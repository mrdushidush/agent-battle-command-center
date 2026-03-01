/**
 * Orchestrator Service — Mission-based task decomposition & execution
 *
 * Pipeline:
 *   1. Create Mission record
 *   2. POST agents:8000/orchestrate/decompose (Sonnet)
 *   3. Create Task records per subtask (linked via missionId)
 *   4. Sequential execution: route → assign → execute → auto-retry per subtask
 *   5. POST agents:8000/orchestrate/review (Sonnet)
 *   6. Status → awaiting_approval (or auto-approve)
 *
 * Reuses existing infrastructure: TaskRouter, ExecutorService, AutoRetryService
 */

import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { TaskRouter, type ModelTier } from './taskRouter.js';
import { ExecutorService } from './executor.js';
import { AutoRetryService } from './autoRetryService.js';
import { calculateTotalCost } from './costCalculator.js';
import { calculateSavings } from './costSavingsCalculator.js';
import { config } from '../config.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StartMissionParams {
  prompt: string;
  language?: string;
  autoApprove?: boolean;
  conversationId?: string;
}

interface SubtaskPlan {
  title: string;
  description: string;
  file_name: string;
  validation_command: string;
  complexity: number;
  language: string;
}

interface SubtaskResult {
  title: string;
  file_name: string;
  validation_passed: boolean;
  code?: string;
  error?: string;
}

interface MissionFiles {
  [fileName: string]: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AGENTS_URL = config.agents.url;
const DECOMPOSE_TIMEOUT_MS = parseInt(process.env.DECOMPOSE_TIMEOUT_MS || '300000', 10);  // 5 min default
const REVIEW_TIMEOUT_MS = parseInt(process.env.REVIEW_TIMEOUT_MS || '300000', 10);        // 5 min default
const SUBTASK_TIMEOUT_MS = 600_000; // 10 min per subtask
const SUBTASK_REST_DELAY_MS = 3_000;     // 3s rest between subtasks (prevents Ollama context pollution)
const SUBTASK_EXTENDED_REST_MS = 8_000;  // 8s extended rest every 5th subtask
const SUBTASK_REST_EVERY_N = 5;          // Trigger extended rest interval

// ─── Service ────────────────────────────────────────────────────────────────

export class OrchestratorService {
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
   * Start a new mission. Creates Mission record and kicks off runMission() in background.
   * Returns the missionId immediately (non-blocking).
   */
  async startMission(params: StartMissionParams): Promise<string> {
    const mission = await this.prisma.mission.create({
      data: {
        prompt: params.prompt,
        language: params.language || 'python',
        autoApprove: params.autoApprove || false,
        conversationId: params.conversationId || null,
        status: 'decomposing',
      },
    });

    // Post initial status to chat
    if (params.conversationId) {
      await this.postToChat(params.conversationId, '🔍 Analyzing your request and planning subtasks...');
    }

    // Emit mission_started
    this.emitMissionEvent('mission_started', { id: mission.id, status: 'decomposing', prompt: params.prompt });

    // Run pipeline in background (don't await)
    this.runMission(mission.id).catch((err) => {
      console.error(`[Orchestrator] Mission ${mission.id} failed:`, err);
    });

    return mission.id;
  }

