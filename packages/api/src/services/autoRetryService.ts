/**
 * Auto-Retry Service
 *
 * Validates task output using the task's validationCommand, then retries
 * with error context if validation fails:
 *   Phase 0: Run validationCommand → PASS → done
 *   Phase 1: Ollama retry with error context → re-validate
 *   Phase 2: Haiku escalation with full context → re-validate
 */

import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../config.js';
import { ExecutorService } from './executor.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationResult {
  success: boolean;
  output: string;
  exit_code: number;  // snake_case from Python API
}

export interface RetryResult {
  validated: boolean;            // true if validation passed (or no validationCommand)
  phase: 'skipped' | 'phase0' | 'phase1' | 'phase2';
  executionResult?: Record<string, unknown>;  // updated result if retried
  finalError?: string;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const AUTO_RETRY_ENABLED = process.env.AUTO_RETRY_ENABLED !== 'false';
const MAX_OLLAMA_RETRIES = parseInt(process.env.AUTO_RETRY_MAX_OLLAMA_RETRIES || '1', 10);
const MAX_HAIKU_RETRIES = parseInt(process.env.AUTO_RETRY_MAX_HAIKU_RETRIES || '1', 10);
const VALIDATION_TIMEOUT_MS = parseInt(process.env.AUTO_RETRY_VALIDATION_TIMEOUT_MS || '15000', 10);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AutoRetryService {
  private executor: ExecutorService;
  private agentsUrl: string;

  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer,
  ) {
    this.executor = new ExecutorService();
    this.agentsUrl = config.agents.url;
  }

  /**
   * Main entry point — validate task output & retry if needed.
   * Called from TaskExecutor.handleTaskCompletion() while locks are still held.
   */
  async validateAndRetry(
    taskId: string,
    originalResult: Record<string, unknown>,
  ): Promise<RetryResult> {
    if (!AUTO_RETRY_ENABLED) {
      return { validated: true, phase: 'skipped', attempts: 0 };
    }

    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task || !task.validationCommand) {
      return { validated: true, phase: 'skipped', attempts: 0 };
    }

    const language = this.detectLanguage(task);
    const validationCmd = task.validationCommand;

    // ── Phase 0: initial validation ──────────────────────────────────────
    this.emitEvent('auto_retry_validation', taskId, { phase: 0, command: validationCmd });

    const phase0 = await this.runValidation(validationCmd, language);
    if (phase0.success) {
      this.emitEvent('auto_retry_result', taskId, { phase: 0, success: true });
      return { validated: true, phase: 'phase0', attempts: 0 };
    }

    console.log(`[AutoRetry] Task ${taskId.substring(0, 8)} failed validation: ${phase0.output.substring(0, 200)}`);

    // Read the failed code for context
    const failedCode = await this.readTaskFile(task);

    // ── Phase 1: Ollama retry with error context ─────────────────────────
    for (let attempt = 1; attempt <= MAX_OLLAMA_RETRIES; attempt++) {
      this.emitEvent('auto_retry_attempt', taskId, { phase: 1, attempt, tier: 'ollama' });
      console.log(`[AutoRetry] Phase 1 attempt ${attempt}/${MAX_OLLAMA_RETRIES} (Ollama) for task ${taskId.substring(0, 8)}`);

      const retryDesc = this.buildRetryDescription(
        task.description || task.title,
        phase0.output,
        failedCode,
        'ollama',
      );

      // Determine Ollama model from complexity
      const cx = task.complexity || 5;
      const ollamaModel = cx >= 9 ? 'qwen2.5-coder:32k'
                        : cx >= 7 ? 'qwen2.5-coder:16k'
                        : 'qwen2.5-coder:8k';

      const execResult = await this.executor.executeTask({
        taskId,
        agentId: task.assignedAgentId || 'coder-01',
        taskDescription: retryDesc,
        expectedOutput: `Fixed code that passes validation`,
        useClaude: false,
        model: ollamaModel,
      });

      if (execResult.success) {
        const revalidation = await this.runValidation(validationCmd, language);
        if (revalidation.success) {
          this.emitEvent('auto_retry_result', taskId, { phase: 1, attempt, success: true });
          console.log(`[AutoRetry] Phase 1 succeeded for task ${taskId.substring(0, 8)} on attempt ${attempt}`);
          return {
            validated: true,
            phase: 'phase1',
            executionResult: { output: execResult.output ?? '', metrics: execResult.metrics ?? {} },
            attempts: attempt,
          };
        }
        // Update failed code for next phase
        console.log(`[AutoRetry] Phase 1 attempt ${attempt} still fails validation: ${revalidation.output.substring(0, 150)}`);
      }
    }

    // ── Phase 2: Haiku escalation ────────────────────────────────────────
    // Re-read file (it may have been updated by Ollama retry)
    const codeAfterPhase1 = await this.readTaskFile(task);
    const latestValidation = await this.runValidation(validationCmd, language);

