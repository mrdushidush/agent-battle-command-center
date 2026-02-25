/**
 * Cost Savings Calculator for Battle Claw
 *
 * Estimates what a task *would have cost* on cloud-only routing (e.g., OpenClaw)
 * vs what it actually cost via ABCC's 3-tier system (90%+ tasks are FREE via Ollama).
 *
 * Cloud equivalent estimates are conservative — based on typical token counts from
 * ABCC stress tests. Real cloud costs are likely higher due to conversation history,
 * retries, and tool call overhead.
 */

export interface CostSavings {
  /** What the task actually cost (0 for Ollama) */
  actualCostUSD: number;
  /** What it would have cost on a cloud-only system */
  cloudEquivalentUSD: number;
  /** Dollars saved */
  savingsUSD: number;
  /** Percentage saved (0-100) */
  savingsPercent: number;
  /** Which cloud model would have been used */
  cloudEquivalentModel: string;
}

/**
 * Cloud equivalent cost table by complexity
 *
 * Conservative estimates based on typical coding task token usage:
 * - Simple tasks (C1-C2): ~1K input + ~500 output tokens → Haiku
 * - Low tasks (C3-C4): ~2K input + ~1K output tokens → Haiku
 * - Moderate tasks (C5-C6): ~2.5K input + ~1.5K output tokens → Sonnet
 * - Complex tasks (C7-C8): ~3.5K input + ~2K output tokens → Sonnet
 * - Extreme tasks (C9): ~5K input + ~3K output tokens → Sonnet
 * - Decomposition (C10): Actual ABCC cost (already using cloud)
 */
const CLOUD_EQUIVALENTS: Record<number, { model: string; costUSD: number }> = {
  1: { model: 'claude-haiku-4-5', costUSD: 0.004 },
  2: { model: 'claude-haiku-4-5', costUSD: 0.006 },
  3: { model: 'claude-haiku-4-5', costUSD: 0.009 },
  4: { model: 'claude-haiku-4-5', costUSD: 0.012 },
  5: { model: 'claude-sonnet-4', costUSD: 0.030 },
  6: { model: 'claude-sonnet-4', costUSD: 0.045 },
  7: { model: 'claude-sonnet-4', costUSD: 0.053 },
  8: { model: 'claude-sonnet-4', costUSD: 0.060 },
  9: { model: 'claude-sonnet-4', costUSD: 0.090 },
  10: { model: 'actual', costUSD: 0 }, // Use actual cost
};

/**
 * Calculate cost savings for a single task
 */
export function calculateSavings(
  complexity: number,
  actualCostUSD: number,
): CostSavings {
  const clamped = Math.min(10, Math.max(1, Math.round(complexity)));

  // C10 decomposition tasks use actual cloud — savings come from routing, not avoidance
  if (clamped >= 10) {
    // Estimate what a naive cloud system would pay (Opus for complex decomposition)
    const naiveCloudCost = 0.15; // ~5K input + ~3K output at Opus rates
    const savings = Math.max(0, naiveCloudCost - actualCostUSD);
    return {
      actualCostUSD,
      cloudEquivalentUSD: naiveCloudCost,
      savingsUSD: savings,
      savingsPercent: naiveCloudCost > 0 ? (savings / naiveCloudCost) * 100 : 0,
      cloudEquivalentModel: 'claude-opus-4-5',
    };
  }

  const equiv = CLOUD_EQUIVALENTS[clamped];
  const cloudCost = equiv.costUSD;
  const savings = Math.max(0, cloudCost - actualCostUSD);

  return {
    actualCostUSD,
    cloudEquivalentUSD: cloudCost,
    savingsUSD: savings,
    savingsPercent: cloudCost > 0 ? (savings / cloudCost) * 100 : 0,
    cloudEquivalentModel: equiv.model,
  };
}

/**
 * Aggregate savings across multiple tasks
 */
export function aggregateSavings(items: CostSavings[]): {
  totalActualCost: number;
  totalCloudEquivalent: number;
  totalSavings: number;
  overallSavingsPercent: number;
  taskCount: number;
  freeTaskCount: number;
} {
  const totalActualCost = items.reduce((sum, i) => sum + i.actualCostUSD, 0);
  const totalCloudEquivalent = items.reduce((sum, i) => sum + i.cloudEquivalentUSD, 0);
  const totalSavings = items.reduce((sum, i) => sum + i.savingsUSD, 0);
  const freeTaskCount = items.filter((i) => i.actualCostUSD === 0).length;

  return {
    totalActualCost,
    totalCloudEquivalent,
    totalSavings,
    overallSavingsPercent:
      totalCloudEquivalent > 0 ? (totalSavings / totalCloudEquivalent) * 100 : 0,
    taskCount: items.length,
    freeTaskCount,
  };
}
