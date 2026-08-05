import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { vi } from 'vitest';
import type { Agent, Task } from '@abcc/shared';

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
  ui: ReactElement<any>,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { ...options });
}

/**
 * Mock task data for testing
 */
export const mockTask: Task = {
  id: 'test-task-1',
  title: 'Test Task',
  description: 'Test task description',
  taskType: 'code',
  requiredAgent: null,
  status: 'pending',
  priority: 5,
  maxIterations: 3,
  currentIteration: 0,
  assignedAgentId: null,
  assignedAt: null,
  needsHumanAt: null,
  humanTimeoutMinutes: 30,
  escalatedToAgentId: null,
  result: null,
  error: null,
  metrics: {
    apiCreditsUsed: 0,
    timeSpentMs: 0,
    iterations: 0,
  },
  lockedFiles: [],
  parentTaskId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
};

/**
 * Mock agent data for testing
 */
export const mockAgent: Agent = {
  id: 'test-agent-1',
  agentTypeId: 'coder',
  type: 'coder',
  name: 'Test Agent',
  status: 'idle',
  currentTaskId: null,
  config: {},
  stats: {
    tasksCompleted: 10,
    tasksFailed: 2,
    successRate: 0.83,
    totalApiCredits: 1.5,
    totalTimeMs: 120000,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Mock execution log for testing
 */
export const mockExecutionLog = {
  id: 'test-log-1',
  taskId: 'test-task-1',
  agentId: 'test-agent-1',
  step: 1,
  thought: 'Analyzing the task',
  action: 'file_write',
  actionInput: { path: 'test.js', content: 'console.log("test")' },
  observation: 'File written successfully',
  timestamp: new Date().toISOString(),
  durationMs: 150,
  isLoop: false,
  errorTrace: null,
  inputTokens: 100,
  outputTokens: 50,
  modelUsed: 'ollama',
};

/**
 * Mock WebSocket hook
 */
export const mockUseSocket = () => ({
  isConnected: true,
  tasks: [mockTask],
  agents: [mockAgent],
  executionLogs: [mockExecutionLog],
  alerts: [],
  costMetrics: {
    totalCost: 1.23,
    byModelTier: {
      free: 0,
      remote: 0,
      haiku: 0.5,
      sonnet: 0.73,
      opus: 0,
    },
    totalTokens: {
      input: 1000,
      output: 500,
      total: 1500,
    },
  },
  queueState: {
    pending: [mockTask],
    active: [],
    idleAgents: [mockAgent],
    stats: {
      pendingCount: 1,
      activeCount: 0,
      idleAgentCount: 1,
    },
  },
  refreshTasks: vi.fn(),
  refreshAgents: vi.fn(),
  refreshQueue: vi.fn(),
});

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
