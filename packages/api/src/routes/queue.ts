import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';
import type { TaskQueueService } from '../services/taskQueue.js';
import { TaskRouter } from '../services/taskRouter.js';
import { ResourcePoolService } from '../services/resourcePool.js';

export const queueRouter: RouterType = Router();

// Get queue state (pending tasks)
queueRouter.get('/', asyncHandler(async (req, res) => {
  const pendingTasks = await prisma.task.findMany({
    where: { status: 'pending' },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
    include: {
      parentTask: {
        select: { id: true, title: true },
      },
    },
  });

  const activeTasks = await prisma.task.findMany({
    where: {
      status: { in: ['assigned', 'in_progress', 'needs_human'] },
    },
    include: {
      assignedAgent: {
        include: { agentType: true },
      },
    },
  });

  const idleAgents = await prisma.agent.findMany({
    where: { status: 'idle' },
    include: { agentType: true },
  });

  res.json({
    pending: pendingTasks,
    active: activeTasks,
    idleAgents,
    stats: {
      pendingCount: pendingTasks.length,
      activeCount: activeTasks.length,
      idleAgentCount: idleAgents.length,
    },
  });
}));

// Manually assign task to agent (micromanager mode)
queueRouter.post('/assign', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  const schema = z.object({
    taskId: z.string().uuid(),
    agentId: z.string(),
  });

  const { taskId, agentId } = schema.parse(req.body);

  // Verify task is pending
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (task.status !== 'pending') {
    res.status(400).json({ error: 'Task is not pending' });
    return;
  }

  // Verify agent is idle
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { agentType: true },
  });

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  if (agent.status !== 'idle') {
    // Agent is busy - task stays in queue and will be auto-assigned when agent is free
    res.json({
      queued: true,
      message: `${agent.name} is busy - task queued and will be assigned automatically when agent is free`,
      task: task,
      agentStatus: agent.status,
      currentTaskId: agent.currentTaskId,
    });
    return;
  }

  // Check agent type compatibility
  if (task.requiredAgent && task.requiredAgent !== agent.agentType.name) {
    res.status(400).json({
      error: `Task requires ${task.requiredAgent} agent, but ${agent.name} is ${agent.agentType.name}`,
    });
    return;
  }

  const assignment = await taskQueue.assignTask(taskId, agentId);

  const updatedTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedAgent: {
        include: { agentType: true },
      },
    },
  });

  res.json(updatedTask);
}));

// Auto-assign next task to an agent
queueRouter.post('/auto-assign', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  const schema = z.object({
    agentId: z.string(),
  });

  const { agentId } = schema.parse(req.body);

  const assignment = await taskQueue.assignNextTask(agentId);

  if (!assignment) {
    res.json({ assigned: false, message: 'No suitable task found' });
    return;
  }

  const task = await prisma.task.findUnique({
    where: { id: assignment.taskId },
    include: {
      assignedAgent: {
        include: { agentType: true },
      },
    },
  });

  res.json({ assigned: true, task });
}));

// Smart auto-assign using intelligent task routing
queueRouter.post('/smart-assign', asyncHandler(async (req, res) => {
  const taskRouter = new TaskRouter(prisma);

  const result = await taskRouter.autoAssignNext();

  if (!result) {
    res.json({ assigned: false, message: 'No pending tasks' });
    return;
  }

  res.json({
    assigned: true,
    task: result.task,
    decision: result.decision,
  });
}));

// Get routing recommendation for a specific task
queueRouter.get('/:taskId/route', asyncHandler(async (req, res) => {
  const taskRouter = new TaskRouter(prisma);
  const { taskId } = req.params;

  const decision = await taskRouter.routeTask(taskId);

  res.json(decision);
}));

// Get file locks
queueRouter.get('/locks', asyncHandler(async (req, res) => {
  const locks = await prisma.fileLock.findMany({
    where: {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      agent: true,
      task: {
        select: { id: true, title: true },
      },
    },
  });

  res.json(locks);
}));

// Release a specific file lock (emergency override)
queueRouter.delete('/locks/:filePath', asyncHandler(async (req, res) => {
  const filePath = decodeURIComponent(req.params.filePath);

  await prisma.fileLock.delete({
    where: { filePath },
  });

  res.status(204).send();
}));

