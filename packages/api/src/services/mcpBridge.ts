/**
 * MCP Bridge Service - Redis Pub/Sub Integration
 *
 * Bridges the Node.js API with the MCP Gateway via Redis pub/sub.
 * When tasks are updated in PostgreSQL (via Node.js API), this service
 * publishes those updates to Redis so the MCP Gateway can sync them.
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger.js';

export interface TaskUpdateEvent {
  type: 'task_created' | 'task_updated' | 'task_completed' | 'task_assigned' | 'task_failed';
  taskId: string;
  timestamp: string;
  data?: any;
}

export class MCPBridgeService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private useMcp: boolean = false;

  constructor() {
    this.useMcp = process.env.USE_MCP === 'true';

    if (!this.useMcp) {
      logger.info('MCP Bridge disabled (USE_MCP=false)');
      return;
    }

    logger.info('MCP Bridge service initialized');
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.useMcp) {
      return;
    }

    if (this.client) {
      logger.warn('MCP Bridge already connected');
      return;
    }

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('MCP Bridge: Max Redis reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            const delay = Math.min(retries * 100, 3000);
            logger.warn(`MCP Bridge: Reconnecting to Redis in ${delay}ms (attempt ${retries})`);
            return delay;
          }
        }
      });

      this.client.on('error', (err) => {
        logger.error('MCP Bridge Redis error:', err);
      });

      this.client.on('connect', () => {
        logger.info('MCP Bridge connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('MCP Bridge disconnected from Redis');
        this.isConnected = false;
      });

      await this.client.connect();
      logger.info('MCP Bridge Redis connection established');

    } catch (error) {
      logger.error('MCP Bridge failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('MCP Bridge disconnected from Redis');
    } catch (error) {
      logger.error('MCP Bridge error disconnecting from Redis:', error);
    }
  }

  /**
   * Publish task update to Redis
   */
  async publishTaskUpdate(event: TaskUpdateEvent): Promise<void> {
    if (!this.useMcp || !this.client || !this.isConnected) {
      return;
    }

    try {
      const channel = `task:${event.taskId}:updates`;
      const message = JSON.stringify(event);

      await this.client.publish(channel, message);

      logger.debug(`MCP Bridge: Published ${event.type} for task ${event.taskId}`);
    } catch (error) {
      logger.error('MCP Bridge error publishing task update:', error);
    }
  }

  /**
   * Publish task creation event
   */
  async publishTaskCreated(taskId: string, taskData: any): Promise<void> {
    await this.publishTaskUpdate({
      type: 'task_created',
      taskId,
      timestamp: new Date().toISOString(),
      data: taskData
    });
  }

  /**
   * Publish task update event
   */
  async publishTaskUpdated(taskId: string, updates: any): Promise<void> {
    await this.publishTaskUpdate({
      type: 'task_updated',
      taskId,
      timestamp: new Date().toISOString(),
      data: updates
    });
  }

  /**
   * Publish task completion event
   */
  async publishTaskCompleted(taskId: string, result: any): Promise<void> {
    await this.publishTaskUpdate({
      type: 'task_completed',
      taskId,
      timestamp: new Date().toISOString(),
      data: result
    });
  }

  /**
   * Publish task assignment event
   */
  async publishTaskAssigned(taskId: string, agentId: string): Promise<void> {
    await this.publishTaskUpdate({
      type: 'task_assigned',
      taskId,
      timestamp: new Date().toISOString(),
      data: { agentId }
    });
  }

  /**
   * Publish task failure event
   */
  async publishTaskFailed(taskId: string, error: any): Promise<void> {
    await this.publishTaskUpdate({
      type: 'task_failed',
      taskId,
      timestamp: new Date().toISOString(),
      data: { error: error?.message || String(error) }
    });
  }

  /**
   * Check if MCP Bridge is enabled and connected
   */
  isReady(): boolean {
    return this.useMcp && this.isConnected;
  }

  /**
   * Get connection status
   */
  getStatus(): { enabled: boolean; connected: boolean } {
    return {
      enabled: this.useMcp,
      connected: this.isConnected
    };
  }
}

// Singleton instance
export const mcpBridge = new MCPBridgeService();
