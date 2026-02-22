import type { Server as SocketIOServer, Socket } from 'socket.io';
import { config } from '../config.js';

// Track connections per IP to prevent DoS
const connectionsPerIP = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 20;

export function setupWebSocket(io: SocketIOServer): void {
  // Authentication middleware — validate API key on connection
  io.use((socket, next) => {
    const expectedKey = config.auth.apiKey;

    // If no API key configured, allow (backward compat — same as HTTP auth)
    if (!expectedKey) {
      return next();
    }

    const token = socket.handshake.auth.token || socket.handshake.headers['x-api-key'];
    if (!token || token !== expectedKey) {
      return next(new Error('Authentication failed: invalid or missing API key'));
    }

    next();
  });

  // Connection rate limiting middleware
  io.use((socket, next) => {
    const clientIp = socket.handshake.address;
    const count = (connectionsPerIP.get(clientIp) || 0) + 1;

    if (count > MAX_CONNECTIONS_PER_IP) {
      return next(new Error('Too many connections from this IP'));
    }

    connectionsPerIP.set(clientIp, count);
    socket.on('disconnect', () => {
      const current = connectionsPerIP.get(clientIp) || 1;
      if (current <= 1) {
        connectionsPerIP.delete(clientIp);
      } else {
        connectionsPerIP.set(clientIp, current - 1);
      }
    });

    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join rooms based on what the client wants to subscribe to
    socket.on('subscribe', (room: string) => {
      socket.join(room);
      console.log(`Client ${socket.id} joined room: ${room}`);
    });

    socket.on('unsubscribe', (room: string) => {
      socket.leave(room);
      console.log(`Client ${socket.id} left room: ${room}`);
    });

    // Client can request current state
    socket.on('request_state', async () => {
      socket.emit('state_sync', { synced: true, timestamp: new Date() });
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    socket.on('disconnect', (reason) => {
      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });
}

// Helper functions to emit events
export function emitTaskEvent(
  io: SocketIOServer,
  eventType: 'task_created' | 'task_updated' | 'task_deleted',
  payload: unknown
): void {
  io.emit(eventType, {
    type: eventType,
    payload,
    timestamp: new Date(),
  });
}

export function emitAgentEvent(
  io: SocketIOServer,
  payload: unknown
): void {
  io.emit('agent_status_changed', {
    type: 'agent_status_changed',
    payload,
    timestamp: new Date(),
  });
}

export function emitExecutionStep(
  io: SocketIOServer,
  payload: unknown
): void {
  io.emit('execution_step', {
    type: 'execution_step',
    payload,
    timestamp: new Date(),
  });
}

export function emitAlert(
  io: SocketIOServer,
  alert: {
    type: string;
    severity: string;
    title: string;
    message: string;
    taskId?: string;
    agentId?: string;
  }
): void {
  io.emit('alert', {
    type: 'alert',
    payload: {
      ...alert,
      id: `alert-${Date.now()}`,
      acknowledged: false,
      createdAt: new Date(),
    },
    timestamp: new Date(),
  });
}

export function emitMetricsUpdate(
  io: SocketIOServer,
  metrics: unknown
): void {
  io.emit('metrics_updated', {
    type: 'metrics_updated',
    payload: metrics,
    timestamp: new Date(),
  });
}

// Chat event helpers
export function emitChatMessageChunk(
  io: SocketIOServer,
  payload: {
    conversationId: string;
    messageId: string;
    chunk: string;
  }
): void {
  io.emit('chat_message_chunk', {
    type: 'chat_message_chunk',
    payload,
    timestamp: new Date(),
  });
}

export function emitChatMessageComplete(
  io: SocketIOServer,
  payload: {
    conversationId: string;
    messageId: string;
    fullContent: string;
  }
): void {
  io.emit('chat_message_complete', {
    type: 'chat_message_complete',
    payload,
    timestamp: new Date(),
  });
}

export function emitChatError(
  io: SocketIOServer,
  payload: {
    conversationId: string;
    error: string;
  }
): void {
  io.emit('chat_error', {
    type: 'chat_error',
    payload,
    timestamp: new Date(),
  });
}

export function emitCostUpdate(
  io: SocketIOServer,
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
  }
): void {
  io.emit('cost_updated', {
    type: 'cost_updated',
    payload: costMetrics,
    timestamp: new Date(),
  });
}
