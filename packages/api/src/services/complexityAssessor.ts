/**
 * Dual Complexity Assessment Service
 *
 * Combines rule-based complexity scoring with Haiku AI assessment
 * to produce more accurate task complexity estimates.
 */

import Anthropic from '@anthropic-ai/sdk';
import { rateLimiter } from './rateLimiter.js';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

interface HaikuAssessment {
  complexity: number;
  reasoning: string;
  factors: string[];
}

interface DualAssessment {
  complexity: number;          // The final score used for routing
  complexitySource: 'router' | 'haiku' | 'dual';  // How the score was determined
  complexityReasoning: string; // Explanation of the score
}

/**
 * Get Haiku's assessment of task complexity
 */
export async function getHaikuComplexityAssessment(
  title: string,
  description: string
): Promise<HaikuAssessment | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY not set, skipping Haiku assessment');
    return null;
  }

  const client = new Anthropic({
    apiKey,
    timeout: 30000, // 30 second timeout
    maxRetries: 2,  // Retry up to 2 times on transient errors
  });

  const prompt = `You are a task complexity assessor for a coding agent system.

Assess the complexity of this programming task on a scale of 1-10:
- 1-3: Simple (single function, basic logic, no dependencies)
- 4-5: Medium (multiple functions, some validation, basic tests)
- 6-7: Moderate (multiple files, external APIs, error handling)
- 8-9: Complex (architecture design, multiple systems, advanced patterns)
- 10: Very Complex (distributed systems, complex algorithms, extensive testing)

Task Title: ${title}

Task Description:
${description}

Respond with ONLY a JSON object in this exact format:
{
  "complexity": <number 1-10>,
  "reasoning": "<1-2 sentence explanation>",
  "factors": ["<factor1>", "<factor2>", "<factor3>"]
}`;

  try {
    // Estimate input tokens (~4 chars per token)
    const estimatedInputTokens = Math.ceil(prompt.length / 4);

    // Wait for rate limit capacity
    await rateLimiter.waitForCapacity('haiku', estimatedInputTokens, 300);

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    // Record actual usage
    rateLimiter.recordUsage(
      'haiku',
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    const content = response.content[0];
    if (content.type !== 'text') {
      console.error('Unexpected response type from Haiku');
      return null;
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not extract JSON from Haiku response:', content.text);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as HaikuAssessment;

    // Validate and clamp complexity
    parsed.complexity = Math.max(1, Math.min(10, parsed.complexity));

    return parsed;
  } catch (error) {
    console.error('Haiku assessment failed:', error);
    return null;
  }
}

/**
 * Perform dual complexity assessment combining router and Haiku scores
 */
export async function getDualComplexityAssessment(
  title: string,
  description: string,
  routerComplexity: number
): Promise<DualAssessment> {
  // Try to get Haiku's assessment
  const haikuAssessment = await getHaikuComplexityAssessment(title, description);

  if (!haikuAssessment) {
    // Fallback to router-only assessment
    return {
      complexity: routerComplexity,
      complexitySource: 'router',
      complexityReasoning: 'Haiku assessment unavailable, using router complexity',
    };
  }

  // Calculate weighted average (equal weight for now)
  // Could adjust weights based on historical accuracy
  const finalComplexity = (routerComplexity + haikuAssessment.complexity) / 2;

  return {
    complexity: Math.round(finalComplexity * 10) / 10, // Round to 1 decimal
    complexitySource: 'dual',
    complexityReasoning: `Router: ${routerComplexity}, Haiku: ${haikuAssessment.complexity}. ${haikuAssessment.reasoning}`,
  };
}

/**
 * Quick complexity check using just Haiku (for validation)
 */
export async function validateComplexityWithHaiku(
  title: string,
  description: string,
  currentComplexity: number
): Promise<{ isAccurate: boolean; suggestedComplexity: number; difference: number }> {
  const haikuAssessment = await getHaikuComplexityAssessment(title, description);

  if (!haikuAssessment) {
    return {
      isAccurate: true,
      suggestedComplexity: currentComplexity,
      difference: 0,
    };
  }

  const difference = Math.abs(currentComplexity - haikuAssessment.complexity);

  return {
    isAccurate: difference <= 2, // Within 2 points is considered accurate
    suggestedComplexity: haikuAssessment.complexity,
    difference,
  };
}
