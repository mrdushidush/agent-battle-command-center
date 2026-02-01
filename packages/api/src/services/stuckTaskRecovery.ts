/**
 * Stuck Task Recovery Service
 *
 * Automatically detects and recovers tasks that have been stuck in "in_progress"
 * status for too long (default: 10 minutes).
 *
 * When a task is detected as stuck:
 * 1. Mark it as aborted with timeout error
 * 2. Release the assigned agent (set to idle)
 * 3. Release file locks
 * 4. Release resource pool slot
 * 5. Emit WebSocket events for UI update
 *
 * This prevents tasks from permanently blocking agents when:
 * - Agent container crashes mid-execution
 * - Network issues interrupt task execution
 * - Agent hangs or enters infinite loop without detection
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import type { Task, Agent, AgentType } from '../types/index.js';
import { ResourcePoolService } from './resourcePool.js';
import { TaskAssigner } from './taskAssigner.js';
import { mcpBridge } from './mcpBridge.js';

export interface StuckTaskRecoveryConfig {
  /** Task timeout in milliseconds (default: 10 minutes) */
  taskTimeoutMs: number;
  /** How often to check for stuck tasks in milliseconds (default: 1 minute) */
  checkIntervalMs: number;
  /** Whether the service is enabled */
  enabled: boolean;
}

const DEFAULT_CONFIG: StuckTaskRecoveryConfig = {
  taskTimeoutMs: 10 * 60 * 1000, // 10 minutes
  checkIntervalMs: 60 * 1000, // 1 minute
  enabled: true,
};

export interface RecoveryResult {
  taskId: string;
  taskTitle: string;
  agentId: string | null;
  agentName: string | null;
  stuckDurationMs: number;
  recoveredAt: Date;
}

export class StuckTaskRecoveryService {
  private config: StuckTaskRecoveryConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private taskAssigner: TaskAssigner;
  private lastCheckTime: Date | null = null;
  private recoveryHistory: RecoveryResult[] = [];
  private readonly maxHistorySize = 100;

  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer,
    config?: Partial<StuckTaskRecoveryConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.taskAssigner = new TaskAssigner(prisma, io);

