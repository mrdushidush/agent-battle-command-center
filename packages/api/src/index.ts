import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import { prisma } from './db/client.js';
import { tasksRouter } from './routes/tasks.js';
import { agentsRouter } from './routes/agents.js';
import { queueRouter } from './routes/queue.js';
import { executeRouter } from './routes/execute.js';
import { metricsRouter } from './routes/metrics.js';
import { chatRouter } from './routes/chat.js';
import { executionLogsRouter } from './routes/execution-logs.js';
import trainingDataRouter from './routes/training-data.js';
import { taskPlanningRouter } from './routes/task-planning.js';
import { codeReviewsRouter } from './routes/code-reviews.js';
import { costMetricsRouter } from './routes/cost-metrics.js';
import { memoriesRouter } from './routes/memories.js';
import { budgetRouter } from './routes/budget.js';
import { validationRouter } from './routes/validation.js';
import { battleClawRouter } from './routes/battle-claw.js';
import { missionsRouter } from './routes/missions.js';
import { setupWebSocket } from './websocket/handler.js';
import { budgetService } from './services/budgetService.js';
import { TaskQueueService } from './services/taskQueue.js';
import { HumanEscalationService } from './services/humanEscalation.js';
import { ChatService } from './services/chatService.js';
import { ResourcePoolService } from './services/resourcePool.js';
import { CodeReviewService } from './services/codeReviewService.js';
import { SchedulerService } from './services/schedulerService.js';
import { StuckTaskRecoveryService } from './services/stuckTaskRecovery.js';
import { AsyncValidationService } from './services/asyncValidationService.js';
import { BattleClawService } from './services/battleClawService.js';
import { OrchestratorService } from './services/orchestratorService.js';
import { mcpBridge } from './services/mcpBridge.js';
import { requireApiKey } from './middleware/auth.js';
import { standardRateLimiter } from './middleware/rateLimiter.js';

const app = express();
const httpServer = createServer(app);

// Socket.io setup with CORS restrictions
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.cors.origins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e6,          // 1MB max message size (prevents payload DoS)
  pingTimeout: 20000,
  pingInterval: 25000,
});

// Middleware with CORS restrictions
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting (before auth to prevent auth bypass attempts)
app.use(standardRateLimiter);

// Authentication
app.use(requireApiKey);

// Make io and services available to routes
app.set('io', io);

// Initialize resource pool for parallel task execution
const resourcePool = ResourcePoolService.getInstance();
resourcePool.initialize(io);

// Initialize budget service for cost tracking
budgetService.setSocketIO(io);

// Initialize code review service (auto-reviews completed tasks)
const codeReviewService = new CodeReviewService(prisma, io);
const autoReviewEnabled = process.env.AUTO_CODE_REVIEW !== 'false';
codeReviewService.setEnabled(autoReviewEnabled);
console.log(`Code review service: ${codeReviewService.isEnabled() ? 'enabled' : 'disabled'}`);

// Initialize async validation service (replaces sync auto-retry when enabled)
const asyncValidation = process.env.ASYNC_VALIDATION_ENABLED !== 'false'
  ? new AsyncValidationService(prisma, io)
  : null;
if (asyncValidation) {
  console.log('Async validation service: enabled');
} else {
  console.log('Async validation service: disabled (using sync auto-retry)');
}

const taskQueue = new TaskQueueService(prisma, io, codeReviewService, asyncValidation || undefined);
const humanEscalation = new HumanEscalationService(prisma, io, taskQueue);
const chatService = new ChatService(io);

// Initialize scheduler for periodic tasks (training export)
const scheduler = new SchedulerService(prisma);

// Initialize stuck task recovery service (auto-recovers tasks stuck in_progress)
const stuckTaskRecovery = new StuckTaskRecoveryService(prisma, io);

app.set('taskQueue', taskQueue);
app.set('humanEscalation', humanEscalation);
app.set('chatService', chatService);
app.set('resourcePool', resourcePool);
app.set('codeReviewService', codeReviewService);
app.set('scheduler', scheduler);
app.set('stuckTaskRecovery', stuckTaskRecovery);
if (asyncValidation) {
  app.set('asyncValidation', asyncValidation);
}

// Initialize Battle Claw service (OpenClaw skill integration)
const battleClawService = new BattleClawService(prisma, io);
app.set('battleClawService', battleClawService);
console.log('Battle Claw service: enabled');

// Initialize Orchestrator service (CTO mission-based decomposition & execution)
const orchestratorService = new OrchestratorService(prisma, io);
app.set('orchestratorService', orchestratorService);
chatService.setOrchestratorService(orchestratorService);
console.log('Orchestrator service: enabled');

// Routes
app.use('/api/tasks', tasksRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/queue', queueRouter);
app.use('/api/execute', executeRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/execution-logs', executionLogsRouter);
app.use('/api/training-data', trainingDataRouter);
app.use('/api/task-planning', taskPlanningRouter);
app.use('/api/code-reviews', codeReviewsRouter);
app.use('/api/cost-metrics', costMetricsRouter);
app.use('/api/memories', memoriesRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/validation', validationRouter);
app.use('/api/battle-claw', battleClawRouter);
app.use('/api/missions', missionsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket setup
setupWebSocket(io);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.env === 'development' ? err.message : undefined,
  });
});

// Start server
async function start() {
  try {
    await prisma.$connect();
    console.log('Connected to database');

    // Connect MCP Bridge (Redis pub/sub)
    await mcpBridge.connect();
    const mcpStatus = mcpBridge.getStatus();
    console.log(`MCP Bridge: ${mcpStatus.enabled ? 'enabled' : 'disabled'}, ${mcpStatus.connected ? 'connected' : 'disconnected'}`);

    // Start human escalation checker
    humanEscalation.startChecker();

    // Start scheduler (training data export)
    scheduler.start();

    // Start stuck task recovery checker
    stuckTaskRecovery.start();

    httpServer.listen(config.server.port, config.server.host, () => {
      console.log(`API server running on http://${config.server.host}:${config.server.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  humanEscalation.stopChecker();
  scheduler.stop();
  stuckTaskRecovery.stop();
  await mcpBridge.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});
