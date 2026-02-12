/**
 * Task Executor Service
 *
 * Handles task execution lifecycle:
 * - Starting task execution
 * - Handling task completion
 * - Handling task failure
 * - Aborting tasks
 *
 * Extracted from taskQueue.ts for better separation of concerns.
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import type { Task, Agent, AgentType } from '../types/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { TrainingDataService } from './trainingDataService.js';
import { calculateActualComplexity, categorizeError } from './complexityCalculator.js';
import { ResourcePoolService } from './resourcePool.js';
import type { CodeReviewService } from './codeReviewService.js';
import { mcpBridge } from './mcpBridge.js';
import { OllamaOptimizer, getOllamaOptimizer } from './ollamaOptimizer.js';
import { TaskAssigner } from './taskAssigner.js';
import { TaskRouter } from './taskRouter.js';
import { ExecutorService } from './executor.js';

export class TaskExecutor {
  private trainingDataService: TrainingDataService;
  private codeReviewService: CodeReviewService | null = null;
  private ollamaOptimizer: OllamaOptimizer;
  private taskAssigner: TaskAssigner;

  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer,
    codeReviewService?: CodeReviewService
  ) {
    this.trainingDataService = new TrainingDataService(prisma);
    this.codeReviewService = codeReviewService || null;
    this.ollamaOptimizer = getOllamaOptimizer(io);
    this.taskAssigner = new TaskAssigner(prisma, io);
  }

  /**
   * Handle task start - update status and create execution record
   */
  async handleTaskStart(taskId: string): Promise<void> {
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'in_progress',
        currentIteration: { increment: 1 },
      },
    });

    // Create execution record
    await this.prisma.taskExecution.create({
      data: {
        taskId,
        agentId: task.assignedAgentId!,
        iteration: task.currentIteration,
        status: 'started',
      },
    });

    this.emitTaskUpdate(task as unknown as Task);

    // Publish to MCP Gateway
    await mcpBridge.publishTaskUpdated(taskId, { status: 'in_progress', iteration: task.currentIteration });
  }

  /**
   * Handle successful task completion
   */
  async handleTaskCompletion(taskId: string, result: Record<string, unknown>): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // === SAFETY NET: Validate test results from agent output ===
    if (result.output && typeof result.output === 'string') {
      try {
        const agentOutput = JSON.parse(result.output as string);
        if (this.detectTestFailures(agentOutput)) {
          console.warn(
            `[TaskExecutor] Task ${taskId} reported success but has test failures - redirecting to failure handler`
          );
          const failureReason = agentOutput.failure_reason
            || agentOutput.test_results
            || 'Tests failed but task was reported as successful';
          await this.handleTaskFailure(taskId, failureReason);
          return;
        }
      } catch {
        // If output isn't valid JSON, skip validation
      }
    }

    // Release file locks
    await this.taskAssigner.releaseFileLocks(taskId);

    // Release resource pool slot
    const resourcePool = ResourcePoolService.getInstance();
    resourcePool.release(taskId);

    // Save output to workspace file
    if (result.output) {
      await this.saveTaskOutput(task, taskId, result.output as string);
    }

    // Get execution logs to calculate actual complexity
    const logs = await this.prisma.executionLog.findMany({
      where: { taskId },
      orderBy: { step: 'asc' },
    });

    // Calculate actual complexity based on execution (post-hoc assessment)
    const calculatedComplexity = calculateActualComplexity(task, logs);

    // Update task - update complexity to reflect actual execution difficulty
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        result: result as Prisma.InputJsonValue,
        completedAt: new Date(),
        complexity: calculatedComplexity,
        complexitySource: 'actual',
      },
    });

    // Update agent stats and status
    await this.updateAgentOnCompletion(task.assignedAgentId!, task.complexity || 5);

    // Update execution record
    await this.prisma.taskExecution.updateMany({
      where: {
        taskId,
        status: 'started',
      },
      data: {
        status: 'completed',
        output: result as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    // Capture training data (async, non-blocking)
    this.captureTrainingData(taskId, task.assignedAgentId!, result, true).catch((error) => {
      console.error('Failed to capture training data:', error);
    });

    // Trigger auto code review (async, non-blocking)
    this.triggerCodeReview(taskId, task.complexity || 5);

    this.emitTaskUpdate(updatedTask as unknown as Task);

    // Publish to MCP Gateway (async, non-blocking)
    mcpBridge.publishTaskCompleted(taskId, result).catch((error) => {
      console.error('Failed to publish task completion to MCP:', error);
    });
  }

  /**
   * Handle task failure - retry or abort
   */
  async handleTaskFailure(taskId: string, error: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Update execution record
    await this.prisma.taskExecution.updateMany({
      where: {
        taskId,
        status: 'started',
      },
      data: {
        status: 'failed',
        error,
        completedAt: new Date(),
      },
    });

    // Capture training data for failed execution (max iterations only)
    if (task.currentIteration >= task.maxIterations && task.assignedAgentId) {
      this.captureTrainingData(taskId, task.assignedAgentId, { error }, false).catch((err) => {
        console.error('Failed to capture training data:', err);
      });
    }

    if (task.currentIteration < task.maxIterations) {
      // Retry: return to assigned state for retry
      const updatedTask = await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'assigned',
          error,
        },
      });

      this.emitTaskUpdate(updatedTask as unknown as Task);
    } else {
      // Max iterations reached: mark as failed
      await this.abortTask(taskId, error);
    }
  }

  /**
   * Abort a task - release resources and mark as aborted
   */
  async abortTask(taskId: string, error?: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Release file locks
    await this.taskAssigner.releaseFileLocks(taskId);

    // Release resource pool slot
    const resourcePool = ResourcePoolService.getInstance();
    resourcePool.release(taskId);

    // Get execution logs to calculate actual complexity and categorize error
    const logs = await this.prisma.executionLog.findMany({
      where: { taskId },
      orderBy: { step: 'asc' },
    });

    const calculatedComplexity = calculateActualComplexity(task, logs);
    const errorCategory = categorizeError(task, logs);

    // Update task - update complexity to reflect actual execution difficulty
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'aborted',
        error: error || 'Max iterations reached',
        complexity: calculatedComplexity,
        complexitySource: 'actual',
        errorCategory,
      },
    });

    // Update agent on failure
    if (task.assignedAgentId) {
      await this.updateAgentOnFailure(task.assignedAgentId, task.complexity || 5);
    }

    this.emitTaskUpdate(updatedTask as unknown as Task);

    // Publish to MCP Gateway (async, non-blocking)
    mcpBridge.publishTaskFailed(taskId, error || 'Max iterations reached').catch((err) => {
      console.error('Failed to publish task failure to MCP:', err);
    });

    // Emit alert
    this.io.emit('alert', {
      type: 'task_failed',
      severity: 'error',
      title: 'Task Failed',
      message: `Task "${task.title}" failed after ${task.currentIteration} iterations`,
      taskId,
      createdAt: new Date(),
    });
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Save task output to workspace file
   */
  private async saveTaskOutput(
    task: { title: string },
    taskId: string,
    output: string
  ): Promise<void> {
    try {
      const workspacePath = process.env.WORKSPACE_PATH || '/app/workspace';
      const tasksPath = path.join(workspacePath, 'tasks');

      // Create a safe filename from task title
      const safeTitle = task.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);

      const filename = `task-${taskId.substring(0, 8)}-${safeTitle}.txt`;
      const filepath = path.join(tasksPath, filename);

      // Prepare output content
      const content = [
        `Task: ${task.title}`,
        `ID: ${taskId}`,
        `Completed: ${new Date().toISOString()}`,
        ``,
        `Output:`,
        `--------`,
        output,
      ].join('\n');

      await fs.writeFile(filepath, content, 'utf-8');
      console.log(`Saved task output to: ${filename}`);
    } catch (error) {
      console.error('Failed to save task output:', error);
      // Don't fail the task if file saving fails
    }
  }

  /**
   * Update agent stats and status on task completion
   */
  private async updateAgentOnCompletion(agentId: string, complexity: number): Promise<void> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { agentType: true },
    });

    if (!agent) return;

    const stats = agent.stats as Record<string, number>;

    // Ollama optimization: Add rest delay to prevent context pollution
    const isOllamaTask = this.ollamaOptimizer.isOllamaTask(complexity, agent.agentType.name);

    if (isOllamaTask) {
      await this.ollamaOptimizer.applyRestDelay(agent.id, agent.name);
    }

    await this.prisma.agent.update({
      where: { id: agent.id },
      data: {
        status: 'idle',
        currentTaskId: null,
        stats: {
          ...stats,
          tasksCompleted: (stats.tasksCompleted || 0) + 1,
          successRate: this.calculateSuccessRate(stats.tasksCompleted + 1, stats.tasksFailed || 0),
        },
      },
    });

    const updatedAgent = await this.prisma.agent.findUnique({
      where: { id: agent.id },
      include: { agentType: true },
    });

    if (updatedAgent) {
      this.emitAgentUpdate(this.formatAgent(updatedAgent));
    }

    // Auto-assign next pending task (async, non-blocking)
    this.autoAssignNextTask(agentId).catch((error) => {
      console.error('Auto-assign after completion failed:', error);
    });
  }

  /**
   * Update agent stats and status on task failure
   */
  private async updateAgentOnFailure(agentId: string, complexity: number): Promise<void> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { agentType: true },
    });

    if (!agent) return;

    const stats = agent.stats as Record<string, number>;

    // Ollama optimization: Add rest delay for failed Ollama tasks too
    const isOllamaTask = this.ollamaOptimizer.isOllamaTask(complexity, agent.agentType.name);

    if (isOllamaTask) {
      await this.ollamaOptimizer.applyFailureRestDelay(agent.id, agent.name);
    }

    await this.prisma.agent.update({
      where: { id: agent.id },
      data: {
        status: 'idle',
        currentTaskId: null,
        stats: {
          ...stats,
          tasksFailed: (stats.tasksFailed || 0) + 1,
          successRate: this.calculateSuccessRate(stats.tasksCompleted || 0, stats.tasksFailed + 1),
        },
      },
    });

    const updatedAgent = await this.prisma.agent.findUnique({
      where: { id: agent.id },
      include: { agentType: true },
    });

    if (updatedAgent) {
      this.emitAgentUpdate(this.formatAgent(updatedAgent));
    }

    // Auto-assign next pending task (async, non-blocking)
    this.autoAssignNextTask(agentId).catch((error) => {
      console.error('Auto-assign after failure failed:', error);
    });
  }

  /**
   * Trigger auto code review based on complexity
   */
  private triggerCodeReview(taskId: string, complexity: number): void {
    if (!this.codeReviewService) return;

    let executedByModel: string;
    if (complexity < 5) {
      executedByModel = 'ollama';
    } else if (complexity < 9) {
      executedByModel = 'haiku';
    } else {
      executedByModel = 'sonnet';
    }

    this.codeReviewService.triggerReview(taskId, executedByModel).catch((error) => {
      console.error('Failed to trigger code review:', error);
    });
  }

  /**
   * Detect test failures in agent output JSON.
   * Returns true if tests were run and failed.
   * Returns false if no tests ran or all tests passed.
   */
  private detectTestFailures(agentOutput: Record<string, unknown>): boolean {
    // Check 1: success field is explicitly false
    if (agentOutput.success === false) {
      return true;
    }

    // Check 2: test_results string contains FAILURE indicator
    if (typeof agentOutput.test_results === 'string') {
      const tr = agentOutput.test_results.toUpperCase();
      if (tr.includes('FAILURE -') && (tr.includes('FAILED') || tr.includes('ERRORS'))) {
        return true;
      }
    }

    return false;
  }

  private calculateSuccessRate(completed: number, failed: number): number {
    const total = completed + failed;
    if (total === 0) return 0;
    return Math.round((completed / total) * 100) / 100;
  }

  private formatAgent(agent: {
    id: string;
    agentTypeId: string;
    name: string;
    status: string;
    currentTaskId: string | null;
    config: unknown;
    stats: unknown;
    createdAt: Date;
    updatedAt: Date;
    agentType: { name: string };
  }): Agent {
    return {
      id: agent.id,
      agentTypeId: agent.agentTypeId,
      type: agent.agentType.name as AgentType,
      name: agent.name,
      status: agent.status as Agent['status'],
      currentTaskId: agent.currentTaskId,
      config: agent.config as Agent['config'],
      stats: agent.stats as Agent['stats'],
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }

  private emitTaskUpdate(task: Task): void {
    console.log(`[TaskExecutor] Emitting task_updated for task ${task.id}, status: ${task.status}`);
    this.io.emit('task_updated', { type: 'task_updated', payload: task, timestamp: new Date() });
  }

  private emitAgentUpdate(agent: Agent): void {
    this.io.emit('agent_status_changed', { type: 'agent_status_changed', payload: agent, timestamp: new Date() });
  }

  /**
   * Capture training data for completed task execution
   * Non-blocking - errors are logged but don't affect task completion
   */
  private async captureTrainingData(
    taskId: string,
    agentId: string,
    result: Record<string, unknown>,
    success: boolean
  ): Promise<void> {
    try {
      // Get task details
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        console.warn(`Task ${taskId} not found - cannot capture training data`);
        return;
      }

      // Get agent details
      const agent = await this.prisma.agent.findUnique({
        where: { id: agentId },
        include: { agentType: true },
      });

      if (!agent) {
        console.warn(`Agent ${agentId} not found - cannot capture training data`);
        return;
      }

      // Get execution logs
      const logs = await this.prisma.executionLog.findMany({
        where: { taskId },
        orderBy: { step: 'asc' },
      });

      // Get execution record for timing data
      const execution = await this.prisma.taskExecution.findFirst({
        where: {
          taskId,
          agentId,
          iteration: task.currentIteration,
        },
      });

      // Determine if Claude was used
      const usedClaude =
        agent.agentType.name === 'cto' ||
        (agent.config as Record<string, unknown>)?.alwaysUseClaude === true ||
        (agent.config as Record<string, unknown>)?.useClaude === true;

      // Calculate duration
      const durationMs = execution?.startedAt && execution?.completedAt
        ? execution.completedAt.getTime() - execution.startedAt.getTime()
        : undefined;

      // Capture to training dataset
      await this.trainingDataService.captureExecution({
        taskId,
        taskDescription: task.description || task.title,
        taskType: task.taskType,
        expectedOutput: undefined, // Could be added to task schema in future
        agentId,
        output: result,
        logs: logs.map((log) => ({
          step: log.step,
          thought: log.thought,
          action: log.action,
          actionInput: log.actionInput,
          observation: log.observation,
          durationMs: log.durationMs,
          isLoop: log.isLoop,
        })),
        success,
        tokens: undefined, // Could be tracked in future
        durationMs,
        usedClaude,
      });

      console.log(
        `✅ Captured ${usedClaude ? 'Claude' : 'local'} training data for task ${taskId.substring(0, 8)}`
      );
    } catch (error) {
      console.error('Failed to capture training data:', error);
      // Don't throw - we don't want to break task completion
    }
  }

  /**
   * Auto-assign next pending task to an idle agent
   * Called after task completion/failure when agent becomes idle
   */
  async autoAssignNextTask(agentId: string): Promise<void> {
    try {
      // Get the agent that just became idle
      const agent = await this.prisma.agent.findUnique({
        where: { id: agentId },
        include: { agentType: true },
      });

      if (!agent || agent.status !== 'idle') {
        return; // Agent not found or not idle (might still be in rest)
      }

      // Get next pending task for this agent type
      const pendingTask = await this.prisma.task.findFirst({
        where: {
          status: 'pending',
          OR: [
            { requiredAgent: null },
            { requiredAgent: agent.agentType.name },
          ],
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      if (!pendingTask) {
        console.log(`📭 No pending tasks for ${agent.name} - staying idle`);
        return;
      }

      // Use TaskRouter to properly route and assign the task
      const taskRouter = new TaskRouter(this.prisma);
      const decision = await taskRouter.routeTask(pendingTask.id);

      // Only auto-assign if the decision matches this agent type
      // (respects complexity routing - don't assign Haiku tasks to Ollama agent)
      const agentMatchesDecision =
        (decision.modelTier === 'ollama' && agent.agentType.name === 'coder') ||
        (decision.modelTier === 'haiku' && agent.agentType.name === 'qa') ||
        (decision.modelTier === 'sonnet' && agent.agentType.name === 'qa');

      if (!agentMatchesDecision) {
        console.log(`⏭️ Task ${pendingTask.id.substring(0, 8)} requires ${decision.modelTier}, ${agent.name} is ${agent.agentType.name} - skipping`);
        return;
      }

      // Assign the task
      await this.taskAssigner.assignTask(pendingTask.id, agentId);

      console.log(`🔄 Auto-assigned task "${pendingTask.title}" to ${agent.name}`);

      // Emit notification for UI
      this.io.emit('alert', {
        type: 'info',
        title: 'Task Auto-Assigned',
        message: `${agent.name} picked up: ${pendingTask.title}`,
        timestamp: new Date(),
      });

      // Mark task as in progress and trigger execution
      await this.handleTaskStart(pendingTask.id);

      // Execute the task asynchronously
      const executor = new ExecutorService();
      const executeAsync = async () => {
        try {
          const result = await executor.executeTask({
            taskId: pendingTask.id,
            agentId: agentId,
            taskDescription: pendingTask.description || pendingTask.title,
            expectedOutput: `Successfully completed: ${pendingTask.title}`,
            useClaude: decision.modelTier !== 'ollama',
          });

          if (result.success) {
            await this.handleTaskCompletion(pendingTask.id, {
              output: result.output ?? '',
              metrics: result.metrics ?? {},
            });
          } else {
            await this.handleTaskFailure(pendingTask.id, result.error || 'Unknown error');
          }
        } catch (error) {
          console.error('Auto-execution error:', error);
          await this.handleTaskFailure(
            pendingTask.id,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      };

      // Fire and forget - execution happens in background
      executeAsync();

    } catch (error) {
      console.error('Auto-assign failed:', error);
      // Don't throw - auto-assign is a nice-to-have, not critical
    }
  }
}
