/**
 * Task Router Service - Cost-Optimized Tiered Routing
 *
 * ACADEMIC COMPLEXITY SCALE (1-10):
 * =================================
 * Based on Campbell's Task Complexity Theory and NLP Research Difficulty scales.
 *
 * | Score | Level    | Characteristics                                          | Model   |
 * |-------|----------|----------------------------------------------------------|---------|
 * | 1-2   | Trivial  | Single-step; clear I/O; no decision-making               | Ollama  |
 * | 3-4   | Low      | Linear sequences; well-defined domain; no ambiguity      | Ollama  |
 * | 5-6   | Moderate | Multiple paths; 2-3 source integration; standard logic   | Haiku   |
 * | 7-8   | High     | Nested branches; conflicting dependencies; multi-file    | Sonnet  |
 * | 9-10  | Extreme  | Fuzzy goals; dynamic requirements; architectural scope   | Opus    |
 *
 * TIER ROUTING:
 * =============
 * - Trivial/Low (1-4)   → Ollama (FREE, ~12s/task)
 * - Moderate (5-6)      → Haiku (~$0.001/task)
 * - High (7-8)          → Sonnet (~$0.005/task)
 * - Extreme (9-10)      → Opus (~$0.04/task)
 *
 * DECOMPOSITION:
 * - Standard (<8)  → Sonnet decomposes into subtasks
 * - Complex (>=8)  → Opus strategic decomposition
 *
 * FIX CYCLE:
 * - 1st failure → Haiku
 * - 2nd failure → Sonnet
 * - 3rd failure → Human escalation
 */

import type { PrismaClient, Task, Agent } from '@prisma/client';
import { getDualComplexityAssessment } from './complexityAssessor.js';

// Model tiers for the routing system
export type ModelTier = 'ollama' | 'haiku' | 'sonnet' | 'opus';

export interface RoutingDecision {
  agentId: string;
  agentName: string;
  reason: string;
  confidence: number; // 0-1 score
  fallbackAgentId?: string; // Backup if first choice unavailable
  modelTier: ModelTier; // Which model tier to use
  estimatedCost: number; // Estimated cost in USD
  // Complexity assessment info
  complexity: number; // Final complexity used for routing
  routerComplexity?: number; // Rule-based complexity
  haikuComplexity?: number; // Haiku's assessment
  haikuReasoning?: string; // Haiku's explanation
  assessmentMethod?: 'dual' | 'router_only' | 'haiku_only';
}

export interface DecompositionDecision {
  modelTier: 'sonnet' | 'opus';
  reason: string;
}

export interface ReviewDecision {
  taskIds: string[];
  reviewerTier: 'opus';
  estimatedCost: number;
}

export interface FixDecision {
  modelTier: 'haiku' | 'sonnet';
  fixAttempt: number;
  escalateToHuman: boolean;
  reason: string;
}

