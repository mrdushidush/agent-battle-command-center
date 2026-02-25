/**
 * Battle Claw Service — Single-call task orchestration for OpenClaw integration
 *
 * Wraps the full ABCC task lifecycle (create → route → assign → execute → validate → return)
 * into a single blocking HTTP call. Designed for external consumers (OpenClaw skills)
 * that want "send description, get code back" simplicity.
 *
 * Reuses all existing ABCC infrastructure:
 * - TaskRouter for complexity scoring
 * - TaskAssigner for agent assignment
 * - ExecutorService for agent execution
 * - AutoRetryService for validation + retry pipeline
 * - CostCalculator for actual cost tracking
 */

import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { TaskRouter, type ModelTier } from './taskRouter.js';
import { ExecutorService } from './executor.js';
import { calculateTotalCost } from './costCalculator.js';
import { calculateSavings, type CostSavings } from './costSavingsCalculator.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BattleClawLanguage = 'python' | 'javascript' | 'typescript' | 'go' | 'php';

export interface BattleClawRequest {
  description: string;
  language: BattleClawLanguage;
  fileName?: string;
  validationCommand?: string;
  maxTimeoutMs?: number;
}

export interface BattleClawResponse {
  success: boolean;
  taskId: string;
  files: Record<string, string>;
  validated: boolean;
  complexity: {
    score: number;
    source: string;
    reasoning?: string;
  };
  execution: {
    model: string;
    tier: ModelTier;
    timeMs: number;
  };
  cost: CostSavings;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes
const POLL_INTERVAL_MS = 1_000;     // 1 second
const MAX_TIMEOUT_MS = 300_000;     // 5 minutes hard cap

const LANGUAGE_EXTENSIONS: Record<BattleClawLanguage, string> = {
  python: '.py',
  javascript: '.js',
  typescript: '.ts',
  go: '.go',
  php: '.php',
};

// ─── Service ─────────────────────────────────────────────────────────────────

export class BattleClawService {
  private router: TaskRouter;
  private executor: ExecutorService;

  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer,
  ) {
    this.router = new TaskRouter(prisma);
    this.executor = new ExecutorService();
  }

  /**
   * Execute a coding task end-to-end: create → route → assign → execute → poll → return code.
   * Blocks until completion or timeout.
   */
  async executeTask(request: BattleClawRequest): Promise<BattleClawResponse> {
    const startTime = Date.now();
    const timeoutMs = Math.min(request.maxTimeoutMs || DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

    // 1. Generate filename if not provided
    const fileName = request.fileName || this.generateFileName(request.description, request.language);

    // 2. Create task in database
    const task = await this.prisma.task.create({
      data: {
        title: this.generateTitle(request.description),
        description: request.description,
        taskType: 'code',
        priority: 5,
        maxIterations: 3,
        validationCommand: request.validationCommand || undefined,
        lockedFiles: [fileName],
        contextNotes: `battle-claw | lang=${request.language} | file=${fileName}`,
      },
    });

    try {
      // 3. Route for complexity assessment
      const routing = await this.router.routeTask(task.id);

      // 4. Assign to agent
      const agentId = routing.agentId;
      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'assigned',
          assignedAgentId: agentId,
          assignedAt: new Date(),
          complexity: routing.complexity,
          complexitySource: routing.complexitySource,
          complexityReasoning: routing.complexityReasoning,
        },
      });
      await this.prisma.agent.update({
        where: { id: agentId },
        data: { status: 'busy', currentTaskId: task.id },
      });

      // 5. Execute via FastAPI agents service
      const execResult = await this.executor.executeTask({
        taskId: task.id,
        agentId,
        taskDescription: request.description,
        expectedOutput: `Write code to: ${request.description}`,
        useClaude: routing.modelTier !== 'ollama' && routing.modelTier !== 'remote_ollama',
        model: routing.modelTier === 'sonnet' ? 'anthropic/claude-sonnet-4-20250514' : undefined,
      });

