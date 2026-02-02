/**
 * Task Router Service - Cost-Optimized Tiered Routing
 *
 * ACADEMIC COMPLEXITY SCALE (1-10):
 * =================================
 * Based on Campbell's Task Complexity Theory and Ollama stress testing (Feb 2026).
 * Key finding: Ollama achieves 100% on C1-C6 with 3s rest delays + reset every 5 tasks.
 *
 * | Score | Level    | Characteristics                                          | Model   |
 * |-------|----------|----------------------------------------------------------|---------|
 * | 1-2   | Trivial  | Single-step; clear I/O; no decision-making               | Ollama  |
 * | 3-4   | Low      | Linear sequences; well-defined domain; no ambiguity      | Ollama  |
 * | 5-6   | Moderate | Multiple conditions; validation; helper logic            | Ollama  |
 * | 7-8   | Complex  | Multiple functions; algorithms; data structures          | Haiku   |
 * | 9-10  | Extreme  | Fuzzy goals; dynamic requirements; architectural scope   | Sonnet  |
 *
 * TIER ROUTING (Execution):
 * =========================
 * - Trivial/Moderate (1-6) → Ollama (FREE, ~30s/task avg)
 * - Complex (7-8)          → Haiku (~$0.001/task)
 * - Extreme (9-10)         → Sonnet (~$0.005/task)
 * - NOTE: Opus NEVER writes code - decomposition & reviews only
 *
 * DECOMPOSITION:
 * - Standard (<9)  → Sonnet decomposes into subtasks
 * - Complex (>=9)  → Opus strategic decomposition
 *
 * CODE REVIEW:
 * - Every 5th Ollama task → Haiku review
 * - Every 10th task (complexity > 5) → Opus review
 *
 * FIX/ESCALATION CYCLE:
 * - Ollama fails/bad review → Haiku retries with context
 * - Haiku fails/bad review  → Human escalation
 * - Sonnet fails/bad review → Human escalation
 */

