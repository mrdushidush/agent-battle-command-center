import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SchedulerService } from '../schedulerService.js';
import { prismaMock } from '../../__mocks__/prisma.js';

describe('SchedulerService', () => {
  let schedulerService: SchedulerService;

  beforeEach(() => {
    schedulerService = new SchedulerService(prismaMock);
  });

  afterEach(() => {
    schedulerService.stop();
  });

  describe('constructor', () => {
    it('should create service instance', () => {
      const instance = new SchedulerService(prismaMock);
      expect(instance).toBeInstanceOf(SchedulerService);
    });
  });

  describe('start/stop', () => {
    it('should start scheduler', () => {
      schedulerService.start();
      const status = schedulerService.getStatus();

      expect(status.running).toBe(true);
    });

    it('should stop scheduler', () => {
      schedulerService.start();
      schedulerService.stop();

      const status = schedulerService.getStatus();
      expect(status.running).toBe(false);
    });

    it('should not double-start', () => {
      schedulerService.start();
      const status1 = schedulerService.getStatus();

      schedulerService.start(); // Should be no-op
      const status2 = schedulerService.getStatus();

      expect(status1.running).toBe(true);
      expect(status2.running).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return scheduler status', () => {
      const status = schedulerService.getStatus();

      expect(status).toBeDefined();
      expect(status.running).toBeDefined();
      expect(status.config).toBeDefined();
      expect(status.lastExportTime).toBeDefined();
      expect(status.nextExportTime).toBeDefined();
    });

    it('should include export interval in config', () => {
      const status = schedulerService.getStatus();

      expect(status.config.exportIntervalHours).toBeDefined();
      expect(status.config.exportPath).toBeDefined();
      expect(status.config.enabled).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('should update export interval', () => {
      schedulerService.updateConfig({ exportIntervalHours: 48 });

      const status = schedulerService.getStatus();
      expect(status.config.exportIntervalHours).toBe(48);
    });

    it('should update export path', () => {
      const newPath = '/custom/export/path';
      schedulerService.updateConfig({ exportPath: newPath });

      const status = schedulerService.getStatus();
      expect(status.config.exportPath).toBe(newPath);
    });

    it('should enable/disable exports', () => {
      schedulerService.updateConfig({ enabled: false });

      const status = schedulerService.getStatus();
      expect(status.config.enabled).toBe(false);
    });
  });

  describe('triggerExport', () => {
    it('should trigger manual export', async () => {
      const result = await schedulerService.triggerExport();

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should update last export time after export', async () => {
      const statusBefore = schedulerService.getStatus();
      const lastExportBefore = statusBefore.lastExportTime;

      await schedulerService.triggerExport();

      const statusAfter = schedulerService.getStatus();
      const lastExportAfter = statusAfter.lastExportTime;

      if (lastExportBefore && lastExportAfter) {
        expect(new Date(lastExportAfter).getTime()).toBeGreaterThanOrEqual(
          new Date(lastExportBefore).getTime()
        );
      }
    });
  });
});