  /**
   * Main pipeline — runs in background after startMission().
   */
  private async runMission(missionId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const mission = await this.prisma.mission.findUniqueOrThrow({ where: { id: missionId } });

      // ── Step 1: Decompose ─────────────────────────────────────────────
      const subtasks = await this.decompose(mission.prompt, mission.language);

      if (subtasks.length === 0) {
        throw new Error('Decomposition returned 0 subtasks');
      }

      // Save plan to mission
      await this.prisma.mission.update({
        where: { id: missionId },
        data: {
          plan: subtasks as unknown as object,
          subtaskCount: subtasks.length,
          status: 'executing',
        },
      });

      // Post plan to chat
      if (mission.conversationId) {
        const planText = subtasks
          .map((st, i) => `${i + 1}. **${st.title}** (C${st.complexity}) → \`${st.file_name}\``)
          .join('\n');
        await this.postToChat(
          mission.conversationId,
          `📋 **Plan: ${subtasks.length} subtasks**\n\n${planText}\n\n⏳ Starting execution...`,
        );
      }

      this.emitMissionEvent('mission_decomposed', {
        id: missionId,
        subtaskCount: subtasks.length,
        plan: subtasks,
      });

      // ── Step 2: Create Task records ───────────────────────────────────
      const taskIds: string[] = [];
      for (const st of subtasks) {
        const task = await this.prisma.task.create({
          data: {
            title: st.title.slice(0, 200),
            description: st.description,
            taskType: 'code',
            priority: 5,
            maxIterations: 3,
            validationCommand: st.validation_command,
            lockedFiles: [st.file_name],
            contextNotes: `mission:${missionId} | lang=${st.language} | file=${st.file_name}`,
            missionId,
          },
        });
        taskIds.push(task.id);

        // Emit so UI sees the task
        this.io.emit('task_created', { type: 'task_created', payload: task, timestamp: new Date() });
      }

      // ── Step 3: Sequential execution ──────────────────────────────────
      const results: SubtaskResult[] = [];

      for (let i = 0; i < taskIds.length; i++) {
        const taskId = taskIds[i];
        const plan = { ...subtasks[i] };  // Clone so we can augment description

        // ── Fix 4: Pass inter-subtask context ────────────────────────
        // Append code from completed subtasks so later files can reference earlier ones
        const prevContext = results
          .filter((r) => r.validation_passed && r.code)
          .map((r) => `--- ${r.file_name} ---\n${r.code}`)
          .join('\n\n');
        if (prevContext) {
          plan.description += `\n\nAlready-written files (reference these, do NOT rewrite):\n${prevContext}`;
        }

        this.emitMissionEvent('mission_subtask_started', {
          missionId,
          taskId,
          index: i,
          total: taskIds.length,
          title: plan.title,
        });

        const result = await this.executeSingleSubtask(taskId, plan, missionId);
        results.push(result);

        // Update mission counters
        if (result.validation_passed) {
          await this.prisma.mission.update({
            where: { id: missionId },
            data: { completedCount: { increment: 1 } },
          });
        } else {
          await this.prisma.mission.update({
            where: { id: missionId },
            data: { failedCount: { increment: 1 } },
          });
        }

        this.emitMissionEvent('mission_subtask_completed', {
          missionId,
          taskId,
          index: i,
          total: taskIds.length,
          title: plan.title,
          passed: result.validation_passed,
          error: result.error,
          fileName: result.file_name,
          code: result.code,
          language: subtasks[i].language,
        });

        // Post progress to chat
        if (mission.conversationId) {
          const icon = result.validation_passed ? '✅' : '❌';
          await this.postToChat(
            mission.conversationId,
            `${icon} [${i + 1}/${taskIds.length}] ${result.validation_passed ? 'PASS' : 'FAIL'}: ${plan.title}`,
          );
        }

        // ── Fix 2: Rest delays between subtasks ──────────────────────
        // Prevents Ollama context pollution that causes syntax errors in later subtasks
        if (i < taskIds.length - 1) {
          const isExtendedRest = (i + 1) % SUBTASK_REST_EVERY_N === 0;
          const restMs = isExtendedRest ? SUBTASK_EXTENDED_REST_MS : SUBTASK_REST_DELAY_MS;
          console.log(`[Orchestrator] Subtask ${i + 1}/${taskIds.length} done, resting ${restMs}ms${isExtendedRest ? ' (extended)' : ''}`);
          await new Promise((resolve) => setTimeout(resolve, restMs));
        }
      }

      // ── Step 4: Review ────────────────────────────────────────────────
      await this.prisma.mission.update({
        where: { id: missionId },
        data: { status: 'reviewing' },
      });

      const review = await this.reviewMission(mission.prompt, results);
      const elapsed = Date.now() - startTime;

      // Calculate total cost from all subtask execution logs
      let totalCost = 0;
      for (const taskId of taskIds) {
        const logs = await this.prisma.executionLog.findMany({ where: { taskId } });
        totalCost += calculateTotalCost(logs);
      }

      await this.prisma.mission.update({
        where: { id: missionId },
        data: {
          reviewResult: review as unknown as object,
          reviewScore: review.score,
          totalCost,
          totalTimeMs: elapsed,
        },
      });

      this.emitMissionEvent('mission_review_complete', {
        missionId,
        review,
      });

      // Post review to chat
      if (mission.conversationId) {
        const passCount = results.filter((r) => r.validation_passed).length;
        await this.postToChat(
          mission.conversationId,
          `📊 **Mission Review** (Score: ${review.score}/10)\n\n`
          + `${review.summary}\n\n`
          + `Results: ${passCount}/${results.length} subtasks passed | Cost: $${totalCost.toFixed(4)} | Time: ${(elapsed / 1000).toFixed(1)}s`
          + (review.findings.length > 0
            ? '\n\nFindings:\n' + review.findings.map((f: { severity: string; issue: string }) => `- [${f.severity}] ${f.issue}`).join('\n')
            : ''),
        );
      }

      // ── Step 5: Approval ──────────────────────────────────────────────
      // autoApprove=true means API/programmatic callers — approve regardless
      // of review score (no chat to manually approve in). Review is informational.
      if (mission.autoApprove) {
        await this.approveMission(missionId);
      } else {
        await this.prisma.mission.update({
          where: { id: missionId },
          data: { status: 'awaiting_approval' },
        });

        if (mission.conversationId) {
          await this.postToChat(
            mission.conversationId,
            '⏳ **Mission awaiting approval.** Type "approve" to accept or describe changes needed.',
          );
        }
      }
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.mission.update({
        where: { id: missionId },
        data: {
          status: 'failed',
          error: errorMsg,
          totalTimeMs: elapsed,
        },
      });

      // Try to post error to chat
      try {
        const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
        if (mission?.conversationId) {
          await this.postToChat(mission.conversationId, `❌ **Mission failed:** ${errorMsg}`);
        }
      } catch { /* best-effort */ }

      this.emitMissionEvent('mission_failed', { missionId, error: errorMsg });
    }
  }

