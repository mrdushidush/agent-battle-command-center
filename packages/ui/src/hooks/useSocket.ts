import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUIStore } from '../store/uiState';
import type { Task, Agent, Alert, ExecutionStep, ChatStreamChunk, ChatStreamComplete, ChatError } from '@abcc/shared';
import {
  playTaskAssigned,
  playTaskInProgress,
  playTaskCompleted,
  playTaskFailed,
  playAgentStuck,
  playLoopDetected,
  playTaskMilestone,
  playOpusReview,
  playDecomposition,
} from '../audio/audioManager';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

// Use window object to persist socket across HMR and React.StrictMode double-renders
declare global {
  interface Window {
    __ABCC_SOCKET__?: Socket | null;
    __ABCC_SOCKET_CONNECTED__?: boolean;
    __ABCC_LAST_SOUND_TIME__?: number;
  }
}

// Initialize from window (persists across HMR reloads)
const getGlobalSocket = (): Socket | null => window.__ABCC_SOCKET__ ?? null;
const setGlobalSocket = (socket: Socket | null) => { window.__ABCC_SOCKET__ = socket; };
const isGlobalConnected = (): boolean => window.__ABCC_SOCKET_CONNECTED__ ?? false;
const setGlobalConnected = (connected: boolean) => { window.__ABCC_SOCKET_CONNECTED__ = connected; };

// Audio delay to prevent overlapping sounds (3s to cover assigned -> in_progress transition)
const SOUND_DELAY_MS = 3000;

// Audio enabled - delay mechanism handles overlap
const AUDIO_DISABLED = false;
const getLastSoundTime = (): number => window.__ABCC_LAST_SOUND_TIME__ ?? 0;
const setLastSoundTime = (time: number) => { window.__ABCC_LAST_SOUND_TIME__ = time; };

// Track pending audio timeouts to prevent accumulation (OOM fix)
const MAX_PENDING_TIMEOUTS = 5;
const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

// Play sound with delay if needed to prevent overlap
const playWithDelay = (playFn: () => void) => {
  // Skip if audio disabled for debugging
  if (AUDIO_DISABLED) return;

  const now = Date.now();
  const lastSound = getLastSoundTime();
  const timeSinceLastSound = now - lastSound;

  if (timeSinceLastSound < SOUND_DELAY_MS) {
    // Drop sound if too many pending (prevents timeout accumulation)
    if (pendingTimeouts.length >= MAX_PENDING_TIMEOUTS) return;

    const delay = SOUND_DELAY_MS - timeSinceLastSound;
    const timeoutId = setTimeout(() => {
      // Remove from tracking
      const idx = pendingTimeouts.indexOf(timeoutId);
      if (idx >= 0) pendingTimeouts.splice(idx, 1);
      setLastSoundTime(Date.now());
      playFn();
    }, delay);
    pendingTimeouts.push(timeoutId);
  } else {
    setLastSoundTime(now);
    playFn();
  }
};

