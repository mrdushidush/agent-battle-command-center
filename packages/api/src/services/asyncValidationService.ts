/**
 * Async Validation Service
 *
 * Decouples validation from task completion. The agent is released immediately,
 * validation runs in background, and retries are deferred to a separate batch phase.
 *
 * Flow:
 *   handleTaskCompletion() → release agent → validateInBackground(taskId)
 *                                                  ↓
 *                                       POST /run-validation
 *                                           ↓         ↓
 *                                         PASS      FAIL → add to retryQueue
 *
 *   After all tasks: processRetryQueue() → Phase 1 Ollama → Phase 2 Haiku
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
  exit_code: number;
}

export interface TaskValidationResult {
  taskId: string;
  passed: boolean;
  error?: string;
  validatedAt: Date;
  retryPhase?: string;
  retryAttempts?: number;
}

interface RetryQueueEntry {
  taskId: string;
  validationError: string;
  validationCommand: string;
  language: string;
  failedCode: string;
  description: string;
  complexity: number;
  agentId: string;
}

export interface RetryQueueResults {
  retried: number;
  saved: number;
  stillFailing: number;
  details: Array<{
    taskId: string;
    savedAt?: string;
    finalError?: string;
  }>;
}

export interface AsyncValidationStatus {
  pending: number;
  passed: number;
  failed: number;
  retryQueueSize: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ASYNC_VALIDATION_ENABLED = process.env.ASYNC_VALIDATION_ENABLED !== 'false';
const MAX_OLLAMA_RETRIES = parseInt(process.env.AUTO_RETRY_MAX_OLLAMA_RETRIES || '1', 10);
const MAX_HAIKU_RETRIES = parseInt(process.env.AUTO_RETRY_MAX_HAIKU_RETRIES || '1', 10);
const VALIDATION_TIMEOUT_MS = parseInt(process.env.AUTO_RETRY_VALIDATION_TIMEOUT_MS || '15000', 10);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AsyncValidationService {
  private validationResults: Map<string, TaskValidationResult> = new Map();
  private retryQueue: RetryQueueEntry[] = [];
  private pendingCount = 0;
  private retryInProgress = false;
  private lastRetryResults: RetryQueueResults | null = null;
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
   * Fire-and-forget — called from handleTaskCompletion after agent release.
   * Returns void; errors are caught internally.
   */
  validateInBackground(taskId: string): void {
    if (!ASYNC_VALIDATION_ENABLED) return;

    this.pendingCount++;
    this._doValidation(taskId)
      .catch((err) => {
        console.error(`[AsyncValidation] Unexpected error validating ${taskId.substring(0, 8)}:`, err);
        this.validationResults.set(taskId, {
          taskId,
          passed: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          validatedAt: new Date(),
        });
      })
      .finally(() => {
        this.pendingCount--;
      });
  }

  /**
   * Fire-and-forget retry queue processing. Returns immediately so HTTP
   * requests don't time out. Poll getStatus()/getLastRetryResults() for progress.
   */
  startRetryQueue(): { started: boolean; count: number } {
    if (this.retryInProgress) {
      return { started: false, count: 0 };
    }
    const count = this.retryQueue.length;
    if (count === 0) {
      return { started: false, count: 0 };
    }
    this.retryInProgress = true;
    this.lastRetryResults = null;
    this.processRetryQueue()
      .then((results) => {
        this.lastRetryResults = results;
        this.retryInProgress = false;
        console.log(`[AsyncValidation] Retry queue complete: ${results.saved}/${results.retried} saved`);
      })
      .catch((err) => {
        console.error('[AsyncValidation] Retry queue error:', err);
        this.retryInProgress = false;
      });
    return { started: true, count };
  }

  /** Get results from the last completed retry run */
  getLastRetryResults(): RetryQueueResults | null {
    return this.lastRetryResults;
  }

  /** Whether the retry queue is currently processing */
  isRetrying(): boolean {
    return this.retryInProgress;
  }

  /**
   * Process the retry queue — called explicitly after all primary tasks complete.
   * Phase 1: Ollama retry with error context → validate
   * Phase 2: Haiku escalation → validate
   */
  async processRetryQueue(): Promise<RetryQueueResults> {
    const results: RetryQueueResults = {
      retried: this.retryQueue.length,
      saved: 0,
      stillFailing: 0,
      details: [],
    };

    const queue = [...this.retryQueue];
    this.retryQueue = [];

    for (const entry of queue) {
      const shortId = entry.taskId.substring(0, 8);
      let saved = false;

      // Phase 1: Ollama retry
      for (let attempt = 1; attempt <= MAX_OLLAMA_RETRIES; attempt++) {
        this.emitEvent('auto_retry_attempt', entry.taskId, { phase: 1, attempt, tier: 'ollama' });
        console.log(`[AsyncValidation] Retry Phase 1 attempt ${attempt}/${MAX_OLLAMA_RETRIES} (Ollama) for ${shortId}`);

        const retryDesc = this.buildRetryDescription(entry.description, entry.validationError, entry.failedCode, 'ollama');
        const cx = entry.complexity || 5;
        const ollamaModel = cx >= 9 ? 'qwen2.5-coder:32k'
                          : cx >= 7 ? 'qwen2.5-coder:16k'
                          : 'qwen2.5-coder:8k';

        const execResult = await this.executor.executeTask({
          taskId: entry.taskId,
          agentId: entry.agentId,
          taskDescription: retryDesc,
          expectedOutput: 'Fixed code that passes validation',
          useClaude: false,
          model: ollamaModel,
        });

        if (execResult.success) {
          const revalidation = await this.runValidation(entry.validationCommand, entry.language);
          if (revalidation.success) {
            this.emitEvent('auto_retry_result', entry.taskId, { phase: 1, attempt, success: true });
            console.log(`[AsyncValidation] Phase 1 saved ${shortId} on attempt ${attempt}`);
            this.validationResults.set(entry.taskId, {
              taskId: entry.taskId,
              passed: true,
              validatedAt: new Date(),
              retryPhase: 'phase1',
              retryAttempts: attempt,
            });
            results.saved++;
            results.details.push({ taskId: entry.taskId, savedAt: 'phase1' });
            saved = true;
            break;
          }
        }
      }

      if (saved) continue;

      // Re-read file after Ollama retry (it may have been updated)
      const codeAfterPhase1 = await this.readTaskFile(entry.description);
      const latestValidation = await this.runValidation(entry.validationCommand, entry.language);

      // Phase 2: Haiku escalation
      for (let attempt = 1; attempt <= MAX_HAIKU_RETRIES; attempt++) {
        this.emitEvent('auto_retry_attempt', entry.taskId, { phase: 2, attempt, tier: 'haiku' });
        console.log(`[AsyncValidation] Retry Phase 2 attempt ${attempt}/${MAX_HAIKU_RETRIES} (Haiku) for ${shortId}`);

        const retryDesc = this.buildRetryDescription(
          entry.description,
          latestValidation.output,
          codeAfterPhase1,
          'haiku',
        );

        const execResult = await this.executor.executeTask({
          taskId: entry.taskId,
          agentId: entry.agentId,
          taskDescription: retryDesc,
          expectedOutput: 'Fixed code that passes validation',
          useClaude: true,
          model: 'anthropic/claude-haiku-4-5-20251001',
        });

        if (execResult.success) {
          const revalidation = await this.runValidation(entry.validationCommand, entry.language);
          if (revalidation.success) {
            this.emitEvent('auto_retry_result', entry.taskId, { phase: 2, attempt, success: true });
            console.log(`[AsyncValidation] Phase 2 saved ${shortId} on attempt ${attempt}`);
            this.validationResults.set(entry.taskId, {
              taskId: entry.taskId,
              passed: true,
              validatedAt: new Date(),
              retryPhase: 'phase2',
              retryAttempts: MAX_OLLAMA_RETRIES + attempt,
            });
            results.saved++;
            results.details.push({ taskId: entry.taskId, savedAt: 'phase2' });
            saved = true;
            break;
          }
        }
      }

      if (!saved) {
        const finalValidation = await this.runValidation(entry.validationCommand, entry.language);
        this.emitEvent('auto_retry_result', entry.taskId, { phase: 2, success: false });
        console.log(`[AsyncValidation] All retries exhausted for ${shortId}`);
        this.validationResults.set(entry.taskId, {
          taskId: entry.taskId,
          passed: false,
          error: finalValidation.output.substring(0, 300),
          validatedAt: new Date(),
          retryPhase: 'exhausted',
          retryAttempts: MAX_OLLAMA_RETRIES + MAX_HAIKU_RETRIES,
        });
        results.stillFailing++;
        results.details.push({ taskId: entry.taskId, finalError: finalValidation.output.substring(0, 200) });
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // REST API helpers
  // ---------------------------------------------------------------------------

  getResults(): TaskValidationResult[] {
    return Array.from(this.validationResults.values());
  }

  getResult(taskId: string): TaskValidationResult | undefined {
    return this.validationResults.get(taskId);
  }

  getStatus(): AsyncValidationStatus & { retryInProgress: boolean } {
    let passed = 0;
    let failed = 0;
    for (const r of this.validationResults.values()) {
      if (r.passed) passed++;
      else failed++;
    }
    return {
      pending: this.pendingCount,
      passed,
      failed,
      retryQueueSize: this.retryQueue.length,
      retryInProgress: this.retryInProgress,
      total: this.validationResults.size + this.pendingCount,
    };
  }

  hasPendingValidations(): boolean {
    return this.pendingCount > 0;
  }

  clearResults(): void {
    this.validationResults.clear();
    this.retryQueue = [];
    this.pendingCount = 0;
    this.retryInProgress = false;
    this.lastRetryResults = null;
  }

  // ---------------------------------------------------------------------------
  // Internal validation logic
  // ---------------------------------------------------------------------------

  private async _doValidation(taskId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task || !task.validationCommand) {
      // No validation command — auto-pass
      this.validationResults.set(taskId, {
        taskId,
        passed: true,
        validatedAt: new Date(),
      });
      return;
    }

    const { language, cleanCommand } = this.extractLanguageFromCommand(task.validationCommand);

    this.emitEvent('task_validating', taskId, { command: cleanCommand });

    const result = await this.runValidation(cleanCommand, language);

    if (result.success) {
      this.emitEvent('task_validated', taskId, { success: true });
      this.validationResults.set(taskId, {
        taskId,
        passed: true,
        validatedAt: new Date(),
      });
    } else {
      this.emitEvent('task_validation_failed', taskId, { error: result.output.substring(0, 200) });
      console.log(`[AsyncValidation] Task ${taskId.substring(0, 8)} failed validation: ${result.output.substring(0, 200)}`);

      // Read failed code for retry context
      const failedCode = await this.readTaskFile(task.description || task.title);

      this.validationResults.set(taskId, {
        taskId,
        passed: false,
        error: result.output.substring(0, 300),
        validatedAt: new Date(),
      });

      // Add to retry queue
      this.retryQueue.push({
        taskId,
        validationError: result.output,
        validationCommand: cleanCommand,
        language,
        failedCode,
        description: task.description || task.title,
        complexity: task.complexity || 5,
        agentId: task.assignedAgentId || 'coder-01',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers (reused from AutoRetryService)
  // ---------------------------------------------------------------------------

  private async runValidation(command: string, language: string): Promise<ValidationResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS + 5_000); // 5s grace beyond inner timeout
    try {
      const response = await fetch(`${this.agentsUrl}/run-validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          language,
          timeout: Math.floor(VALIDATION_TIMEOUT_MS / 1000),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { success: false, output: `Validation endpoint error: ${response.status}`, exit_code: -1 };
      }

      return await response.json() as ValidationResult;
    } catch (error) {
      return {
        success: false,
        output: `Validation request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        exit_code: -1,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async readTaskFile(description: string): Promise<string> {
    const fileMatch = description.match(/tasks\/([a-z0-9_/]+\.(py|js|ts|go|php|jsx|html|css))/i);
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
   * Extract language from LANG=xxx prefix in validationCommand, falling back
   * to description-based detection if no prefix is present.
   */
  private extractLanguageFromCommand(command: string): { language: string; cleanCommand: string } {
    const langMatch = command.match(/^LANG=(\w+)\s/);
    if (langMatch) {
      return { language: langMatch[1], cleanCommand: command.substring(langMatch[0].length) };
    }
    // Fallback: no prefix — return as-is with 'python' default
    return { language: 'python', cleanCommand: command };
  }

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

  private emitEvent(event: string, taskId: string, data: Record<string, unknown>): void {
    this.io.emit(event, {
      type: event,
      taskId,
      ...data,
      timestamp: new Date(),
    });
  }
}
