import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SchedulerService } from '../schedulerService.js';

// Mock training data service
jest.mock('../trainingDataService.js', () => ({
  TrainingDataService: jest.fn().mockImplementation(() => ({
    exportTrainingData: jest.fn<() => Promise<any>>().mockResolvedValue({ path: '/tmp/export.jsonl', count: 5 }),
  })),
}));

// Mock fs
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn<() => Promise<any>>().mockResolvedValue(undefined),
    readdir: jest.fn<() => Promise<any>>().mockResolvedValue([]),
    rm: jest.fn<() => Promise<any>>().mockResolvedValue(undefined),
    stat: jest.fn<() => Promise<any>>().mockResolvedValue({ mtimeMs: Date.now() }),
  },
}));

describe('SchedulerService', () => {
  let mockPrisma: any;
  let scheduler: SchedulerService;

  beforeEach(() => {
    mockPrisma = {};
    // Disable training export to avoid timer side effects
    process.env.TRAINING_EXPORT_ENABLED = 'false';
    scheduler = new SchedulerService(mockPrisma, {
      trainingExportEnabled: false,
    });
  });

  afterEach(() => {
    scheduler.stop();
    delete process.env.TRAINING_EXPORT_ENABLED;
  });

  describe('constructor', () => {
    it('should accept partial config', () => {
      const svc = new SchedulerService(mockPrisma, {
        trainingExportIntervalHours: 12,
      });

      const status = svc.getStatus();
      expect(status.trainingExport.intervalHours).toBe(12);
      svc.stop();
    });

    it('should use defaults when no config provided', () => {
      const svc = new SchedulerService(mockPrisma, {
        trainingExportEnabled: false,
      });

      const status = svc.getStatus();
      expect(status.trainingExport.intervalHours).toBe(24);
      svc.stop();
    });
  });

  describe('start / stop', () => {
    it('should start and stop without errors', () => {
      expect(() => scheduler.start()).not.toThrow();
      expect(() => scheduler.stop()).not.toThrow();
    });

    it('should handle double stop gracefully', () => {
      scheduler.start();
      scheduler.stop();
      expect(() => scheduler.stop()).not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return scheduler status', () => {
      const status = scheduler.getStatus();

      expect(status.trainingExport).toBeDefined();
      expect(status.trainingExport).toHaveProperty('enabled');
      expect(status.trainingExport).toHaveProperty('intervalHours');
      expect(status.trainingExport).toHaveProperty('lastExport');
      expect(status.trainingExport).toHaveProperty('exportPath');
    });
  });

  describe('triggerExport', () => {
    it('should trigger manual export', async () => {
      const result = await scheduler.triggerExport();

      expect(result).toHaveProperty('success');
    });
  });
});
