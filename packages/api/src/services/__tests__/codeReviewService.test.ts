import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CodeReviewService } from '../codeReviewService.js';

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() },
  }));
});

// Mock MCP bridge
jest.mock('../mcpBridge.js', () => ({
  mcpBridge: { publishEvent: jest.fn() },
}));

describe('CodeReviewService', () => {
  let service: CodeReviewService;
  let mockPrisma: any;
  let mockIO: any;

  beforeEach(() => {
    mockPrisma = {
      codeReview: { create: jest.fn(), findFirst: jest.fn() },
      executionLog: { findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]) },
      task: { update: jest.fn() },
    };
    mockIO = { emit: jest.fn() };

    // Set API key for tests
    process.env.ANTHROPIC_API_KEY = 'test-key';
    service = new CodeReviewService(mockPrisma, mockIO);
  });

  describe('getReviewDecision', () => {
    it('should not review decomposition tasks', () => {
      const task = { type: 'decomposition', status: 'completed' } as any;

      const decision = service.getReviewDecision(task, 'ollama');

      expect(decision.shouldReview).toBe(false);
    });

    it('should not review debug tasks', () => {
      const task = { type: 'debug', status: 'completed' } as any;

      const decision = service.getReviewDecision(task, 'ollama');

      expect(decision.shouldReview).toBe(false);
    });

    it('should not review review tasks', () => {
      const task = { type: 'review', status: 'completed' } as any;

      const decision = service.getReviewDecision(task, 'ollama');

      expect(decision.shouldReview).toBe(false);
    });
  });

  describe('setEnabled / isEnabled', () => {
    it('should toggle enabled state', () => {
      expect(service.isEnabled()).toBe(true);

      service.setEnabled(false);
      expect(service.isEnabled()).toBe(false);

      service.setEnabled(true);
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('getScheduleStatus', () => {
    it('should return counter values', () => {
      const status = service.getScheduleStatus();

      expect(status).toHaveProperty('ollamaCounter');
      expect(status).toHaveProperty('allTaskCounter');
      expect(status).toHaveProperty('nextOllamaReview');
      expect(status).toHaveProperty('nextOpusReview');
    });
  });

  describe('resetCounters', () => {
    it('should reset counters to zero', () => {
      service.resetCounters();
      const status = service.getScheduleStatus();

      expect(status.ollamaCounter).toBe(0);
      expect(status.allTaskCounter).toBe(0);
    });
  });
});
