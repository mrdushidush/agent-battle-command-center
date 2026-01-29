/**
 * Anthropic API Rate Limiter
 *
 * Implements sliding window rate limiting to prevent hitting API limits.
 * Tracks requests per minute (RPM) and tokens per minute (TPM).
 */

interface RateLimits {
  rpm: number; // Requests per minute
  inputTpm: number; // Input tokens per minute
  outputTpm: number; // Output tokens per minute
}

interface UsageEntry {
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
}

// Anthropic rate limits by model tier
const MODEL_LIMITS: Record<string, RateLimits> = {
  haiku: { rpm: 50, inputTpm: 50000, outputTpm: 10000 },
  sonnet: { rpm: 50, inputTpm: 30000, outputTpm: 8000 },
  opus: { rpm: 50, inputTpm: 30000, outputTpm: 8000 },
};

// Buffer threshold - trigger rate limiting at this percentage of limit
const RATE_LIMIT_BUFFER = parseFloat(process.env.RATE_LIMIT_BUFFER || '0.8');
// Minimum delay between API calls (milliseconds)
const MIN_API_DELAY = parseFloat(process.env.MIN_API_DELAY || '0.5') * 1000;
// Debug logging
const RATE_LIMIT_DEBUG = process.env.RATE_LIMIT_DEBUG === 'true';

function debug(message: string, ...args: unknown[]): void {
  if (RATE_LIMIT_DEBUG) {
    console.log(`[RateLimiter] ${message}`, ...args);
  }
}

class AnthropicRateLimiter {
  private usageByTier: Map<string, UsageEntry[]> = new Map();
  private lastCallTime: number = 0;

  constructor() {
    // Initialize usage arrays for each tier
    for (const tier of Object.keys(MODEL_LIMITS)) {
      this.usageByTier.set(tier, []);
    }
  }

  /**
   * Get the model tier from a model name
   */
  getModelTier(model: string): string {
    const modelLower = model.toLowerCase();
    if (modelLower.includes('haiku')) return 'haiku';
    if (modelLower.includes('sonnet')) return 'sonnet';
    if (modelLower.includes('opus')) return 'opus';
    // Default to most restrictive tier
    return 'opus';
  }

  /**
   * Clean entries older than 60 seconds
   */
  private cleanOldEntries(tier: string): void {
    const entries = this.usageByTier.get(tier) || [];
    const cutoff = Date.now() - 60000; // 60 seconds ago
    const filtered = entries.filter((e) => e.timestamp > cutoff);
    this.usageByTier.set(tier, filtered);
  }

  /**
   * Get current usage in the sliding window
   */
  private getCurrentUsage(tier: string): {
    requests: number;
    inputTokens: number;
    outputTokens: number;
  } {
    this.cleanOldEntries(tier);
    const entries = this.usageByTier.get(tier) || [];

    return {
      requests: entries.length,
      inputTokens: entries.reduce((sum, e) => sum + e.inputTokens, 0),
      outputTokens: entries.reduce((sum, e) => sum + e.outputTokens, 0),
    };
  }

