import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CodeReviewService } from '../codeReviewService.js';
import { prismaMock } from '../../__mocks__/prisma.js';

// Mock SocketIO
const mockIO = {
  emit: jest.fn(),
} as any;

describe('CodeReviewService', () => {
  let reviewService: CodeReviewService;

  beforeEach(() => {
    reviewService = new CodeReviewService(prismaMock, mockIO);
    jest.clearAllMocks();
  });

  describe('shouldReview', () => {
    it('should review Ollama tasks at configured interval', () => {
      // Set interval to 5
      reviewService.updateConfig({ ollamaReviewInterval: 5 });

      // Task #5 should be reviewed
      const result = reviewService.shouldReview({
        tier: 'ollama',
        taskNumber: 5,
        complexity: 3,
      });

      expect(result).toBe(true);
    });

    it('should not review Ollama task before interval', () => {
      reviewService.updateConfig({ ollamaReviewInterval: 5 });

      const result = reviewService.shouldReview({
        tier: 'ollama',
        taskNumber: 3,
        complexity: 3,
      });

      expect(result).toBe(false);
    });

    it('should review complex tasks at Opus interval', () => {
      reviewService.updateConfig({ opusReviewInterval: 10 });

      const result = reviewService.shouldReview({
        tier: 'sonnet',
        taskNumber: 10,
        complexity: 8,
      });

      expect(result).toBe(true);
    });

    it('should not review when disabled', () => {
      reviewService.updateConfig({ enabled: false });

      const result = reviewService.shouldReview({
        tier: 'ollama',
        taskNumber: 5,
        complexity: 3,
      });

      expect(result).toBe(false);
    });
  });

  describe('getReviewerTier', () => {
    it('should use Haiku for Ollama tasks', () => {
      const tier = reviewService.getReviewerTier('ollama', 3);
      expect(tier).toBe('haiku');
    });

    it('should use Opus for complex tasks', () => {
      const tier = reviewService.getReviewerTier('sonnet', 8);
      expect(tier).toBe('opus');
    });

    it('should use Haiku for moderate complexity', () => {
      const tier = reviewService.getReviewerTier('haiku', 5);
      expect(tier).toBe('haiku');
    });
  });

  describe('config management', () => {
    it('should update review intervals', () => {
      reviewService.updateConfig({
        ollamaReviewInterval: 10,
        opusReviewInterval: 20,
      });

      const config = reviewService.getConfig();
      expect(config.ollamaReviewInterval).toBe(10);
      expect(config.opusReviewInterval).toBe(20);
    });

    it('should update quality threshold', () => {
      reviewService.updateConfig({ qualityThreshold: 8 });

      const config = reviewService.getConfig();
      expect(config.qualityThreshold).toBe(8);
    });

    it('should enable/disable reviews', () => {
      reviewService.updateConfig({ enabled: false });

      const config = reviewService.getConfig();
      expect(config.enabled).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return review statistics', () => {
      const stats = reviewService.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalReviews).toBeDefined();
      expect(stats.averageQuality).toBeDefined();
      expect(stats.passRate).toBeDefined();
    });
  });
});
