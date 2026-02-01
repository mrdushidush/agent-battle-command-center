/**
 * Task Assigner Service
 *
 * Handles task-to-agent assignment logic:
 * - Find suitable agent for pending task
 * - Handle file lock conflicts
 * - Assign task and update agent status
 */

import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import type { Task, Agent, AgentType } from '../types/index.js';
import { mcpBridge } from './mcpBridge.js';

export interface TaskAssignment {
  taskId: string;
  agentId: string;
}

export class TaskAssigner {
  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer
  ) {}

  /**
   * Assign next suitable task to an agent
   */
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

  /**
   * Assign a specific task to an agent
   */
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

  /**
   * Get list of currently locked files
   */
  async getLockedFiles(): Promise<string[]> {
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

  /**
   * Acquire file locks for a task
   */
  async lockFiles(taskId: string, agentId: string, files: string[]): Promise<void> {
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

  /**
   * Release file locks for a task
   */
  async releaseFileLocks(taskId: string): Promise<void> {
    await this.prisma.fileLock.deleteMany({
      where: { lockedByTask: taskId },
    });
  }

  /**
   * Format agent for event emission
   */
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
