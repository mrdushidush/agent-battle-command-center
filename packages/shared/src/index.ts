// Agent Types
export type AgentType = 'coder' | 'qa';
export type AgentStatus = 'idle' | 'busy' | 'stuck' | 'offline';

export interface AgentStats {
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number;
  totalApiCredits: number;
  totalTimeMs: number;
}

export interface AgentConfig {
  preferredModel?: string;
  maxConcurrentTasks?: number;
  autoRetry?: boolean;
}

export interface AgentTypeInfo {
  id: string;
  name: AgentType;
  displayName: string;
  description: string;
  capabilities: string[];
  icon: string;
  color: string;
}

export interface Agent {
  id: string;
  agentTypeId: string;
  type: AgentType;
  name: string;
  status: AgentStatus;
  currentTaskId: string | null;
  config: AgentConfig;
  stats: AgentStats;
  createdAt: Date;
  updatedAt: Date;
}

// Task Types
export type TaskType = 'code' | 'test' | 'review' | 'debug' | 'refactor';
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'needs_human'
  | 'completed'
  | 'failed'
  | 'aborted';

export type TaskPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface TaskMetrics {
  apiCreditsUsed: number;
  timeSpentMs: number;
  iterations: number;
}

export interface TaskResult {
  success: boolean;
  output?: string;
  filesModified?: string[];
  error?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  taskType: TaskType;
  requiredAgent: AgentType | null;
  status: TaskStatus;
  priority: TaskPriority;
  maxIterations: number;
  currentIteration: number;
  assignedAgentId: string | null;
  assignedAt: Date | null;
  needsHumanAt: Date | null;
  humanTimeoutMinutes: number;
  escalatedToAgentId: string | null;
  result: TaskResult | null;
  error: string | null;
  metrics: TaskMetrics;
  lockedFiles: string[];
  parentTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

// Execution Types
export interface ExecutionStep {
  id: string;
  taskId: string;
  agentId: string;
  iteration: number;
  stepNumber: number;
  action: string;
  description: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'awaiting_approval';
  startedAt: Date;
  completedAt?: Date;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  agentId: string;
  iteration: number;
  status: 'started' | 'completed' | 'failed';
  apiCreditsUsed: number;
  durationMs: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  logs: string;
  startedAt: Date;
  completedAt: Date | null;
}

// File Lock Types
export interface FileLock {
  id: string;
  filePath: string;
  lockedByAgentId: string;
  lockedByTaskId: string;
  lockedAt: Date;
  expiresAt: Date;
}

// Alert Types
export type AlertType =
  | 'agent_stuck'
  | 'human_input_needed'
  | 'file_conflict'
  | 'task_failed'
  | 'escalation';

export type AlertSeverity = 'info' | 'warning' | 'error';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  taskId?: string;
  agentId?: string;
  acknowledged: boolean;
  createdAt: Date;
}

// WebSocket Event Types
export type WSEventType =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'agent_status_changed'
  | 'execution_step'
  | 'alert'
  | 'metrics_updated'
  | 'chat_message_chunk'
  | 'chat_message_complete'
  | 'chat_error';

export interface WSEvent<T = unknown> {
  type: WSEventType;
  payload: T;
  timestamp: Date;
}

export interface TaskCreatedEvent extends WSEvent<Task> {
  type: 'task_created';
}

export interface TaskUpdatedEvent extends WSEvent<Task> {
  type: 'task_updated';
}

export interface TaskDeletedEvent extends WSEvent<{ id: string }> {
  type: 'task_deleted';
}

export interface AgentStatusEvent extends WSEvent<Agent> {
  type: 'agent_status_changed';
}

export interface ExecutionStepEvent extends WSEvent<ExecutionStep> {
  type: 'execution_step';
}

export interface AlertEvent extends WSEvent<Alert> {
  type: 'alert';
}

// API Request/Response Types
export interface CreateTaskRequest {
  title: string;
  description: string;
  taskType: TaskType;
  requiredAgent?: AgentType;
  priority?: TaskPriority;
  maxIterations?: number;
  humanTimeoutMinutes?: number;
  parentTaskId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  maxIterations?: number;
}

export interface ExecuteTaskRequest {
  taskId: string;
  agentId: string;
  taskDescription?: string;
  expectedOutput?: string;
  useClaude?: boolean;
  model?: string;
  allowFallback?: boolean;
  stepByStep?: boolean;
}

export interface ExecuteTaskResponse {
  success: boolean;
  executionId: string;
  output?: string;
  metrics?: TaskMetrics;
  error?: string;
}

export interface HumanInputRequest {
  taskId: string;
  input: string;
  action: 'approve' | 'reject' | 'modify';
  modifiedContent?: string;
}

// Metrics Types
export interface OverviewMetrics {
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

export interface TimelineDataPoint {
  timestamp: Date;
  tasksCompleted: number;
  tasksFailed: number;
  apiCreditsUsed: number;
}

// UI State Types
export type UIMode = 'overseer' | 'micromanager' | 'dashboard';

export interface UIState {
  mode: UIMode;
  selectedTaskId: string | null;
  selectedAgentId: string | null;
  sidebarCollapsed: boolean;
  alertsPanelOpen: boolean;
  chatPanelOpen: boolean;
  activeChatAgentId: string | null;
  activeConversationId: string | null;
}

// Constants
export const AGENT_COLORS: Record<AgentType, string> = {
  coder: '#3B82F6', // blue
  qa: '#10B981',    // green
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#6B7280',    // gray
  assigned: '#8B5CF6',   // purple
  in_progress: '#3B82F6', // blue
  needs_human: '#F59E0B', // amber
  completed: '#10B981',   // green
  failed: '#EF4444',      // red
  aborted: '#6B7280',     // gray
};

export const AGENT_STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '#10B981',    // green
  busy: '#3B82F6',    // blue
  stuck: '#F59E0B',   // amber
  offline: '#6B7280', // gray
};

export const DEFAULT_MAX_ITERATIONS = 3;
export const DEFAULT_HUMAN_TIMEOUT_MINUTES = 30;
export const DEFAULT_PRIORITY: TaskPriority = 5;

// Chat Types
export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  agentId: string;
  taskId: string | null;
  title: string | null;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationRequest {
  agentId: string;
  taskId?: string;
  title?: string;
}

export interface SendMessageRequest {
  content: string;
}

export interface ChatStreamChunk {
  conversationId: string;
  messageId: string;
  chunk: string;
}

export interface ChatStreamComplete {
  conversationId: string;
  messageId: string;
  fullContent: string;
}

export interface ChatError {
  conversationId: string;
  error: string;
}

// Chat WebSocket Events
export type ChatWSEventType =
  | 'chat_message_chunk'
  | 'chat_message_complete'
  | 'chat_error';

export interface ChatMessageChunkEvent extends WSEvent<ChatStreamChunk> {
  type: 'chat_message_chunk';
}

export interface ChatMessageCompleteEvent extends WSEvent<ChatStreamComplete> {
  type: 'chat_message_complete';
}

export interface ChatErrorEvent extends WSEvent<ChatError> {
  type: 'chat_error';
}
