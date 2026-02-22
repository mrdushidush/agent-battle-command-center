import { config } from '../config.js';
import type { ExecuteTaskRequest, ExecuteTaskResponse, TaskMetrics } from '../types/index.js';

// Timeout constants (ms)
const EXECUTE_TIMEOUT_MS = 600_000; // 10 min — long tasks (C7-C9)
const ABORT_TIMEOUT_MS = 15_000;    // 15s
const HEALTH_TIMEOUT_MS = 10_000;   // 10s

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export class ExecutorService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.agents.url;
  }

  async executeTask(
    request: ExecuteTaskRequest
  ): Promise<ExecuteTaskResponse> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: request.taskId,
          agent_id: request.agentId,
          task_description: request.taskDescription,
          expected_output: request.expectedOutput,
          use_claude: request.useClaude ?? true,
          model: request.model,
          allow_fallback: request.allowFallback ?? true,
        }),
      }, EXECUTE_TIMEOUT_MS);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          executionId: '',
          error: `Execution failed: ${error}`,
        };
      }

      const result = await response.json() as {
        success: boolean;
        execution_id: string;
        output?: string;
        metrics?: {
          api_credits_used?: number;
          time_spent_ms?: number;
          iterations?: number;
        };
        error?: string;
      };

      return {
        success: result.success,
        executionId: result.execution_id,
        output: result.output,
        metrics: {
          apiCreditsUsed: result.metrics?.api_credits_used ?? 0,
          timeSpentMs: result.metrics?.time_spent_ms ?? 0,
          iterations: result.metrics?.iterations ?? 1,
        },
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        executionId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async abortExecution(taskId: string): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/execute/abort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId,
        }),
      }, ABORT_TIMEOUT_MS);

      return response.ok;
    } catch (error) {
      console.error('Abort execution error:', error);
      return false;
    }
  }

  async healthCheck(): Promise<{ status: string; ollama: boolean; claude: boolean }> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/health`, {}, HEALTH_TIMEOUT_MS);
      if (!response.ok) {
        return { status: 'error', ollama: false, claude: false };
      }
      return await response.json() as { status: string; ollama: boolean; claude: boolean };
    } catch (error) {
      return { status: 'error', ollama: false, claude: false };
    }
  }
}
