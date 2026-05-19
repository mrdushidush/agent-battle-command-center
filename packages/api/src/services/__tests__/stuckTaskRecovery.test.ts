import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { StuckTaskRecoveryService } from '../stuckTaskRecovery.js';

// Mock dependencies
jest.mock('../resourcePool.js', () => ({
  ResourcePoolService: {
    getInstance: jest.fn().mockReturnValue({
      release: jest.fn(),
      hasResource: jest.fn().mockReturnValue(false),
    }),
  },
}));

jest.mock('../taskAssigner.js', () => ({
  TaskAssigner: jest.fn().mockImplementation(() => ({
    releaseFileLocks: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  })),
}));

jest.mock('../mcpBridge.js', () => ({
  mcpBridge: { publishEvent: jest.fn() },
}));

describe('StuckTaskRecoveryService', () => {
  let service: StuckTaskRecoveryService;
  let mockPrisma: any;
  let mockIO: any;

  beforeEach(() => {
    mockPrisma = {
      task: {
        findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
        update: jest.fn<() => Promise<any>>(),
      },
      agent: {
        update: jest.fn<() => Promise<any>>(),
      },
      taskExecution: {
        updateMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 0 }),
      },
      fileLock: {
        deleteMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 0 }),
      },
    };
    mockIO = { emit: jest.fn() };

    service = new StuckTaskRecoveryService(mockPrisma, mockIO, {
      enabled: true,
      taskTimeoutMs: 60000,
      checkIntervalMs: 5000,
    });
  });

  afterEach(() => {
    service.stop();
  });

  describe('constructor', () => {
    it('should accept custom config', () => {
      const config = service.getConfig();

      expect(config.taskTimeoutMs).toBe(60000);
      expect(config.checkIntervalMs).toBe(5000);
      expect(config.enabled).toBe(true);
    });

    it('should use defaults when no config provided', () => {
      const svc = new StuckTaskRecoveryService(mockPrisma, mockIO);
      const config = svc.getConfig();

      expect(config.taskTimeoutMs).toBe(300000); // 5 minutes
      expect(config.checkIntervalMs).toBe(30000); // 30 seconds
      expect(config.enabled).toBe(true);
      svc.stop();
    });
  });

  describe('start / stop', () => {
    it('should start and stop without errors', () => {
      expect(() => service.start()).not.toThrow();
      expect(() => service.stop()).not.toThrow();
    });
  });

  describe('checkAndRecoverStuckTasks', () => {
    it('should return empty array when no stuck tasks', async () => {
      const results = await service.checkAndRecoverStuckTasks();

      expect(results).toEqual([]);
    });
  });

  describe('getStatus', () => {
    it('should return service status', () => {
      const status = service.getStatus();

      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('taskTimeoutMs');
      expect(status).toHaveProperty('checkIntervalMs');
      expect(status).toHaveProperty('recentRecoveries');
      expect(status.enabled).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      service.updateConfig({ taskTimeoutMs: 300000 });

      const config = service.getConfig();
      expect(config.taskTimeoutMs).toBe(300000);
    });

    it('should preserve unmodified values', () => {
      service.updateConfig({ taskTimeoutMs: 300000 });

      const config = service.getConfig();
      expect(config.checkIntervalMs).toBe(5000); // unchanged
    });
  });

  describe('triggerCheck', () => {
    it('should run manual check', async () => {
      const results = await service.triggerCheck();

      expect(Array.isArray(results)).toBe(true);
    });
  });
});
