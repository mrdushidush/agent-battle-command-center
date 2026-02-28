import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TaskQueueService } from '../taskQueue.js';
import { prismaMock } from '../../__mocks__/prisma.js';
import type { Server as SocketIOServer } from 'socket.io';
import type { Task, Agent, AgentType as PrismaAgentType, FileLock } from '@prisma/client';

// Mock socket.io
const mockIo = {
  emit: jest.fn(),
} as unknown as SocketIOServer;

describe('TaskQueueService', () => {
  let service: TaskQueueService;

  beforeEach(() => {
    service = new TaskQueueService(prismaMock, mockIo);
    jest.clearAllMocks();
  });

  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-1',
    title: 'Test Task',
    description: 'A test task',
    taskType: 'code',
    status: 'pending',
    priority: 5,
    parentTaskId: null,
    assignedAgentId: null,
    requiredAgent: null,
    lockedFiles: [],
    result: null,
    error: null,
    currentIteration: 0,
    maxIterations: 3,
    assignedAt: null,
    completedAt: null,
    needsHumanAt: null,
    humanTimeoutMinutes: 30,
    escalatedToAgentId: null,
    apiCreditsUsed: 0 as unknown as import('@prisma/client/runtime/library').Decimal,
    timeSpentMs: 0,
    acceptanceCriteria: null,
    contextNotes: null,
    validationCommand: null,
    complexity: null,
    complexitySource: null,
    complexityReasoning: null,
    errorCategory: null,
    missionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createAgent = (
    overrides: Partial<Agent & { agentType: PrismaAgentType }> = {}
  ): Agent & { agentType: PrismaAgentType } => ({
    id: 'agent-1',
    agentTypeId: 'type-coder',
    name: 'Coder Agent',
    status: 'idle',
    currentTaskId: null,
    config: {},
    stats: { tasksCompleted: 0, tasksFailed: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
    agentType: {
      id: 'type-coder',
      name: 'coder',
      displayName: 'Coder',
      description: null,
      capabilities: [],
      icon: null,
      color: null,
      createdAt: new Date(),
    },
    ...overrides,
  });

  describe('assignTask', () => {
    it('should assign task to agent successfully', async () => {
      const task = createTask();
      const agent = createAgent();
      const updatedTask = { ...task, status: 'assigned', assignedAgentId: 'agent-1' };
      const updatedAgent = { ...agent, status: 'busy', currentTaskId: 'task-1' };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);
      prismaMock.fileLock.findMany.mockResolvedValue([]);

      const result = await service.assignTask('task-1', 'agent-1');

      expect(result).toEqual({ taskId: 'task-1', agentId: 'agent-1' });
      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'assigned',
          assignedAgentId: 'agent-1',
        }),
      });
      expect(prismaMock.agent.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: expect.objectContaining({
          status: 'busy',
          currentTaskId: 'task-1',
        }),
        include: { agentType: true },
      });
    });

    it('should throw error if task not found', async () => {
      prismaMock.task.findUnique.mockResolvedValue(null);

      await expect(service.assignTask('nonexistent', 'agent-1')).rejects.toThrow(
        'Task nonexistent not found'
      );
    });

    it('should acquire file locks when task has lockedFiles', async () => {
      const task = createTask({ lockedFiles: ['src/index.ts', 'src/utils.ts'] });
      const agent = createAgent();
      const updatedTask = { ...task, status: 'assigned', assignedAgentId: 'agent-1' };
      const updatedAgent = { ...agent, status: 'busy', currentTaskId: 'task-1' };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);
      prismaMock.fileLock.upsert.mockResolvedValue({} as FileLock);

      await service.assignTask('task-1', 'agent-1');

      expect(prismaMock.fileLock.upsert).toHaveBeenCalledTimes(2);
    });

    it('should emit task_updated and agent_status_changed events', async () => {
      const task = createTask();
      const agent = createAgent();
      const updatedTask = { ...task, status: 'assigned', assignedAgentId: 'agent-1' };
      const updatedAgent = { ...agent, status: 'busy', currentTaskId: 'task-1' };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);

      await service.assignTask('task-1', 'agent-1');

      expect(mockIo.emit).toHaveBeenCalledWith('task_updated', expect.objectContaining({
        type: 'task_updated',
        payload: expect.objectContaining({ status: 'assigned' }),
      }));
      expect(mockIo.emit).toHaveBeenCalledWith('agent_status_changed', expect.objectContaining({
        type: 'agent_status_changed',
      }));
    });
  });

  describe('assignNextTask', () => {
    it('should return null if agent not found', async () => {
      prismaMock.agent.findUnique.mockResolvedValue(null);

      const result = await service.assignNextTask('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null if agent is not idle', async () => {
      const busyAgent = createAgent({ status: 'busy' });
      prismaMock.agent.findUnique.mockResolvedValue(busyAgent);

      const result = await service.assignNextTask('agent-1');

      expect(result).toBeNull();
    });

    it('should return null if no pending tasks', async () => {
      const agent = createAgent();
      prismaMock.agent.findUnique.mockResolvedValue(agent);
      prismaMock.fileLock.findMany.mockResolvedValue([]);
      prismaMock.task.findFirst.mockResolvedValue(null);

      const result = await service.assignNextTask('agent-1');

      expect(result).toBeNull();
    });

    it('should skip tasks with file conflicts', async () => {
      const agent = createAgent();
      const conflictingTask = createTask({ lockedFiles: ['src/locked.ts'] });
      const alternativeTask = createTask({ id: 'task-2', lockedFiles: [] });
      const updatedTask = { ...alternativeTask, status: 'assigned', assignedAgentId: 'agent-1' };
      const updatedAgent = { ...agent, status: 'busy', currentTaskId: 'task-2' };

      prismaMock.agent.findUnique.mockResolvedValue(agent);
      prismaMock.fileLock.findMany.mockResolvedValue([
        { filePath: 'src/locked.ts', lockedByAgent: 'other-agent' } as FileLock,
      ]);
      prismaMock.task.findFirst
        .mockResolvedValueOnce(conflictingTask) // First call finds conflicting task
        .mockResolvedValueOnce(alternativeTask); // Second call finds alternative
      prismaMock.task.findUnique.mockResolvedValue(alternativeTask);
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);

      const result = await service.assignNextTask('agent-1');

      expect(result).toEqual({ taskId: 'task-2', agentId: 'agent-1' });
    });
  });

  describe('handleTaskStart', () => {
    it('should update task status to in_progress', async () => {
      const task = createTask({ status: 'assigned', assignedAgentId: 'agent-1' });
      const updatedTask = { ...task, status: 'in_progress', currentIteration: 1 };

      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.taskExecution.create.mockResolvedValue({} as any);

      await service.handleTaskStart('task-1');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: 'in_progress',
          currentIteration: { increment: 1 },
        },
      });
    });

    it('should create execution record', async () => {
      const task = createTask({
        status: 'assigned',
        assignedAgentId: 'agent-1',
        currentIteration: 1,
      });

      prismaMock.task.update.mockResolvedValue(task);
      prismaMock.taskExecution.create.mockResolvedValue({} as any);

      await service.handleTaskStart('task-1');

      expect(prismaMock.taskExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: 'task-1',
          agentId: 'agent-1',
          status: 'started',
        }),
      });
    });
  });

  describe('handleTaskCompletion', () => {
    it('should update task status to completed', async () => {
      const task = createTask({ status: 'in_progress', assignedAgentId: 'agent-1' });
      const agent = createAgent({ id: 'agent-1', status: 'busy', currentTaskId: 'task-1' });
      const updatedTask = { ...task, status: 'completed', result: { output: 'Success' } };
      const updatedAgent = { ...agent, status: 'idle', currentTaskId: null };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.fileLock.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.findUnique.mockResolvedValue(agent);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);
      prismaMock.taskExecution.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.executionLog.findMany.mockResolvedValue([]);
      prismaMock.taskExecution.findFirst.mockResolvedValue(null);

      await service.handleTaskCompletion('task-1', { output: 'Success' });

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'completed',
          result: { output: 'Success' },
        }),
      });
    });

    it('should release file locks', async () => {
      const task = createTask({ status: 'in_progress', assignedAgentId: 'agent-1' });
      const agent = createAgent({ id: 'agent-1' });
      const updatedTask = { ...task, status: 'completed' };
      const updatedAgent = { ...agent, status: 'idle' };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.fileLock.deleteMany.mockResolvedValue({ count: 2 });
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.findUnique.mockResolvedValue(agent);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);
      prismaMock.taskExecution.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.executionLog.findMany.mockResolvedValue([]);
      prismaMock.taskExecution.findFirst.mockResolvedValue(null);

      await service.handleTaskCompletion('task-1', {});

      expect(prismaMock.fileLock.deleteMany).toHaveBeenCalledWith({
        where: { lockedByTask: 'task-1' },
      });
    });

    it('should reset agent to idle', async () => {
      const task = createTask({ status: 'in_progress', assignedAgentId: 'agent-1' });
      const agent = createAgent({ id: 'agent-1', status: 'busy', currentTaskId: 'task-1' });
      const updatedTask = { ...task, status: 'completed' };
      const updatedAgent = { ...agent, status: 'idle', currentTaskId: null };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.fileLock.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.findUnique.mockResolvedValue(agent);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);
      prismaMock.taskExecution.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.executionLog.findMany.mockResolvedValue([]);
      prismaMock.taskExecution.findFirst.mockResolvedValue(null);

      await service.handleTaskCompletion('task-1', {});

      expect(prismaMock.agent.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: expect.objectContaining({
          status: 'idle',
          currentTaskId: null,
        }),
      });
    });

    it('should throw if task not found', async () => {
      prismaMock.task.findUnique.mockResolvedValue(null);

      await expect(service.handleTaskCompletion('nonexistent', {})).rejects.toThrow(
        'Task nonexistent not found'
      );
    });
  });

  describe('handleTaskFailure', () => {
    it('should retry if under max iterations', async () => {
      const task = createTask({
        status: 'in_progress',
        assignedAgentId: 'agent-1',
        currentIteration: 1,
        maxIterations: 3,
      });
      const updatedTask = { ...task, status: 'assigned', error: 'Test error' };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.taskExecution.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.task.update.mockResolvedValue(updatedTask);

      await service.handleTaskFailure('task-1', 'Test error');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: 'assigned',
          error: 'Test error',
        },
      });
    });

    it('should abort if max iterations reached', async () => {
      const task = createTask({
        status: 'in_progress',
        assignedAgentId: 'agent-1',
        currentIteration: 3,
        maxIterations: 3,
      });
      const agent = createAgent({ id: 'agent-1' });
      const updatedTask = { ...task, status: 'aborted', error: 'Max iterations reached' };
      const updatedAgent = { ...agent, status: 'idle' };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.taskExecution.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.fileLock.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.findUnique.mockResolvedValue(agent);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);

      await service.handleTaskFailure('task-1', 'Test error');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'aborted',
        }),
      });
    });
  });

  describe('returnToPool', () => {
    it('should reset task to pending state', async () => {
      const task = createTask({
        status: 'in_progress',
        assignedAgentId: 'agent-1',
        currentIteration: 2,
      });
      const agent = createAgent({ id: 'agent-1', status: 'busy' });
      const updatedTask = {
        ...task,
        status: 'pending',
        assignedAgentId: null,
        currentIteration: 0,
      };
      const updatedAgent = { ...agent, status: 'idle', currentTaskId: null };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.fileLock.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);
      prismaMock.agent.findUnique.mockResolvedValue(updatedAgent);

      await service.returnToPool('task-1');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: 'pending',
          assignedAgentId: null,
          assignedAt: null,
          currentIteration: 0,
          error: null,
        },
      });
    });
  });
});
