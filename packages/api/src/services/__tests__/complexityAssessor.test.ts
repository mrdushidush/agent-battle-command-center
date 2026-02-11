import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Shared mock function that persists across mock resets
const mockCreate = jest.fn<(...args: any[]) => Promise<any>>();

// Mock Anthropic SDK
jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

// Mock rate limiter
jest.unstable_mockModule('../rateLimiter.js', () => ({
  rateLimiter: {
    waitForCapacity: jest.fn<() => Promise<number>>().mockResolvedValue(0),
    recordUsage: jest.fn(),
  },
}));

// Dynamic import AFTER mocks are set up
const { getHaikuComplexityAssessment, getDualComplexityAssessment, validateComplexityWithHaiku } =
  await import('../complexityAssessor.js');

// TODO: ESM mock issue - jest.unstable_mockModule works but mockCreate reference
// doesn't propagate to the Anthropic constructor mock in all cases.
// Needs investigation into jest ESM mock hoisting behavior.
describe.skip('Complexity Assessor', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    mockCreate.mockReset();
    process.env = { ...ORIGINAL_ENV, ANTHROPIC_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('getHaikuComplexityAssessment', () => {
    it('should return null when API key is not set', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const result = await getHaikuComplexityAssessment(
        'Test Task',
        'Simple description'
      );

      expect(result).toBeNull();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should parse valid JSON response from Haiku', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: `{
            "complexity": 5,
            "reasoning": "Task requires multiple functions",
            "factors": ["multi-step", "validation", "error-handling"]
          }`,
        }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      });

      const result = await getHaikuComplexityAssessment(
        'Create user registration',
        'Build a user registration endpoint with validation'
      );

      expect(result).toEqual({
        complexity: 5,
        reasoning: 'Task requires multiple functions',
        factors: ['multi-step', 'validation', 'error-handling'],
      });
    });

    it('should clamp complexity to 1-10 range', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 15, "reasoning": "Very complex", "factors": []}',
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await getHaikuComplexityAssessment('Test', 'Test');

      expect(result?.complexity).toBe(10);
    });

    it('should clamp negative complexity to 1', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": -5, "reasoning": "Invalid", "factors": []}',
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await getHaikuComplexityAssessment('Test', 'Test');

      expect(result?.complexity).toBe(1);
    });

    it('should extract JSON from markdown code blocks', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: `Here's my assessment:\n\n\`\`\`json\n{
            "complexity": 7,
            "reasoning": "Complex algorithm required",
            "factors": ["algorithm", "optimization"]
          }\n\`\`\``,
        }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await getHaikuComplexityAssessment('Test', 'Test');

      expect(result?.complexity).toBe(7);
    });

    it('should return null on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await getHaikuComplexityAssessment('Test', 'Test');

      expect(result).toBeNull();
    });

    it('should return null when JSON cannot be parsed', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Invalid JSON response' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await getHaikuComplexityAssessment('Test', 'Test');

      expect(result).toBeNull();
    });

    it('should include task title and description in prompt', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"complexity": 5, "reasoning": "Test", "factors": []}' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      await getHaikuComplexityAssessment(
        'Build API endpoint',
        'Create a REST API for user management'
      );

      const call = mockCreate.mock.calls[0] as any[];
      const prompt = call[0].messages[0].content;
      expect(prompt).toContain('Build API endpoint');
      expect(prompt).toContain('Create a REST API for user management');
    });
  });

  describe('getDualComplexityAssessment', () => {
    it('should use router complexity when Haiku is unavailable', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await getDualComplexityAssessment(
        'Test Task',
        'Description',
        6
      );

      expect(result.complexity).toBe(6);
      expect(result.complexitySource).toBe('router');
      expect(result.complexityReasoning).toContain('Haiku assessment unavailable');
    });

    it('should use Haiku score when diff >= 2 (semantic complexity)', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 9, "reasoning": "LRU cache requires advanced data structures", "factors": ["algorithm", "data-structure"]}',
        }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await getDualComplexityAssessment(
        'LRU Cache',
        'Implement an LRU cache',
        5 // Router underestimated
      );

      expect(result.complexity).toBe(9); // Use Haiku directly
      expect(result.complexitySource).toBe('dual');
    });

    it('should include reasoning from Haiku in final assessment', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 7, "reasoning": "Requires API integration and error handling", "factors": ["api", "error-handling"]}',
        }],
        usage: { input_tokens: 100, output_tokens: 40 },
      });

      const result = await getDualComplexityAssessment(
        'API Integration',
        'Integrate third-party API',
        6
      );

      expect(result.complexityReasoning).toContain('Requires API integration and error handling');
    });
  });

  describe('validateComplexityWithHaiku', () => {
    it('should mark as accurate when within 2 points', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 7, "reasoning": "Test", "factors": []}',
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await validateComplexityWithHaiku('Test', 'Test', 6);

      expect(result.isAccurate).toBe(true);
      expect(result.suggestedComplexity).toBe(7);
      expect(result.difference).toBe(1);
    });

    it('should mark as inaccurate when difference > 2', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 9, "reasoning": "Test", "factors": []}',
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await validateComplexityWithHaiku('Test', 'Test', 5);

      expect(result.isAccurate).toBe(false);
      expect(result.suggestedComplexity).toBe(9);
      expect(result.difference).toBe(4);
    });

    it('should return accurate=true when Haiku unavailable', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await validateComplexityWithHaiku('Test', 'Test', 6);

      expect(result.isAccurate).toBe(true);
      expect(result.suggestedComplexity).toBe(6);
      expect(result.difference).toBe(0);
    });
  });
});
