/**
 * Code Review Service - Tiered Review System
 *
 * REVIEW SCHEDULE:
 * ================
 * - Haiku reviews: Every 5th Ollama task (cheap quality gate)
 * - Opus reviews: Every 10th task with complexity > 5 (deep analysis)
 *
 * FAILURE CRITERIA:
 * =================
 * - Quality score < 6
 * - Any "critical" severity finding
 * - Syntax errors detected
 *
 * ESCALATION:
 * ===========
 * - Failed review → task marked pending, context added to MCP
 * - Ollama → Haiku → Human
 */

import type { PrismaClient, Task } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import Anthropic from '@anthropic-ai/sdk';
import { mcpBridge } from './mcpBridge.js';

export interface CodeReviewFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  location?: string;
  suggestion?: string;
}

export interface CodeReviewResult {
  qualityScore: number;
  findings: CodeReviewFinding[];
  summary: string;
  approved: boolean;
  inputTokens: number;
  outputTokens: number;
  hasSyntaxErrors: boolean;
}

export interface ReviewDecision {
  shouldReview: boolean;
  reviewer: 'haiku' | 'opus' | null;
  reason: string;
}

// Task types that should NOT be reviewed
const SKIP_REVIEW_TYPES = ['review', 'decomposition', 'debug'];

// Review schedule configuration (can be overridden via env vars)
const OLLAMA_REVIEW_INTERVAL = parseInt(process.env.OLLAMA_REVIEW_INTERVAL || '5', 10);
const OPUS_REVIEW_INTERVAL = parseInt(process.env.OPUS_REVIEW_INTERVAL || '10', 10);
const OPUS_MIN_COMPLEXITY = 5;
const REVIEW_QUALITY_THRESHOLD = parseInt(process.env.REVIEW_QUALITY_THRESHOLD || '6', 10);

export class CodeReviewService {
  private anthropic: Anthropic | null = null;
  private enabled: boolean = true;

