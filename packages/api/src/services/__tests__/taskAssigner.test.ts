import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TaskAssigner } from '../taskAssigner.js';
import { prismaMock } from '../../__mocks__/prisma.js';
import type { Server as SocketIOServer } from 'socket.io';
import type { Task, Agent, AgentType as PrismaAgentType, FileLock } from '@prisma/client';

// Mock mcpBridge
jest.mock('../mcpBridge.js', () => ({
  mcpBridge: {
    publishTaskAssigned: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as unknown as void),
  },
}));

// Mock socket.io
const mockIo = {
  emit: jest.fn(),
} as unknown as SocketIOServer;

describe('TaskAssigner', () => {
  let assigner: TaskAssigner;

  beforeEach(() => {
    assigner = new TaskAssigner(prismaMock, mockIo);
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

  const createFileLock = (overrides: Partial<FileLock> = {}): FileLock => ({
    id: 'lock-1',
    filePath: 'src/locked.ts',
    lockedByAgent: 'other-agent',
    lockedByTask: 'other-task',
    lockedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    ...overrides,
  });

  describe('assignTask', () => {
    it('should update task status to assigned', async () => {
      const task = createTask();
      const agent = createAgent();
      const updatedTask = { ...task, status: 'assigned', assignedAgentId: 'agent-1' };
      const updatedAgent = { ...agent, status: 'busy', currentTaskId: 'task-1' };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);

      await assigner.assignTask('task-1', 'agent-1');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'assigned',
          assignedAgentId: 'agent-1',
          assignedAt: expect.any(Date),
        }),
      });
    });

    it('should update agent status to busy', async () => {
      const task = createTask();
      const agent = createAgent();
      const updatedTask = { ...task, status: 'assigned', assignedAgentId: 'agent-1' };
      const updatedAgent = { ...agent, status: 'busy', currentTaskId: 'task-1' };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);

      await assigner.assignTask('task-1', 'agent-1');

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

      await expect(assigner.assignTask('nonexistent', 'agent-1')).rejects.toThrow(
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

      await assigner.assignTask('task-1', 'agent-1');

      expect(prismaMock.fileLock.upsert).toHaveBeenCalledTimes(2);
      expect(prismaMock.fileLock.upsert).toHaveBeenCalledWith({
        where: { filePath: 'src/index.ts' },
        update: expect.objectContaining({
          lockedByAgent: 'agent-1',
          lockedByTask: 'task-1',
        }),
        create: expect.objectContaining({
          filePath: 'src/index.ts',
          lockedByAgent: 'agent-1',
          lockedByTask: 'task-1',
        }),
      });
    });

    it('should emit task_updated and agent_status_changed events', async () => {
      const task = createTask();
      const agent = createAgent();
      const updatedTask = { ...task, status: 'assigned', assignedAgentId: 'agent-1' };
      const updatedAgent = { ...agent, status: 'busy', currentTaskId: 'task-1' };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);

      await assigner.assignTask('task-1', 'agent-1');

      expect(mockIo.emit).toHaveBeenCalledWith('task_updated', expect.objectContaining({
        type: 'task_updated',
        payload: expect.objectContaining({ status: 'assigned' }),
      }));
      expect(mockIo.emit).toHaveBeenCalledWith('agent_status_changed', expect.objectContaining({
        type: 'agent_status_changed',
      }));
    });

    it('should return task and agent IDs on success', async () => {
      const task = createTask();
      const agent = createAgent();
      const updatedTask = { ...task, status: 'assigned', assignedAgentId: 'agent-1' };
      const updatedAgent = { ...agent, status: 'busy', currentTaskId: 'task-1' };

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);

      const result = await assigner.assignTask('task-1', 'agent-1');

      expect(result).toEqual({ taskId: 'task-1', agentId: 'agent-1' });
    });
  });

  describe('assignNextTask', () => {
    it('should return null when agent not found', async () => {
      prismaMock.agent.findUnique.mockResolvedValue(null);

      const result = await assigner.assignNextTask('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when agent is not idle', async () => {
      const busyAgent = createAgent({ status: 'busy' });
      prismaMock.agent.findUnique.mockResolvedValue(busyAgent);

      const result = await assigner.assignNextTask('agent-1');

      expect(result).toBeNull();
    });

    it('should return null when no pending tasks', async () => {
      const agent = createAgent();
      prismaMock.agent.findUnique.mockResolvedValue(agent);
      prismaMock.fileLock.findMany.mockResolvedValue([]);
      prismaMock.task.findFirst.mockResolvedValue(null);

      const result = await assigner.assignNextTask('agent-1');

      expect(result).toBeNull();
    });

    it('should skip tasks with file conflicts', async () => {
      const agent = createAgent();
      const conflictingTask = createTask({ id: 'task-1', lockedFiles: ['src/locked.ts'] });
      const alternativeTask = createTask({ id: 'task-2', lockedFiles: [] });
      const updatedTask = { ...alternativeTask, status: 'assigned', assignedAgentId: 'agent-1' };
      const updatedAgent = { ...agent, status: 'busy', currentTaskId: 'task-2' };

      prismaMock.agent.findUnique.mockResolvedValue(agent);
      prismaMock.fileLock.findMany.mockResolvedValue([
        createFileLock({ filePath: 'src/locked.ts' }),
      ]);
      prismaMock.task.findFirst
        .mockResolvedValueOnce(conflictingTask) // First call finds conflicting task
        .mockResolvedValueOnce(alternativeTask); // Second call finds alternative
      prismaMock.task.findUnique.mockResolvedValue(alternativeTask);
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);

      const result = await assigner.assignNextTask('agent-1');

      expect(result).toEqual({ taskId: 'task-2', agentId: 'agent-1' });
    });

    it('should return null if all tasks have file conflicts', async () => {
      const agent = createAgent();
      const conflictingTask = createTask({ id: 'task-1', lockedFiles: ['src/locked.ts'] });

      prismaMock.agent.findUnique.mockResolvedValue(agent);
      prismaMock.fileLock.findMany.mockResolvedValue([
        createFileLock({ filePath: 'src/locked.ts' }),
      ]);
      prismaMock.task.findFirst
        .mockResolvedValueOnce(conflictingTask) // First call finds conflicting task
        .mockResolvedValueOnce(null); // No alternative found

      const result = await assigner.assignNextTask('agent-1');

      expect(result).toBeNull();
    });

    it('should assign task when no conflicts exist', async () => {
      const agent = createAgent();
      const task = createTask({ lockedFiles: [] });
      const updatedTask = { ...task, status: 'assigned', assignedAgentId: 'agent-1' };
      const updatedAgent = { ...agent, status: 'busy', currentTaskId: 'task-1' };

      prismaMock.agent.findUnique.mockResolvedValue(agent);
      prismaMock.fileLock.findMany.mockResolvedValue([]);
      prismaMock.task.findFirst.mockResolvedValue(task);
      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.task.update.mockResolvedValue(updatedTask);
      prismaMock.agent.update.mockResolvedValue(updatedAgent);

      const result = await assigner.assignNextTask('agent-1');

      expect(result).toEqual({ taskId: 'task-1', agentId: 'agent-1' });
    });
  });

  describe('getLockedFiles', () => {
    it('should return only non-expired locks', async () => {
      const activeLock = createFileLock({
        filePath: 'src/active.ts',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      });
      const noExpiryLock = createFileLock({
        filePath: 'src/permanent.ts',
        expiresAt: null,
      });

      prismaMock.fileLock.findMany.mockResolvedValue([activeLock, noExpiryLock]);

      const lockedFiles = await assigner.getLockedFiles();

      expect(lockedFiles).toContain('src/active.ts');
      expect(lockedFiles).toContain('src/permanent.ts');
      expect(prismaMock.fileLock.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } },
          ],
        },
      });
    });

    it('should return empty array when no locks exist', async () => {
      prismaMock.fileLock.findMany.mockResolvedValue([]);

      const lockedFiles = await assigner.getLockedFiles();

      expect(lockedFiles).toEqual([]);
    });
  });

  describe('releaseFileLocks', () => {
    it('should delete locks for task', async () => {
      prismaMock.fileLock.deleteMany.mockResolvedValue({ count: 2 });

      await assigner.releaseFileLocks('task-1');

      expect(prismaMock.fileLock.deleteMany).toHaveBeenCalledWith({
        where: { lockedByTask: 'task-1' },
      });
    });

    it('should handle case where no locks exist', async () => {
      prismaMock.fileLock.deleteMany.mockResolvedValue({ count: 0 });

      // Should not throw
      await assigner.releaseFileLocks('task-with-no-locks');

      expect(prismaMock.fileLock.deleteMany).toHaveBeenCalledWith({
        where: { lockedByTask: 'task-with-no-locks' },
      });
    });
  });

  describe('lockFiles', () => {
    it('should create locks for all files', async () => {
      prismaMock.fileLock.upsert.mockResolvedValue({} as FileLock);

      await assigner.lockFiles('task-1', 'agent-1', ['file1.ts', 'file2.ts', 'file3.ts']);

      expect(prismaMock.fileLock.upsert).toHaveBeenCalledTimes(3);
    });

    it('should set 30 minute expiry on locks', async () => {
      prismaMock.fileLock.upsert.mockResolvedValue({} as FileLock);

      const beforeTime = Date.now();
      await assigner.lockFiles('task-1', 'agent-1', ['file.ts']);
      const afterTime = Date.now();

      const upsertCall = prismaMock.fileLock.upsert.mock.calls[0][0];
      const createData = upsertCall.create as { expiresAt: Date };
      const expiresAt = createData.expiresAt.getTime();

      // Should expire ~30 minutes from now
      expect(expiresAt).toBeGreaterThan(beforeTime + 29 * 60 * 1000);
      expect(expiresAt).toBeLessThan(afterTime + 31 * 60 * 1000);
    });

    it('should handle empty file list', async () => {
      await assigner.lockFiles('task-1', 'agent-1', []);

      expect(prismaMock.fileLock.upsert).not.toHaveBeenCalled();
    });
  });
});
