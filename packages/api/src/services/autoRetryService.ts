/**
 * Auto-Retry Service
 *
 * Validates task output using the task's validationCommand, then retries
 * with error context if validation fails:
 *   Phase 0: Run validationCommand → PASS → done
 *   Phase 1: Local Ollama retry with error context → re-validate
 *   Phase 2: Remote Ollama retry (if configured) → re-validate
 *   Phase 3: Haiku escalation with full context → re-validate
 */

import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { promises as fs } from 'fs';
import path from 'path';
import { config, agentsHeaders } from '../config.js';
import { createLogger } from '../logger.js';
import { ExecutorService } from './executor.js';
import { isRemoteOllamaEnabled, getRemoteModelForComplexity } from './resourcePool.js';

const log = createLogger('AutoRetry');

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
  phase: 'skipped' | 'phase0' | 'phase1' | 'phase2' | 'phase3';
  executionResult?: Record<string, unknown>;  // updated result if retried
  finalError?: string;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const AUTO_RETRY_ENABLED = process.env.AUTO_RETRY_ENABLED !== 'false';
const MAX_OLLAMA_RETRIES = parseInt(process.env.AUTO_RETRY_MAX_OLLAMA_RETRIES || '1', 10);
const MAX_REMOTE_RETRIES = parseInt(process.env.AUTO_RETRY_MAX_REMOTE_RETRIES || '1', 10);
const MAX_HAIKU_RETRIES = parseInt(process.env.AUTO_RETRY_MAX_HAIKU_RETRIES || '1', 10);
const VALIDATION_TIMEOUT_MS = parseInt(process.env.AUTO_RETRY_VALIDATION_TIMEOUT_MS || '15000', 10);
// Hard limit: prevent infinite retry loops (Mar 2, 2026 fix)
const MAX_TOTAL_RETRIES = 3;

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

    log.info('Task failed validation', { taskId: taskId.substring(0, 8), output: phase0.output.substring(0, 200) });

    // Read the failed code for context
    const failedCode = await this.readTaskFile(task);

    // Track total retries across all phases (Mar 2, 2026 fix for infinite loops)
    let totalRetries = 0;

    // ── Phase 1: Ollama retry with error context ─────────────────────────
    for (let attempt = 1; attempt <= MAX_OLLAMA_RETRIES; attempt++) {
      // Hard limit: stop if we've exhausted max total retries
      if (totalRetries >= MAX_TOTAL_RETRIES) {
        log.warn('Reached max total retries - aborting retry loop', { maxTotalRetries: MAX_TOTAL_RETRIES });
        break;
      }
      totalRetries++;
      this.emitEvent('auto_retry_attempt', taskId, { phase: 1, attempt, tier: 'ollama' });
      log.info('Phase 1 attempt (Ollama)', { attempt, maxAttempts: MAX_OLLAMA_RETRIES, taskId: taskId.substring(0, 8) });

      const retryDesc = this.buildRetryDescription(
        task.description || task.title,
        phase0.output,
        failedCode,
        'ollama',
      );

      // Determine Ollama model from complexity (16K default, 32K for C7+, 8K deprecated)
      const cx = task.complexity || 5;
      const ollamaModel = cx >= 7 ? 'qwen2.5-coder:32k' : 'qwen2.5-coder:16k';

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
          log.info('Phase 1 succeeded', { taskId: taskId.substring(0, 8), attempt });
          return {
            validated: true,
            phase: 'phase1',
            executionResult: { output: execResult.output ?? '', metrics: execResult.metrics ?? {} },
            attempts: attempt,
          };
        }
        // Update failed code for next phase
        log.info('Phase 1 attempt still fails validation', { attempt, output: revalidation.output.substring(0, 150) });
      }
    }

    // ── Phase 2: Remote Ollama retry (if configured) ─────────────────────
    let attemptsAfterPhase1 = MAX_OLLAMA_RETRIES;
    const remoteEnabled = isRemoteOllamaEnabled();

    if (remoteEnabled) {
      const codeAfterPhase1 = await this.readTaskFile(task);
      const phase1Validation = await this.runValidation(validationCmd, language);

      for (let attempt = 1; attempt <= MAX_REMOTE_RETRIES; attempt++) {
        // Hard limit: stop if we've exhausted max total retries
        if (totalRetries >= MAX_TOTAL_RETRIES) {
          log.warn('Reached max total retries - skipping Phase 2', { maxTotalRetries: MAX_TOTAL_RETRIES });
          break;
        }
        totalRetries++;
        this.emitEvent('auto_retry_attempt', taskId, { phase: 2, attempt, tier: 'remote' });
        log.info('Phase 2 attempt (Remote Ollama)', { attempt, maxAttempts: MAX_REMOTE_RETRIES, taskId: taskId.substring(0, 8) });

        const retryDesc = this.buildRetryDescription(
          task.description || task.title,
          phase1Validation.output,
          codeAfterPhase1,
          'remote',
        );

        const remoteModel = getRemoteModelForComplexity(task.complexity || 7);
        const execResult = await this.executor.executeTask({
          taskId,
          agentId: task.assignedAgentId || 'coder-01',
          taskDescription: retryDesc,
          expectedOutput: `Fixed code that passes validation`,
          useClaude: false,
          model: remoteModel,
          env: { OLLAMA_API_BASE: process.env.REMOTE_OLLAMA_URL || '' },
        });

        if (execResult.success) {
          const revalidation = await this.runValidation(validationCmd, language);
          if (revalidation.success) {
            this.emitEvent('auto_retry_result', taskId, { phase: 2, attempt, success: true });
            log.info('Phase 2 (Remote) succeeded', { taskId: taskId.substring(0, 8), attempt });
            return {
              validated: true,
              phase: 'phase2',
              executionResult: { output: execResult.output ?? '', metrics: execResult.metrics ?? {} },
              attempts: MAX_OLLAMA_RETRIES + attempt,
            };
          }
          log.info('Phase 2 attempt still fails validation', { attempt, output: revalidation.output.substring(0, 150) });
        }
      }
      attemptsAfterPhase1 = MAX_OLLAMA_RETRIES + MAX_REMOTE_RETRIES;
    }

    // ── Phase 3: Haiku escalation ────────────────────────────────────────
    // Re-read file (it may have been updated by previous retries)
    const codeAfterPreviousPhases = await this.readTaskFile(task);
    const latestValidation = await this.runValidation(validationCmd, language);

    // Check if we've hit the max retry limit before starting Phase 3
    if (totalRetries >= MAX_TOTAL_RETRIES) {
      log.warn('Reached max total retries - skipping Phase 3 escalation', { maxTotalRetries: MAX_TOTAL_RETRIES });
      return {
        validated: false,
        phase: 'phase3',
        finalError: `Max retries exceeded after ${totalRetries} attempts`,
        attempts: totalRetries,
      };
    }

    for (let attempt = 1; attempt <= MAX_HAIKU_RETRIES; attempt++) {
      // Hard limit: stop if we've exhausted max total retries
      if (totalRetries >= MAX_TOTAL_RETRIES) {
        log.warn('Reached max total retries - aborting Phase 3', { maxTotalRetries: MAX_TOTAL_RETRIES });
        break;
      }
      totalRetries++;
      this.emitEvent('auto_retry_attempt', taskId, { phase: 3, attempt, tier: 'haiku' });
      log.info('Phase 3 attempt (Haiku)', { attempt, maxAttempts: MAX_HAIKU_RETRIES, taskId: taskId.substring(0, 8) });

      const retryDesc = this.buildRetryDescription(
        task.description || task.title,
        latestValidation.output,
        codeAfterPreviousPhases,
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
          this.emitEvent('auto_retry_result', taskId, { phase: 3, attempt, success: true });
          log.info('Phase 3 succeeded', { taskId: taskId.substring(0, 8), attempt });
          return {
            validated: true,
            phase: 'phase3',
            executionResult: { output: execResult.output ?? '', metrics: execResult.metrics ?? {} },
            attempts: attemptsAfterPhase1 + attempt,
          };
        }
        log.info('Phase 3 attempt still fails validation', { attempt, output: revalidation.output.substring(0, 150) });
      }
    }

    // All retries exhausted
    const totalAttempts = attemptsAfterPhase1 + MAX_HAIKU_RETRIES;
    const finalValidation = await this.runValidation(validationCmd, language);
    this.emitEvent('auto_retry_result', taskId, { phase: 3, success: false, totalAttempts });
    log.warn('All retries exhausted', { taskId: taskId.substring(0, 8), totalAttempts });

    return {
      validated: false,
      phase: 'phase3',
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
        headers: agentsHeaders(),
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
    tier: 'ollama' | 'remote' | 'haiku',
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
