import { create } from 'zustand';
import type { Task, Agent, Alert, UIMode } from '@abcc/shared';

interface UIState {
  // Mode
  mode: UIMode;
  setMode: (mode: UIMode) => void;

  // Selection
  selectedTaskId: string | null;
  selectedAgentId: string | null;
  selectTask: (id: string | null) => void;
  selectAgent: (id: string | null) => void;

  // UI toggles
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  alertsPanelOpen: boolean;
  toggleAlertsPanel: () => void;
  chatPanelOpen: boolean;
  toggleChatPanel: () => void;
  toolLogOpen: boolean;
  toggleToolLog: () => void;

  // Chat state
  activeChatAgentId: string | null;
  activeConversationId: string | null;
  setActiveChatAgent: (agentId: string | null) => void;
  setActiveConversation: (conversationId: string | null) => void;

  // Data
  tasks: Task[];
  agents: Agent[];
  alerts: Alert[];
  setTasks: (tasks: Task[]) => void;
  setAgents: (agents: Agent[]) => void;
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: string) => void;
  clearAlerts: () => void;

  // Real-time updates
  updateTask: (task: Task) => void;
  removeTask: (id: string) => void;
  updateAgent: (agent: Agent) => void;

  // Metrics
  metrics: {
    totalApiCredits: number;
    totalTimeMs: number;
    totalIterations: number;
  };
  setMetrics: (metrics: Partial<UIState['metrics']>) => void;

  // Cost metrics
  costMetrics: {
    totalCost: number;
    byModelTier: {
      free: number;
      haiku: number;
      sonnet: number;
      opus: number;
    };
    totalTokens: {
      input: number;
      output: number;
      total: number;
    };
    lastUpdated: Date | null;
  };
  updateCostMetrics: (metrics: Partial<UIState['costMetrics']>) => void;

  // Audio settings
  audioSettings: {
    muted: boolean;
    volume: number;
  };
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;

  // Agent health tracking
  agentHealth: {
    [agentId: string]: {
      tokenBudget: {
        input: number;
        output: number;
        maxInput: number;
        maxOutput: number;
      };
      loopDetected: boolean;
      lastActionTime: number | null;
      averageResponseTime: number;
      actionCount: number;
    };
  };
  updateAgentHealth: (agentId: string, health: Partial<UIState['agentHealth'][string]>) => void;
  resetAgentHealth: (agentId: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Mode
  mode: 'overseer',
  setMode: (mode) => set({ mode }),

  // Selection
  selectedTaskId: null,
  selectedAgentId: null,
  selectTask: (id) => set({ selectedTaskId: id }),
  selectAgent: (id) => set({ selectedAgentId: id }),

  // UI toggles
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  alertsPanelOpen: false,
  toggleAlertsPanel: () => set((state) => ({ alertsPanelOpen: !state.alertsPanelOpen })),
  chatPanelOpen: false,
  toggleChatPanel: () => set((state) => ({ chatPanelOpen: !state.chatPanelOpen })),
  toolLogOpen: false,
  toggleToolLog: () => set((state) => ({ toolLogOpen: !state.toolLogOpen })),

  // Chat state
  activeChatAgentId: null,
  activeConversationId: null,
  setActiveChatAgent: (agentId) => set({ activeChatAgentId: agentId }),
  setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),

  // Data
  tasks: [],
  agents: [],
  alerts: [],
  setTasks: (tasks) => set({ tasks }),
  setAgents: (agents) => set({ agents }),
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 50), // Keep last 50
      alertsPanelOpen: true,
    })),
  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a
      ),
    })),
  clearAlerts: () => set({ alerts: [] }),

  // Real-time updates
  updateTask: (task) =>
    set((state) => ({
      tasks: state.tasks.some((t) => t.id === task.id)
        ? state.tasks.map((t) => (t.id === task.id ? task : t))
        : [...state.tasks, task],
    })),
  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
    })),
  updateAgent: (agent) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === agent.id ? agent : a)),
    })),

  // Metrics
  metrics: {
    totalApiCredits: 0,
    totalTimeMs: 0,
    totalIterations: 0,
  },
  setMetrics: (metrics) =>
    set((state) => ({
      metrics: { ...state.metrics, ...metrics },
    })),

  // Cost metrics
  costMetrics: {
    totalCost: 0,
    byModelTier: {
      free: 0,
      haiku: 0,
      sonnet: 0,
      opus: 0,
    },
    totalTokens: {
      input: 0,
      output: 0,
      total: 0,
    },
    lastUpdated: null,
  },
  updateCostMetrics: (metrics) =>
    set((state) => ({
      costMetrics: {
        ...state.costMetrics,
        ...metrics,
        lastUpdated: new Date(),
      },
    })),

  // Audio settings
  audioSettings: {
    muted: false,
    volume: 0.7,
  },
  setMuted: (muted) =>
    set((state) => ({
      audioSettings: { ...state.audioSettings, muted },
    })),
  setVolume: (volume) =>
    set((state) => ({
      audioSettings: { ...state.audioSettings, volume },
    })),

  // Agent health tracking
  agentHealth: {},
  updateAgentHealth: (agentId, health) =>
    set((state) => ({
      agentHealth: {
        ...state.agentHealth,
        [agentId]: {
          ...(state.agentHealth[agentId] || {
            tokenBudget: { input: 0, output: 0, maxInput: 100000, maxOutput: 100000 },
            loopDetected: false,
            lastActionTime: null,
            averageResponseTime: 0,
            actionCount: 0,
          }),
          ...health,
        },
      },
    })),
  resetAgentHealth: (agentId) =>
    set((state) => {
      const newHealth = { ...state.agentHealth };
      delete newHealth[agentId];
      return { agentHealth: newHealth };
    }),
}));
