/**
 * Budget Service
 *
 * Tracks daily API spending and enforces budget limits.
 * When budget is exceeded, blocks Claude API calls but allows Ollama (free).
 */

import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../db/client.js';

export interface BudgetConfig {
  dailyLimitCents: number;  // Budget in cents (e.g., 500 = $5.00)
  warningThreshold: number; // Percentage to trigger warning (0.8 = 80%)
  enabled: boolean;
}

export interface BudgetStatus {
  dailySpentCents: number;
  dailyLimitCents: number;
  allTimeSpentCents: number;
  percentUsed: number;
  isOverBudget: boolean;
  isWarning: boolean;
  claudeBlocked: boolean;
  resetTime: Date;
  lastUpdated: Date;
}

export interface DailySpend {
  date: string;  // YYYY-MM-DD
  spentCents: number;
  taskCount: number;
}

// Cost rates in cents per 1M tokens (Feb 2026 Anthropic pricing)
// Note: Using current model versions (Haiku 4.5, Sonnet 4, Opus 4.5)
const COST_RATES = {
  haiku: { input: 100, output: 500 },     // $1/$5 per 1M (Haiku 4.5)
  sonnet: { input: 300, output: 1500 },   // $3/$15 per 1M (Sonnet 4/4.5)
  opus: { input: 500, output: 2500 },     // $5/$25 per 1M (Opus 4.5 - cheaper than 4!)
};

class BudgetService {
  private static instance: BudgetService;
  private io: SocketIOServer | null = null;

  private config: BudgetConfig = {
    dailyLimitCents: 500, // $5.00 default
    warningThreshold: 0.8,
    enabled: true,
  };

  private dailySpend: Map<string, DailySpend> = new Map();
  private allTimeSpentCents: number = 0;

  private constructor() {
    // Load from database on init
    this.loadFromDatabase();
  }

  static getInstance(): BudgetService {
    if (!BudgetService.instance) {
      BudgetService.instance = new BudgetService();
    }
    return BudgetService.instance;
  }

