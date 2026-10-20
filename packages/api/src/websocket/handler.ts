import type { Server as SocketIOServer, Socket } from 'socket.io';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('WebSocket');

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Track connections per IP to prevent DoS
const connectionsPerIP = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 20;

export function setupWebSocket(io: SocketIOServer): void {
  // Authentication middleware — validate API key on connection
  io.use((socket, next) => {
    const expectedKey = config.auth.apiKey;

    // If no API key configured, reject — same as HTTP auth (middleware/auth.ts)
    if (!expectedKey) {
      return next(new Error('Server misconfiguration: API_KEY is not configured'));
    }

    const rawToken = socket.handshake.auth.token || socket.handshake.headers['x-api-key'];
    // Headers may be string[]; auth.token is any. Only accept scalar string.
    const token = typeof rawToken === 'string' ? rawToken : '';
    if (!token || !safeEqual(token, expectedKey)) {
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
    log.debug('Client connected', { socketId: socket.id });

    // Join rooms based on what the client wants to subscribe to
    socket.on('subscribe', (room: string) => {
      socket.join(room);
      log.debug('Client joined room', { socketId: socket.id, room });
    });

    socket.on('unsubscribe', (room: string) => {
      socket.leave(room);
      log.debug('Client left room', { socketId: socket.id, room });
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
      log.debug('Client disconnected', { socketId: socket.id, reason });
    });

    socket.on('error', (error) => {
      log.error('Socket error', { socketId: socket.id, error: String(error) });
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

export function emitExecutionLogCreated(
  io: SocketIOServer,
  payload: unknown
): void {
  io.emit('execution_log_created', {
    type: 'execution_log_created',
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
