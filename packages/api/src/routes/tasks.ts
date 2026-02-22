import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';
import type { TaskQueueService } from '../services/taskQueue.js';
import type { Server as SocketIOServer } from 'socket.io';

export const tasksRouter: RouterType = Router();

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  taskType: z.enum(['code', 'test', 'review', 'debug', 'refactor']),
  requiredAgent: z.enum(['coder', 'qa', 'cto']).optional(),
  priority: z.number().min(1).max(10).default(5),
  maxIterations: z.number().min(1).max(10).default(3),
  humanTimeoutMinutes: z.number().min(1).max(1440).default(30),
  parentTaskId: z.string().uuid().optional(),
  lockedFiles: z.array(z.string()).default([]),
  acceptanceCriteria: z.string().optional(),
  contextNotes: z.string().optional(),
  validationCommand: z.string().max(2000).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  priority: z.number().min(1).max(10).optional(),
  maxIterations: z.number().min(1).max(10).optional(),
  currentIteration: z.number().min(0).max(10).optional(),
  lockedFiles: z.array(z.string()).optional(),
  // Allow updating status and result from diagnostic scripts
  status: z.enum(['pending', 'assigned', 'in_progress', 'needs_human', 'completed', 'failed', 'aborted']).optional(),
  result: z.any().optional(),  // Prisma Json type
  error: z.string().nullable().optional(),
  timeSpentMs: z.number().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  // Allow clearing assignment for task reset
  assignedAgentId: z.string().nullable().optional(),
  assignedAt: z.string().datetime().nullable().optional(),
});

// List tasks with filters
tasksRouter.get('/', asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const requiredAgent = req.query.requiredAgent as string | undefined;
  const assignedAgentId = req.query.assignedAgentId as string | undefined;

  const tasks = await prisma.task.findMany({
    where: {
      ...(status && { status }),
      ...(requiredAgent && { requiredAgent }),
      ...(assignedAgentId && { assignedAgentId }),
    },
    include: {
      assignedAgent: {
        include: { agentType: true },
      },
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  res.json(tasks);
}));

// Get single task
tasksRouter.get('/:id', asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      assignedAgent: {
        include: { agentType: true },
      },
      taskExecutions: {
        orderBy: { startedAt: 'desc' },
        take: 10,
      },
      fileLocks: true,
      subTasks: true,
    },
  });

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  res.json(task);
}));

// Create task
tasksRouter.post('/', asyncHandler(async (req, res) => {
  const data = createTaskSchema.parse(req.body);

  const task = await prisma.task.create({
    data: {
      title: data.title,
      taskType: data.taskType,
      description: data.description,
      requiredAgent: data.requiredAgent,
      priority: data.priority,
      maxIterations: data.maxIterations,
      humanTimeoutMinutes: data.humanTimeoutMinutes,
      lockedFiles: data.lockedFiles,
      acceptanceCriteria: data.acceptanceCriteria,
      contextNotes: data.contextNotes,
      validationCommand: data.validationCommand,
      ...(data.parentTaskId && { parentTask: { connect: { id: data.parentTaskId } } }),
    },
  });

  const io = req.app.get('io') as SocketIOServer;
  io.emit('task_created', {
    type: 'task_created',
    payload: task,
    timestamp: new Date(),
  });

  res.status(201).json(task);
}));

// Update task
tasksRouter.patch('/:id', asyncHandler(async (req, res) => {
  const data = updateTaskSchema.parse(req.body);

  // Build Prisma update data, only including defined fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.maxIterations !== undefined) updateData.maxIterations = data.maxIterations;
  if (data.currentIteration !== undefined) updateData.currentIteration = data.currentIteration;
  if (data.lockedFiles !== undefined) updateData.lockedFiles = data.lockedFiles;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.result !== undefined) updateData.result = data.result;
  if (data.error !== undefined) updateData.error = data.error;
  if (data.timeSpentMs !== undefined) updateData.timeSpentMs = data.timeSpentMs;
  if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
  // Handle relation fields - use disconnect for null
  if (data.assignedAgentId !== undefined) {
    updateData.assignedAgentId = data.assignedAgentId;
  }
  if (data.assignedAt !== undefined) {
    updateData.assignedAt = data.assignedAt;
  }

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: updateData,
  });

  const io = req.app.get('io') as SocketIOServer;
  io.emit('task_updated', {
    type: 'task_updated',
    payload: task,
    timestamp: new Date(),
  });

  res.json(task);
}));

// Delete/cancel task
tasksRouter.delete('/:id', asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
  });

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Can't delete tasks that are in progress or assigned
  if (['assigned', 'in_progress', 'needs_human'].includes(task.status)) {
    res.status(400).json({ error: 'Cannot delete active tasks. Wait for completion or abort first.' });
    return;
  }

  await prisma.task.delete({
    where: { id: req.params.id },
  });

  const io = req.app.get('io') as SocketIOServer;
  io.emit('task_deleted', {
    type: 'task_deleted',
    payload: { id: req.params.id },
    timestamp: new Date(),
  });

  res.status(204).send();
}));

// Retry failed task
tasksRouter.post('/:id/retry', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
  });

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (!['failed', 'aborted'].includes(task.status)) {
    res.status(400).json({ error: 'Can only retry failed or aborted tasks' });
    return;
  }

  await taskQueue.returnToPool(req.params.id);

  const updatedTask = await prisma.task.findUnique({
    where: { id: req.params.id },
  });

  res.json(updatedTask);
}));

// Submit human input
tasksRouter.post('/:id/human', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  const schema = z.object({
    input: z.string(),
    action: z.enum(['approve', 'reject', 'modify']),
    modifiedContent: z.string().optional(),
  });

  const data = schema.parse(req.body);

  await taskQueue.provideHumanInput(req.params.id, data.input, data.action);

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
  });

  res.json(task);
}));

// Abort task
tasksRouter.post('/:id/abort', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
  });

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  await taskQueue.abortTask(req.params.id, 'Manually aborted');

  const updatedTask = await prisma.task.findUnique({
    where: { id: req.params.id },
  });

  res.json(updatedTask);
}));

// Complete task (for diagnostic scripts)
tasksRouter.post('/:id/complete', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  const schema = z.object({
    result: z.any(),
    success: z.boolean(),
    error: z.string().nullable().optional(),
  });

  const data = schema.parse(req.body);

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
  });

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (data.success) {
    await taskQueue.handleTaskCompletion(req.params.id, {
      output: JSON.stringify(data.result),
      metrics: {},
    });
  } else {
    await taskQueue.handleTaskFailure(req.params.id, data.error || 'Unknown error');
  }

  const updatedTask = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      assignedAgent: {
        include: { agentType: true },
      },
    },
  });

  res.json(updatedTask);
}));