  // In-memory counters (will be persisted to Redis when MCP is ready)
  private ollamaTaskCounter: number = 0;
  private allTaskCounter: number = 0;

  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer
  ) {
    // Initialize Anthropic client if API key available
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      console.warn('CodeReviewService: ANTHROPIC_API_KEY not set, auto-review disabled');
      this.enabled = false;
    }

    // Load counters from Redis if MCP is enabled
    this.loadCountersFromRedis().catch(() => {
      console.log('CodeReviewService: Using in-memory counters (Redis not available)');
    });
  }

  /**
   * Load review counters from Redis
   */
  private async loadCountersFromRedis(): Promise<void> {
    // TODO: Implement Redis counter loading when MCP bridge exposes get/set methods
    // For now, counters reset on service restart
  }

  /**
   * Save review counters to Redis
   */
  private async saveCountersToRedis(): Promise<void> {
    // TODO: Implement Redis counter saving when MCP bridge exposes get/set methods
  }

  /**
   * Determine if and how a task should be reviewed based on tiered schedule
   */
  getReviewDecision(task: Task, executedByModel: string | null): ReviewDecision {
    if (!this.enabled) {
      return { shouldReview: false, reviewer: null, reason: 'Review service disabled' };
    }

    // Skip certain task types
    if (SKIP_REVIEW_TYPES.includes(task.taskType || '')) {
      return { shouldReview: false, reviewer: null, reason: `Skipping ${task.taskType} task type` };
    }

    // Skip failed tasks
    if (task.status !== 'completed') {
      return { shouldReview: false, reviewer: null, reason: 'Task not completed' };
    }

    const complexity = task.complexity || 5;
    const isOllamaTask = executedByModel === 'ollama' || !executedByModel;

    // Increment counters
    this.allTaskCounter++;
    if (isOllamaTask) {
      this.ollamaTaskCounter++;
    }

    // Save counters (async, non-blocking)
    this.saveCountersToRedis().catch(() => {});

    // Check Haiku review schedule (every 5th Ollama task)
    if (isOllamaTask && this.ollamaTaskCounter % OLLAMA_REVIEW_INTERVAL === 0) {
      return {
        shouldReview: true,
        reviewer: 'haiku',
        reason: `Haiku review: Ollama task #${this.ollamaTaskCounter} (every ${OLLAMA_REVIEW_INTERVAL}th)`
      };
    }

    // Check Opus review schedule (every 10th task with complexity > 5)
    if (complexity > OPUS_MIN_COMPLEXITY && this.allTaskCounter % OPUS_REVIEW_INTERVAL === 0) {
      return {
        shouldReview: true,
        reviewer: 'opus',
        reason: `Opus review: Task #${this.allTaskCounter} (every ${OPUS_REVIEW_INTERVAL}th, complexity ${complexity.toFixed(1)} > ${OPUS_MIN_COMPLEXITY})`
      };
    }

    return {
      shouldReview: false,
      reviewer: null,
      reason: `No review needed (Ollama: ${this.ollamaTaskCounter}/${OLLAMA_REVIEW_INTERVAL}, All: ${this.allTaskCounter}/${OPUS_REVIEW_INTERVAL})`
    };
  }

  /**
   * Trigger code review for a completed task (async, non-blocking)
   */
  async triggerReview(taskId: string, executedByModel?: string | null): Promise<void> {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: { assignedAgent: true },
      });

      if (!task) {
        console.error(`CodeReviewService: Task ${taskId} not found`);
        return;
      }

      // Check review decision
      const decision = this.getReviewDecision(task, executedByModel || null);

      if (!decision.shouldReview) {
        console.log(`CodeReviewService: ${decision.reason}`);
        return;
      }

      // Check if already reviewed
      const existingReview = await this.prisma.codeReview.findFirst({
        where: { taskId },
      });

      if (existingReview) {
        console.log(`CodeReviewService: Task ${taskId} already reviewed`);
        return;
      }

      console.log(`CodeReviewService: ${decision.reason}`);

      // Get execution logs for context
      const executionLogs = await this.prisma.executionLog.findMany({
        where: { taskId },
        orderBy: { step: 'asc' },
        take: 20,
      });

      // Extract code from execution logs
      const codeContent = this.extractCodeFromLogs(executionLogs, task);

      if (!codeContent) {
        console.log(`CodeReviewService: No code found for task ${taskId}`);
        return;
      }

      // Perform the review with appropriate model
      const reviewResult = await this.performReview(task, codeContent, decision.reviewer!);

      // Check if review failed
      const reviewFailed = this.checkReviewFailed(reviewResult);

      // Create code review record
      const review = await this.prisma.codeReview.create({
        data: {
          taskId,
          reviewerId: 'auto-review',
          reviewerModel: decision.reviewer === 'opus' ? 'claude-opus-4-5-20251101' : 'claude-haiku-4-5-20251001',
          initialComplexity: task.complexity || 5,
          opusComplexity: reviewResult.qualityScore,
          findings: reviewResult.findings as unknown as undefined,
          summary: reviewResult.summary,
          codeQualityScore: reviewResult.qualityScore,
          status: reviewFailed ? 'needs_fixes' : 'approved',
          inputTokens: reviewResult.inputTokens,
          outputTokens: reviewResult.outputTokens,
          totalCost: this.calculateCost(reviewResult.inputTokens, reviewResult.outputTokens, decision.reviewer!),
        },
      });

      // Handle review failure - escalate task
      if (reviewFailed) {
        await this.handleReviewFailure(task, reviewResult, executedByModel || null);
      }

      // Emit event
      this.io.emit('code_review_completed', {
        type: 'code_review_completed',
        payload: {
          taskId,
          reviewId: review.id,
          reviewer: decision.reviewer,
          qualityScore: reviewResult.qualityScore,
          approved: !reviewFailed,
          findingsCount: reviewResult.findings.length,
          hasSyntaxErrors: reviewResult.hasSyntaxErrors,
        },
        timestamp: new Date(),
      });

      console.log(`CodeReviewService: Review completed for task ${taskId} - Reviewer: ${decision.reviewer}, Score: ${reviewResult.qualityScore}/10, Passed: ${!reviewFailed}`);
    } catch (error) {
      console.error(`CodeReviewService: Error reviewing task ${taskId}:`, error);
    }
  }

  /**
   * Check if review failed based on criteria
   */
  private checkReviewFailed(result: CodeReviewResult): boolean {
    // Quality score below threshold
    if (result.qualityScore < REVIEW_QUALITY_THRESHOLD) {
      return true;
    }

    // Any critical severity finding
    const hasCritical = result.findings.some(f => f.severity === 'critical');
    if (hasCritical) {
      return true;
    }

    // Syntax errors detected
    if (result.hasSyntaxErrors) {
      return true;
    }

    return false;
  }

  /**
   * Handle review failure - mark task pending and add context to MCP
   */
  private async handleReviewFailure(
    task: Task,
    reviewResult: CodeReviewResult,
    executedByModel: string | null
  ): Promise<void> {
    // Determine escalation tier
    const nextTier = this.getEscalationTier(executedByModel);

    console.log(`CodeReviewService: Review failed for task ${task.id}, escalating from ${executedByModel || 'unknown'} to ${nextTier}`);

    // Update task status
    if (nextTier === 'human') {
      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          result: {
            ...((task.result as object) || {}),
            reviewFailed: true,
            reviewScore: reviewResult.qualityScore,
            needsHumanReview: true,
            criticalFindings: reviewResult.findings.filter(f => f.severity === 'critical') as unknown as object[],
          },
        },
      });

      // Emit human escalation event
      this.io.emit('task_needs_human_review', {
        type: 'task_needs_human_review',
        payload: {
          taskId: task.id,
          reason: 'Review failed after escalation',
          reviewScore: reviewResult.qualityScore,
          criticalFindings: reviewResult.findings.filter(f => f.severity === 'critical').length,
        },
        timestamp: new Date(),
      });
    } else {
      // Mark task as pending for retry by higher tier
      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'pending',
          assignedAgentId: null,
          currentIteration: task.currentIteration + 1,
          result: {
            ...((task.result as object) || {}),
            reviewFailed: true,
            reviewScore: reviewResult.qualityScore,
            previousModel: executedByModel,
            preferredModel: nextTier,
            reviewContext: {
              qualityScore: reviewResult.qualityScore,
              findings: reviewResult.findings as unknown as object[],
              summary: reviewResult.summary,
              hasSyntaxErrors: reviewResult.hasSyntaxErrors,
            },
          },
        },
      });

      // Publish to MCP for context sharing
      await mcpBridge.publishTaskUpdated(task.id, {
        status: 'pending',
        reviewFailed: true,
        preferredModel: nextTier,
        reviewContext: {
          qualityScore: reviewResult.qualityScore,
          criticalFindings: reviewResult.findings.filter(f => f.severity === 'critical'),
          suggestions: reviewResult.findings.map(f => f.suggestion).filter(Boolean),
        },
      });
    }
  }

  /**
   * Get escalation tier based on current model
   */
  private getEscalationTier(currentModel: string | null): 'haiku' | 'human' {
    switch (currentModel) {
      case 'ollama':
        return 'haiku';
      case 'haiku':
      case 'sonnet':
      case 'opus':
      default:
        return 'human';
    }
  }

  /**
   * Extract code content from execution logs
   */
  private extractCodeFromLogs(logs: Array<{ action: string; actionInput: unknown; observation: string | null }>, task: Task): string | null {
    const codeBlocks: string[] = [];

    for (const log of logs) {
      // Look for file_write actions
      if (log.action === 'file_write' && log.actionInput) {
        const input = log.actionInput as { path?: string; content?: string };
        if (input.content) {
          codeBlocks.push(`// File: ${input.path || 'unknown'}\n${input.content}`);
        }
      }

      // Look for code in observations
      if (log.observation && (log.observation.includes('def ') || log.observation.includes('function ') || log.observation.includes('class '))) {
        const codeMatch = log.observation.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeMatch) {
          codeBlocks.push(codeMatch[1]);
        }
      }
    }

    // Also check task result for code
    const result = task.result as { output?: string; code?: string } | null;
    if (result?.code) {
      codeBlocks.push(result.code);
    }

    return codeBlocks.length > 0 ? codeBlocks.join('\n\n---\n\n') : null;
  }

  /**
   * Perform code review using specified model
   */
  private async performReview(task: Task, codeContent: string, reviewer: 'haiku' | 'opus'): Promise<CodeReviewResult> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const model = reviewer === 'opus' ? 'claude-opus-4-5-20251101' : 'claude-haiku-4-5-20251001';

    const systemPrompt = `You are an expert code reviewer. Analyze the provided code and return a JSON response with:
- qualityScore: 0-10 (10 = excellent)
- findings: array of issues found
- summary: brief overall assessment
- approved: boolean (true if qualityScore >= ${REVIEW_QUALITY_THRESHOLD} and no critical/high issues)
- hasSyntaxErrors: boolean (true if syntax errors detected)

For each finding, include:
- severity: "critical" | "high" | "medium" | "low"
- category: e.g., "bug", "security", "performance", "style", "syntax", "best-practice"
- description: what the issue is
- suggestion: how to fix it

CRITICAL findings should include:
- Syntax errors that prevent code from running
- Security vulnerabilities (injection, XSS, etc.)
- Data loss or corruption risks

Be constructive and specific. Focus on actual issues.`;

    const userPrompt = `Review this code for task: "${task.title}"

Task Description: ${task.description}

Code:
\`\`\`
${codeContent.substring(0, 8000)}
\`\`\`

Return ONLY valid JSON matching this schema:
{
  "qualityScore": number,
  "findings": [{"severity": string, "category": string, "description": string, "suggestion": string}],
  "summary": string,
  "approved": boolean,
  "hasSyntaxErrors": boolean
}`;

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: 2000,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt,
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON response');
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      qualityScore: Math.min(10, Math.max(0, result.qualityScore || 5)),
      findings: result.findings || [],
      summary: result.summary || 'Review completed',
      approved: result.approved ?? (result.qualityScore >= REVIEW_QUALITY_THRESHOLD),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      hasSyntaxErrors: result.hasSyntaxErrors ?? false,
    };
  }

  /**
   * Calculate cost for review
   * Opus: $15/M input, $75/M output
   * Haiku: $0.25/M input, $1.25/M output
   */
  private calculateCost(inputTokens: number, outputTokens: number, reviewer: 'haiku' | 'opus'): number {
    if (reviewer === 'opus') {
      const inputCost = (inputTokens / 1_000_000) * 15;
      const outputCost = (outputTokens / 1_000_000) * 75;
      return Math.round((inputCost + outputCost) * 10000) / 10000;
    } else {
      const inputCost = (inputTokens / 1_000_000) * 0.25;
      const outputCost = (outputTokens / 1_000_000) * 1.25;
      return Math.round((inputCost + outputCost) * 10000) / 10000;
    }
  }

  /**
   * Enable/disable auto-review
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`CodeReviewService: Auto-review ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.anthropic !== null;
  }

  /**
   * Get review schedule status
   */
  getScheduleStatus(): {
    ollamaCounter: number;
    allTaskCounter: number;
    nextOllamaReview: number;
    nextOpusReview: number;
  } {
    return {
      ollamaCounter: this.ollamaTaskCounter,
      allTaskCounter: this.allTaskCounter,
      nextOllamaReview: OLLAMA_REVIEW_INTERVAL - (this.ollamaTaskCounter % OLLAMA_REVIEW_INTERVAL),
      nextOpusReview: OPUS_REVIEW_INTERVAL - (this.allTaskCounter % OPUS_REVIEW_INTERVAL),
    };
  }

  /**
   * Reset review counters (for testing)
   */
  resetCounters(): void {
    this.ollamaTaskCounter = 0;
    this.allTaskCounter = 0;
    this.saveCountersToRedis().catch(() => {});
  }
}