export class TaskRouter {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calculate task complexity score (1-10) using Academic Complexity Framework
   *
   * Based on Campbell's Task Complexity Theory:
   * - Component complexity: Number of distinct acts/information cues
   * - Coordinative complexity: Relationships between task inputs and outputs
   * - Dynamic complexity: Changes in states during task execution
   *
   * Factors analyzed:
   * - Structural indicators (steps, files, dependencies)
   * - Semantic indicators (keywords suggesting complexity level)
   * - Task characteristics (type, history, requirements)
   */
  calculateComplexity(task: Task): number {
    const description = (task.description || '').toLowerCase();
    const title = (task.title || '').toLowerCase();
    const text = `${title} ${description}`;

    let score = 1; // Base score (minimum complexity)

    // ========================================
    // 1. STRUCTURAL COMPLEXITY (Component)
    // ========================================

    // Count explicit steps (Step 1, Step 2, etc.)
    const steps = description.match(/step \d+/gi)?.length || 0;
    if (steps <= 2) score += 0;           // Trivial: 1-2 steps
    else if (steps <= 4) score += 1;      // Low: 3-4 steps
    else if (steps <= 6) score += 2;      // Moderate: 5-6 steps
    else score += 3;                       // High: 7+ steps

    // Count files mentioned (indicators of multi-file tasks)
    const filePatterns = text.match(/\.(py|ts|js|tsx|jsx|json|md|css|html)\b/gi) || [];
    const uniqueFiles = new Set(filePatterns).size;
    if (uniqueFiles >= 3) score += 2;      // Multi-file task
    else if (uniqueFiles === 2) score += 1;

    // Count function/class definitions expected
    const defCount = (text.match(/\b(function|class|def|interface|type)\b/gi) || []).length;
    if (defCount >= 3) score += 1;

    // ========================================
    // 2. SEMANTIC COMPLEXITY (Keywords)
    // ========================================

    // Academic complexity indicators by tier
    const complexityIndicators = {
      // Trivial (1-2): Single-step, clear I/O, no decision-making
      trivial: ['simple', 'basic', 'single', 'just', 'only', 'straightforward'],

      // Low (3-4): Linear sequences, well-defined, no ambiguity
      low: ['create', 'add', 'write', 'make', 'return', 'print', 'output'],

      // Moderate (5-6): Multiple paths, 2-3 source integration
      moderate: [
        'handle', 'validate', 'check', 'multiple', 'combine', 'integrate',
        'parse', 'convert', 'transform', 'edge case', 'error handling',
        'if else', 'switch', 'conditional'
      ],

      // High (7-8): Nested logic, conflicting dependencies, multi-file
      high: [
        'refactor', 'redesign', 'optimize', 'async', 'concurrent', 'parallel',
        'nested', 'recursive', 'complex', 'algorithm', 'data structure',
        'database', 'api', 'service', 'module', 'component'
      ],

      // Extreme (9-10): Fuzzy goals, dynamic, architectural
      extreme: [
        'architect', 'design system', 'framework', 'infrastructure',
        'scalab', 'distributed', 'microservice', 'migration', 'legacy',
        'security', 'authentication', 'authorization', 'real-time'
      ],
    };

    // Score based on highest complexity indicators found
    let maxTierScore = 0;

    // Check extreme first (highest weight)
    const extremeMatches = complexityIndicators.extreme.filter((k) => text.includes(k)).length;
    if (extremeMatches >= 2) maxTierScore = Math.max(maxTierScore, 4);
    else if (extremeMatches === 1) maxTierScore = Math.max(maxTierScore, 3);

    // Check high
    const highMatches = complexityIndicators.high.filter((k) => text.includes(k)).length;
    if (highMatches >= 3) maxTierScore = Math.max(maxTierScore, 3);
    else if (highMatches >= 1) maxTierScore = Math.max(maxTierScore, 2);

    // Check moderate
    const moderateMatches = complexityIndicators.moderate.filter((k) => text.includes(k)).length;
    if (moderateMatches >= 2) maxTierScore = Math.max(maxTierScore, 2);
    else if (moderateMatches === 1) maxTierScore = Math.max(maxTierScore, 1);

    // Trivial/low indicators reduce score (but not below 1)
    const trivialMatches = complexityIndicators.trivial.filter((k) => text.includes(k)).length;
    if (trivialMatches >= 2 && maxTierScore <= 1) score -= 0.5;

    score += maxTierScore;

    // ========================================
    // 3. TASK CHARACTERISTICS
    // ========================================

    // Task type complexity
    switch (task.taskType) {
      case 'code':
        score += 0.5;  // Standard coding
        break;
      case 'test':
        score += 1.5;  // Testing requires understanding + verification
        break;
      case 'review':
        score += 2.5;  // Review requires deep analysis
        break;
      case 'decomposition':
        score += 3;    // Decomposition is high-level planning
        break;
    }

    // Failed tasks are harder (evidence of hidden complexity)
    if (task.currentIteration > 0) {
      score += Math.min(task.currentIteration * 1.5, 3); // Cap at +3
    }

    // Description length as proxy for requirement complexity
    const wordCount = description.split(/\s+/).length;
    if (wordCount > 200) score += 1;      // Long descriptions = more requirements
    else if (wordCount > 100) score += 0.5;

    // ========================================
    // 4. COORDINATIVE COMPLEXITY
    // ========================================

    // Dependencies and imports mentioned
    const importPatterns = text.match(/\b(import|require|from|include|depend)\b/gi) || [];
    if (importPatterns.length >= 3) score += 1;

    // Multiple outputs expected
    const outputPatterns = text.match(/\b(return|output|result|response|yield)\b/gi) || [];
    if (outputPatterns.length >= 3) score += 0.5;

    // Clamp to valid range [1, 10]
    return Math.min(10, Math.max(1, Math.round(score * 10) / 10));
  }

  /**
   * Determine best agent for a task
   */
  async routeTask(taskId: string): Promise<RoutingDecision> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Get all available agents
    const agents = await this.prisma.agent.findMany({
      where: {
        status: 'idle',
      },
      include: {
        agentType: true,
      },
    });

