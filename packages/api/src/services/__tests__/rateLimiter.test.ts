import { describe, it, expect } from '@jest/globals';
import { AnthropicRateLimiter } from '../rateLimiter.js';

describe('AnthropicRateLimiter', () => {
  // Note: We test the class directly rather than the singleton to isolate state
  let limiter: AnthropicRateLimiter;

  beforeEach(() => {
    limiter = new AnthropicRateLimiter();
  });

  describe('getModelTier', () => {
    it('should identify haiku models', () => {
      expect(limiter.getModelTier('claude-haiku-4-5-20251001')).toBe('haiku');
      expect(limiter.getModelTier('anthropic/claude-haiku-4-5-20251001')).toBe('haiku');
    });

    it('should identify sonnet models', () => {
      expect(limiter.getModelTier('claude-sonnet-4-5-20250929')).toBe('sonnet');
      expect(limiter.getModelTier('anthropic/claude-sonnet-4-20250514')).toBe('sonnet');
    });

    it('should identify opus models', () => {
      expect(limiter.getModelTier('claude-opus-4-5-20251101')).toBe('opus');
    });

    it('should default to opus for unknown models', () => {
      expect(limiter.getModelTier('unknown-model')).toBe('opus');
    });
  });

  describe('recordUsage', () => {
    it('should record without throwing', () => {
      expect(() => {
        limiter.recordUsage('haiku', 1000, 500);
      }).not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return status for all tiers', () => {
      const status = limiter.getStatus();

      expect(status).toHaveProperty('haiku');
      expect(status).toHaveProperty('sonnet');
      expect(status).toHaveProperty('opus');
    });

    it('should show usage after recording', () => {
      limiter.recordUsage('haiku', 1000, 500);

      const status = limiter.getStatus();
      expect(status.haiku.requests).toBeGreaterThan(0);
    });

    it('should include limits in status', () => {
      const status = limiter.getStatus();

      expect(status.haiku.limits).toBeDefined();
      expect(status.haiku.limits.rpm).toBeGreaterThan(0);
    });
  });

  describe('waitForCapacity', () => {
    it('should return quickly when under limits', async () => {
      const start = Date.now();
      await limiter.waitForCapacity('haiku', 100, 50);
      const elapsed = Date.now() - start;

      // Should complete within reasonable time (MIN_API_DELAY + buffer)
      expect(elapsed).toBeLessThan(5000);
    });
  });
});