  /**
   * Calculate delay needed to stay under limits
   */
  private calculateDelay(
    tier: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number = 0
  ): number {
    const limits = MODEL_LIMITS[tier];
    if (!limits) return 0;

    const usage = this.getCurrentUsage(tier);
    const entries = this.usageByTier.get(tier) || [];

    // Calculate thresholds with buffer
    const rpmThreshold = limits.rpm * RATE_LIMIT_BUFFER;
    const inputTpmThreshold = limits.inputTpm * RATE_LIMIT_BUFFER;
    const outputTpmThreshold = limits.outputTpm * RATE_LIMIT_BUFFER;

    let maxDelay = 0;

    // Check RPM
    if (usage.requests >= rpmThreshold) {
      // Find oldest entry to determine when we can make another request
      const oldestEntry = entries.reduce(
        (min, e) => (e.timestamp < min ? e.timestamp : min),
        Date.now()
      );
      const rpmDelay = oldestEntry + 60000 - Date.now();
      if (rpmDelay > maxDelay) {
        maxDelay = rpmDelay;
        debug(
          `RPM limit: ${usage.requests}/${limits.rpm}, need delay: ${rpmDelay}ms`
        );
      }
    }

    // Check input TPM
    if (usage.inputTokens + estimatedInputTokens >= inputTpmThreshold) {
      // Find entries to remove to get under threshold
      let tokensToFree =
        usage.inputTokens + estimatedInputTokens - inputTpmThreshold;
      const sortedEntries = [...entries].sort(
        (a, b) => a.timestamp - b.timestamp
      );

      for (const entry of sortedEntries) {
        if (tokensToFree <= 0) break;
        const delay = entry.timestamp + 60000 - Date.now();
        if (delay > maxDelay) {
          maxDelay = delay;
          debug(
            `Input TPM limit: ${usage.inputTokens}/${limits.inputTpm}, need delay: ${delay}ms`
          );
        }
        tokensToFree -= entry.inputTokens;
      }
    }

    // Check output TPM
    if (usage.outputTokens + estimatedOutputTokens >= outputTpmThreshold) {
      let tokensToFree =
        usage.outputTokens + estimatedOutputTokens - outputTpmThreshold;
      const sortedEntries = [...entries].sort(
        (a, b) => a.timestamp - b.timestamp
      );

      for (const entry of sortedEntries) {
        if (tokensToFree <= 0) break;
        const delay = entry.timestamp + 60000 - Date.now();
        if (delay > maxDelay) {
          maxDelay = delay;
          debug(
            `Output TPM limit: ${usage.outputTokens}/${limits.outputTpm}, need delay: ${delay}ms`
          );
        }
        tokensToFree -= entry.outputTokens;
      }
    }

    // Enforce minimum delay between calls
    const timeSinceLastCall = Date.now() - this.lastCallTime;
    if (timeSinceLastCall < MIN_API_DELAY) {
      const minDelay = MIN_API_DELAY - timeSinceLastCall;
      if (minDelay > maxDelay) {
        maxDelay = minDelay;
      }
    }

    return Math.max(0, maxDelay);
  }

  /**
   * Wait for capacity before making an API call
   * Returns the number of milliseconds waited
   */
  async waitForCapacity(
    modelOrTier: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number = 0
  ): Promise<number> {
    const tier = MODEL_LIMITS[modelOrTier]
      ? modelOrTier
      : this.getModelTier(modelOrTier);
    const delay = this.calculateDelay(
      tier,
      estimatedInputTokens,
      estimatedOutputTokens
    );

    if (delay > 0) {
      console.log(
        `[RateLimiter] Waiting ${(delay / 1000).toFixed(1)}s for ${tier} capacity (estimated: ${estimatedInputTokens} input tokens)`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastCallTime = Date.now();
    return delay;
  }

  /**
   * Record actual token usage after an API call completes
   */
  recordUsage(
    modelOrTier: string,
    inputTokens: number,
    outputTokens: number
  ): void {
    const tier = MODEL_LIMITS[modelOrTier]
      ? modelOrTier
      : this.getModelTier(modelOrTier);
    const entries = this.usageByTier.get(tier) || [];

    entries.push({
      timestamp: Date.now(),
      inputTokens,
      outputTokens,
    });

    this.usageByTier.set(tier, entries);
    debug(
      `Recorded usage for ${tier}: ${inputTokens} input, ${outputTokens} output tokens`
    );
  }

  /**
   * Get current rate limit status for monitoring
   */
  getStatus(): Record<
    string,
    {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      limits: RateLimits;
    }
  > {
    const status: Record<
      string,
      {
        requests: number;
        inputTokens: number;
        outputTokens: number;
        limits: RateLimits;
      }
    > = {};

    for (const tier of Object.keys(MODEL_LIMITS)) {
      const usage = this.getCurrentUsage(tier);
      status[tier] = {
        ...usage,
        limits: MODEL_LIMITS[tier],
      };
    }

    return status;
  }
}

// Export singleton instance
export const rateLimiter = new AnthropicRateLimiter();

// Export class for testing
export { AnthropicRateLimiter, MODEL_LIMITS };