// Get resource pool status
queueRouter.get('/resources', asyncHandler(async (req, res) => {
  const resourcePool = ResourcePoolService.getInstance();
  const status = resourcePool.getStatus();

  res.json({
    resources: status,
    limits: resourcePool.getLimits(),
    summary: {
      ollama: resourcePool.getResourceStatus('ollama'),
      claude: resourcePool.getResourceStatus('claude'),
    },
  });
}));

/**
 * Parallel task assignment - assigns tasks based on resource availability
 *
 * Unlike /smart-assign, this endpoint:
 * - Does NOT check if agent is idle (allows parallel execution)
 * - Checks resource pool availability instead
 * - Allows multiple tasks to run simultaneously on different resources
 * - Enables Ollama tasks and Claude tasks to execute in parallel
 */
queueRouter.post('/parallel-assign', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;
  const taskRouter = new TaskRouter(prisma);
  const resourcePool = ResourcePoolService.getInstance();

  // Get locked files from active tasks
  const locks = await prisma.fileLock.findMany({
    where: {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });
  const lockedFiles = locks.map((lock) => lock.filePath);

  // Get pending tasks by priority
  const pendingTasks = await prisma.task.findMany({
    where: {
      status: 'pending',
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  if (pendingTasks.length === 0) {
    res.json({ assigned: false, message: 'No pending tasks' });
    return;
  }

  // Find a task that can run with available resources
  for (const task of pendingTasks) {
    // Check file conflicts
    const taskFiles = task.lockedFiles || [];
    const hasFileConflict = taskFiles.some((file) => lockedFiles.includes(file));
    if (hasFileConflict) {
      continue; // Skip tasks with file conflicts
    }

    // Calculate complexity to determine resource type
    const routerComplexity = taskRouter.calculateComplexity(task);
    const resourceType = resourcePool.getResourceForComplexity(routerComplexity);

    // Check if resource is available
    if (!resourcePool.canAcquire(resourceType)) {
      continue; // Skip if no slots available for this resource type
    }

    // Find appropriate agent for this task
    // For Ollama tasks, use coder agent; for Claude tasks, use qa agent
    const agentTypeName = resourceType === 'ollama' ? 'coder' : 'qa';
    const agent = await prisma.agent.findFirst({
      where: {
        agentType: { name: agentTypeName },
        status: 'idle', // Only assign to idle agents to prevent race conditions
      },
      include: { agentType: true },
    });

    if (!agent) {
      continue; // No agent of required type
    }

    // Also check if task has required agent constraint
    if (task.requiredAgent && task.requiredAgent !== agent.agentType.name) {
      continue; // Task requires different agent type
    }

    // Acquire resource slot
    if (!resourcePool.acquire(resourceType, task.id)) {
      continue; // Failed to acquire (race condition)
    }

    // Assign task to agent (this updates task and agent status)
    try {
      await taskQueue.assignTask(task.id, agent.id);

      const updatedTask = await prisma.task.findUnique({
        where: { id: task.id },
        include: {
          assignedAgent: {
            include: { agentType: true },
          },
        },
      });

      res.json({
        assigned: true,
        task: updatedTask,
        resource: {
          type: resourceType,
          complexity: routerComplexity,
        },
        poolStatus: resourcePool.getStatus(),
      });
      return;
    } catch (error) {
      // Release resource if assignment failed
      resourcePool.release(task.id);
      console.error(`[parallel-assign] Failed to assign task ${task.id}:`, error);
      continue;
    }
  }

  // No task could be assigned (all have conflicts or no resources available)
  res.json({
    assigned: false,
    message: 'No tasks can be assigned with current resources',
    poolStatus: resourcePool.getStatus(),
  });
}));

// Clear resource pool (for testing/reset)
queueRouter.post('/resources/clear', asyncHandler(async (req, res) => {
  const resourcePool = ResourcePoolService.getInstance();
  resourcePool.clear();

  res.json({
    message: 'Resource pool cleared',
    status: resourcePool.getStatus(),
  });
}));
