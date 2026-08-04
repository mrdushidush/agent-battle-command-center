import { describe, it, expect } from '@jest/globals';
import { calculateActualComplexity, categorizeError } from '../complexityCalculator.js';
import type { Task, ExecutionLog } from '@prisma/client';

// Minimal fixtures - only the fields these two pure functions actually read.
function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-123',
    status: 'completed',
    currentIteration: 1,
    maxIterations: 3,
    complexity: null,
    error: null,
    ...overrides,
  } as Task;
}

function createLogs(count: number, isLoop = false): ExecutionLog[] {
  return Array.from(
    { length: count },
    (_, i) => ({ id: `log-${i}`, taskId: 'task-123', isLoop }) as ExecutionLog
  );
}

describe('Complexity Calculator', () => {
  describe('calculateActualComplexity', () => {
    describe('non-terminal status', () => {
      it('should return the estimated complexity without adjustments', () => {
        const task = createTask({ status: 'pending', complexity: 7 });
        expect(calculateActualComplexity(task, createLogs(0))).toBe(7);
      });

      it('should fall back to 5 when no complexity was estimated', () => {
        const task = createTask({ status: 'in_progress', complexity: null });
        expect(calculateActualComplexity(task, createLogs(0))).toBe(5);
      });
    });

    describe('tool call adjustment', () => {
      it('should subtract 1 for fewer than 5 tool calls', () => {
        expect(calculateActualComplexity(createTask(), createLogs(3))).toBe(2);
      });

      it('should adjust by 0 for 5 to 9 tool calls', () => {
        expect(calculateActualComplexity(createTask(), createLogs(7))).toBe(3);
      });

      it('should add 1 for 10 to 19 tool calls', () => {
        expect(calculateActualComplexity(createTask(), createLogs(15))).toBe(4);
      });

      it('should add 2 for 20 or more tool calls', () => {
        expect(calculateActualComplexity(createTask(), createLogs(25))).toBe(5);
      });
    });

    describe('adjustment caps', () => {
      it('should cap the retry adjustment at +3', () => {
        const task = createTask({ currentIteration: 10 });
        expect(calculateActualComplexity(task, createLogs(3))).toBe(5);
      });

      it('should cap the loop adjustment at +2', () => {
        expect(calculateActualComplexity(createTask(), createLogs(4, true))).toBe(4);
      });
    });

    describe('status baselines', () => {
      it('should start a failed task from a baseline of 7', () => {
        // A high estimate keeps the +2 failure cap from binding, so the
        // baseline itself is what the assertion measures: 7 - 1 = 6.
        const task = createTask({ status: 'failed', complexity: 10 });
        expect(calculateActualComplexity(task, createLogs(3))).toBe(6);
      });

      it('should start a task awaiting a human from a baseline of 6', () => {
        // Stays clear of the upper clamp so the baseline is observable: 6 - 1 = 5.
        const task = createTask({ status: 'needs_human' });
        expect(calculateActualComplexity(task, createLogs(3))).toBe(5);
      });
    });

    describe('failure handling', () => {
      it('should cap a failed task at its estimated complexity plus 2', () => {
        const task = createTask({ status: 'failed', complexity: 3, currentIteration: 5 });
        expect(calculateActualComplexity(task, createLogs(25))).toBe(5);
      });

      it('should assume an estimate of 8 when a failed task has no complexity', () => {
        const task = createTask({ status: 'failed', complexity: null, currentIteration: 5 });
        expect(calculateActualComplexity(task, createLogs(25))).toBe(10);
      });

      it('should treat aborted the same as failed', () => {
        const task = createTask({ status: 'aborted', complexity: 3, currentIteration: 5 });
        expect(calculateActualComplexity(task, createLogs(25))).toBe(5);
      });
    });

    describe('range clamping', () => {
      it('should clamp the result to 10', () => {
        const task = createTask({ status: 'needs_human', currentIteration: 10 });
        expect(calculateActualComplexity(task, createLogs(25, true))).toBe(10);
      });

      it('should never return less than 1', () => {
        const task = createTask({ currentIteration: 0 });
        expect(calculateActualComplexity(task, createLogs(3))).toBe(1);
      });
    });
  });

  describe('categorizeError', () => {
    it('should return null for a completed task', () => {
      expect(categorizeError(createTask({ status: 'completed' }), createLogs(0))).toBeNull();
    });

    it('should return null for a task that has not finished', () => {
      expect(categorizeError(createTask({ status: 'pending' }), createLogs(0))).toBeNull();
    });

    it('should report a detected loop ahead of the error message', () => {
      const task = createTask({ status: 'failed', error: 'Request timeout' });
      expect(categorizeError(task, createLogs(2, true))).toBe('loop_detected');
    });

    it('should categorize a timeout', () => {
      const task = createTask({ status: 'failed', error: 'Request timed out after 30s' });
      expect(categorizeError(task, createLogs(2))).toBe('timeout');
    });

    it('should categorize exhausted iterations', () => {
      const task = createTask({ status: 'failed', error: 'Max iterations reached' });
      expect(categorizeError(task, createLogs(2))).toBe('max_iterations');
    });

    it('should categorize a rate limit as an api error', () => {
      const task = createTask({ status: 'failed', error: 'Rate limit exceeded' });
      expect(categorizeError(task, createLogs(2))).toBe('api_error');
    });

    it('should categorize a syntax error', () => {
      const task = createTask({ status: 'failed', error: 'SyntaxError: unexpected token' });
      expect(categorizeError(task, createLogs(2))).toBe('syntax_error');
    });

    it('should categorize an exception as a runtime error', () => {
      const task = createTask({ status: 'failed', error: 'Unhandled exception in worker' });
      expect(categorizeError(task, createLogs(2))).toBe('runtime_error');
    });

    it('should categorize a missing module as an import error', () => {
      const task = createTask({ status: 'failed', error: 'Module not found' });
      expect(categorizeError(task, createLogs(2))).toBe('import_error');
    });

    it('should categorize denied access as a permission error', () => {
      const task = createTask({ status: 'failed', error: 'Access denied to workspace' });
      expect(categorizeError(task, createLogs(2))).toBe('permission_error');
    });

    it('should fall back to unknown_error for an unrecognized message', () => {
      const task = createTask({ status: 'failed', error: 'Something went wrong' });
      expect(categorizeError(task, createLogs(2))).toBe('unknown_error');
    });

    it('should fall back to unknown_error when there is no error message', () => {
      const task = createTask({ status: 'failed', error: null });
      expect(categorizeError(task, createLogs(2))).toBe('unknown_error');
    });

    it('should categorize an aborted task', () => {
      const task = createTask({ status: 'aborted', error: 'Request timed out' });
      expect(categorizeError(task, createLogs(0))).toBe('timeout');
    });
  });
});