    // Override with environment variables
    if (process.env.STUCK_TASK_TIMEOUT_MS) {
      this.config.taskTimeoutMs = parseInt(process.env.STUCK_TASK_TIMEOUT_MS, 10);
    }
    if (process.env.STUCK_TASK_CHECK_INTERVAL_MS) {
      this.config.checkIntervalMs = parseInt(process.env.STUCK_TASK_CHECK_INTERVAL_MS, 10);
    }
    if (process.env.STUCK_TASK_RECOVERY_ENABLED === 'false') {
      this.config.enabled = false;
    }
  }

  /**
   * Start the periodic stuck task checker
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('StuckTaskRecoveryService: Disabled via configuration');
      return;
    }

    if (this.checkInterval) {
      console.log('StuckTaskRecoveryService: Already running');
      return;
    }

    console.log(`StuckTaskRecoveryService: Starting (timeout: ${this.config.taskTimeoutMs / 1000}s, check interval: ${this.config.checkIntervalMs / 1000}s)`);

    // Run initial check after a short delay
    setTimeout(() => {
      this.checkAndRecoverStuckTasks().catch(err => {
        console.error('StuckTaskRecoveryService: Initial check failed:', err);
      });
    }, 5000);

    // Then run periodically
    this.checkInterval = setInterval(() => {
      this.checkAndRecoverStuckTasks().catch(err => {
        console.error('StuckTaskRecoveryService: Periodic check failed:', err);
      });
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop the periodic checker
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('StuckTaskRecoveryService: Stopped');
    }
  }

  /**
   * Check for and recover stuck tasks
   */
  async checkAndRecoverStuckTasks(): Promise<RecoveryResult[]> {
    this.lastCheckTime = new Date();
    const timeoutThreshold = new Date(Date.now() - this.config.taskTimeoutMs);

    // Find tasks that have been in_progress for too long
    const stuckTasks = await this.prisma.task.findMany({
      where: {
        status: 'in_progress',
        assignedAt: { lt: timeoutThreshold },
      },
      include: {
        assignedAgent: {
          include: { agentType: true },
        },
      },
    });

    if (stuckTasks.length === 0) {
      return [];
    }

    console.log(`StuckTaskRecoveryService: Found ${stuckTasks.length} stuck task(s)`);

    const results: RecoveryResult[] = [];

    for (const task of stuckTasks) {
      try {
        const result = await this.recoverStuckTask(task);
        results.push(result);
        this.addToHistory(result);
      } catch (error) {
        console.error(`StuckTaskRecoveryService: Failed to recover task ${task.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Recover a single stuck task
   */
  private async recoverStuckTask(task: {
    id: string;
    title: string;
    assignedAgentId: string | null;
    assignedAt: Date | null;
    complexity: number | null;
    assignedAgent: {
      id: string;
      name: string;
      agentTypeId: string;
      status: string;
      currentTaskId: string | null;
      config: Prisma.JsonValue;
      stats: Prisma.JsonValue;
      createdAt: Date;
      updatedAt: Date;
      agentType: { name: string };
    } | null;
  }): Promise<RecoveryResult> {
    const stuckDurationMs = task.assignedAt
      ? Date.now() - task.assignedAt.getTime()
      : this.config.taskTimeoutMs;

    const timeoutMinutes = Math.round(this.config.taskTimeoutMs / 60000);
    const errorMessage = `Task timed out after ${timeoutMinutes} minutes (stuck in in_progress state)`;

    console.log(`StuckTaskRecoveryService: Recovering task ${task.id} (${task.title}) - stuck for ${Math.round(stuckDurationMs / 1000)}s`);

    // 1. Release file locks
    await this.taskAssigner.releaseFileLocks(task.id);

    // 2. Release resource pool slot
    const resourcePool = ResourcePoolService.getInstance();
    resourcePool.release(task.id);

    // 3. Update task to aborted status
    const updatedTask = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'aborted',
        error: errorMessage,
        errorCategory: 'timeout',
      },
    });

    // 4. Update execution record if exists
    await this.prisma.taskExecution.updateMany({
      where: {
        taskId: task.id,
        status: 'started',
      },
      data: {
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
      },
    });

    // 5. Update agent stats and release
    if (task.assignedAgentId && task.assignedAgent) {
      const stats = task.assignedAgent.stats as Record<string, number>;

      await this.prisma.agent.update({
        where: { id: task.assignedAgentId },
        data: {
          status: 'idle',
          currentTaskId: null,
          stats: {
            ...stats,
            tasksFailed: (stats.tasksFailed || 0) + 1,
            successRate: this.calculateSuccessRate(
              stats.tasksCompleted || 0,
              (stats.tasksFailed || 0) + 1
            ),
          },
        },
      });

      // Emit agent update
      const updatedAgent = await this.prisma.agent.findUnique({
        where: { id: task.assignedAgentId },
        include: { agentType: true },
      });

      if (updatedAgent) {
        this.emitAgentUpdate(this.formatAgent(updatedAgent));
      }
    }

    // 6. Emit task update
    this.emitTaskUpdate(updatedTask as unknown as Task);

    // 7. Emit alert for visibility
    this.io.emit('alert', {
      type: 'task_timeout',
      severity: 'warning',
      title: 'Task Recovered from Stuck State',
      message: `Task "${task.title}" was automatically recovered after being stuck for ${Math.round(stuckDurationMs / 60000)} minutes`,
      taskId: task.id,
      agentId: task.assignedAgentId,
      createdAt: new Date(),
    });

    // 8. Publish to MCP Gateway
    mcpBridge.publishTaskFailed(task.id, errorMessage).catch(err => {
      console.error('StuckTaskRecoveryService: Failed to publish to MCP:', err);
    });

    return {
      taskId: task.id,
      taskTitle: task.title,
      agentId: task.assignedAgentId,
      agentName: task.assignedAgent?.name || null,
      stuckDurationMs,
      recoveredAt: new Date(),
    };
  }

  /**
   * Manually trigger recovery check
   */
  async triggerCheck(): Promise<RecoveryResult[]> {
    return this.checkAndRecoverStuckTasks();
  }

  /**
   * Get service status
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    taskTimeoutMs: number;
    checkIntervalMs: number;
    lastCheckTime: Date | null;
    recentRecoveries: RecoveryResult[];
  } {
    return {
      enabled: this.config.enabled,
      running: this.checkInterval !== null,
      taskTimeoutMs: this.config.taskTimeoutMs,
      checkIntervalMs: this.config.checkIntervalMs,
      lastCheckTime: this.lastCheckTime,
      recentRecoveries: this.recoveryHistory.slice(-10),
    };
  }

  /**
   * Get configuration
   */
  getConfig(): StuckTaskRecoveryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (runtime)
   */
  updateConfig(config: Partial<StuckTaskRecoveryConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    // Handle enable/disable
    if (wasEnabled && !this.config.enabled) {
      this.stop();
    } else if (!wasEnabled && this.config.enabled) {
      this.start();
    }

    // Handle interval change (restart if running)
    if (this.checkInterval && config.checkIntervalMs) {
      this.stop();
      this.start();
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private calculateSuccessRate(completed: number, failed: number): number {
    const total = completed + failed;
    if (total === 0) return 0;
    return Math.round((completed / total) * 100) / 100;
  }

  private formatAgent(agent: {
    id: string;
    agentTypeId: string;
    name: string;
    status: string;
    currentTaskId: string | null;
    config: Prisma.JsonValue;
    stats: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
    agentType: { name: string };
  }): Agent {
    return {
      id: agent.id,
      agentTypeId: agent.agentTypeId,
      type: agent.agentType.name as AgentType,
      name: agent.name,
      status: agent.status as Agent['status'],
      currentTaskId: agent.currentTaskId,
      config: agent.config as Agent['config'],
      stats: agent.stats as unknown as Agent['stats'],
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }

  private emitTaskUpdate(task: Task): void {
    this.io.emit('task_updated', {
      type: 'task_updated',
      payload: task,
      timestamp: new Date(),
    });
  }

  private emitAgentUpdate(agent: Agent): void {
    this.io.emit('agent_status_changed', {
      type: 'agent_status_changed',
      payload: agent,
      timestamp: new Date(),
    });
  }

  private addToHistory(result: RecoveryResult): void {
    this.recoveryHistory.push(result);
    if (this.recoveryHistory.length > this.maxHistorySize) {
      this.recoveryHistory.shift();
    }
  }
}