  setSocketIO(io: SocketIOServer): void {
    this.io = io;
  }

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private getResetTime(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private async loadFromDatabase(): Promise<void> {
    try {
      // Calculate all-time spent from execution logs
      const result = await prisma.executionLog.aggregate({
        _sum: {
          inputTokens: true,
          outputTokens: true,
        },
        where: {
          modelUsed: {
            not: null,
          },
        },
      });

      // Also get code review costs
      const reviewCosts = await prisma.codeReview.aggregate({
        _sum: {
          totalCost: true,
        },
      });

      // Calculate costs from tokens (approximate - actual calculation happens per-log)
      const logs = await prisma.executionLog.findMany({
        select: {
          inputTokens: true,
          outputTokens: true,
          modelUsed: true,
          timestamp: true,
        },
        where: {
          modelUsed: {
            not: null,
          },
        },
      });

      let totalCents = 0;
      const today = this.getTodayKey();
      let todayCents = 0;
      let todayTasks = 0;

      for (const log of logs) {
        const costCents = this.calculateCostCents(
          log.inputTokens || 0,
          log.outputTokens || 0,
          log.modelUsed || ''
        );
        totalCents += costCents;

        const logDate = log.timestamp.toISOString().split('T')[0];
        if (logDate === today) {
          todayCents += costCents;
          todayTasks++;
        }
      }

      // Add code review costs
      const reviewCostCents = Math.round((Number(reviewCosts._sum.totalCost) || 0) * 100);
      totalCents += reviewCostCents;

      this.allTimeSpentCents = totalCents;

      if (todayCents > 0) {
        this.dailySpend.set(today, {
          date: today,
          spentCents: todayCents,
          taskCount: todayTasks,
        });
      }

      console.log(`💰 Budget loaded: Today $${(todayCents/100).toFixed(2)}, All-time $${(totalCents/100).toFixed(2)}`);
    } catch (error) {
      console.error('Failed to load budget from database:', error);
    }
  }

  private calculateCostCents(inputTokens: number, outputTokens: number, model: string): number {
    const modelLower = model.toLowerCase();

    let rates = { input: 0, output: 0 };

    if (modelLower.includes('opus')) {
      rates = COST_RATES.opus;
    } else if (modelLower.includes('sonnet')) {
      rates = COST_RATES.sonnet;
    } else if (modelLower.includes('haiku')) {
      rates = COST_RATES.haiku;
    } else {
      // Ollama (local or remote) or unknown - free
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * rates.input;
    const outputCost = (outputTokens / 1_000_000) * rates.output;

    return Math.round((inputCost + outputCost) * 100) / 100; // Round to cents
  }

  /**
   * Record API usage and update budget tracking
   */
  recordUsage(inputTokens: number, outputTokens: number, model: string): void {
    const costCents = this.calculateCostCents(inputTokens, outputTokens, model);

    if (costCents === 0) return; // Free model, no tracking needed

    const today = this.getTodayKey();
    const existing = this.dailySpend.get(today) || {
      date: today,
      spentCents: 0,
      taskCount: 0,
    };

    existing.spentCents += costCents;
    existing.taskCount++;
    this.dailySpend.set(today, existing);

    this.allTimeSpentCents += costCents;

    // Emit update
    this.emitBudgetUpdate();

    console.log(`💵 Cost recorded: $${(costCents/100).toFixed(4)} (${model}) | Today: $${(existing.spentCents/100).toFixed(2)}/${(this.config.dailyLimitCents/100).toFixed(2)}`);
  }

  /**
   * Check if Claude APIs should be blocked due to budget
   */
  isClaudeBlocked(): boolean {
    if (!this.config.enabled) return false;

    const today = this.getTodayKey();
    const todaySpend = this.dailySpend.get(today)?.spentCents || 0;

    return todaySpend >= this.config.dailyLimitCents;
  }

  /**
   * Get current budget status
   */
  getStatus(): BudgetStatus {
    const today = this.getTodayKey();
    const todaySpend = this.dailySpend.get(today)?.spentCents || 0;
    const percentUsed = this.config.dailyLimitCents > 0
      ? todaySpend / this.config.dailyLimitCents
      : 0;

    return {
      dailySpentCents: todaySpend,
      dailyLimitCents: this.config.dailyLimitCents,
      allTimeSpentCents: this.allTimeSpentCents,
      percentUsed,
      isOverBudget: percentUsed >= 1,
      isWarning: percentUsed >= this.config.warningThreshold && percentUsed < 1,
      claudeBlocked: this.isClaudeBlocked(),
      resetTime: this.getResetTime(),
      lastUpdated: new Date(),
    };
  }

  /**
   * Get configuration
   */
  getConfig(): BudgetConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(updates: Partial<BudgetConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emitBudgetUpdate();
    console.log(`⚙️ Budget config updated:`, this.config);
  }

  /**
   * Reset daily budget (manual reset)
   */
  resetDaily(): void {
    const today = this.getTodayKey();
    this.dailySpend.delete(today);
    this.emitBudgetUpdate();
    console.log(`🔄 Daily budget reset`);
  }

  /**
   * Get spending history
   */
  getHistory(days: number = 7): DailySpend[] {
    const result: DailySpend[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];

      result.push(this.dailySpend.get(key) || {
        date: key,
        spentCents: 0,
        taskCount: 0,
      });
    }

    return result.reverse();
  }

  /**
   * Get cost per task metrics
   */
  getCostPerTaskMetrics(): { avgCostCents: number; totalTasks: number; todayAvg: number; todayTasks: number } {
    const today = this.getTodayKey();
    const todayData = this.dailySpend.get(today);

    let totalTasks = 0;
    let totalCost = 0;

    for (const spend of this.dailySpend.values()) {
      totalTasks += spend.taskCount;
      totalCost += spend.spentCents;
    }

    return {
      avgCostCents: totalTasks > 0 ? totalCost / totalTasks : 0,
      totalTasks,
      todayAvg: todayData && todayData.taskCount > 0
        ? todayData.spentCents / todayData.taskCount
        : 0,
      todayTasks: todayData?.taskCount || 0,
    };
  }

  private emitBudgetUpdate(): void {
    if (!this.io) return;

    const status = this.getStatus();
    const costPerTask = this.getCostPerTaskMetrics();

    this.io.emit('budget_updated', {
      type: 'budget_updated',
      payload: {
        ...status,
        costPerTask,
      },
      timestamp: new Date(),
    });
  }
}

export const budgetService = BudgetService.getInstance();
export { BudgetService };
