import type { PrismaClient, Prisma } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import type { Task, Agent, AgentType, TaskStatus } from '../types/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { TrainingDataService } from './trainingDataService.js';
import { calculateActualComplexity, categorizeError } from './complexityCalculator.js';
import { ResourcePoolService } from './resourcePool.js';
import type { CodeReviewService } from './codeReviewService.js';
import { mcpBridge } from './mcpBridge.js';

export interface TaskAssignment {
  taskId: string;
  agentId: string;
}

export class TaskQueueService {
  private trainingDataService: TrainingDataService;
  private codeReviewService: CodeReviewService | null = null;

  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer,
    codeReviewService?: CodeReviewService
  ) {
    this.trainingDataService = new TrainingDataService(prisma);
    this.codeReviewService = codeReviewService || null;
  }

  async assignNextTask(agentId: string): Promise<TaskAssignment | null> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { agentType: true },
    });

    if (!agent || agent.status !== 'idle') {
      return null;
    }

    const agentTypeName = agent.agentType.name as AgentType;

    // Get currently locked files
    const lockedFiles = await this.getLockedFiles();

    // Find best matching task
    const task = await this.prisma.task.findFirst({
      where: {
        status: 'pending',
        OR: [
          { requiredAgent: agentTypeName },
          { requiredAgent: null },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    if (!task) {
      return null;
    }

    // Check for file conflicts
    const taskFiles = task.lockedFiles || [];
    const hasConflict = taskFiles.some(file => lockedFiles.includes(file));

    if (hasConflict) {
      // Try to find another task without conflicts
      const alternativeTask = await this.prisma.task.findFirst({
        where: {
          status: 'pending',
          id: { not: task.id },
          OR: [
            { requiredAgent: agentTypeName },
            { requiredAgent: null },
          ],
          NOT: {
            lockedFiles: { hasSome: lockedFiles },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      if (!alternativeTask) {
        return null;
      }

      return this.assignTask(alternativeTask.id, agentId);
    }

    return this.assignTask(task.id, agentId);
  }

  async assignTask(taskId: string, agentId: string): Promise<TaskAssignment> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Acquire file locks
    if (task.lockedFiles && task.lockedFiles.length > 0) {
      await this.lockFiles(taskId, agentId, task.lockedFiles);
    }

    // Update task
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'assigned',
        assignedAgentId: agentId,
        assignedAt: new Date(),
      },
    });

    // Update agent
    const updatedAgent = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        status: 'busy',
        currentTaskId: taskId,
      },
      include: { agentType: true },
    });

    // Emit events
    this.emitTaskUpdate(updatedTask as unknown as Task);
    this.emitAgentUpdate(this.formatAgent(updatedAgent));

    // Publish to MCP Gateway (Redis pub/sub)
    await mcpBridge.publishTaskAssigned(taskId, agentId);

    return { taskId, agentId };
  }

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

  async handleTaskCompletion(taskId: string, result: Record<string, unknown>): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Release file locks
    await this.releaseFileLocks(taskId);

    // Release resource pool slot
    const resourcePool = ResourcePoolService.getInstance();
    resourcePool.release(taskId);

    // Save output to workspace file
    if (result.output) {
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
          result.output,
        ].join('\n');

        await fs.writeFile(filepath, content, 'utf-8');
        console.log(`Saved task output to: ${filename}`);
      } catch (error) {
        console.error('Failed to save task output:', error);
        // Don't fail the task if file saving fails
      }
    }

    // Get execution logs to calculate actual complexity
    const logs = await this.prisma.executionLog.findMany({
      where: { taskId },
      orderBy: { step: 'asc' },
    });

    // Calculate actual complexity based on execution
    const actualComplexity = calculateActualComplexity(task, logs);

    // Update task
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        result: result as Prisma.InputJsonValue,
        completedAt: new Date(),
        actualComplexity,
      },
    });

    // Update agent stats and status
    const agent = await this.prisma.agent.findUnique({
      where: { id: task.assignedAgentId! },
    });

    if (agent) {
      const stats = agent.stats as Record<string, number>;
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
    }

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
    if (this.codeReviewService) {
      this.codeReviewService.triggerReview(taskId).catch((error) => {
        console.error('Failed to trigger code review:', error);
      });
    }

    this.emitTaskUpdate(updatedTask as unknown as Task);

    // Publish to MCP Gateway (async, non-blocking)
    mcpBridge.publishTaskCompleted(taskId, result).catch((error) => {
      console.error('Failed to publish task completion to MCP:', error);
    });
  }

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

  async abortTask(taskId: string, error?: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Release file locks
    await this.releaseFileLocks(taskId);

    // Release resource pool slot
    const resourcePool = ResourcePoolService.getInstance();
    resourcePool.release(taskId);

    // Get execution logs to calculate actual complexity and categorize error
    const logs = await this.prisma.executionLog.findMany({
      where: { taskId },
      orderBy: { step: 'asc' },
    });

    const actualComplexity = calculateActualComplexity(task, logs);
    const errorCategory = categorizeError(task, logs);

    // Update task
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'aborted',
        error: error || 'Max iterations reached',
        actualComplexity,
        errorCategory,
      },
    });

    // Update agent
    if (task.assignedAgentId) {
      const agent = await this.prisma.agent.findUnique({
        where: { id: task.assignedAgentId },
      });

      if (agent) {
        const stats = agent.stats as Record<string, number>;
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
      }
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

  async requestHumanInput(taskId: string, reason: string): Promise<void> {
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'needs_human',
        needsHumanAt: new Date(),
      },
    });

    // Update agent status
    if (task.assignedAgentId) {
      await this.prisma.agent.update({
        where: { id: task.assignedAgentId },
        data: { status: 'stuck' },
      });

      const updatedAgent = await this.prisma.agent.findUnique({
        where: { id: task.assignedAgentId },
        include: { agentType: true },
      });

      if (updatedAgent) {
        this.emitAgentUpdate(this.formatAgent(updatedAgent));
      }
    }

    this.emitTaskUpdate(task as unknown as Task);

    // Emit alert
    this.io.emit('alert', {
      type: 'human_input_needed',
      severity: 'warning',
      title: 'Human Input Required',
      message: reason,
      taskId,
      agentId: task.assignedAgentId,
      createdAt: new Date(),
    });
  }

  async provideHumanInput(taskId: string, input: string, action: 'approve' | 'reject' | 'modify'): Promise<void> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });

    if (!task || task.status !== 'needs_human') {
      throw new Error('Task is not waiting for human input');
    }

    if (action === 'reject') {
      await this.abortTask(taskId, 'Rejected by human');
      return;
    }

    // Resume task
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'assigned',
        needsHumanAt: null,
      },
    });

    // Update agent status
    if (task.assignedAgentId) {
      await this.prisma.agent.update({
        where: { id: task.assignedAgentId },
        data: { status: 'busy' },
      });

      const updatedAgent = await this.prisma.agent.findUnique({
        where: { id: task.assignedAgentId },
        include: { agentType: true },
      });

      if (updatedAgent) {
        this.emitAgentUpdate(this.formatAgent(updatedAgent));
      }
    }

    this.emitTaskUpdate(updatedTask as unknown as Task);
  }

  async returnToPool(taskId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Release file locks
    await this.releaseFileLocks(taskId);

    // Release resource pool slot
    const resourcePool = ResourcePoolService.getInstance();
    resourcePool.release(taskId);

    // Reset task
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'pending',
        assignedAgentId: null,
        assignedAt: null,
        currentIteration: 0,
        error: null,
      },
    });

    // Update agent if was assigned
    if (task.assignedAgentId) {
      await this.prisma.agent.update({
        where: { id: task.assignedAgentId },
        data: {
          status: 'idle',
          currentTaskId: null,
        },
      });

      const updatedAgent = await this.prisma.agent.findUnique({
        where: { id: task.assignedAgentId },
        include: { agentType: true },
      });

      if (updatedAgent) {
        this.emitAgentUpdate(this.formatAgent(updatedAgent));
      }
    }

    this.emitTaskUpdate(updatedTask as unknown as Task);
  }

  private async getLockedFiles(): Promise<string[]> {
    const locks = await this.prisma.fileLock.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    return locks.map(lock => lock.filePath);
  }

  private async lockFiles(taskId: string, agentId: string, files: string[]): Promise<void> {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    for (const filePath of files) {
      await this.prisma.fileLock.upsert({
        where: { filePath },
        update: {
          lockedByAgent: agentId,
          lockedByTask: taskId,
          lockedAt: new Date(),
          expiresAt,
        },
        create: {
          filePath,
          lockedByAgent: agentId,
          lockedByTask: taskId,
          expiresAt,
        },
      });
    }
  }

  private async releaseFileLocks(taskId: string): Promise<void> {
    await this.prisma.fileLock.deleteMany({
      where: { lockedByTask: taskId },
    });
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
        (agent.config as any)?.alwaysUseClaude === true ||
        (agent.config as any)?.useClaude === true;

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
}
