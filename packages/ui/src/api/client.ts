const API_BASE = '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add API key if configured
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const response = await fetch(url, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Tasks API
export const tasksApi = {
  list: (filters?: { status?: string; requiredAgent?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.requiredAgent) params.set('requiredAgent', filters.requiredAgent);
    const query = params.toString();
    return request<Task[]>(`/tasks${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<Task>(`/tasks/${id}`),

  create: (data: CreateTaskRequest) =>
    request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateTaskRequest) =>
    request<Task>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/tasks/${id}`, { method: 'DELETE' }),

  retry: (id: string) =>
    request<Task>(`/tasks/${id}/retry`, { method: 'POST' }),

  submitHumanInput: (id: string, data: HumanInputRequest) =>
    request<Task>(`/tasks/${id}/human`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  abort: (id: string) =>
    request<Task>(`/tasks/${id}/abort`, { method: 'POST' }),
};

// Agents API
export const agentsApi = {
  list: (filters?: { type?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.status) params.set('status', filters.status);
    const query = params.toString();
    return request<Agent[]>(`/agents${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<Agent & { currentTask?: Task }>(`/agents/${id}`),

  update: (id: string, config: Partial<AgentConfig>) =>
    request<Agent>(`/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    }),

  pause: (id: string) =>
    request<Agent>(`/agents/${id}/pause`, { method: 'POST' }),

  resume: (id: string) =>
    request<Agent>(`/agents/${id}/resume`, { method: 'POST' }),

  abort: (id: string) =>
    request<Agent>(`/agents/${id}/abort`, { method: 'POST' }),

  setOffline: (id: string) =>
    request<Agent>(`/agents/${id}/offline`, { method: 'POST' }),

  setOnline: (id: string) =>
    request<Agent>(`/agents/${id}/online`, { method: 'POST' }),

  getStats: (id: string) =>
    request<{ stats: AgentStats; executions: TaskExecution[] }>(`/agents/${id}/stats`),

  getModelFeatures: () =>
    request<{ grokEnabled: boolean }>('/agents/model-features'),
};

// Queue API
export const queueApi = {
  getState: () =>
    request<QueueState>('/queue'),

  assign: (taskId: string, agentId: string) =>
    request<Task>('/queue/assign', {
      method: 'POST',
      body: JSON.stringify({ taskId, agentId }),
    }),

  autoAssign: (agentId: string) =>
    request<{ assigned: boolean; task?: Task }>('/queue/auto-assign', {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    }),

  getLocks: () => request<FileLock[]>('/queue/locks'),

  releaseLock: (filePath: string) =>
    request<void>(`/queue/locks/${encodeURIComponent(filePath)}`, {
      method: 'DELETE',
    }),
};

// Execute API
export const executeApi = {
  start: (taskId: string, options?: ExecuteOptions) =>
    request<{ started: boolean; taskId: string }>('/execute', {
      method: 'POST',
      body: JSON.stringify({ taskId, ...options }),
    }),

  // Quick execute - auto-assigns and executes a pending task
  quickExecute: async (taskId: string, agentId: string): Promise<{ started: boolean; taskId: string; queued?: boolean; message?: string }> => {
    // First assign the task
    const assignResult = await request<{ queued?: boolean; message?: string; task?: Task } | Task>('/queue/assign', {
      method: 'POST',
      body: JSON.stringify({ taskId, agentId }),
    });

    // Check if task was queued (agent busy) instead of assigned
    if ('queued' in assignResult && assignResult.queued) {
      return {
        started: false,
        taskId,
        queued: true,
        message: assignResult.message || 'Task queued - will auto-execute when agent is free'
      };
    }

    // Task was assigned, now execute it
    return request<{ started: boolean; taskId: string }>('/execute', {
      method: 'POST',
      body: JSON.stringify({ taskId, useClaude: false }),
    });
  },

  step: (taskId: string, stepNumber: number) =>
    request<ExecutionStep>('/execute/step', {
      method: 'POST',
      body: JSON.stringify({ taskId, stepNumber }),
    }),

  approve: (taskId: string, stepNumber: number) =>
    request<{ approved: boolean }>('/execute/approve', {
      method: 'POST',
      body: JSON.stringify({ taskId, stepNumber }),
    }),

  reject: (taskId: string, stepNumber: number, reason: string) =>
    request<{ rejected: boolean }>('/execute/reject', {
      method: 'POST',
      body: JSON.stringify({ taskId, stepNumber, reason }),
    }),

  abort: (taskId: string) =>
    request<{ aborted: boolean }>('/execute/abort', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    }),

  health: () => request<{ status: string; ollama: boolean; claude: boolean }>('/execute/health'),
};

// Metrics API
export const metricsApi = {
  overview: () => request<OverviewMetrics>('/metrics/overview'),

  agent: (id: string) =>
    request<AgentMetrics>(`/metrics/agents/${id}`),

  timeline: (hours?: number) =>
    request<TimelineDataPoint[]>(`/metrics/timeline${hours ? `?hours=${hours}` : ''}`),

  distribution: () => request<DistributionMetrics>('/metrics/distribution'),
};

// Code Reviews API
export const codeReviewsApi = {
  getForTask: (taskId: string) =>
    request<CodeReview>(`/code-reviews/task/${taskId}`),

  getAll: (params?: { limit?: number; offset?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.status) query.set('status', params.status);
    return request<{ reviews: CodeReview[]; total: number }>(`/code-reviews?${query}`);
  },

  getStats: () => request<CodeReviewStats>('/code-reviews/stats'),
};

// Execution Logs API
export const executionLogsApi = {
  getTaskLogs: (taskId: string) =>
    request<ExecutionLog[]>(`/execution-logs/task/${taskId}`),

  getAgentLogs: (agentId: string, limit = 100) =>
    request<ExecutionLog[]>(`/execution-logs/agent/${agentId}?limit=${limit}`),

  getLoopLogs: (taskId: string) =>
    request<ExecutionLog[]>(`/execution-logs/task/${taskId}/loops`),
};

// Chat API
export const chatApi = {
  listConversations: (agentId?: string) => {
    const query = agentId ? `?agentId=${agentId}` : '';
    return request<Conversation[]>(`/chat/conversations${query}`);
  },

  getConversation: (id: string) =>
    request<Conversation>(`/chat/conversations/${id}`),

  createConversation: (data: CreateConversationRequest) =>
    request<Conversation>('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteConversation: (id: string) =>
    request<void>(`/chat/conversations/${id}`, { method: 'DELETE' }),

  sendMessage: (conversationId: string, content: string) =>
    request<{ status: string; conversationId: string }>(
      `/chat/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    ),
};

// Types
import type {
  Task,
  Agent,
  AgentConfig,
  AgentStats,
  FileLock,
  ExecutionStep,
  TaskExecution,
  Conversation,
  CreateConversationRequest,
} from '@abcc/shared';

interface CreateTaskRequest {
  title: string;
  description?: string;
  taskType: string;
  requiredAgent?: string;
  priority?: number;
  maxIterations?: number;
  lockedFiles?: string[];
  validationCommand?: string;
}

interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: number;
  maxIterations?: number;
}

interface HumanInputRequest {
  input: string;
  action: 'approve' | 'reject' | 'modify';
  modifiedContent?: string;
}

interface ExecuteOptions {
  useClaude?: boolean;
  model?: string;
  allowFallback?: boolean;
}

interface QueueState {
  pending: Task[];
  active: Task[];
  idleAgents: Agent[];
  stats: {
    pendingCount: number;
    activeCount: number;
    idleAgentCount: number;
  };
}

interface OverviewMetrics {
  totalTasks: number;
  pendingTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalAgents: number;
  busyAgents: number;
  idleAgents: number;
  totalApiCredits: number;
  totalTimeMs: number;
  successRate: number;
}

interface AgentMetrics {
  agent: Agent;
  stats: AgentStats;
  executions: TaskExecution[];
  metrics: {
    totalExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    totalApiCredits: number;
    totalTimeMs: number;
    avgDurationMs: number;
  };
}

interface TimelineDataPoint {
  timestamp: string;
  tasksCompleted: number;
  tasksFailed: number;
  apiCreditsUsed: number;
}

interface DistributionMetrics {
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byAgent: { agent: string; count: number }[];
}

export interface ExecutionLog {
  id: string;
  taskId: string;
  agentId: string;
  step: number;
  timestamp: string;
  thought?: string;
  action: string;
  actionInput: unknown;
  observation: string;
  durationMs?: number;
  isLoop: boolean;
  errorTrace?: string;
  inputTokens?: number;
  outputTokens?: number;
  modelUsed?: string;
}

export interface CodeReviewFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  location?: string;
  suggestion?: string;
}

export interface CodeReview {
  id: string;
  taskId: string;
  reviewerId?: string;
  reviewerModel?: string;
  initialComplexity: number;
  opusComplexity?: number;
  findings: CodeReviewFinding[];
  summary?: string;
  codeQualityScore?: number;
  status: 'pending' | 'approved' | 'needs_fixes' | 'rejected';
  fixAttempts: number;
  fixedByAgentId?: string;
  fixedByModel?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalCost?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CodeReviewStats {
  total: number;
  approved: number;
  needsFixes: number;
  approvalRate: string;
  avgQualityScore: string;
  totalCost: string;
}

// Missions API
export const missionsApi = {
  start: (data: { prompt: string; language?: string; autoApprove?: boolean; waitForCompletion?: boolean; conversationId?: string }) =>
    request<{ id: string; status: string }>('/missions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  list: (params?: { status?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    return request<MissionSummary[]>(`/missions?${query}`);
  },

  get: (id: string) =>
    request<MissionDetail>(`/missions/${id}`),

  approve: (id: string) =>
    request<{ id: string; status: string }>(`/missions/${id}/approve`, { method: 'POST' }),

  reject: (id: string, reason?: string) =>
    request<{ id: string; status: string }>(`/missions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getFiles: (id: string) =>
    request<Record<string, string>>(`/missions/${id}/files`),
};

export interface MissionSummary {
  id: string;
  prompt: string;
  language: string;
  status: string;
  subtaskCount: number;
  completedCount: number;
  failedCount: number;
  reviewScore: number | null;
  totalCost: number;
  totalTimeMs: number;
  error: string | null;
  createdAt: string;
  tasks: Array<{ id: string; title: string; status: string; complexity: number | null }>;
}

export interface MissionDetail extends MissionSummary {
  plan: Array<{ title: string; description: string; file_name: string; validation_command: string; complexity: number; language: string }> | null;
  reviewResult: { approved: boolean; score: number; summary: string; findings: Array<{ severity: string; file: string; issue: string; suggestion: string }> } | null;
  autoApprove: boolean;
  conversationId: string | null;
}

// Cost Metrics API
export const costMetricsApi = {
  summary: () =>
    request<CostMetricsSummary>('/cost-metrics/summary'),

  byAgent: () =>
    request<CostByAgentResponse>('/cost-metrics/by-agent'),

  byTaskType: () =>
    request<CostByTaskTypeResponse>('/cost-metrics/by-task-type'),

  timeline: (hours = 24) =>
    request<CostTimelineResponse>(`/cost-metrics/timeline?hours=${hours}`),
};

export interface CostMetricsSummary {
  totalCost: number;
  totalCostFormatted: string;
  byModelTier: {
    free: number;
    remote: number;
    haiku: number;
    sonnet: number;
    opus: number;
  };
  byModel: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    count: number;
  }>;
  totalTokens: {
    input: number;
    output: number;
    total: number;
  };
  logCount: number;
}

export interface AgentCostMetrics {
  agentId: string;
  agentName: string;
  agentType: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  logCount: number;
}

export interface CostByAgentResponse {
  agents: AgentCostMetrics[];
  totalAgents: number;
}

export interface TaskTypeCostMetrics {
  taskType: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  taskCount: number;
  logCount: number;
}

export interface CostByTaskTypeResponse {
  taskTypes: TaskTypeCostMetrics[];
  totalTypes: number;
}

export interface HourlyCostData {
  hour: string;
  timestamp: Date;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  logCount: number;
  byModelTier: {
    free: number;
    remote: number;
    haiku: number;
    sonnet: number;
    opus: number;
  };
}

export interface CostTimelineResponse {
  timeline: HourlyCostData[];
  hours: number;
  startTime: Date;
  endTime: Date;
  totalCost: number;
}

// Validation API
export interface TaskValidationResult {
  taskId: string;
  passed: boolean;
  error?: string;
  validatedAt: string;
  retryPhase?: string;
  retryAttempts?: number;
}

export interface ValidationStatus {
  pending: number;
  passed: number;
  failed: number;
  retryQueueSize: number;
  retryInProgress: boolean;
  total: number;
}

export interface RetryQueueResults {
  retried: number;
  saved: number;
  stillFailing: number;
  details: Array<{
    taskId: string;
    savedAt?: string;
    finalError?: string;
  }>;
}

export const validationApi = {
  getStatus: () =>
    request<ValidationStatus>('/validation/status'),

  getResult: (taskId: string) =>
    request<TaskValidationResult | null>(`/validation/results?taskId=${taskId}`),

  triggerRetry: () =>
    request<{ started: boolean; count: number }>('/validation/retry', { method: 'POST' }),

  getRetryResults: () =>
    request<RetryQueueResults | null>('/validation/retry-results'),
};
