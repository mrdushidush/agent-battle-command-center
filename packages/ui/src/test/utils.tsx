import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { vi } from 'vitest';

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
export const mockTask = {
  id: 'test-task-1',
  title: 'Test Task',
  description: 'Test task description',
  taskType: 'code' as const,
  status: 'pending' as const,
  priority: 5,
  complexity: 5,
  routerComplexity: 5,
  haikuComplexity: null,
  finalComplexity: 5,
  requiredAgent: null,
  assignedAgentId: null,
  assignedAt: null,
  currentIteration: 0,
  maxIterations: 3,
  result: null,
  error: null,
  errorCategory: null,
  lockedFiles: [],
  acceptanceCriteria: null,
  contextNotes: null,
  validationCommand: null,
  humanTimeoutMinutes: 30,
  parentTaskId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  timeSpentMs: null,
  completedAt: null,
  apiCreditsUsed: 0,
};

/**
 * Mock agent data for testing
 */
export const mockAgent = {
  id: 'test-agent-1',
  name: 'Test Agent',
  agentTypeId: 'coder',
  status: 'idle' as const,
  currentTaskId: null,
  stats: {
    tasksCompleted: 10,
    tasksFailed: 2,
    totalIterations: 15,
    avgIterations: 1.5,
    totalTimeMs: 120000,
    avgTimeMs: 12000,
    successRate: 0.83,
  },
  config: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  agentType: {
    id: 'coder',
    name: 'coder',
    description: 'Coding agent',
    capabilities: ['file_write', 'code_generation'],
  },
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
