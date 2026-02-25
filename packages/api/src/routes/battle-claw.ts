/**
 * Battle Claw Routes — OpenClaw skill integration endpoint
 *
 * Provides a single "send description, get code back" API for external consumers.
 * Wraps the full ABCC task lifecycle into one blocking HTTP call.
 *
 * Endpoints:
 *   POST /api/battle-claw/execute  — Execute a coding task end-to-end
 *   GET  /api/battle-claw/health   — Quick health + Ollama status
 *   GET  /api/battle-claw/stats    — Cumulative task stats & savings
 */

import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../types/index.js';
import { BattleClawService } from '../services/battleClawService.js';
import { ExecutorService } from '../services/executor.js';

export const battleClawRouter: RouterType = Router();

// ─── POST /execute ───────────────────────────────────────────────────────────

const executeSchema = z.object({
  description: z.string().min(3).max(5000),
  language: z.enum(['python', 'javascript', 'typescript', 'go', 'php']).default('python'),
  fileName: z.string().max(200).optional(),
  validationCommand: z.string().max(2000).optional(),
  maxTimeoutMs: z.number().min(5000).max(300000).optional(),
});

battleClawRouter.post('/execute', asyncHandler(async (req, res) => {
  let data;
  try {
    data = executeSchema.parse(req.body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request parameters',
        details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
      return;
    }
    throw err;
  }

  const service = req.app.get('battleClawService') as BattleClawService;
  if (!service) {
    res.status(503).json({ error: 'Battle Claw service not initialized' });
    return;
  }

  const result = await service.executeTask(data);

  res.json(result);
}));

// ─── GET /health ─────────────────────────────────────────────────────────────

battleClawRouter.get('/health', asyncHandler(async (req, res) => {
  const executor = new ExecutorService();
  const health = await executor.healthCheck();

  res.json({
    status: health.status === 'ok' ? 'ready' : 'degraded',
    ollama: health.ollama,
    claude: health.claude,
    remoteOllama: health.remote_ollama ?? false,
    version: '1.0.0',
    capabilities: {
      languages: ['python', 'javascript', 'typescript', 'go', 'php'],
      maxComplexity: 10,
      autoRetry: process.env.AUTO_RETRY_ENABLED !== 'false',
      asyncValidation: process.env.ASYNC_VALIDATION_ENABLED !== 'false',
    },
  });
}));

// ─── GET /stats ──────────────────────────────────────────────────────────────

battleClawRouter.get('/stats', asyncHandler(async (req, res) => {
  const service = req.app.get('battleClawService') as BattleClawService;
  if (!service) {
    res.status(503).json({ error: 'Battle Claw service not initialized' });
    return;
  }

  const stats = await service.getStats();
  res.json(stats);
}));
