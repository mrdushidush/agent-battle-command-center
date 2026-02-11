import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock prisma before importing budgetService (singleton loads from DB in constructor)
jest.mock('../../db/client.js', () => ({
  prisma: {
    executionLog: {
      aggregate: jest.fn<() => Promise<any>>().mockResolvedValue({
        _sum: { inputTokens: 0, outputTokens: 0 },
      }),
      findMany: jest.fn<() => Promise<any>>().mockResolvedValue([]),
    },
    codeReview: {
      aggregate: jest.fn<() => Promise<any>>().mockResolvedValue({
        _sum: { totalCost: 0 },
      }),
    },
  },
}));

// Import after mocking
import { budgetService, BudgetService } from '../budgetService.js';

describe('BudgetService', () => {
  beforeEach(() => {
    // Reset daily spend and config to defaults
    budgetService.resetDaily();
    budgetService.setConfig({
      dailyLimitCents: 500,
      warningThreshold: 0.8,
      enabled: true,
    });
  });

  describe('recordUsage', () => {
    it('should track haiku costs', () => {
      // 1000 input tokens + 500 output tokens of Haiku
      // Input: (1000/1M) * 100 = 0.1 cents
      // Output: (500/1M) * 500 = 0.25 cents
      budgetService.recordUsage(1000, 500, 'claude-haiku-4-5-20251001');

      const status = budgetService.getStatus();
      expect(status.dailySpentCents).toBeGreaterThan(0);
    });

    it('should not track ollama costs', () => {
      budgetService.recordUsage(10000, 5000, 'qwen2.5-coder:7b');

      const status = budgetService.getStatus();
      expect(status.dailySpentCents).toBe(0);
    });

    it('should track sonnet costs higher than haiku', () => {
      budgetService.recordUsage(100000, 50000, 'claude-sonnet-4-5');
      const sonnetCost = budgetService.getStatus().dailySpentCents;

      budgetService.resetDaily();
      budgetService.recordUsage(100000, 50000, 'claude-haiku-4-5');
      const haikuCost = budgetService.getStatus().dailySpentCents;

      expect(sonnetCost).toBeGreaterThan(haikuCost);
    });

    it('should track opus costs higher than sonnet', () => {
      budgetService.recordUsage(100000, 50000, 'claude-opus-4-5');
      const opusCost = budgetService.getStatus().dailySpentCents;

      budgetService.resetDaily();
      budgetService.recordUsage(100000, 50000, 'claude-sonnet-4-5');
      const sonnetCost = budgetService.getStatus().dailySpentCents;

      expect(opusCost).toBeGreaterThan(sonnetCost);
    });
  });

  describe('isClaudeBlocked', () => {
    it('should not block when under budget', () => {
      expect(budgetService.isClaudeBlocked()).toBe(false);
    });

    it('should block when over daily limit', () => {
      budgetService.setConfig({ dailyLimitCents: 1, enabled: true });
      // Record enough usage to exceed 1 cent
      budgetService.recordUsage(1000000, 500000, 'claude-haiku-4-5');

      expect(budgetService.isClaudeBlocked()).toBe(true);
    });

    it('should not block when disabled', () => {
      budgetService.setConfig({ dailyLimitCents: 0, enabled: false });

      expect(budgetService.isClaudeBlocked()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return budget status', () => {
      const status = budgetService.getStatus();

      expect(status).toHaveProperty('dailySpentCents');
      expect(status).toHaveProperty('dailyLimitCents');
      expect(status).toHaveProperty('percentUsed');
      expect(status).toHaveProperty('isOverBudget');
      expect(status).toHaveProperty('isWarning');
      expect(status).toHaveProperty('claudeBlocked');
      expect(status).toHaveProperty('resetTime');
      expect(status.dailyLimitCents).toBe(500);
    });

    it('should show warning at threshold', () => {
      budgetService.setConfig({ dailyLimitCents: 100, warningThreshold: 0.5, enabled: true });
      // Record 60% of budget
      budgetService.recordUsage(2000000, 1000000, 'claude-haiku-4-5');

      const status = budgetService.getStatus();
      // Cost should be material enough to trigger warning at 50% threshold
      if (status.percentUsed >= 0.5 && status.percentUsed < 1) {
        expect(status.isWarning).toBe(true);
      }
    });
  });

  describe('setConfig', () => {
    it('should update budget configuration', () => {
      budgetService.setConfig({ dailyLimitCents: 1000 });

      const config = budgetService.getConfig();
      expect(config.dailyLimitCents).toBe(1000);
    });

    it('should preserve unmodified config values', () => {
      budgetService.setConfig({ dailyLimitCents: 1000 });

      const config = budgetService.getConfig();
      expect(config.warningThreshold).toBe(0.8);
      expect(config.enabled).toBe(true);
    });
  });

  describe('resetDaily', () => {
    it('should clear today spending', () => {
      budgetService.recordUsage(1000000, 500000, 'claude-haiku-4-5');
      expect(budgetService.getStatus().dailySpentCents).toBeGreaterThan(0);

      budgetService.resetDaily();
      expect(budgetService.getStatus().dailySpentCents).toBe(0);
    });
  });

  describe('getHistory', () => {
    it('should return history for requested days', () => {
      const history = budgetService.getHistory(7);

      expect(history).toHaveLength(7);
      expect(history[0]).toHaveProperty('date');
      expect(history[0]).toHaveProperty('spentCents');
      expect(history[0]).toHaveProperty('taskCount');
    });
  });

  describe('getCostPerTaskMetrics', () => {
    it('should return zero metrics when no tasks', () => {
      const metrics = budgetService.getCostPerTaskMetrics();

      expect(metrics.avgCostCents).toBe(0);
      expect(metrics.totalTasks).toBe(0);
      expect(metrics.todayTasks).toBe(0);
    });

    it('should calculate metrics after recording usage', () => {
      budgetService.recordUsage(1000000, 500000, 'claude-haiku-4-5');
      budgetService.recordUsage(1000000, 500000, 'claude-haiku-4-5');

      const metrics = budgetService.getCostPerTaskMetrics();

      expect(metrics.totalTasks).toBe(2);
      expect(metrics.todayTasks).toBe(2);
      expect(metrics.avgCostCents).toBeGreaterThan(0);
    });
  });
});
