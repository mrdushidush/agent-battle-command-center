import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BudgetService } from '../budgetService.js';

describe('BudgetService', () => {
  let budgetService: BudgetService;

  beforeEach(() => {
    // Get singleton instance and reset state
    budgetService = BudgetService.getInstance();
    budgetService.setConfig({ dailyLimitCents: 500, warningThreshold: 0.8, enabled: true });
  });

  describe('recordCost', () => {
    it('should track daily spending', async () => {
      await budgetService.recordCost(100, 'haiku', 'test-task-1');

      const status = budgetService.getStatus();
      expect(status.dailySpentCents).toBe(100);
      expect(status.allTimeSpentCents).toBe(100);
      expect(status.percentUsed).toBeCloseTo(0.2); // 100/500 = 20%
      expect(status.isOverBudget).toBe(false);
      expect(status.isWarning).toBe(false);
    });

    it('should trigger warning at 80% threshold', async () => {
      await budgetService.recordCost(400, 'haiku', 'test-task-1');

      const status = budgetService.getStatus();
      expect(status.percentUsed).toBeCloseTo(0.8);
      expect(status.isWarning).toBe(true);
      expect(status.isOverBudget).toBe(false);
    });

    it('should block Claude when over budget', async () => {
      await budgetService.recordCost(600, 'opus', 'test-task-1');

      const status = budgetService.getStatus();
      expect(status.isOverBudget).toBe(true);
      expect(status.claudeBlocked).toBe(true);
      expect(status.percentUsed).toBeGreaterThan(1.0);
    });

    it('should accumulate multiple costs', async () => {
      await budgetService.recordCost(100, 'haiku', 'task-1');
      await budgetService.recordCost(150, 'sonnet', 'task-2');
      await budgetService.recordCost(200, 'opus', 'task-3');

      const status = budgetService.getStatus();
      expect(status.dailySpentCents).toBe(450);
      expect(status.allTimeSpentCents).toBe(450);
    });
  });

  describe('checkBudget', () => {
    it('should allow requests when under budget', () => {
      const result = budgetService.checkBudget();
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block requests when over budget', async () => {
      await budgetService.recordCost(600, 'opus', 'expensive-task');

      const result = budgetService.checkBudget();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('budget');
    });

    it('should allow requests when budget is disabled', async () => {
      budgetService.updateConfig({ enabled: false });
      await budgetService.recordCost(1000, 'opus', 'expensive-task');

      const result = budgetService.checkBudget();
      expect(result.allowed).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update daily limit', () => {
      budgetService.updateConfig({ dailyLimitCents: 1000 });

      const status = budgetService.getStatus();
      expect(status.dailyLimitCents).toBe(1000);
    });

    it('should update warning threshold', () => {
      budgetService.updateConfig({ warningThreshold: 0.9 });

      // Warning should trigger at 90% instead of 80%
      budgetService.recordCost(450, 'haiku', 'task-1').then(() => {
        const status = budgetService.getStatus();
        expect(status.isWarning).toBe(false); // 450/500 = 90%, exactly at threshold
      });
    });

    it('should enable/disable budget enforcement', async () => {
      budgetService.updateConfig({ enabled: false });
      await budgetService.recordCost(1000, 'opus', 'expensive-task');

      const status = budgetService.getStatus();
      expect(status.claudeBlocked).toBe(false); // Not blocked when disabled
    });
  });

  describe('calculateTaskCost', () => {
    it('should calculate Haiku cost correctly', () => {
      const cost = budgetService.calculateTaskCost(1000, 500, 'haiku');
      // (1000 * 100 / 1M) + (500 * 500 / 1M) = 0.1 + 0.25 = 0.35 cents
      expect(cost).toBeCloseTo(0.35);
    });

    it('should calculate Sonnet cost correctly', () => {
      const cost = budgetService.calculateTaskCost(1000, 500, 'sonnet');
      // (1000 * 300 / 1M) + (500 * 1500 / 1M) = 0.3 + 0.75 = 1.05 cents
      expect(cost).toBeCloseTo(1.05);
    });

    it('should calculate Opus cost correctly', () => {
      const cost = budgetService.calculateTaskCost(1000, 500, 'opus');
      // (1000 * 500 / 1M) + (500 * 2500 / 1M) = 0.5 + 1.25 = 1.75 cents
      expect(cost).toBeCloseTo(1.75);
    });

    it('should return 0 for Ollama (free)', () => {
      const cost = budgetService.calculateTaskCost(1000, 500, 'ollama');
      expect(cost).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should include cost per task stats', async () => {
      await budgetService.recordCost(10, 'haiku', 'task-1');
      await budgetService.recordCost(20, 'sonnet', 'task-2');
      await budgetService.recordCost(30, 'opus', 'task-3');

      const status = budgetService.getStatus();
      expect(status.costPerTask).toBeDefined();
      expect(status.costPerTask.totalTasks).toBe(3);
      expect(status.costPerTask.avgCostCents).toBeCloseTo(20); // (10+20+30)/3
    });

    it('should format display values correctly', () => {
      const status = budgetService.getStatus();
      expect(status.display).toBeDefined();
      expect(status.display.dailySpent).toMatch(/^\$/);
      expect(status.display.dailyLimit).toMatch(/^\$/);
      expect(status.display.avgCostPerTask).toMatch(/^\$/);
    });

    it('should include reset time for tomorrow midnight UTC', () => {
      const status = budgetService.getStatus();
      const resetTime = new Date(status.resetTime);

      expect(resetTime.getUTCHours()).toBe(0);
      expect(resetTime.getUTCMinutes()).toBe(0);
      expect(resetTime.getUTCSeconds()).toBe(0);
      expect(resetTime.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
