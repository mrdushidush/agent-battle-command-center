import type { ExecutionLog } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Cost rates per million tokens (input / output)
 * Rates in USD per 1M tokens
 * Updated Feb 2026 with official Anthropic pricing
 *
 * | Model              | Input   | Output  |
 * |--------------------|---------|---------|
 * | Opus 4.5           | $5      | $25     |
 * | Opus 4/4.1         | $15     | $75     |
 * | Sonnet 4/4.5       | $3      | $15     |
 * | Haiku 4.5          | $1      | $5      |
 * | Haiku 3.5          | $0.80   | $4      |
 * | Haiku 3            | $0.25   | $1.25   |
 */
const COST_RATES: Record<string, { input: number; output: number }> = {
  // Ollama - free local model
  'ollama': { input: 0, output: 0 },

  // Claude Haiku 3 (deprecated but kept for legacy logs)
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-haiku-3': { input: 0.25, output: 1.25 },

  // Claude Haiku 3.5
  'claude-3-5-haiku': { input: 0.80, output: 4 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4 },
  'claude-haiku-3-5': { input: 0.80, output: 4 },

  // Claude Haiku 4.5 - Current default
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },

  // Claude Sonnet 3.5/3.7 (deprecated)
  'claude-3-5-sonnet': { input: 3, output: 15 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-sonnet-20240620': { input: 3, output: 15 },
  'claude-3-7-sonnet': { input: 3, output: 15 },

  // Claude Sonnet 4/4.5 - Current default
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15 },

  // Claude Opus 3/4/4.1 (legacy pricing)
  'claude-3-opus': { input: 15, output: 75 },
  'claude-opus-3': { input: 15, output: 75 },
  'claude-opus-4': { input: 15, output: 75 },
  'claude-opus-4-1': { input: 15, output: 75 },

  // Claude Opus 4.5 - Current default (cheaper than Opus 4!)
  'claude-opus-4-5': { input: 5, output: 25 },
  'claude-opus-4-5-20251101': { input: 5, output: 25 },

  // xAI Grok models (estimated pricing)
  'grok-code-fast-1': { input: 5, output: 15 },
  'grok-3-latest': { input: 5, output: 15 },
  'grok-4-latest': { input: 10, output: 30 },
};

/**
 * Get the cost rate for a specific model
 */
function getModelRate(modelName: string | null): { input: number; output: number } {
  if (!modelName) {
    return { input: 0, output: 0 };
  }

  // Normalize model name
  const normalizedModel = modelName.toLowerCase().trim();

  // Check for exact match
  if (normalizedModel in COST_RATES) {
    return COST_RATES[normalizedModel];
  }

  // Check for partial matches (order matters - check specific versions first)
  if (normalizedModel.includes('ollama')) {
    return COST_RATES['ollama'];
  }
  if (normalizedModel.includes('grok')) {
    return COST_RATES['grok-code-fast-1']; // Default Grok pricing
  }
  // Haiku versions
  if (normalizedModel.includes('haiku-4-5') || normalizedModel.includes('haiku-4.5')) {
    return COST_RATES['claude-haiku-4-5'];
  }
  if (normalizedModel.includes('haiku-3-5') || normalizedModel.includes('haiku-3.5')) {
    return COST_RATES['claude-3-5-haiku'];
  }
  if (normalizedModel.includes('haiku')) {
    return COST_RATES['claude-haiku-4-5']; // Default to current version
  }
  // Sonnet versions
  if (normalizedModel.includes('sonnet')) {
    return COST_RATES['claude-sonnet-4']; // All Sonnet versions same price
  }
  // Opus versions
  if (normalizedModel.includes('opus-4-5') || normalizedModel.includes('opus-4.5')) {
    return COST_RATES['claude-opus-4-5'];
  }
  if (normalizedModel.includes('opus')) {
    return COST_RATES['claude-opus-4']; // Default to legacy pricing for older Opus
  }

  // Default to zero cost for unknown models
  console.warn(`Unknown model for cost calculation: ${modelName}`);
  return { input: 0, output: 0 };
}

/**
 * Calculate cost for a single execution log entry
 */
export function calculateLogCost(log: ExecutionLog): number {
  const inputTokens = log.inputTokens ?? 0;
  const outputTokens = log.outputTokens ?? 0;
  const model = log.modelUsed;

  if (inputTokens === 0 && outputTokens === 0) {
    return 0;
  }

  const rates = getModelRate(model);

  // Cost = (input_tokens / 1M) * input_rate + (output_tokens / 1M) * output_rate
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;

  return inputCost + outputCost;
}

/**
 * Calculate total cost from multiple execution logs
 */
export function calculateTotalCost(logs: ExecutionLog[]): number {
  return logs.reduce((total, log) => total + calculateLogCost(log), 0);
}

/**
 * Cost summary interface
 */
export interface CostSummary {
  totalCost: number;
  byModel: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    count: number;
  }>;
  byModelTier: {
    free: number;
    grok: number;
    haiku: number;
    sonnet: number;
    opus: number;
  };
  totalInputTokens: number;
  totalOutputTokens: number;
  logCount: number;
}

/**
 * Get model tier for grouping
 */
function getModelTier(modelName: string | null): 'free' | 'grok' | 'haiku' | 'sonnet' | 'opus' {
  if (!modelName) return 'free';

  const normalized = modelName.toLowerCase();

  if (normalized.includes('ollama')) return 'free';
  if (normalized.includes('grok')) return 'grok';
  if (normalized.includes('haiku')) return 'haiku';
  if (normalized.includes('opus')) return 'opus';
  if (normalized.includes('sonnet')) return 'sonnet';

  return 'free';
}

/**
 * Aggregate costs from execution logs with detailed breakdown
 */
export function aggregateCosts(logs: ExecutionLog[]): CostSummary {
  const byModel: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    count: number;
  }> = {};

  const byModelTier = {
    free: 0,
    grok: 0,
    haiku: 0,
    sonnet: 0,
    opus: 0,
  };

  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const log of logs) {
    const inputTokens = log.inputTokens ?? 0;
    const outputTokens = log.outputTokens ?? 0;
    const model = log.modelUsed ?? 'unknown';
    const logCost = calculateLogCost(log);

    // Update totals
    totalCost += logCost;
    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;

    // Update by-model breakdown
    if (!byModel[model]) {
      byModel[model] = {
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        count: 0,
      };
    }

    byModel[model].inputTokens += inputTokens;
    byModel[model].outputTokens += outputTokens;
    byModel[model].cost += logCost;
    byModel[model].count += 1;

    // Update by-tier breakdown
    const tier = getModelTier(model);
    byModelTier[tier] += logCost;
  }

  return {
    totalCost,
    byModel,
    byModelTier,
    totalInputTokens,
    totalOutputTokens,
    logCount: logs.length,
  };
}

/**
 * Format cost as USD string
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(6)}`;
}

/**
 * Convert number to Prisma Decimal
 */
export function toDecimal(value: number): Decimal {
  return new Decimal(value);
}
