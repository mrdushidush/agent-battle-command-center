import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';
import { AgentManagerService } from '../services/agentManager.js';
import type { TaskQueueService } from '../services/taskQueue.js';
import type { StuckTaskRecoveryService } from '../services/stuckTaskRecovery.js';
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

// Get Ollama rest status (for debugging)
// Must be before /:id to avoid being matched as an agent ID
agentsRouter.get('/ollama-status', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  if (!taskQueue) {
    res.status(500).json({ error: 'TaskQueue service not initialized' });
    return;
  }

  res.json({
    agentTaskCounts: taskQueue.getOllamaTaskCounts(),
    config: taskQueue.getOllamaConfig(),
  });
}));

// Reset Ollama task counter (for testing)
agentsRouter.post('/ollama-reset-counter', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  if (!taskQueue) {
    res.status(500).json({ error: 'TaskQueue service not initialized' });
    return;
  }

  taskQueue.resetOllamaTaskCounts();
  res.json({ success: true, message: 'Ollama task counters reset to 0' });
}));

// Get stuck task recovery status
agentsRouter.get('/stuck-recovery/status', asyncHandler(async (req, res) => {
  const stuckTaskRecovery = req.app.get('stuckTaskRecovery') as StuckTaskRecoveryService;

  if (!stuckTaskRecovery) {
    res.status(500).json({ error: 'StuckTaskRecovery service not initialized' });
    return;
  }

  res.json(stuckTaskRecovery.getStatus());
}));

// Manually trigger stuck task recovery check
agentsRouter.post('/stuck-recovery/check', asyncHandler(async (req, res) => {
  const stuckTaskRecovery = req.app.get('stuckTaskRecovery') as StuckTaskRecoveryService;

  if (!stuckTaskRecovery) {
    res.status(500).json({ error: 'StuckTaskRecovery service not initialized' });
    return;
  }

  const results = await stuckTaskRecovery.triggerCheck();
  res.json({
    success: true,
    recoveredCount: results.length,
    recovered: results,
  });
}));

// Update stuck task recovery configuration
agentsRouter.patch('/stuck-recovery/config', asyncHandler(async (req, res) => {
  const stuckTaskRecovery = req.app.get('stuckTaskRecovery') as StuckTaskRecoveryService;

  if (!stuckTaskRecovery) {
    res.status(500).json({ error: 'StuckTaskRecovery service not initialized' });
    return;
  }

  const configSchema = z.object({
    taskTimeoutMs: z.number().min(60000).max(3600000).optional(), // 1 min to 1 hour
    checkIntervalMs: z.number().min(10000).max(600000).optional(), // 10 sec to 10 min
    enabled: z.boolean().optional(),
  });

  const config = configSchema.parse(req.body);
  stuckTaskRecovery.updateConfig(config);

  res.json({
    success: true,
    config: stuckTaskRecovery.getConfig(),
  });
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

// Update agent config or status
agentsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;
  const agentManager = new AgentManagerService(prisma, io);

  const updateSchema = z.object({
    // Config fields
    preferredModel: z.string().optional(),
    maxConcurrentTasks: z.number().min(1).max(5).optional(),
    autoRetry: z.boolean().optional(),
    alwaysUseClaude: z.boolean().optional(),
    maxContextTokens: z.number().min(1000).max(200000).optional(),
    // Status fields (for test scripts)
    status: z.enum(['idle', 'busy', 'paused', 'offline']).optional(),
    currentTaskId: z.string().nullable().optional(),
  });

  const update = updateSchema.parse(req.body);

  // If status or currentTaskId is being updated, do a direct DB update
  if (update.status !== undefined || update.currentTaskId !== undefined) {
    const agent = await prisma.agent.update({
      where: { id: req.params.id },
      data: {
        ...(update.status !== undefined && { status: update.status }),
        ...(update.currentTaskId !== undefined && { currentTaskId: update.currentTaskId }),
      },
      include: { agentType: true },
    });

    if (agent) {
      io.emit('agent_status_changed', {
        type: 'agent_status_changed',
        payload: agent,
        timestamp: new Date(),
      });
    }

    res.json(agent);
    return;
  }

  // Otherwise update config
  const config = {
    preferredModel: update.preferredModel,
    maxConcurrentTasks: update.maxConcurrentTasks,
    autoRetry: update.autoRetry,
    alwaysUseClaude: update.alwaysUseClaude,
    maxContextTokens: update.maxContextTokens,
  };

  const agent = await agentManager.updateAgentConfig(req.params.id, config);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  res.json(agent);
}));

// Delete agent
agentsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;
  const agentManager = new AgentManagerService(prisma, io);

  try {
    const deleted = await agentManager.deleteAgent(req.params.id);

    if (!deleted) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to delete agent' });
  }
}));

// Pause agent
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
  const stuckTaskRecovery = req.app.get('stuckTaskRecovery') as StuckTaskRecoveryService;

  if (!stuckTaskRecovery) {
    res.status(500).json({ error: 'StuckTaskRecovery service not initialized' });
    return;
  }

  const results = await stuckTaskRecovery.forceRecoverAll();

  res.json({
    success: true,
    message: `Force recovered ${results.length} stuck tasks`,
    recoveredCount: results.length,
    recovered: results,
  });
}));
