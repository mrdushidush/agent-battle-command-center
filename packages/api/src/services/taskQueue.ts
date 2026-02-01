import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import type { Task, Agent, AgentType } from '../types/index.js';
import { ResourcePoolService } from './resourcePool.js';
import type { CodeReviewService } from './codeReviewService.js';
import {
  getOllamaOptimizer,
  getOllamaTaskCounts,
  resetOllamaTaskCounts,
} from './ollamaOptimizer.js';
import { TaskAssigner, type TaskAssignment } from './taskAssigner.js';
import { TaskExecutor } from './taskExecutor.js';

// Re-export types for backwards compatibility
export type { TaskAssignment } from './taskAssigner.js';

export class TaskQueueService {
  private taskAssigner: TaskAssigner;
  private taskExecutor: TaskExecutor;

  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer,
    codeReviewService?: CodeReviewService
  ) {
    this.taskAssigner = new TaskAssigner(prisma, io);
    this.taskExecutor = new TaskExecutor(prisma, io, codeReviewService);
  }

  // ============================================
  // Ollama Optimization (Delegated)
  // ============================================

  /**
   * Get Ollama task counts per agent (for monitoring/debugging)
   * @deprecated Use ollamaOptimizer.getTaskCounts() instead
   */
  getOllamaTaskCounts(): Record<string, number> {
    return getOllamaTaskCounts();
  }

  /**
   * Reset Ollama task counters (for testing)
   * @deprecated Use ollamaOptimizer.resetTaskCounts() instead
   */
  resetOllamaTaskCounts(): void {
    resetOllamaTaskCounts();
  }

  /**
   * Get Ollama optimization config
   * @deprecated Use ollamaOptimizer.getConfig() instead
   */
  getOllamaConfig() {
    return getOllamaOptimizer(this.io).getConfig();
  }

  /**
   * Assign next suitable task to an agent
   * @deprecated Use taskAssigner.assignNextTask() directly
   */
  async assignNextTask(agentId: string): Promise<TaskAssignment | null> {
    return this.taskAssigner.assignNextTask(agentId);
  }

  /**
   * Assign a specific task to an agent
   * @deprecated Use taskAssigner.assignTask() directly
   */
  async assignTask(taskId: string, agentId: string): Promise<TaskAssignment> {
    return this.taskAssigner.assignTask(taskId, agentId);
  }

  /**
   * Handle task start - delegates to TaskExecutor
   */
  async handleTaskStart(taskId: string): Promise<void> {
    return this.taskExecutor.handleTaskStart(taskId);
  }

  /**
   * Handle task completion - delegates to TaskExecutor
   */
  async handleTaskCompletion(taskId: string, result: Record<string, unknown>): Promise<void> {
    return this.taskExecutor.handleTaskCompletion(taskId, result);
  }

  /**
   * Handle task failure - delegates to TaskExecutor
   */
  async handleTaskFailure(taskId: string, error: string): Promise<void> {
    return this.taskExecutor.handleTaskFailure(taskId, error);
  }

  /**
   * Abort a task - delegates to TaskExecutor
   */
  async abortTask(taskId: string, error?: string): Promise<void> {
    return this.taskExecutor.abortTask(taskId, error);
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
    await this.taskAssigner.releaseFileLocks(taskId);

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

  // ============================================
  // Private Helper Methods
  // ============================================

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
}
