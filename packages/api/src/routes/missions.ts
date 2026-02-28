/**
 * Missions Routes — CTO Orchestrator REST endpoints
 *
 * POST   /api/missions              — Start mission
 * GET    /api/missions              — List missions
 * GET    /api/missions/:id          — Get mission + subtask status
 * POST   /api/missions/:id/approve  — Approve mission
 * POST   /api/missions/:id/reject   — Reject mission
 * GET    /api/missions/:id/files    — Get all generated files
 * GET    /api/missions/:id/download — Download ZIP bundle
 */

import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../types/index.js';
import { prisma } from '../db/client.js';
import { OrchestratorService } from '../services/orchestratorService.js';
import { generateMissionZip, type ZipMissionMetadata } from '../services/zipService.js';

export const missionsRouter: RouterType = Router();

// ─── POST / — Start a new mission ──────────────────────────────────────────

const startSchema = z.object({
  prompt: z.string().min(3).max(10000),
  language: z.enum(['python', 'javascript', 'typescript', 'go', 'php']).default('python'),
  autoApprove: z.boolean().default(false),
  waitForCompletion: z.boolean().default(false),
  conversationId: z.string().uuid().optional(),
});

missionsRouter.post('/', asyncHandler(async (req, res) => {
  let data;
  try {
    data = startSchema.parse(req.body);
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

  const orchestrator = req.app.get('orchestratorService') as OrchestratorService;
  if (!orchestrator) {
    res.status(503).json({ error: 'Orchestrator service not initialized' });
    return;
  }

  const missionId = await orchestrator.startMission({
    prompt: data.prompt,
    language: data.language,
    autoApprove: data.autoApprove,
    conversationId: data.conversationId,
  });

  // Blocking mode: wait for terminal state then return full result
  if (data.waitForCompletion) {
    try {
      await orchestrator.waitForCompletion(missionId);
    } catch {
      // Timeout — return current state anyway
    }

    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      include: { tasks: { select: { id: true, title: true, status: true, complexity: true } } },
    });

    if (!mission) {
      res.status(404).json({ error: 'Mission not found' });
      return;
    }

    const files = await orchestrator.getMissionFiles(missionId);

    res.json({
      id: mission.id,
      status: mission.status,
      subtaskCount: mission.subtaskCount,
      completedCount: mission.completedCount,
      failedCount: mission.failedCount,
      reviewScore: mission.reviewScore,
      totalCost: Number(mission.totalCost),
      totalTimeMs: mission.totalTimeMs,
      error: mission.error,
      files,
      tasks: mission.tasks,
    });
    return;
  }

  // Non-blocking: return immediately with mission ID
  res.status(202).json({ id: missionId, status: 'decomposing' });
}));

// ─── GET / — List missions ──────────────────────────────────────────────────

missionsRouter.get('/', asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const limit = parseInt(req.query.limit as string || '20', 10);

  const missions = await prisma.mission.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    include: {
      tasks: {
        select: { id: true, title: true, status: true, complexity: true },
      },
    },
  });

  res.json(missions.map((m) => ({
    ...m,
    totalCost: Number(m.totalCost),
  })));
}));

// ─── GET /:id — Get mission detail ──────────────────────────────────────────

missionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const mission = await prisma.mission.findUnique({
    where: { id: req.params.id },
    include: {
      tasks: {
        select: { id: true, title: true, status: true, complexity: true, error: true, timeSpentMs: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!mission) {
    res.status(404).json({ error: 'Mission not found' });
    return;
  }

  res.json({
    ...mission,
    totalCost: Number(mission.totalCost),
  });
}));

// ─── POST /:id/approve — Approve mission ───────────────────────────────────

missionsRouter.post('/:id/approve', asyncHandler(async (req, res) => {
  const orchestrator = req.app.get('orchestratorService') as OrchestratorService;
  if (!orchestrator) {
    res.status(503).json({ error: 'Orchestrator service not initialized' });
    return;
  }

  const mission = await prisma.mission.findUnique({ where: { id: req.params.id } });
  if (!mission) {
    res.status(404).json({ error: 'Mission not found' });
    return;
  }
  if (mission.status !== 'awaiting_approval') {
    res.status(400).json({ error: `Cannot approve mission in status: ${mission.status}` });
    return;
  }

  await orchestrator.approveMission(mission.id);
  res.json({ id: mission.id, status: 'approved' });
}));

// ─── POST /:id/reject — Reject mission ─────────────────────────────────────

missionsRouter.post('/:id/reject', asyncHandler(async (req, res) => {
  const orchestrator = req.app.get('orchestratorService') as OrchestratorService;
  if (!orchestrator) {
    res.status(503).json({ error: 'Orchestrator service not initialized' });
    return;
  }

  const mission = await prisma.mission.findUnique({ where: { id: req.params.id } });
  if (!mission) {
    res.status(404).json({ error: 'Mission not found' });
    return;
  }
  if (mission.status !== 'awaiting_approval') {
    res.status(400).json({ error: `Cannot reject mission in status: ${mission.status}` });
    return;
  }

  const reason = req.body?.reason as string | undefined;
  await orchestrator.rejectMission(mission.id, reason);
  res.json({ id: mission.id, status: 'failed' });
}));

// ─── GET /:id/files — Get generated files ──────────────────────────────────

missionsRouter.get('/:id/files', asyncHandler(async (req, res) => {
  const orchestrator = req.app.get('orchestratorService') as OrchestratorService;
  if (!orchestrator) {
    res.status(503).json({ error: 'Orchestrator service not initialized' });
    return;
  }

  const mission = await prisma.mission.findUnique({ where: { id: req.params.id } });
  if (!mission) {
    res.status(404).json({ error: 'Mission not found' });
    return;
  }

  const files = await orchestrator.getMissionFiles(mission.id);
  res.json(files);
}));

// ─── GET /:id/download — Download ZIP bundle ───────────────────────────────

missionsRouter.get('/:id/download', asyncHandler(async (req, res) => {
  const orchestrator = req.app.get('orchestratorService') as OrchestratorService;
  if (!orchestrator) {
    res.status(503).json({ error: 'Orchestrator service not initialized' });
    return;
  }

  const mission = await prisma.mission.findUnique({
    where: { id: req.params.id },
    include: {
      tasks: {
        select: { id: true, title: true, status: true, complexity: true, lockedFiles: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!mission) {
    res.status(404).json({ error: 'Mission not found' });
    return;
  }

  if (!['approved', 'awaiting_approval'].includes(mission.status)) {
    res.status(400).json({ error: `Cannot download mission in status: ${mission.status}` });
    return;
  }

  const files = await orchestrator.getMissionFiles(mission.id);
  if (Object.keys(files).length === 0) {
    res.status(404).json({ error: 'No files generated for this mission' });
    return;
  }

  // Build task status map (file_name → status) from plan + tasks
  const taskStatuses: Record<string, string> = {};
  const plan = mission.plan as Array<{ title: string; file_name: string; complexity: number }> | null;
  if (plan) {
    for (const subtask of plan) {
      const fileName = subtask.file_name?.split('/').pop() || subtask.file_name;
      // Match plan entry to task by title
      const matchingTask = mission.tasks.find((t) => t.title === subtask.title);
      taskStatuses[fileName] = matchingTask?.status || 'unknown';
    }
  }

  const metadata: ZipMissionMetadata = {
    missionId: mission.id,
    prompt: mission.prompt,
    language: mission.language,
    reviewScore: mission.reviewScore,
    totalCost: Number(mission.totalCost),
    totalTimeMs: mission.totalTimeMs || 0,
    subtaskCount: mission.subtaskCount,
    completedCount: mission.completedCount,
    failedCount: mission.failedCount,
    plan,
    taskStatuses,
  };

  const zipBuffer = await generateMissionZip(files, metadata);

  // Generate filename from prompt: "Create a landing page" → "mission-create-a-landing-page.zip"
  const slug = mission.prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('-');
  const zipFilename = `mission-${slug || mission.id.slice(0, 8)}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
  res.setHeader('Content-Length', zipBuffer.length);
  res.send(zipBuffer);
}));