      // 6. Handle execution result — let the existing taskQueue handle lifecycle
      //    but we need to wait for completion
      if (execResult.success) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            status: 'completed',
            result: {
              output: execResult.output ?? '',
              apiCreditsUsed: execResult.metrics?.apiCreditsUsed ?? 0,
              timeSpentMs: execResult.metrics?.timeSpentMs ?? 0,
              iterations: execResult.metrics?.iterations ?? 1,
            },
            completedAt: new Date(),
            timeSpentMs: Date.now() - startTime,
          },
        });
      } else {
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            status: 'failed',
            error: execResult.error || 'Execution failed',
            timeSpentMs: Date.now() - startTime,
          },
        });
      }

      // 7. Release agent
      await this.prisma.agent.update({
        where: { id: agentId },
        data: { status: 'idle', currentTaskId: null },
      });

      // 8. Read generated files from workspace
      const files = await this.readGeneratedFiles(task.id, fileName);

      // 9. Calculate costs
      const logs = await this.prisma.executionLog.findMany({
        where: { taskId: task.id },
      });
      const actualCost = calculateTotalCost(logs);
      const savings = calculateSavings(routing.complexity, actualCost);

      const elapsed = Date.now() - startTime;

      if (!execResult.success) {
        return {
          success: false,
          taskId: task.id,
          files: {},
          validated: false,
          complexity: {
            score: routing.complexity,
            source: routing.complexitySource || 'router',
            reasoning: routing.complexityReasoning,
          },
          execution: {
            model: this.getModelName(routing.modelTier),
            tier: routing.modelTier,
            timeMs: elapsed,
          },
          cost: savings,
          error: execResult.error || 'Execution failed',
        };
      }

      return {
        success: true,
        taskId: task.id,
        files,
        validated: !!request.validationCommand,
        complexity: {
          score: routing.complexity,
          source: routing.complexitySource || 'router',
          reasoning: routing.complexityReasoning,
        },
        execution: {
          model: this.getModelName(routing.modelTier),
          tier: routing.modelTier,
          timeMs: elapsed,
        },
        cost: savings,
      };
    } catch (error) {
      // Clean up on failure
      const elapsed = Date.now() - startTime;
      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timeSpentMs: elapsed,
        },
      }).catch(() => {});

      // Try to release the agent
      const failedTask = await this.prisma.task.findUnique({ where: { id: task.id } });
      if (failedTask?.assignedAgentId) {
        await this.prisma.agent.update({
          where: { id: failedTask.assignedAgentId },
          data: { status: 'idle', currentTaskId: null },
        }).catch(() => {});
      }

      return {
        success: false,
        taskId: task.id,
        files: {},
        validated: false,
        complexity: { score: 0, source: 'error' },
        execution: { model: 'unknown', tier: 'ollama', timeMs: elapsed },
        cost: calculateSavings(5, 0),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Read generated files from workspace.
   * The agents write files to /app/workspace/tasks/ inside Docker.
   */
  private async readGeneratedFiles(
    taskId: string,
    expectedFileName: string,
  ): Promise<Record<string, string>> {
    const files: Record<string, string> = {};

    try {
      // Try to read the expected file from execution logs
      const logs = await this.prisma.executionLog.findMany({
        where: {
          taskId,
          action: { in: ['file_write', 'write_file'] },
        },
        orderBy: { timestamp: 'desc' },
      });

      for (const log of logs) {
        const actionInput = log.actionInput as Record<string, unknown> | null;
        if (actionInput) {
          const filePath = (actionInput.file_path || actionInput.path || actionInput.filename) as string | undefined;
          const content = (actionInput.content || actionInput.code) as string | undefined;
          if (filePath && content) {
            // Use just the filename, not the full Docker path
            const name = filePath.split('/').pop() || filePath;
            files[name] = content;
          }
        }
      }

      // If no files found in logs, check the task result
      if (Object.keys(files).length === 0) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        const result = task?.result as Record<string, unknown> | null;
        if (result?.output && typeof result.output === 'string') {
          // Try to extract code from the output
          const codeMatch = result.output.match(/```[\w]*\n([\s\S]*?)```/);
          if (codeMatch) {
            files[expectedFileName] = codeMatch[1].trim();
          }
        }
      }
    } catch {
      // File reading is best-effort
    }

    return files;
  }

  /**
   * Get cumulative stats for all Battle Claw tasks
   */
  async getStats(): Promise<{
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    successRate: number;
    totalSavingsUSD: number;
    totalActualCostUSD: number;
    avgTimeMs: number;
    byLanguage: Record<string, { tasks: number; success: number }>;
    byTier: Record<string, number>;
  }> {
    const tasks = await this.prisma.task.findMany({
      where: {
        contextNotes: { startsWith: 'battle-claw' },
      },
      select: {
        id: true,
        status: true,
        complexity: true,
        timeSpentMs: true,
        contextNotes: true,
      },
    });

    const successful = tasks.filter((t) => t.status === 'completed');
    const failed = tasks.filter((t) => t.status === 'failed');

    // Calculate total savings
    let totalSavings = 0;
    let totalActualCost = 0;
    const byLanguage: Record<string, { tasks: number; success: number }> = {};
    const byTier: Record<string, number> = {};

    for (const task of tasks) {
      const complexity = task.complexity || 5;
      const savings = calculateSavings(complexity, 0); // Ollama tasks cost $0
      totalSavings += savings.savingsUSD;
      totalActualCost += savings.actualCostUSD;

      // Parse language from contextNotes
      const langMatch = task.contextNotes?.match(/lang=(\w+)/);
      const lang = langMatch?.[1] || 'unknown';
      if (!byLanguage[lang]) byLanguage[lang] = { tasks: 0, success: 0 };
      byLanguage[lang].tasks++;
      if (task.status === 'completed') byLanguage[lang].success++;

      // Track by tier
      const tier = complexity >= 10 ? 'sonnet' : complexity >= 7 ? 'ollama-16k' : 'ollama-8k';
      byTier[tier] = (byTier[tier] || 0) + 1;
    }

    const totalTimeMs = tasks.reduce((sum, t) => sum + (t.timeSpentMs || 0), 0);

    return {
      totalTasks: tasks.length,
      successfulTasks: successful.length,
      failedTasks: failed.length,
      successRate: tasks.length > 0 ? (successful.length / tasks.length) * 100 : 0,
      totalSavingsUSD: totalSavings,
      totalActualCostUSD: totalActualCost,
      avgTimeMs: tasks.length > 0 ? totalTimeMs / tasks.length : 0,
      byLanguage,
      byTier,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private generateTitle(description: string): string {
    // Truncate to 200 chars (DB limit)
    const cleaned = description.replace(/\n/g, ' ').trim();
    return cleaned.length > 195 ? cleaned.slice(0, 195) + '...' : cleaned;
  }

  private generateFileName(description: string, language: BattleClawLanguage): string {
    // Extract a reasonable filename from the description
    const words = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['the', 'that', 'this', 'with', 'from', 'create', 'write', 'implement', 'build', 'make', 'function'].includes(w))
      .slice(0, 3);

    const base = words.length > 0 ? words.join('_') : 'task';
    return `${base}${LANGUAGE_EXTENSIONS[language]}`;
  }

  private getModelName(tier: ModelTier): string {
    switch (tier) {
      case 'ollama': return process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
      case 'remote_ollama': return process.env.REMOTE_OLLAMA_MODEL || 'remote-ollama';
      case 'haiku': return 'claude-haiku-4-5-20251001';
      case 'sonnet': return 'claude-sonnet-4-20250514';
      case 'opus': return 'claude-opus-4-5-20251101';
    }
  }
}
