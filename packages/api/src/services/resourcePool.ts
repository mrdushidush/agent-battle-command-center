/**
 * Resource Pool Service - Manages parallel task execution resources
 *
 * Enables Ollama tasks and Claude tasks to execute simultaneously since they
 * use different resources (local GPU vs cloud API). This improves throughput
 * by ~40-60% for mixed-complexity batches.
 *
 * Resource Types:
 * - ollama: Single local Ollama instance (1 slot)
 * - claude: Cloud API with rate limiting (2 slots - rate limiter handles throttling)
 */

import type { Server as SocketIOServer } from 'socket.io';

export type ResourceType = 'ollama' | 'claude';

export interface ResourceStatus {
  type: ResourceType;
  maxSlots: number;
  activeSlots: number;
  activeTasks: string[];
}

export class ResourcePoolService {
  private static instance: ResourcePoolService;
  private io: SocketIOServer | null = null;

  // Active tasks per resource type
  private activeTasks: Map<ResourceType, Set<string>> = new Map([
    ['ollama', new Set()],
    ['claude', new Set()],
  ]);

  // Configurable limits per resource type
  private limits: Record<ResourceType, number> = {
    ollama: 1, // Single Ollama instance
    claude: 2, // Can run 2 Claude tasks (rate limiter handles throttling)
  };

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ResourcePoolService {
    if (!ResourcePoolService.instance) {
      ResourcePoolService.instance = new ResourcePoolService();
    }
    return ResourcePoolService.instance;
  }

  /**
   * Initialize with Socket.IO for event emission
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * Check if a resource slot is available
   */
  canAcquire(type: ResourceType): boolean {
    const active = this.activeTasks.get(type);
    if (!active) return false;
    return active.size < this.limits[type];
  }

  /**
   * Acquire a resource slot for a task
   * Returns true if acquired, false if no slots available
   */
  acquire(type: ResourceType, taskId: string): boolean {
    if (!this.canAcquire(type)) {
      return false;
    }

    const active = this.activeTasks.get(type);
    if (!active) return false;

    active.add(taskId);

    // Emit resource acquired event
    this.emitResourceEvent('resource_acquired', {
      type,
      taskId,
      activeSlots: active.size,
      maxSlots: this.limits[type],
    });

    console.log(`[ResourcePool] Acquired ${type} slot for task ${taskId.substring(0, 8)} (${active.size}/${this.limits[type]})`);
    return true;
  }

  /**
   * Release a resource slot when task completes
   */
  release(taskId: string): void {
    // Check both resource types since we may not know which one was used
    for (const [type, tasks] of this.activeTasks.entries()) {
      if (tasks.has(taskId)) {
        tasks.delete(taskId);

        // Emit resource released event
        this.emitResourceEvent('resource_released', {
          type,
          taskId,
          activeSlots: tasks.size,
          maxSlots: this.limits[type],
        });

        console.log(`[ResourcePool] Released ${type} slot for task ${taskId.substring(0, 8)} (${tasks.size}/${this.limits[type]})`);
        return;
      }
    }
  }

  /**
   * Determine which resource type a task needs based on whether it uses Claude
   */
  getResourceForTask(useClaude: boolean): ResourceType {
    return useClaude ? 'claude' : 'ollama';
  }

  /**
   * Get resource type based on complexity (for routing decisions)
   * C1-C9 use Ollama (dynamic context), C10 uses Claude
   */
  getResourceForComplexity(complexity: number): ResourceType {
    return complexity < 10 ? 'ollama' : 'claude';
  }

  /**
   * Check if a task is currently holding a resource
   */
  hasResource(taskId: string): boolean {
    for (const tasks of this.activeTasks.values()) {
      if (tasks.has(taskId)) return true;
    }
    return false;
  }

  /**
   * Get which resource type a task is using
   */
  getTaskResource(taskId: string): ResourceType | null {
    for (const [type, tasks] of this.activeTasks.entries()) {
      if (tasks.has(taskId)) return type;
    }
    return null;
  }

  /**
   * Get current status of all resource pools
   */
  getStatus(): ResourceStatus[] {
    return Array.from(this.activeTasks.entries()).map(([type, tasks]) => ({
      type,
      maxSlots: this.limits[type],
      activeSlots: tasks.size,
      activeTasks: Array.from(tasks),
    }));
  }

  /**
   * Get status for a specific resource type
   */
  getResourceStatus(type: ResourceType): ResourceStatus {
    const tasks = this.activeTasks.get(type) || new Set();
    return {
      type,
      maxSlots: this.limits[type],
      activeSlots: tasks.size,
      activeTasks: Array.from(tasks),
    };
  }

  /**
   * Update resource limits (for testing or configuration)
   */
  setLimit(type: ResourceType, limit: number): void {
    if (limit < 1) {
      throw new Error('Resource limit must be at least 1');
    }
    this.limits[type] = limit;
    console.log(`[ResourcePool] Set ${type} limit to ${limit}`);
  }

  /**
   * Get current limits
   */
  getLimits(): Record<ResourceType, number> {
    return { ...this.limits };
  }

  /**
   * Clear all active tasks (for testing or reset)
   */
  clear(): void {
    for (const tasks of this.activeTasks.values()) {
      tasks.clear();
    }
    console.log('[ResourcePool] Cleared all active tasks');
  }

  /**
   * Emit resource event via Socket.IO
   */
  private emitResourceEvent(
    event: 'resource_acquired' | 'resource_released',
    payload: {
      type: ResourceType;
      taskId: string;
      activeSlots: number;
      maxSlots: number;
    }
  ): void {
    if (this.io) {
      this.io.emit(event, {
        type: event,
        payload,
        timestamp: new Date(),
      });
    }
  }
}
