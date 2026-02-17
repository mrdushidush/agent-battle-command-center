import { describe, it, expect, beforeEach } from '@jest/globals';
import { ResourcePoolService } from '../resourcePool.js';

describe('ResourcePoolService', () => {
  let pool: ResourcePoolService;

  beforeEach(() => {
    // Get singleton and clear state between tests
    pool = ResourcePoolService.getInstance();
    pool.clear();
  });

  describe('canAcquire', () => {
    it('should allow acquiring when slots are available', () => {
      expect(pool.canAcquire('ollama')).toBe(true);
      expect(pool.canAcquire('claude')).toBe(true);
    });

    it('should deny acquiring when ollama slot is full', () => {
      pool.acquire('ollama', 'task-1');

      expect(pool.canAcquire('ollama')).toBe(false);
    });

    it('should allow 2 claude slots', () => {
      pool.acquire('claude', 'task-1');

      expect(pool.canAcquire('claude')).toBe(true);

      pool.acquire('claude', 'task-2');

      expect(pool.canAcquire('claude')).toBe(false);
    });
  });

  describe('acquire', () => {
    it('should return true when slot is acquired', () => {
      expect(pool.acquire('ollama', 'task-1')).toBe(true);
    });

    it('should return false when no slots available', () => {
      pool.acquire('ollama', 'task-1');

      expect(pool.acquire('ollama', 'task-2')).toBe(false);
    });
  });

  describe('release', () => {
    it('should free slot after release', () => {
      pool.acquire('ollama', 'task-1');
      expect(pool.canAcquire('ollama')).toBe(false);

      pool.release('task-1');
      expect(pool.canAcquire('ollama')).toBe(true);
    });

    it('should handle releasing non-existent task gracefully', () => {
      // Should not throw
      pool.release('non-existent');
    });
  });

  describe('getResourceForTask', () => {
    it('should return ollama for non-claude tasks', () => {
      expect(pool.getResourceForTask(false)).toBe('ollama');
    });

    it('should return claude for claude tasks', () => {
      expect(pool.getResourceForTask(true)).toBe('claude');
    });
  });

  describe('getResourceForComplexity', () => {
    it('should return ollama for complexity < 10', () => {
      expect(pool.getResourceForComplexity(1)).toBe('ollama');
      expect(pool.getResourceForComplexity(3)).toBe('ollama');
      expect(pool.getResourceForComplexity(4)).toBe('ollama');
      expect(pool.getResourceForComplexity(9)).toBe('ollama');
    });

    it('should return claude for complexity >= 10', () => {
      expect(pool.getResourceForComplexity(10)).toBe('claude');
    });
  });

  describe('hasResource', () => {
    it('should return true for active task', () => {
      pool.acquire('ollama', 'task-1');

      expect(pool.hasResource('task-1')).toBe(true);
    });

    it('should return false for unknown task', () => {
      expect(pool.hasResource('task-1')).toBe(false);
    });
  });

  describe('getTaskResource', () => {
    it('should return resource type for active task', () => {
      pool.acquire('claude', 'task-1');

      expect(pool.getTaskResource('task-1')).toBe('claude');
    });

    it('should return null for unknown task', () => {
      expect(pool.getTaskResource('unknown')).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should return status of all pools', () => {
      pool.acquire('ollama', 'task-1');
      pool.acquire('claude', 'task-2');

      const status = pool.getStatus();

      expect(status).toHaveLength(2);

      const ollamaStatus = status.find(s => s.type === 'ollama');
      expect(ollamaStatus?.activeSlots).toBe(1);
      expect(ollamaStatus?.maxSlots).toBe(1);
      expect(ollamaStatus?.activeTasks).toContain('task-1');

      const claudeStatus = status.find(s => s.type === 'claude');
      expect(claudeStatus?.activeSlots).toBe(1);
      expect(claudeStatus?.maxSlots).toBe(2);
    });
  });

  describe('setLimit', () => {
    it('should update resource limits', () => {
      pool.setLimit('ollama', 3);

      const limits = pool.getLimits();
      expect(limits.ollama).toBe(3);
    });

    it('should throw for invalid limit', () => {
      expect(() => pool.setLimit('ollama', 0)).toThrow('Resource limit must be at least 1');
    });
  });

  describe('clear', () => {
    it('should release all active tasks', () => {
      pool.acquire('ollama', 'task-1');
      pool.acquire('claude', 'task-2');

      pool.clear();

      expect(pool.canAcquire('ollama')).toBe(true);
      expect(pool.canAcquire('claude')).toBe(true);
      expect(pool.hasResource('task-1')).toBe(false);
    });
  });
});
