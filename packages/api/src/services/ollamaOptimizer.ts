/**
 * Ollama Optimizer Service
 *
 * Handles Ollama-specific optimization based on stress test findings (Feb 2026):
 * - Context pollution after multiple tasks causes syntax errors
 * - Rest delays and periodic extended rest prevent this
 * - Ollama achieves 100% success rate on complexity 1-6 with these optimizations
 */

import type { Server as SocketIOServer } from 'socket.io';

// Ollama optimization constants (from stress test findings)
export const OLLAMA_REST_DELAY_MS = 3000; // 3 seconds rest between Ollama tasks
export const OLLAMA_EXTENDED_REST_MS = 8000; // 8 seconds every Nth task for context clearing
export const OLLAMA_RESET_EVERY_N_TASKS = 5; // Extended rest every N Ollama tasks
export const OLLAMA_COMPLEXITY_THRESHOLD = 10; // Tasks with complexity < 10 go to Ollama

// Track Ollama task counts per agent for periodic extended rest
const ollamaTaskCounts = new Map<string, number>();

// Helper function for async sleep
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface OllamaConfig {
  restDelayMs: number;
  extendedRestMs: number;
  resetEveryNTasks: number;
  complexityThreshold: number;
}

export interface OllamaRestEvent {
  agentId: string;
  restMs: number;
  isExtendedRest: boolean;
  taskCount: number;
}

export class OllamaOptimizer {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Get Ollama task counts per agent (for monitoring/debugging)
   */
  getTaskCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    ollamaTaskCounts.forEach((count, agentId) => {
      counts[agentId] = count;
    });
    return counts;
  }

  /**
   * Reset Ollama task counters (for testing)
   */
  resetTaskCounts(): void {
    ollamaTaskCounts.clear();
    console.log('🔄 Ollama task counters reset');
  }

  /**
   * Get Ollama optimization config
   */
  getConfig(): OllamaConfig {
    return {
      restDelayMs: OLLAMA_REST_DELAY_MS,
      extendedRestMs: OLLAMA_EXTENDED_REST_MS,
      resetEveryNTasks: OLLAMA_RESET_EVERY_N_TASKS,
      complexityThreshold: OLLAMA_COMPLEXITY_THRESHOLD,
    };
  }

  /**
   * Check if a task should use LOCAL Ollama based on complexity and agent type.
   * Remote Ollama tasks (128GB server, 70B models) don't need rest delays.
   */
  isOllamaTask(complexity: number, agentTypeName: string, modelTier?: string): boolean {
    if (modelTier === 'remote_ollama') return false; // Remote doesn't need rest
    return complexity < OLLAMA_COMPLEXITY_THRESHOLD && agentTypeName === 'coder';
  }

  /**
   * Apply rest delay after Ollama task completion
   * Returns the current task count for this agent
   */
  async applyRestDelay(agentId: string, agentName?: string): Promise<number> {
    const currentCount = (ollamaTaskCounts.get(agentId) || 0) + 1;
    ollamaTaskCounts.set(agentId, currentCount);

    const isExtendedRest = currentCount % OLLAMA_RESET_EVERY_N_TASKS === 0;
    const restMs = isExtendedRest ? OLLAMA_EXTENDED_REST_MS : OLLAMA_REST_DELAY_MS;

    console.log(
      `🛏️ Ollama task completed (${currentCount} total). Resting ${restMs / 1000}s...${
        isExtendedRest ? ' (extended rest for context clearing)' : ''
      }`
    );

    // Emit cooling down event for UI
    this.emitCoolingDown(agentId, restMs, isExtendedRest, currentCount);

    // Wait for rest period
    await sleep(restMs);

    if (isExtendedRest) {
      console.log(
        `✨ Ollama agent ${agentName || agentId} context clearing complete (${currentCount} tasks since reset)`
      );
    }

    return currentCount;
  }

  /**
   * Apply rest delay after Ollama task failure
   * Failed tasks also contribute to context pollution
   */
  async applyFailureRestDelay(agentId: string, agentName?: string): Promise<number> {
    const currentCount = (ollamaTaskCounts.get(agentId) || 0) + 1;
    ollamaTaskCounts.set(agentId, currentCount);

    const isExtendedRest = currentCount % OLLAMA_RESET_EVERY_N_TASKS === 0;
    const restMs = isExtendedRest ? OLLAMA_EXTENDED_REST_MS : OLLAMA_REST_DELAY_MS;

    console.log(
      `🛏️ Ollama task failed (${currentCount} total). Resting ${restMs / 1000}s...${
        isExtendedRest ? ' (extended rest)' : ''
      }`
    );

    this.emitCoolingDown(agentId, restMs, isExtendedRest, currentCount);

    await sleep(restMs);

    return currentCount;
  }

  /**
   * Emit cooling down event for UI feedback
   */
  private emitCoolingDown(
    agentId: string,
    restMs: number,
    isExtendedRest: boolean,
    taskCount: number
  ): void {
    this.io.emit('agent_cooling_down', {
      type: 'agent_cooling_down',
      payload: { agentId, restMs, isExtendedRest, taskCount },
      timestamp: new Date(),
    });
  }
}

// Singleton for backwards compatibility
let instance: OllamaOptimizer | null = null;

export function getOllamaOptimizer(io: SocketIOServer): OllamaOptimizer {
  if (!instance) {
    instance = new OllamaOptimizer(io);
  }
  return instance;
}

// Direct export of counts for routes that need them
export function getOllamaTaskCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  ollamaTaskCounts.forEach((count, agentId) => {
    counts[agentId] = count;
  });
  return counts;
}

export function resetOllamaTaskCounts(): void {
  ollamaTaskCounts.clear();
  console.log('🔄 Ollama task counters reset');
}
