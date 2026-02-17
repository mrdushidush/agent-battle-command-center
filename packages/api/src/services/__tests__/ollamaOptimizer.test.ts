import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  OllamaOptimizer,
  OLLAMA_REST_DELAY_MS,
  OLLAMA_EXTENDED_REST_MS,
  OLLAMA_RESET_EVERY_N_TASKS,
  OLLAMA_COMPLEXITY_THRESHOLD,
  getOllamaTaskCounts,
  resetOllamaTaskCounts,
} from '../ollamaOptimizer.js';
import type { Server as SocketIOServer } from 'socket.io';

// Mock socket.io
const mockIo = {
  emit: jest.fn(),
} as unknown as SocketIOServer;

describe('OllamaOptimizer', () => {
  let optimizer: OllamaOptimizer;

  beforeEach(() => {
    optimizer = new OllamaOptimizer(mockIo);
    // Reset state before each test
    resetOllamaTaskCounts();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after tests
    resetOllamaTaskCounts();
  });

  describe('getConfig', () => {
    it('should return correct constants', () => {
      const config = optimizer.getConfig();

      expect(config.restDelayMs).toBe(OLLAMA_REST_DELAY_MS);
      expect(config.extendedRestMs).toBe(OLLAMA_EXTENDED_REST_MS);
      expect(config.resetEveryNTasks).toBe(OLLAMA_RESET_EVERY_N_TASKS);
      expect(config.complexityThreshold).toBe(OLLAMA_COMPLEXITY_THRESHOLD);
    });

    it('should return expected default values', () => {
      const config = optimizer.getConfig();

      expect(config.restDelayMs).toBe(3000);
      expect(config.extendedRestMs).toBe(8000);
      expect(config.resetEveryNTasks).toBe(5);
      expect(config.complexityThreshold).toBe(10);
    });
  });

  describe('isOllamaTask', () => {
    it('should return true for complexity < 10 and coder agent', () => {
      expect(optimizer.isOllamaTask(1, 'coder')).toBe(true);
      expect(optimizer.isOllamaTask(3, 'coder')).toBe(true);
      expect(optimizer.isOllamaTask(6, 'coder')).toBe(true);
      expect(optimizer.isOllamaTask(7, 'coder')).toBe(true);
      expect(optimizer.isOllamaTask(9, 'coder')).toBe(true);
      expect(optimizer.isOllamaTask(9.9, 'coder')).toBe(true);
    });

    it('should return false for complexity >= 10', () => {
      expect(optimizer.isOllamaTask(10, 'coder')).toBe(false);
    });

    it('should return false for non-coder agents even with low complexity', () => {
      expect(optimizer.isOllamaTask(1, 'qa')).toBe(false);
      expect(optimizer.isOllamaTask(3, 'cto')).toBe(false);
      expect(optimizer.isOllamaTask(5, 'reviewer')).toBe(false);
    });

    it('should return false when both conditions fail', () => {
      expect(optimizer.isOllamaTask(8, 'qa')).toBe(false);
    });
  });

  describe('getTaskCounts', () => {
    it('should return empty object when no tasks have been processed', () => {
      const counts = optimizer.getTaskCounts();
      expect(counts).toEqual({});
    });

    it('should return task counts per agent after applyRestDelay', async () => {
      // Use a short timeout for tests
      jest.useFakeTimers();

      const promise1 = optimizer.applyRestDelay('agent-1');
      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      await promise1;

      const promise2 = optimizer.applyRestDelay('agent-1');
      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      await promise2;

      const promise3 = optimizer.applyRestDelay('agent-2');
      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      await promise3;

      const counts = optimizer.getTaskCounts();
      expect(counts['agent-1']).toBe(2);
      expect(counts['agent-2']).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('resetTaskCounts', () => {
    it('should clear the counts', async () => {
      jest.useFakeTimers();

      const promise = optimizer.applyRestDelay('agent-1');
      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      await promise;

      expect(optimizer.getTaskCounts()['agent-1']).toBe(1);

      optimizer.resetTaskCounts();

      expect(optimizer.getTaskCounts()).toEqual({});

      jest.useRealTimers();
    });

    it('should allow fresh counting after reset', async () => {
      jest.useFakeTimers();

      // Add some counts
      const promise1 = optimizer.applyRestDelay('agent-1');
      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      await promise1;

      const promise2 = optimizer.applyRestDelay('agent-1');
      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      await promise2;

      expect(optimizer.getTaskCounts()['agent-1']).toBe(2);

      // Reset
      optimizer.resetTaskCounts();

      // Add new count
      const promise3 = optimizer.applyRestDelay('agent-1');
      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      await promise3;

      expect(optimizer.getTaskCounts()['agent-1']).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('applyRestDelay', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should increment task count and emit event', async () => {
      const promise = optimizer.applyRestDelay('agent-1', 'Coder Agent');

      // Should emit immediately
      expect(mockIo.emit).toHaveBeenCalledWith('agent_cooling_down', {
        type: 'agent_cooling_down',
        payload: {
          agentId: 'agent-1',
          restMs: OLLAMA_REST_DELAY_MS,
          isExtendedRest: false,
          taskCount: 1,
        },
        timestamp: expect.any(Date),
      });

      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      const taskCount = await promise;

      expect(taskCount).toBe(1);
      expect(optimizer.getTaskCounts()['agent-1']).toBe(1);
    });

    it('should use standard rest delay for normal tasks', async () => {
      const promise = optimizer.applyRestDelay('agent-1');

      expect(mockIo.emit).toHaveBeenCalledWith(
        'agent_cooling_down',
        expect.objectContaining({
          payload: expect.objectContaining({
            restMs: OLLAMA_REST_DELAY_MS,
            isExtendedRest: false,
          }),
        })
      );

      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      await promise;
    });

    it('should use extended rest delay every Nth task', async () => {
      // Run N-1 normal tasks
      for (let i = 1; i < OLLAMA_RESET_EVERY_N_TASKS; i++) {
        const promise = optimizer.applyRestDelay('agent-1');
        jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
        await promise;
      }

      jest.clearAllMocks();

      // The Nth task should trigger extended rest
      const promise = optimizer.applyRestDelay('agent-1');

      expect(mockIo.emit).toHaveBeenCalledWith(
        'agent_cooling_down',
        expect.objectContaining({
          payload: expect.objectContaining({
            restMs: OLLAMA_EXTENDED_REST_MS,
            isExtendedRest: true,
            taskCount: OLLAMA_RESET_EVERY_N_TASKS,
          }),
        })
      );

      jest.advanceTimersByTime(OLLAMA_EXTENDED_REST_MS);
      await promise;
    });

    it('should return the current task count', async () => {
      for (let i = 1; i <= 3; i++) {
        const promise = optimizer.applyRestDelay('agent-1');
        jest.advanceTimersByTime(OLLAMA_EXTENDED_REST_MS);
        const count = await promise;
        expect(count).toBe(i);
      }
    });
  });

  describe('applyFailureRestDelay', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should increment task count for failed tasks', async () => {
      const promise = optimizer.applyFailureRestDelay('agent-1');

      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      const taskCount = await promise;

      expect(taskCount).toBe(1);
      expect(optimizer.getTaskCounts()['agent-1']).toBe(1);
    });

    it('should emit cooling down event for failures', async () => {
      const promise = optimizer.applyFailureRestDelay('agent-1', 'Coder Agent');

      expect(mockIo.emit).toHaveBeenCalledWith('agent_cooling_down', {
        type: 'agent_cooling_down',
        payload: {
          agentId: 'agent-1',
          restMs: OLLAMA_REST_DELAY_MS,
          isExtendedRest: false,
          taskCount: 1,
        },
        timestamp: expect.any(Date),
      });

      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      await promise;
    });

    it('should trigger extended rest on Nth failure', async () => {
      // Run N-1 failures
      for (let i = 1; i < OLLAMA_RESET_EVERY_N_TASKS; i++) {
        const promise = optimizer.applyFailureRestDelay('agent-1');
        jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
        await promise;
      }

      jest.clearAllMocks();

      // The Nth failure should trigger extended rest
      const promise = optimizer.applyFailureRestDelay('agent-1');

      expect(mockIo.emit).toHaveBeenCalledWith(
        'agent_cooling_down',
        expect.objectContaining({
          payload: expect.objectContaining({
            isExtendedRest: true,
          }),
        })
      );

      jest.advanceTimersByTime(OLLAMA_EXTENDED_REST_MS);
      await promise;
    });

    it('should count failures and successes together', async () => {
      const promise1 = optimizer.applyRestDelay('agent-1');
      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      await promise1;

      const promise2 = optimizer.applyFailureRestDelay('agent-1');
      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      const count = await promise2;

      expect(count).toBe(2);
    });
  });

  describe('module-level functions', () => {
    it('getOllamaTaskCounts should return task counts', async () => {
      jest.useFakeTimers();

      const promise = optimizer.applyRestDelay('agent-x');
      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      await promise;

      const counts = getOllamaTaskCounts();
      expect(counts['agent-x']).toBe(1);

      jest.useRealTimers();
    });

    it('resetOllamaTaskCounts should clear all counts', async () => {
      jest.useFakeTimers();

      const promise = optimizer.applyRestDelay('agent-y');
      jest.advanceTimersByTime(OLLAMA_REST_DELAY_MS);
      await promise;

      resetOllamaTaskCounts();

      const counts = getOllamaTaskCounts();
      expect(counts).toEqual({});

      jest.useRealTimers();
    });
  });
});