import type { PrismaClient, Task, Agent } from '@prisma/client';
import { getDualComplexityAssessment } from './complexityAssessor.js';
import { budgetService } from './budgetService.js';

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
  complexitySource?: string; // How complexity was determined: 'router', 'haiku', 'dual'
  complexityReasoning?: string; // Explanation of the complexity score
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
        'database', 'api', 'service', 'module', 'component',
        // Data structures and algorithms
        'cache', 'lru', 'linked list', 'hash map', 'hashmap', 'tree', 'graph',
        'queue', 'stack', 'heap', 'binary', 'sorting', 'searching',
        'o(1)', 'o(n)', 'o(log', 'time complexity', 'space complexity'
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
          complexitySource: 'router',
        };
      }

      throw new Error('No agents available');
    }

    // Calculate complexity using dual assessment (router + Haiku)
    const routerComplexity = this.calculateComplexity(task);
    let complexity = routerComplexity;
    let complexitySource: string = 'router';
    let complexityReasoning: string | undefined;

    // Try dual assessment with Haiku (always, unless already high complexity)
    // Note: Router can underestimate (e.g. "LRU cache" = 1.5 but should be 7+)
    if (routerComplexity <= 8) {
      try {
        const dualAssessment = await getDualComplexityAssessment(
          task.title,
          task.description || '',
          routerComplexity
        );

        complexity = dualAssessment.complexity;
        complexitySource = dualAssessment.complexitySource;
        complexityReasoning = dualAssessment.complexityReasoning;

        // Save complexity assessments to task for future fine-tuning
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            complexity,
            complexitySource,
            complexityReasoning,
          },
        });

        console.log(`📊 Complexity assessment: ${complexity} (source: ${complexitySource})`);
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
    // Based on Campbell's Task Complexity Theory + Ollama stress testing (Feb 2026)
    // Ollama achieves 100% success on C1-C6 with rest delays + periodic context reset

    // BUDGET CHECK: If Claude is blocked, force all tasks to Ollama
    const claudeBlocked = budgetService.isClaudeBlocked();
    if (claudeBlocked) {
      console.log('💸 Budget exceeded - forcing task to Ollama (free)');
    }

    // TRIVIAL/MODERATE (1-6): Single-step to moderate logic → Ollama (FREE)
    // Also route here if Claude is blocked due to budget
    if (!selectedAgent && (complexity < 7 || claudeBlocked)) {
      selectedAgent = agents.find((a) => a.agentType.name === 'coder') || null;
      if (selectedAgent) {
        if (claudeBlocked && complexity >= 7) {
          reason = `⚠️ Budget exceeded - routing ${complexity.toFixed(1)}/10 task to Ollama (free)`;
          confidence = 0.7; // Lower confidence for forced routing
        } else {
          const level = complexity < 3 ? 'Trivial' : complexity < 5 ? 'Low' : 'Moderate';
          reason = `${level} complexity (${complexity.toFixed(1)}/10) → Ollama (free, ~30s)`;
          confidence = 0.9;
        }
        modelTier = 'ollama';
        estimatedCost = 0;
      }
    }

    // COMPLEX (7-8): Multiple functions, algorithms, data structures → Haiku
    if (!selectedAgent && complexity >= 7 && complexity < 9) {
      selectedAgent = agents.find((a) => a.agentType.name === 'qa') || null;
      if (selectedAgent) {
        reason = `Complex (${complexity.toFixed(1)}/10) → Haiku (quality, ~$0.001)`;
        confidence = 0.9;
        modelTier = 'haiku';
        estimatedCost = 0.001;
      }
    }

    // EXTREME (9-10): Fuzzy goals, architectural scope → Sonnet (Opus never codes)
    if (!selectedAgent && complexity >= 9) {
      selectedAgent = agents.find((a) => a.agentType.name === 'qa') || null;
      if (selectedAgent) {
        reason = `Extreme complexity (${complexity.toFixed(1)}/10) → Sonnet (expert coding, ~$0.005)`;
        confidence = 0.85;
        modelTier = 'sonnet';
        estimatedCost = 0.005;
      }
    }

    // FALLBACK: If no agent selected yet, handle based on complexity
    if (!selectedAgent) {
      // For high-complexity tasks (7+), ONLY allow qa agent - don't fall back to coder
      // This prevents routing complex tasks to Ollama which can't handle them
      if (complexity >= 7) {
        const qaAgent = agents.find((a) => a.agentType.name === 'qa');
        if (qaAgent) {
          selectedAgent = qaAgent;
          if (complexity < 9) {
            reason = `Complex (${complexity.toFixed(1)}/10) → Haiku (qa agent available)`;
            modelTier = 'haiku';
            estimatedCost = 0.001;
          } else {
            reason = `Extreme (${complexity.toFixed(1)}/10) → Sonnet (qa agent available)`;
            modelTier = 'sonnet';
            estimatedCost = 0.005;
          }
          confidence = 0.7;
        } else {
          // No qa agent available for complex task - throw error so task queues
          throw new Error(`No suitable agent for complex task (${complexity.toFixed(1)}/10). QA agent required but not idle.`);
        }
      } else {
        // For simple tasks (< 7), coder is fine
        selectedAgent = agents.find((a) => a.agentType.name === 'coder')
          || agents.find((a) => a.agentType.name === 'qa')
          || agents[0];

        if (selectedAgent) {
          reason = `Fallback: ${complexity.toFixed(1)}/10 → Ollama`;
          modelTier = 'ollama';
          estimatedCost = 0;
          confidence = 0.6;
        }
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
      complexitySource,
      complexityReasoning,
    };
  }

  /**
   * Determine which model to use for task decomposition
   */
  getDecompositionDecision(complexity: number): DecompositionDecision {
    if (complexity >= 9) {
      return {
        modelTier: 'opus',
        reason: `Extreme complexity (${complexity.toFixed(1)}/10) requires Opus for strategic decomposition`,
      };
    }
    return {
      modelTier: 'sonnet',
      reason: `Standard complexity (${complexity.toFixed(1)}/10) - Sonnet provides cost-effective decomposition`,
    };
  }

  /**
   * Determine fix strategy based on failure count
   *
   * Escalation path (cost-optimized):
   * - Ollama fails → Haiku retries with context
   * - Haiku fails  → Human escalation (Sonnet too expensive for fix cycles)
   * - Sonnet fails → Human escalation
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
    // After Haiku tries, escalate to human (no Sonnet in fix cycle)
    return {
      modelTier: 'haiku',
      fixAttempt: failureCount,
      escalateToHuman: true,
      reason: `${failureCount} failures → Escalate to human (Haiku already tried)`,
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