  /**
   * Execute a single subtask: route → assign coder → execute → auto-retry → release.
   * Mirrors BattleClawService.executeTask() pattern.
   */
  private async executeSingleSubtask(
    taskId: string,
    plan: SubtaskPlan,
    missionId: string,
  ): Promise<SubtaskResult> {
    const startTime = Date.now();

    try {
      // Route for complexity
      const routing = await this.router.routeTask(taskId);

      // Atomic agent assignment
      const agentId = routing.agentId;
      const agentUpdate = await this.prisma.agent.updateMany({
        where: { id: agentId, status: 'idle' },
        data: { status: 'busy', currentTaskId: taskId },
      });
      if (agentUpdate.count === 0) {
        // Wait for agent to become available (up to 2 min)
        const available = await this.waitForAgent(agentId, 120_000);
        if (!available) {
          throw new Error(`Agent ${agentId} not available after waiting`);
        }
        const retry = await this.prisma.agent.updateMany({
          where: { id: agentId, status: 'idle' },
          data: { status: 'busy', currentTaskId: taskId },
        });
        if (retry.count === 0) {
          throw new Error(`Agent ${agentId} still not available`);
        }
      }

      // Update task status
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'in_progress',
          assignedAgentId: agentId,
          assignedAt: new Date(),
          complexity: routing.complexity,
          complexitySource: routing.complexitySource,
          complexityReasoning: routing.complexityReasoning,
        },
      });

      this.emitTaskUpdate(taskId);
      this.emitAgentUpdate(agentId, 'busy');

      // Execute
      const execResult = await this.executor.executeTask({
        taskId,
        agentId,
        taskDescription: plan.description,
        expectedOutput: `Write code to: ${plan.description}`,
        useClaude: routing.modelTier !== 'ollama' && routing.modelTier !== 'remote_ollama',
        model: routing.modelTier === 'sonnet' ? 'anthropic/claude-sonnet-4-20250514' : undefined,
      });

      // Auto-retry validation
      let validated = false;
      if (execResult.success) {
        const autoRetry = new AutoRetryService(this.prisma, this.io);
        const retryResult = await autoRetry.validateAndRetry(taskId, execResult as unknown as Record<string, unknown>);
        validated = retryResult.validated;

        await this.prisma.task.update({
          where: { id: taskId },
          data: {
            status: validated ? 'completed' : 'failed',
            error: validated ? null : (retryResult.finalError || 'Validation failed'),
            result: { output: execResult.output ?? '' },
            completedAt: validated ? new Date() : null,
            timeSpentMs: Date.now() - startTime,
          },
        });
      } else {
        await this.prisma.task.update({
          where: { id: taskId },
          data: {
            status: 'failed',
            error: execResult.error || 'Execution failed',
            timeSpentMs: Date.now() - startTime,
          },
        });
      }

      // Release agent
      await this.prisma.agent.update({
        where: { id: agentId },
        data: { status: 'idle', currentTaskId: null },
      });
      this.emitAgentUpdate(agentId, 'idle');
      this.emitTaskUpdate(taskId);

      // Read generated code from execution logs
      const code = await this.readGeneratedCode(taskId);

      return {
        title: plan.title,
        file_name: plan.file_name,
        validation_passed: validated,
        code: code || undefined,
        error: execResult.success ? undefined : (execResult.error || 'Execution failed'),
      };
    } catch (error) {
      // Clean up on failure
      const task = await this.prisma.task.findUnique({ where: { id: taskId } });
      if (task?.assignedAgentId) {
        await this.prisma.agent.update({
          where: { id: task.assignedAgentId },
          data: { status: 'idle', currentTaskId: null },
        }).catch(() => {});
        this.emitAgentUpdate(task.assignedAgentId, 'idle');
      }

      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timeSpentMs: Date.now() - startTime,
        },
      }).catch(() => {});

      this.emitTaskUpdate(taskId);

      return {
        title: plan.title,
        file_name: plan.file_name,
        validation_passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Approve a mission — mark as approved and complete.
   */
  async approveMission(missionId: string): Promise<void> {
    const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });

    await this.prisma.mission.update({
      where: { id: missionId },
      data: {
        status: 'approved',
        completedAt: new Date(),
      },
    });

    if (mission?.conversationId) {
      // Post cost summary
      const costStr = mission.totalCost ? `$${mission.totalCost.toFixed(4)}` : 'FREE (Ollama)';
      const timeStr = mission.totalTimeMs ? `${(mission.totalTimeMs / 1000).toFixed(1)}s` : 'unknown';
      const summary = `**Mission cost:** ${costStr} · ${timeStr} runtime · ${mission.subtaskCount} subtasks`;
      await this.postToChat(mission.conversationId, summary);

      // Post approval confirmation
      await this.postToChat(mission.conversationId, '✅ **Mission approved!** All files are ready in the workspace.');

      // Post publish options
      await this.postToChat(
        mission.conversationId,
        'Where would you like to export the code?\n\n• Reply **zip** to download a ZIP bundle\n• Reply **github** to create a GitHub repository',
      );
    }

    this.emitMissionEvent('mission_approved', { missionId });
  }

  /**
   * Reject a mission — mark as failed with reason.
   */
  async rejectMission(missionId: string, reason?: string): Promise<void> {
    await this.prisma.mission.update({
      where: { id: missionId },
      data: {
        status: 'failed',
        error: reason || 'Rejected by user',
      },
    });

    const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
    if (mission?.conversationId) {
      await this.postToChat(
        mission.conversationId,
        `🚫 **Mission rejected.** ${reason || 'No reason given.'}`,
      );
    }

    this.emitMissionEvent('mission_failed', { missionId, error: reason || 'Rejected by user' });
  }

  /**
   * Retry failed subtasks for a mission that's awaiting approval.
   */
  async retryFailedSubtasks(missionId: string, retryPrompt?: string): Promise<void> {
    const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });

    if (!mission) {
      throw new Error(`Mission ${missionId} not found`);
    }

    if (mission.status !== 'awaiting_approval') {
      throw new Error(`Mission must be awaiting_approval to retry failed subtasks. Current status: ${mission.status}`);
    }

    // Find all failed tasks
    const failedTasks = await this.prisma.task.findMany({
      where: {
        missionId,
        status: { in: ['failed', 'aborted'] },
      },
    });

    if (failedTasks.length === 0) {
      throw new Error('No failed subtasks to retry');
    }

    // Reset failed tasks to pending, optionally append retry prompt
    for (const task of failedTasks) {
      let newDescription = task.description;
      if (retryPrompt) {
        newDescription += `\n\nRETRY NOTE: ${retryPrompt}`;
      }

      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'pending',
          description: newDescription,
          error: null,
        },
      });
    }

    // Reset mission to executing state and clear failed count
    await this.prisma.mission.update({
      where: { id: missionId },
      data: {
        status: 'executing',
        failedCount: 0,
      },
    });

    if (mission.conversationId) {
      await this.postToChat(
        mission.conversationId,
        `🔄 **Retrying ${failedTasks.length} failed subtask(s)...**`,
      );
    }

    this.emitMissionEvent('mission_retry_started', { missionId, failedCount: failedTasks.length });
  }

  /**
   * Get all generated files for a mission (from execution logs).
   */
  async getMissionFiles(missionId: string): Promise<MissionFiles> {
    const files: MissionFiles = {};

    const tasks = await this.prisma.task.findMany({
      where: { missionId },
    });

    for (const task of tasks) {
      const logs = await this.prisma.executionLog.findMany({
        where: {
          taskId: task.id,
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
            const name = filePath.split('/').pop() || filePath;
            files[name] = content;
          }
        }
      }
    }

    return files;
  }

  /**
   * Wait for mission to reach a terminal state (for blocking API mode).
   */
  async waitForCompletion(missionId: string, timeoutMs = 600_000): Promise<void> {
    const start = Date.now();
    const terminalStatuses = ['approved', 'failed', 'awaiting_approval'];

    while (Date.now() - start < timeoutMs) {
      const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
      if (mission && terminalStatuses.includes(mission.status)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Mission timed out waiting for completion');
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Call Python agents service to decompose a prompt.
   */
  private async decompose(prompt: string, language: string): Promise<SubtaskPlan[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DECOMPOSE_TIMEOUT_MS);

    try {
      const response = await fetch(`${AGENTS_URL}/orchestrate/decompose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, language }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Decompose failed: ${text}`);
      }

      const result = await response.json() as { success: boolean; subtasks: SubtaskPlan[]; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Decompose returned failure');
      }

      return result.subtasks;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Call Python agents service to review results.
   */
  private async reviewMission(
    prompt: string,
    subtaskResults: SubtaskResult[],
  ): Promise<{ approved: boolean; score: number; summary: string; findings: Array<{ severity: string; issue: string }> }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REVIEW_TIMEOUT_MS);

    try {
      const response = await fetch(`${AGENTS_URL}/orchestrate/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, subtasks: subtaskResults }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Review failed: ${text}`);
      }

      const result = await response.json() as { success: boolean; review: { approved: boolean; score: number; summary: string; findings: Array<{ severity: string; issue: string }> }; error?: string };
      if (!result.success) {
        // If review fails, return a conservative result
        return { approved: false, score: 0, summary: result.error || 'Review failed', findings: [] };
      }

      return result.review;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Read generated code from execution logs for a task.
   */
  private async readGeneratedCode(taskId: string): Promise<string | null> {
    const logs = await this.prisma.executionLog.findMany({
      where: {
        taskId,
        action: { in: ['file_write', 'write_file'] },
      },
      orderBy: { timestamp: 'desc' },
      take: 1,
    });

    if (logs.length === 0) return null;

    const actionInput = logs[0].actionInput as Record<string, unknown> | null;
    if (!actionInput) return null;

    return (actionInput.content || actionInput.code) as string | null;
  }

  /**
   * Wait for an agent to become idle.
   */
  private async waitForAgent(agentId: string, maxWaitMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
      if (agent?.status === 'idle') return true;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return false;
  }

  /**
   * Post a non-streaming assistant message to a chat conversation.
   */
  private async postToChat(conversationId: string, content: string): Promise<void> {
    try {
      const message = await this.prisma.chatMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content,
        },
      });

      // Emit via WebSocket so UI gets it
      this.io.emit('chat_message_complete', {
        type: 'chat_message_complete',
        payload: {
          conversationId,
          messageId: message.id,
          fullContent: content,
        },
        timestamp: new Date(),
      });

      // Update conversation timestamp
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    } catch (err) {
      console.error(`[Orchestrator] Failed to post to chat:`, err);
    }
  }

  // ─── WebSocket Events ─────────────────────────────────────────────────────

  private emitMissionEvent(event: string, payload: Record<string, unknown>): void {
    this.io.emit(event, { type: event, payload, timestamp: new Date() });
  }

  private emitTaskUpdate(taskId: string): void {
    this.prisma.task.findUnique({ where: { id: taskId } }).then((task) => {
      if (task) {
        this.io.emit('task_updated', { type: 'task_updated', payload: task, timestamp: new Date() });
      }
    }).catch(() => {});
  }

  private emitAgentUpdate(agentId: string, status: string): void {
    this.io.emit('agent_status_changed', {
      type: 'agent_status_changed',
      payload: { id: agentId, status },
      timestamp: new Date(),
    });
  }
}
