import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AgentManagerService } from '../agentManager.js';
import { prismaMock } from '../../__mocks__/prisma.js';

// Mock the db/client module to use prismaMock
jest.mock('../../db/client.js', () => ({
  prisma: prismaMock,
}));

describe('AgentManagerService', () => {
  let agentManager: AgentManagerService;
  let mockIO: any;

  const makeAgent = (overrides: Record<string, unknown> = {}) => ({
    id: 'agent-1',
    name: 'Coder-01',
    status: 'idle',
    agentTypeId: 'type-1',
    agentType: { id: 'type-1', name: 'coder' },
    config: {},
    stats: {},
    currentTaskId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockIO = {
      emit: jest.fn(),
    };
    agentManager = new AgentManagerService(prismaMock as any, mockIO);
    jest.clearAllMocks();
  });

  describe('getAgents', () => {
    it('should return all agents', async () => {
      const mockAgents = [makeAgent()];
      (prismaMock.agent.findMany as any).mockResolvedValue(mockAgents);

      const agents = await agentManager.getAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('agent-1');
      expect(agents[0].type).toBe('coder');
    });

    it('should return empty array when no agents exist', async () => {
      (prismaMock.agent.findMany as any).mockResolvedValue([]);

      const agents = await agentManager.getAgents();

      expect(agents).toHaveLength(0);
    });
  });

  describe('getAgent', () => {
    it('should return single agent by ID', async () => {
      (prismaMock.agent.findUnique as any).mockResolvedValue(makeAgent());

      const agent = await agentManager.getAgent('agent-1');

      expect(agent).toBeDefined();
      expect(agent?.id).toBe('agent-1');
    });

    it('should return null for non-existent agent', async () => {
      (prismaMock.agent.findUnique as any).mockResolvedValue(null);

      const agent = await agentManager.getAgent('non-existent');

      expect(agent).toBeNull();
    });
  });

  describe('updateAgentConfig', () => {
    it('should update agent configuration', async () => {
      (prismaMock.agent.findUnique as any).mockResolvedValue(makeAgent({ config: {} }));
      (prismaMock.agent.update as any).mockResolvedValue(
        makeAgent({ config: { preferredModel: 'new-model' } })
      );

      const agent = await agentManager.updateAgentConfig('agent-1', {
        preferredModel: 'new-model',
      } as any);

      expect(agent?.config).toEqual({ preferredModel: 'new-model' });
    });

    it('should return null for non-existent agent', async () => {
      (prismaMock.agent.findUnique as any).mockResolvedValue(null);

      const agent = await agentManager.updateAgentConfig('non-existent', {} as any);

      expect(agent).toBeNull();
    });
  });

  describe('setAgentOffline', () => {
    it('should set agent to offline status and release file locks', async () => {
      (prismaMock.agent.findUnique as any).mockResolvedValue(makeAgent());
      (prismaMock.fileLock.deleteMany as any).mockResolvedValue({ count: 0 });
      (prismaMock.agent.update as any).mockResolvedValue(makeAgent({ status: 'offline' }));

      const agent = await agentManager.setAgentOffline('agent-1');

      expect(agent?.status).toBe('offline');
      expect(prismaMock.fileLock.deleteMany).toHaveBeenCalledWith({
        where: { lockedByAgent: 'agent-1' },
      });
    });

    it('should return task to pool if agent has one assigned', async () => {
      (prismaMock.agent.findUnique as any).mockResolvedValue(makeAgent({ currentTaskId: 'task-1' }));
      (prismaMock.fileLock.deleteMany as any).mockResolvedValue({ count: 0 });
      (prismaMock.task.update as any).mockResolvedValue({});
      (prismaMock.agent.update as any).mockResolvedValue(makeAgent({ status: 'offline' }));

      await agentManager.setAgentOffline('agent-1');

      expect(prismaMock.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: 'pending', assignedAgentId: null }),
        })
      );
    });
  });

  describe('setAgentOnline', () => {
    it('should set agent to idle status', async () => {
      (prismaMock.agent.update as any).mockResolvedValue(makeAgent({ status: 'idle' }));

      const agent = await agentManager.setAgentOnline('agent-1');

      expect(agent?.status).toBe('idle');
      expect(mockIO.emit).toHaveBeenCalledWith('agent_status_changed', expect.anything());
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent when idle', async () => {
      (prismaMock.agent.findUnique as any).mockResolvedValue(makeAgent());
      (prismaMock.agent.delete as any).mockResolvedValue({});

      const result = await agentManager.deleteAgent('agent-1');

      expect(result).toBe(true);
      expect(mockIO.emit).toHaveBeenCalledWith('agent_deleted', expect.anything());
    });

    it('should reject deletion when agent is busy', async () => {
      (prismaMock.agent.findUnique as any).mockResolvedValue(makeAgent({ status: 'busy' }));

      await expect(agentManager.deleteAgent('agent-1')).rejects.toThrow(
        'Cannot delete agent while busy'
      );
    });

    it('should return false for non-existent agent', async () => {
      (prismaMock.agent.findUnique as any).mockResolvedValue(null);

      const result = await agentManager.deleteAgent('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('pauseAgent', () => {
    it('should set busy agent to stuck (paused) status', async () => {
      (prismaMock.agent.findUnique as any).mockResolvedValue(makeAgent({ status: 'busy' }));
      (prismaMock.agent.update as any).mockResolvedValue(makeAgent({ status: 'stuck' }));

      const agent = await agentManager.pauseAgent('agent-1');

      expect(agent?.status).toBe('stuck');
      expect(mockIO.emit).toHaveBeenCalledWith('agent_status_changed', expect.anything());
    });

    it('should not change status if agent is not busy', async () => {
      const idleAgent = makeAgent({ status: 'idle' });
      (prismaMock.agent.findUnique as any).mockResolvedValue(idleAgent);

      const agent = await agentManager.pauseAgent('agent-1');

      // Should return agent without updating (not busy)
      expect(prismaMock.agent.update).not.toHaveBeenCalled();
    });
  });

  describe('resumeAgent', () => {
    it('should set agent to idle when no current task', async () => {
      (prismaMock.agent.findUnique as any).mockResolvedValue(
        makeAgent({ status: 'stuck', currentTaskId: null })
      );
      (prismaMock.agent.update as any).mockResolvedValue(makeAgent({ status: 'idle' }));

      const agent = await agentManager.resumeAgent('agent-1');

      expect(agent?.status).toBe('idle');
    });

    it('should set agent to busy when it has a current task', async () => {
      (prismaMock.agent.findUnique as any).mockResolvedValue(
        makeAgent({ status: 'stuck', currentTaskId: 'task-1' })
      );
      (prismaMock.agent.update as any).mockResolvedValue(makeAgent({ status: 'busy' }));

      const agent = await agentManager.resumeAgent('agent-1');

      expect(agent?.status).toBe('busy');
    });
  });
});