    for (let attempt = 1; attempt <= MAX_HAIKU_RETRIES; attempt++) {
      this.emitEvent('auto_retry_attempt', taskId, { phase: 2, attempt, tier: 'haiku' });
      console.log(`[AutoRetry] Phase 2 attempt ${attempt}/${MAX_HAIKU_RETRIES} (Haiku) for task ${taskId.substring(0, 8)}`);

      const retryDesc = this.buildRetryDescription(
        task.description || task.title,
        latestValidation.output,
        codeAfterPhase1,
        'haiku',
      );

      const execResult = await this.executor.executeTask({
        taskId,
        agentId: task.assignedAgentId || 'coder-01',
        taskDescription: retryDesc,
        expectedOutput: `Fixed code that passes validation`,
        useClaude: true,
        model: 'anthropic/claude-haiku-4-5-20251001',
      });

      if (execResult.success) {
        const revalidation = await this.runValidation(validationCmd, language);
        if (revalidation.success) {
          this.emitEvent('auto_retry_result', taskId, { phase: 2, attempt, success: true });
          console.log(`[AutoRetry] Phase 2 succeeded for task ${taskId.substring(0, 8)} on attempt ${attempt}`);
          return {
            validated: true,
            phase: 'phase2',
            executionResult: { output: execResult.output ?? '', metrics: execResult.metrics ?? {} },
            attempts: MAX_OLLAMA_RETRIES + attempt,
          };
        }
        console.log(`[AutoRetry] Phase 2 attempt ${attempt} still fails validation: ${revalidation.output.substring(0, 150)}`);
      }
    }

    // All retries exhausted
    const totalAttempts = MAX_OLLAMA_RETRIES + MAX_HAIKU_RETRIES;
    const finalValidation = await this.runValidation(validationCmd, language);
    this.emitEvent('auto_retry_result', taskId, { phase: 2, success: false, totalAttempts });
    console.log(`[AutoRetry] All retries exhausted for task ${taskId.substring(0, 8)} after ${totalAttempts} attempts`);

    return {
      validated: false,
      phase: 'phase2',
      finalError: `Validation failed after ${totalAttempts} retries: ${finalValidation.output.substring(0, 300)}`,
      attempts: totalAttempts,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Call the agents service /run-validation endpoint
   */
  private async runValidation(
    command: string,
    language: string,
  ): Promise<ValidationResult> {
    try {
      const response = await fetch(`${this.agentsUrl}/run-validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          language,
          timeout: Math.floor(VALIDATION_TIMEOUT_MS / 1000),
        }),
      });

      if (!response.ok) {
        return { success: false, output: `Validation endpoint error: ${response.status}`, exit_code: -1 };
      }

      const result = await response.json() as ValidationResult;
      return result;
    } catch (error) {
      return {
        success: false,
        output: `Validation request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        exit_code: -1,
      };
    }
  }

  /**
   * Read the task file from the shared workspace volume
   */
  private async readTaskFile(task: { description: string | null; title: string }): Promise<string> {
    const desc = task.description || task.title;
    // Match file path like tasks/c1_double.py, tasks/foo.js, etc.
    const fileMatch = desc.match(/tasks\/([a-z0-9_]+\.(py|js|ts|go|php))/i);
    if (!fileMatch) return '';

    const workspacePath = process.env.WORKSPACE_PATH || '/app/workspace';
    const filePath = path.join(workspacePath, 'tasks', fileMatch[1]);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return '';
    }
  }

  /**
   * Detect programming language from task description
   */
  private detectLanguage(task: { description: string | null; title: string }): string {
    const desc = (task.description || task.title).toLowerCase();
    if (desc.includes('.js') || desc.includes('javascript')) return 'javascript';
    if (desc.includes('.ts') || desc.includes('typescript')) return 'typescript';
    if (desc.includes('.go') || desc.includes(' go ')) return 'go';
    if (desc.includes('.php') || desc.includes('php')) return 'php';
    return 'python'; // default
  }

  /**
   * Build an enriched retry description with error context
   */
  private buildRetryDescription(
    originalDescription: string,
    validationError: string,
    failedCode: string,
    tier: 'ollama' | 'haiku',
  ): string {
    const codeSection = failedCode
      ? `\n\nThe previous attempt produced this code (which has errors):\n\`\`\`\n${failedCode}\n\`\`\``
      : '';

    const errorSection = `\n\nThe validation failed with this error:\n\`\`\`\n${validationError}\n\`\`\``;

    const fixInstruction = tier === 'haiku'
      ? '\n\nYou are an expert code fixer. Carefully analyze the error and the failed code, then rewrite the ENTIRE file using file_write with the corrected implementation. Make sure the fix addresses the exact error shown above.'
      : '\n\nFix the error shown above. Rewrite the ENTIRE file using file_write with the corrected implementation.';

    return `${originalDescription}${codeSection}${errorSection}${fixInstruction}`;
  }

  /**
   * Emit a WebSocket event for UI feedback
   */
  private emitEvent(event: string, taskId: string, data: Record<string, unknown>): void {
    this.io.emit(event, {
      type: event,
      taskId,
      ...data,
      timestamp: new Date(),
    });
  }
}