    if (agents.length === 0) {
      // No idle agents - escalate to CTO for queue management
      const cto = await this.prisma.agent.findFirst({
        where: {
          agentType: {
            name: 'cto',
          },
        },
      });

      if (cto) {
        return {
          agentId: cto.id,
          agentName: cto.name,
          reason: 'All agents busy - CTO will manage queue and prioritize',
          confidence: 0.8,
          modelTier: 'opus' as ModelTier,
          estimatedCost: 0.04,
          complexity: 10, // High complexity if no agents available
          routerComplexity: 10,
          assessmentMethod: 'router_only' as const,
        };
      }

      throw new Error('No agents available');
    }

    // Calculate complexity using dual assessment (router + Haiku)
    const routerComplexity = this.calculateComplexity(task);
    let complexity = routerComplexity;
    let haikuComplexity: number | undefined;
    let haikuReasoning: string | undefined;
    let assessmentMethod: 'dual' | 'router_only' | 'haiku_only' = 'router_only';

    // Try dual assessment with Haiku (if API key available and task is not trivial)
    if (routerComplexity >= 2) {
      try {
        const dualAssessment = await getDualComplexityAssessment(
          task.title,
          task.description || '',
          routerComplexity
        );

        complexity = dualAssessment.finalComplexity;
        haikuComplexity = dualAssessment.haikuComplexity;
        haikuReasoning = dualAssessment.haikuReasoning;
        assessmentMethod = dualAssessment.assessmentMethod;

        // Save complexity assessments to task for future fine-tuning
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            routerComplexity,
            haikuComplexity,
            haikuReasoning,
            finalComplexity: complexity,
          },
        });

        console.log(`📊 Dual complexity: router=${routerComplexity}, haiku=${haikuComplexity}, final=${complexity}`);
      } catch (error) {
        console.warn('Dual assessment failed, using router complexity:', error);
        complexity = routerComplexity;
      }
    }

    // Route based on new tiered system
    let selectedAgent: Agent | null = null;
    let reason = '';
    let confidence = 0.5;
    let modelTier: ModelTier = 'ollama';
    let estimatedCost = 0;

    // Task explicitly requires specific agent (override all other rules)
    if (task.requiredAgent) {
      const requiredAgentName = task.requiredAgent.toLowerCase();
      selectedAgent = agents.find((a) => a.agentType.name === requiredAgentName) || null;
      if (selectedAgent) {
        reason = `Task explicitly requires ${task.requiredAgent} agent`;
        confidence = 1.0;
        modelTier = requiredAgentName === 'cto' ? 'opus' : requiredAgentName === 'qa' ? 'haiku' : 'ollama';
        estimatedCost = modelTier === 'opus' ? 0.04 : modelTier === 'haiku' ? 0.001 : 0;
      }
    }

    // ACADEMIC TIER ROUTING
    // ======================
    // Based on Campbell's Task Complexity Theory

    // TRIVIAL/LOW (1-4): Single-step to linear sequences → Ollama (FREE)
    if (!selectedAgent && complexity < 5) {
      selectedAgent = agents.find((a) => a.agentType.name === 'coder') || null;
      if (selectedAgent) {
        const level = complexity < 3 ? 'Trivial' : 'Low';
        reason = `${level} complexity (${complexity.toFixed(1)}/10) → Ollama (free, ~12s)`;
        confidence = 0.9;
        modelTier = 'ollama';
        estimatedCost = 0;
      }
    }

    // MODERATE (5-6): Multiple paths, 2-3 source integration → Haiku
    if (!selectedAgent && complexity >= 5 && complexity < 7) {
      selectedAgent = agents.find((a) => a.agentType.name === 'qa') || null;
      if (selectedAgent) {
        reason = `Moderate complexity (${complexity.toFixed(1)}/10) → Haiku (quality, ~$0.001)`;
        confidence = 0.9;
        modelTier = 'haiku';
        estimatedCost = 0.001;
      }
    }

    // HIGH (7-8): Nested logic, conflicting dependencies → Sonnet
    if (!selectedAgent && complexity >= 7 && complexity < 9) {
      selectedAgent = agents.find((a) => a.agentType.name === 'qa') || null;
      if (selectedAgent) {
        reason = `High complexity (${complexity.toFixed(1)}/10) → Sonnet (advanced, ~$0.005)`;
        confidence = 0.85;
        modelTier = 'sonnet';
        estimatedCost = 0.005;
      }
    }

    // EXTREME (9-10): Fuzzy goals, architectural scope → Opus
    if (!selectedAgent && complexity >= 9) {
      selectedAgent = agents.find((a) => a.agentType.name === 'cto') || null;
      if (selectedAgent) {
        reason = `Extreme complexity (${complexity.toFixed(1)}/10) → Opus (expert, ~$0.04)`;
        confidence = 0.8;
        modelTier = 'opus';
        estimatedCost = 0.04;
      }
    }

    // FALLBACK: If no agent selected yet, use best available
    if (!selectedAgent) {
      // Try QA first, then Coder
      selectedAgent = agents.find((a) => a.agentType.name === 'qa')
        || agents.find((a) => a.agentType.name === 'coder')
        || agents[0];

      if (selectedAgent) {
        // Determine tier based on complexity
        if (complexity < 5) {
          reason = `Fallback: ${complexity.toFixed(1)}/10 → Ollama`;
          modelTier = 'ollama';
          estimatedCost = 0;
        } else if (complexity < 7) {
          reason = `Fallback: ${complexity.toFixed(1)}/10 → Haiku`;
          modelTier = 'haiku';
          estimatedCost = 0.001;
        } else {
          reason = `Fallback: ${complexity.toFixed(1)}/10 → Sonnet`;
          modelTier = 'sonnet';
          estimatedCost = 0.005;
        }
        confidence = 0.6;
      }
    }

    // Find fallback agent (prefer QA as backup for coder tasks)
    const fallbackAgent = modelTier === 'ollama'
      ? agents.find((a) => a.agentType.name === 'qa')
      : agents.find((a) => a.id !== selectedAgent!.id);

    return {
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      reason,
      confidence,
      fallbackAgentId: fallbackAgent?.id,
      modelTier,
      estimatedCost,
      // Complexity assessment info
      complexity,
      routerComplexity,
      haikuComplexity,
      haikuReasoning,
      assessmentMethod,
    };
  }

  /**
   * Determine which model to use for task decomposition
   */
  getDecompositionDecision(complexity: number): DecompositionDecision {
    if (complexity >= 8) {
      return {
        modelTier: 'opus',
        reason: `High complexity (${complexity.toFixed(1)}/10) requires Opus for strategic decomposition`,
      };
    }
    return {
      modelTier: 'sonnet',
      reason: `Standard complexity (${complexity.toFixed(1)}/10) - Sonnet provides cost-effective decomposition`,
    };
  }

  /**
   * Determine fix strategy based on failure count
   */
  getFixDecision(failureCount: number): FixDecision {
    if (failureCount === 1) {
      return {
        modelTier: 'haiku',
        fixAttempt: 1,
        escalateToHuman: false,
        reason: '1st failure → Haiku fix attempt (~$0.001)',
      };
    }
    if (failureCount === 2) {
      return {
        modelTier: 'sonnet',
        fixAttempt: 2,
        escalateToHuman: false,
        reason: '2nd failure → Sonnet fix attempt (~$0.005)',
      };
    }
    return {
      modelTier: 'sonnet',
      fixAttempt: failureCount,
      escalateToHuman: true,
      reason: `${failureCount} failures → Escalate to human`,
    };
  }

  /**
   * Batch review decision for completed tasks
   */
  async getReviewDecision(taskIds: string[]): Promise<ReviewDecision> {
    // Always use Opus for code review (highest quality matters most here)
    return {
      taskIds,
      reviewerTier: 'opus',
      estimatedCost: taskIds.length * 0.02, // ~$0.02 per task review
    };
  }

  /**
   * Auto-assign the next pending task
   */
  async autoAssignNext(): Promise<{ task: Task; decision: RoutingDecision } | null> {
    // Get highest priority pending task
    const task = await this.prisma.task.findFirst({
      where: {
        status: 'pending',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    if (!task) {
      return null; // No pending tasks
    }

    // Route the task
    const decision = await this.routeTask(task.id);

    // Assign the task
    const updatedTask = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'assigned',
        assignedAgentId: decision.agentId,
        assignedAt: new Date(),
      },
    });

    // Update agent status
    await this.prisma.agent.update({
      where: { id: decision.agentId },
      data: {
        status: 'busy',
        currentTaskId: task.id,
      },
    });

    return {
      task: updatedTask,
      decision,
    };
  }
}
