import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';
import { AgentManagerService } from '../services/agentManager.js';
import type { TaskQueueService } from '../services/taskQueue.js';
import type { Server as SocketIOServer } from 'socket.io';

export const agentsRouter: RouterType = Router();

// List all agents
agentsRouter.get('/', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;
  const agentManager = new AgentManagerService(prisma, io);

  const type = req.query.type as string | undefined;
  const status = req.query.status as string | undefined;

  let agents = await agentManager.getAgents();

  if (type) {
    agents = agents.filter(a => a.type === type);
  }

  if (status) {
    agents = agents.filter(a => a.status === status);
  }

  res.json(agents);
}));

// Get agent types
agentsRouter.get('/types', asyncHandler(async (req, res) => {
  const types = await prisma.agentType.findMany();
  res.json(types);
}));

// Get single agent
agentsRouter.get('/:id', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;
  const agentManager = new AgentManagerService(prisma, io);

  const agent = await agentManager.getAgent(req.params.id);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  // Include current task if any
  let currentTask = null;
  if (agent.currentTaskId) {
    currentTask = await prisma.task.findUnique({
      where: { id: agent.currentTaskId },
    });
  }

  res.json({ ...agent, currentTask });
}));

// Update agent config
agentsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;
  const agentManager = new AgentManagerService(prisma, io);

  const configSchema = z.object({
    preferredModel: z.string().optional(),
    maxConcurrentTasks: z.number().min(1).max(5).optional(),
    autoRetry: z.boolean().optional(),
    alwaysUseClaude: z.boolean().optional(),
    maxContextTokens: z.number().min(1000).max(200000).optional(),
  });

  const config = configSchema.parse(req.body);

  const agent = await agentManager.updateAgentConfig(req.params.id, config);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  res.json(agent);
}));

// Pause agent (micromanager control)
agentsRouter.post('/:id/pause', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;
  const agentManager = new AgentManagerService(prisma, io);

  const agent = await agentManager.pauseAgent(req.params.id);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  res.json(agent);
}));

// Resume agent
agentsRouter.post('/:id/resume', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;
  const agentManager = new AgentManagerService(prisma, io);

  const agent = await agentManager.resumeAgent(req.params.id);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  res.json(agent);
}));

// Abort agent's current task
agentsRouter.post('/:id/abort', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;
  const agentManager = new AgentManagerService(prisma, io);

  const agent = await agentManager.getAgent(req.params.id);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  if (!agent.currentTaskId) {
    res.status(400).json({ error: 'Agent has no current task' });
    return;
  }

  await taskQueue.abortTask(agent.currentTaskId, 'Aborted by user');

  const updatedAgent = await agentManager.getAgent(req.params.id);
  res.json(updatedAgent);
}));

// Set agent offline
agentsRouter.post('/:id/offline', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;
  const agentManager = new AgentManagerService(prisma, io);

  const agent = await agentManager.setAgentOffline(req.params.id);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  res.json(agent);
}));

// Set agent online
agentsRouter.post('/:id/online', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;
  const agentManager = new AgentManagerService(prisma, io);

  const agent = await agentManager.setAgentOnline(req.params.id);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  res.json(agent);
}));

// Get agent stats
agentsRouter.get('/:id/stats', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;
  const agentManager = new AgentManagerService(prisma, io);

  const stats = await agentManager.getAgentStats(req.params.id);

  if (!stats) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  // Include execution history
  const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
  const executions = await prisma.taskExecution.findMany({
    where: { agentId: req.params.id },
    orderBy: { startedAt: 'desc' },
    take: 20,
    include: { task: true },
  });

  res.json({ stats, executions });
}));

// DEBUG: Reset all agents (clear stuck states)
agentsRouter.post('/reset-all', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;

  // Find all tasks that are stuck (assigned or in_progress, regardless of error)
  const stuckTasks = await prisma.task.findMany({
    where: {
      OR: [
        { status: 'assigned' },
        { status: 'in_progress' },
      ],
    },
  });

  // Mark all stuck tasks as failed
  const failedTasksResult = await prisma.task.updateMany({
    where: {
      OR: [
        { status: 'assigned' },
        { status: 'in_progress' },
      ],
    },
    data: {
      status: 'failed',
      error: 'Task was stuck and reset by user',
      completedAt: new Date(),
    },
  });

  // Update all agents to idle with no current task
  const agentsResult = await prisma.agent.updateMany({
    data: {
      status: 'idle',
      currentTaskId: null,
    },
  });

  // Emit agent status change events
  const agents = await prisma.agent.findMany({
    include: { agentType: true },
  });

  agents.forEach(agent => {
    io.emit('agent_status_changed', {
      type: 'agent_status_changed',
      payload: agent,
      timestamp: new Date(),
    });
  });

  // Emit task status changes for failed tasks
  stuckTasks.forEach(task => {
    // Update task object to reflect the changes made by updateMany
    const updatedTask = {
      ...task,
      status: 'failed',
      error: 'Task was stuck and reset by user',
      completedAt: new Date(),
    };
    io.emit('task_updated', {
      type: 'task_updated',
      payload: updatedTask,
      timestamp: new Date(),
    });
  });

  res.json({
    success: true,
    message: `Reset ${agentsResult.count} agents to idle, marked ${failedTasksResult.count} stuck tasks as failed`,
    agentsReset: agentsResult.count,
    tasksFixed: failedTasksResult.count,
  });
}));
