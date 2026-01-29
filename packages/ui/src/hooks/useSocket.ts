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
} from '../audio/audioManager';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const connectedRef = useRef(false);

  const connect = useCallback(() => {
    // Prevent multiple connections
    if (connectedRef.current || socketRef.current?.connected) return;
    connectedRef.current = true;

    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    // Task events
    socket.on('task_created', (event: { payload: Task }) => {
      console.log('Task created:', event.payload);
      useUIStore.getState().updateTask(event.payload);
    });

    socket.on('task_updated', (event: { payload: Task }) => {
      console.log('Task updated:', event.payload);
      const newTask = event.payload;
      const prevTask = useUIStore.getState().tasks.find((t) => t.id === newTask.id);

      // Play audio for status changes
      if (prevTask && prevTask.status !== newTask.status) {
        const agentType = newTask.assignedAgentId
          ? useUIStore.getState().agents.find((a) => a.id === newTask.assignedAgentId)?.type
          : undefined;

        switch (newTask.status) {
          case 'assigned':
            playTaskAssigned(agentType);
            break;
          case 'in_progress':
            playTaskInProgress(agentType);
            break;
          case 'completed':
            playTaskCompleted(agentType);
            break;
          case 'failed':
            playTaskFailed(agentType);
            break;
          case 'needs_human':
            playAgentStuck(agentType);
            break;
        }
      }

      // Play milestone sound on iteration progress
      if (prevTask && prevTask.currentIteration < newTask.currentIteration) {
        const agentType = newTask.assignedAgentId
          ? useUIStore.getState().agents.find((a) => a.id === newTask.assignedAgentId)?.type
          : undefined;

        // Play milestone sound every 2 iterations
        if (newTask.currentIteration % 2 === 0) {
          playTaskMilestone(agentType);
        }
      }

      useUIStore.getState().updateTask(newTask);
    });

    socket.on('task_deleted', (event: { payload: { id: string } }) => {
      console.log('Task deleted:', event.payload.id);
      useUIStore.getState().removeTask(event.payload.id);
    });

    // Agent events
    socket.on('agent_status_changed', (event: { payload: Agent }) => {
      console.log('Agent status changed:', event.payload);
      useUIStore.getState().updateAgent(event.payload);
    });

    // Execution events
    socket.on('execution_step', (event: { payload: ExecutionStep & { isLoop?: boolean; durationMs?: number } }) => {
      console.log('Execution step:', event.payload);
      const payload = event.payload;

      // Update agent health tracking
      if (payload.agentId) {
        const agentId = payload.agentId;
        const now = Date.now();

        // Check for loop detection
        if (payload.isLoop) {
          playLoopDetected();
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
      console.log('Alert:', event.payload);
      useUIStore.getState().addAlert(event.payload);
    });

    // Cost metrics events
    socket.on('cost_updated', (event: { payload: {
      totalCost: number;
      byModelTier: { free: number; haiku: number; sonnet: number; opus: number };
      totalTokens: { input: number; output: number; total: number };
    } }) => {
      console.log('Cost updated:', event.payload);
      useUIStore.getState().updateCostMetrics(event.payload);
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

    socketRef.current = socket;
  }, []); // No dependencies - connect once

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      connectedRef.current = false;
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    emit,
    isConnected,
    socket: socketRef.current,
  };
}
