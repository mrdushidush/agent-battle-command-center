import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';
import { ExecutorService } from '../services/executor.js';
import type { TaskQueueService } from '../services/taskQueue.js';
import type { Server as SocketIOServer } from 'socket.io';

export const executeRouter: RouterType = Router();

const executor = new ExecutorService();

// Track in-flight executions to prevent duplicate runs of same task
const inFlightTasks = new Set<string>();

// Execute a task
executeRouter.post('/', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;
  const io = req.app.get('io') as SocketIOServer;

  const schema = z.object({
    taskId: z.string().uuid(),
    useClaude: z.boolean().default(true),
    model: z.string().optional(),
    allowFallback: z.boolean().default(true),
  });

  const data = schema.parse(req.body);

  // Get task
  const task = await prisma.task.findUnique({
    where: { id: data.taskId },
    include: { assignedAgent: true },
  });

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (!task.assignedAgentId) {
    res.status(400).json({ error: 'Task is not assigned to an agent' });
    return;
  }

  // Prevent duplicate execution of same task
  if (inFlightTasks.has(data.taskId)) {
    res.status(409).json({ error: 'Task execution already in progress' });
    return;
  }
  inFlightTasks.add(data.taskId);

  // Mark task as in progress
  await taskQueue.handleTaskStart(data.taskId);

  // Execute asynchronously
  const executeAsync = async () => {
    try {
      const result = await executor.executeTask({
        taskId: data.taskId,
        agentId: task.assignedAgentId!,
        taskDescription: task.description || task.title,
        expectedOutput: `Successfully completed: ${task.title}`,
        useClaude: data.useClaude,
        model: data.model,
        allowFallback: data.allowFallback,
      });

      if (result.success) {
        await taskQueue.handleTaskCompletion(data.taskId, {
          output: result.output ?? '',
          metrics: result.metrics ?? {},
        });
      } else {
        await taskQueue.handleTaskFailure(data.taskId, result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Execution error:', error);
      await taskQueue.handleTaskFailure(
        data.taskId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  // Fire and forget — catch to prevent silent stuck tasks, always clean up dedup set
  executeAsync()
    .catch((err) => {
      console.error(`[Execute] Unhandled async error for task ${data.taskId}:`, err);
      return taskQueue.handleTaskFailure(data.taskId, err instanceof Error ? err.message : 'Unhandled execution error').catch(
        (e) => console.error(`[Execute] Failed to mark task ${data.taskId} as failed:`, e)
      );
    })
    .finally(() => {
      inFlightTasks.delete(data.taskId);
    });

  res.json({ started: true, taskId: data.taskId });
}));

// Abort execution
executeRouter.post('/abort', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  const schema = z.object({
    taskId: z.string().uuid(),
  });

  const data = schema.parse(req.body);

  const success = await executor.abortExecution(data.taskId);

  if (success) {
    await taskQueue.abortTask(data.taskId, 'Execution aborted by user');
  }

  res.json({ aborted: success });
}));

// Health check for executor service
executeRouter.get('/health', asyncHandler(async (req, res) => {
  const health = await executor.healthCheck();
  res.json(health);
}));