export function useSocket() {
  const socketRef = useRef<Socket | null>(getGlobalSocket());
  const [isConnected, setIsConnected] = useState(isGlobalConnected());
  const connectedRef = useRef(isGlobalConnected());

  const connect = useCallback(() => {
    const existingSocket = getGlobalSocket();
    const connected = isGlobalConnected();

    // Prevent multiple connections (check both local ref and global)
    if (connected || existingSocket?.connected) {
      // Reuse existing socket
      socketRef.current = existingSocket;
      connectedRef.current = connected;
      setIsConnected(connected);
      return;
    }
    setGlobalConnected(true);
    connectedRef.current = true;

    const apiKey = import.meta.env.VITE_API_KEY || '';
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 20000,
      auth: { token: apiKey },
    });

    socket.on('connect', () => {
      setGlobalConnected(true);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setGlobalConnected(false);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    // Task events
    socket.on('task_created', (event: { payload: Task }) => {
      useUIStore.getState().updateTask(event.payload);
    });

    socket.on('task_updated', (event: { payload: Task }) => {
      const newTask = event.payload;
      const prevTask = useUIStore.getState().tasks.find((t) => t.id === newTask.id);

      // Play audio for status changes
      if (prevTask && prevTask.status !== newTask.status) {
        const agentType = newTask.assignedAgentId
          ? useUIStore.getState().agents.find((a) => a.id === newTask.assignedAgentId)?.type
          : undefined;

        switch (newTask.status) {
          case 'assigned':
            playWithDelay(() => playTaskAssigned(agentType));
            break;
          case 'in_progress':
            playWithDelay(() => playTaskInProgress(agentType));
            break;
          case 'completed':
            playWithDelay(() => playTaskCompleted(agentType));
            break;
          case 'failed':
            playWithDelay(() => playTaskFailed(agentType));
            break;
          case 'needs_human':
            playWithDelay(() => playAgentStuck(agentType));
            break;
        }
      }

      // Play failure sound on iteration decrease (repair/retry)
      if (prevTask && newTask.currentIteration < prevTask.currentIteration) {
        const agentType = newTask.assignedAgentId
          ? useUIStore.getState().agents.find((a) => a.id === newTask.assignedAgentId)?.type
          : undefined;
        playWithDelay(() => playTaskFailed(agentType));
      }

      // Play milestone sound on iteration progress
      if (prevTask && prevTask.currentIteration < newTask.currentIteration) {
        const agentType = newTask.assignedAgentId
          ? useUIStore.getState().agents.find((a) => a.id === newTask.assignedAgentId)?.type
          : undefined;

        // Play milestone sound every 2 iterations
        if (newTask.currentIteration % 2 === 0) {
          playWithDelay(() => playTaskMilestone(agentType));
        }
      }

      useUIStore.getState().updateTask(newTask);
    });

    socket.on('task_deleted', (event: { payload: { id: string } }) => {
      useUIStore.getState().removeTask(event.payload.id);
    });

    // Agent events
    socket.on('agent_status_changed', (event: { payload: Agent }) => {
      useUIStore.getState().updateAgent(event.payload);
    });

    // Execution events
    socket.on('execution_step', (event: { payload: ExecutionStep & { isLoop?: boolean; durationMs?: number } }) => {
      const payload = event.payload;

      // Update agent health tracking
      if (payload.agentId) {
        const agentId = payload.agentId;
        const now = Date.now();

        // Check for loop detection
        if (payload.isLoop) {
          playWithDelay(() => playLoopDetected());
          useUIStore.getState().updateAgentHealth(agentId, {
            loopDetected: true,
            lastActionTime: now,
          });
        } else {
          // Update token usage and response time
          const currentHealth = useUIStore.getState().agentHealth[agentId];
          const tokenUpdate: any = {
            lastActionTime: now,
            loopDetected: false,
          };

          // Update average response time
          if (payload.durationMs) {
            const prevAvg = currentHealth?.averageResponseTime || 0;
            const prevCount = currentHealth?.actionCount || 0;

            tokenUpdate.averageResponseTime = (prevAvg * prevCount + payload.durationMs) / (prevCount + 1);
            tokenUpdate.actionCount = prevCount + 1;
          }

          useUIStore.getState().updateAgentHealth(agentId, tokenUpdate);
        }
      }
    });

    // Alert events
    socket.on('alert', (event: { payload: Alert }) => {
      useUIStore.getState().addAlert(event.payload);
    });

    // Cost metrics events
    socket.on('cost_updated', (event: { payload: {
      totalCost: number;
      byModelTier: { free: number; remote: number; haiku: number; sonnet: number; opus: number };
      totalTokens: { input: number; output: number; total: number };
    } }) => {
      useUIStore.getState().updateCostMetrics(event.payload);
    });

    // Budget events
    socket.on('budget_updated', (event: { payload: {
      dailySpentCents: number;
      dailyLimitCents: number;
      allTimeSpentCents: number;
      percentUsed: number;
      isOverBudget: boolean;
      isWarning: boolean;
      claudeBlocked: boolean;
      costPerTask?: { avgCostCents: number; todayTasks: number };
      burnRateCentsPerMin?: number;
    } }) => {
      useUIStore.getState().updateBudget({
        dailySpentCents: event.payload.dailySpentCents,
        dailyLimitCents: event.payload.dailyLimitCents,
        allTimeSpentCents: event.payload.allTimeSpentCents,
        percentUsed: event.payload.percentUsed,
        isOverBudget: event.payload.isOverBudget,
        isWarning: event.payload.isWarning,
        claudeBlocked: event.payload.claudeBlocked,
        avgCostPerTaskCents: event.payload.costPerTask?.avgCostCents || 0,
        todayTasks: event.payload.costPerTask?.todayTasks || 0,
        burnRateCentsPerMin: event.payload.burnRateCentsPerMin || 0,
      });
    });

    // Chat events - delegate to chat handlers if available
    socket.on('chat_message_chunk', (event: { payload: ChatStreamChunk }) => {
      const handlers = (window as unknown as { chatHandlers?: {
        handleStreamChunk: (data: ChatStreamChunk) => void;
      } }).chatHandlers;
      if (handlers?.handleStreamChunk) {
        handlers.handleStreamChunk(event.payload);
      }
    });

    socket.on('chat_message_complete', (event: { payload: ChatStreamComplete }) => {
      const handlers = (window as unknown as { chatHandlers?: {
        handleStreamComplete: (data: ChatStreamComplete) => void;
      } }).chatHandlers;
      if (handlers?.handleStreamComplete) {
        handlers.handleStreamComplete(event.payload);
      }
    });

    socket.on('chat_error', (event: { payload: ChatError }) => {
      const handlers = (window as unknown as { chatHandlers?: {
        handleStreamError: (data: ChatError) => void;
      } }).chatHandlers;
      if (handlers?.handleStreamError) {
        handlers.handleStreamError(event.payload);
      }
    });

    // Validation pipeline events
    socket.on('task_validating', (event: { taskId: string }) => {
      useUIStore.getState().setValidationStatus(event.taskId, { status: 'validating' });
    });

    socket.on('task_validated', (event: { taskId: string }) => {
      useUIStore.getState().setValidationStatus(event.taskId, { status: 'passed' });
    });

    socket.on('task_validation_failed', (event: { taskId: string; error?: string }) => {
      useUIStore.getState().setValidationStatus(event.taskId, {
        status: 'failed',
        error: event.error,
      });
    });

    socket.on('auto_retry_attempt', (event: { taskId: string; phase: number; attempt: number; tier: string }) => {
      useUIStore.getState().setValidationStatus(event.taskId, {
        status: 'retrying',
        retryPhase: event.phase,
        retryAttempt: event.attempt,
        retryTier: event.tier,
      });
    });

    socket.on('auto_retry_result', (event: { taskId: string; success: boolean; phase: number }) => {
      useUIStore.getState().setValidationStatus(event.taskId, {
        status: event.success ? 'passed' : 'failed',
        retryPhase: event.phase,
      });
    });

    // Code review events (Opus reviewing code)
    socket.on('code_review_started', () => {
      playWithDelay(() => playOpusReview('cto'));
    });

    // Task decomposition events (CTO breaking down tasks)
    socket.on('task_decomposition_started', () => {
      playWithDelay(() => playDecomposition('cto'));
    });

    // Mission lifecycle events
    socket.on('mission_started', (event: { payload: { id: string; status: string; prompt: string } }) => {
      useUIStore.getState().updateMission(event.payload.id, {
        status: event.payload.status as 'decomposing',
        prompt: event.payload.prompt,
      });
      useUIStore.getState().clearMissionCodeFiles();
      playWithDelay(() => playDecomposition('cto'));
    });

    socket.on('mission_decomposed', (event: { payload: { id: string; subtaskCount: number } }) => {
      useUIStore.getState().updateMission(event.payload.id, {
        status: 'executing',
        subtaskCount: event.payload.subtaskCount,
      });
    });

    socket.on('mission_subtask_completed', (event: { payload: { missionId: string; index: number; total: number; passed: boolean; fileName?: string; code?: string; language?: string; title?: string } }) => {
      const { missionId, index, passed, fileName, code, language, title } = event.payload;
      useUIStore.getState().updateMission(missionId, {
        completedCount: index + 1,
        failedCount: passed ? undefined : (useUIStore.getState().missions[missionId]?.failedCount || 0) + 1,
      });
      // Add code to live code window
      if (fileName && code && language) {
        useUIStore.getState().setMissionCodeFile(fileName, {
          language,
          code,
          subtaskTitle: title || `Subtask ${index + 1}`,
        });
        // Auto-open code window when first code arrives
        if (useUIStore.getState().missionCodeFiles && Object.keys(useUIStore.getState().missionCodeFiles).length === 1) {
          useUIStore.getState().toggleCodeWindow();
        }
      }
    });

    socket.on('mission_review_complete', (event: { payload: { missionId: string; review: { score: number; approved: boolean } } }) => {
      useUIStore.getState().updateMission(event.payload.missionId, {
        status: 'awaiting_approval',
        reviewScore: event.payload.review.score,
      });
    });

    socket.on('mission_approved', (event: { payload: { missionId: string } }) => {
      useUIStore.getState().updateMission(event.payload.missionId, { status: 'approved' });
      playWithDelay(() => playTaskCompleted('cto'));
    });

    socket.on('mission_failed', (event: { payload: { missionId: string; error: string } }) => {
      useUIStore.getState().updateMission(event.payload.missionId, {
        status: 'failed',
        error: event.payload.error,
      });
      playWithDelay(() => playTaskFailed('cto'));
    });

    socket.on('clarification_requested', (event: { payload: { conversationId: string; questions: string[] } }) => {
      useUIStore.getState().setPendingClarification({
        conversationId: event.payload.conversationId,
        questions: event.payload.questions,
      });
    });

    socketRef.current = socket;
    setGlobalSocket(socket);
  }, []); // No dependencies - connect once

  const disconnect = useCallback(() => {
    // Only disconnect if this is the actual global socket
    // In StrictMode, we want to keep the connection alive
    if (socketRef.current && socketRef.current === getGlobalSocket()) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setGlobalSocket(null);
      connectedRef.current = false;
      setGlobalConnected(false);
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  useEffect(() => {
    // Sync local state with global on mount
    const existingSocket = getGlobalSocket();
    if (existingSocket && isGlobalConnected()) {
      socketRef.current = existingSocket;
      setIsConnected(true);
    }

    return () => {
      // Don't disconnect in cleanup - let the socket persist
      // This prevents React.StrictMode from creating multiple connections
      // The socket will be cleaned up when the page unloads
    };
  }, []);

  return {
    connect,
    disconnect,
    emit,
    isConnected,
    socket: socketRef.current,
  };
}
