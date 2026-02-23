import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';
import { aggregateCosts, calculateTotalCost, formatCost } from '../services/costCalculator.js';

export const costMetricsRouter: RouterType = Router();

/**
 * GET /api/cost-metrics/summary
 * Get overall cost summary with breakdown by model tier
 */
costMetricsRouter.get('/summary', asyncHandler(async (req, res) => {
  // Get all execution logs
  const logs = await prisma.executionLog.findMany({
    orderBy: { timestamp: 'desc' },
  });

  const summary = aggregateCosts(logs);

  res.json({
    totalCost: summary.totalCost,
    totalCostFormatted: formatCost(summary.totalCost),
    byModelTier: {
      free: summary.byModelTier.free,
      remote: summary.byModelTier.remote,
      haiku: summary.byModelTier.haiku,
      sonnet: summary.byModelTier.sonnet,
      opus: summary.byModelTier.opus,
    },
    byModel: summary.byModel,
    totalTokens: {
      input: summary.totalInputTokens,
      output: summary.totalOutputTokens,
      total: summary.totalInputTokens + summary.totalOutputTokens,
    },
    logCount: summary.logCount,
  });
}));

/**
 * GET /api/cost-metrics/by-agent
 * Get cost breakdown per agent
 */
costMetricsRouter.get('/by-agent', asyncHandler(async (req, res) => {
  // Get all execution logs grouped by agent
  const logs = await prisma.executionLog.findMany({
    include: {
      agent: {
        include: {
          agentType: true,
        },
      },
    },
    orderBy: { timestamp: 'desc' },
  });

  // Group logs by agent
  const byAgent: Record<string, {
    agentId: string;
    agentName: string;
    agentType: string;
    totalCost: number;
    inputTokens: number;
    outputTokens: number;
    logCount: number;
  }> = {};

  for (const log of logs) {
    const agentId = log.agentId;

    if (!byAgent[agentId]) {
      byAgent[agentId] = {
        agentId: log.agent.id,
        agentName: log.agent.name,
        agentType: log.agent.agentType.name,
        totalCost: 0,
        inputTokens: 0,
        outputTokens: 0,
        logCount: 0,
      };
    }

    const agentLogs = logs.filter(l => l.agentId === agentId);
    const agentSummary = aggregateCosts(agentLogs);

    byAgent[agentId] = {
      ...byAgent[agentId],
      totalCost: agentSummary.totalCost,
      inputTokens: agentSummary.totalInputTokens,
      outputTokens: agentSummary.totalOutputTokens,
      logCount: agentSummary.logCount,
    };
  }

  // Convert to array and sort by cost
  const agents = Object.values(byAgent).sort((a, b) => b.totalCost - a.totalCost);

  res.json({
    agents,
    totalAgents: agents.length,
  });
}));

/**
 * GET /api/cost-metrics/by-task-type
 * Get cost breakdown per task type
 */
costMetricsRouter.get('/by-task-type', asyncHandler(async (req, res) => {
  // Get all execution logs with task information
  const logs = await prisma.executionLog.findMany({
    include: {
      task: true,
    },
    orderBy: { timestamp: 'desc' },
  });

  // Group logs by task type
  const byTaskType: Record<string, {
    taskType: string;
    totalCost: number;
    inputTokens: number;
    outputTokens: number;
    taskCount: number;
    logCount: number;
  }> = {};

  // Track unique tasks per type
  const tasksByType: Record<string, Set<string>> = {};

  for (const log of logs) {
    const taskType = log.task.taskType;

    if (!byTaskType[taskType]) {
      byTaskType[taskType] = {
        taskType,
        totalCost: 0,
        inputTokens: 0,
        outputTokens: 0,
        taskCount: 0,
        logCount: 0,
      };
      tasksByType[taskType] = new Set();
    }

    // Track unique task
    tasksByType[taskType].add(log.taskId);
  }

  // Calculate costs per task type
  for (const taskType of Object.keys(byTaskType)) {
    const typeLogs = logs.filter(l => l.task.taskType === taskType);
    const summary = aggregateCosts(typeLogs);

    byTaskType[taskType].totalCost = summary.totalCost;
    byTaskType[taskType].inputTokens = summary.totalInputTokens;
    byTaskType[taskType].outputTokens = summary.totalOutputTokens;
    byTaskType[taskType].logCount = summary.logCount;
    byTaskType[taskType].taskCount = tasksByType[taskType].size;
  }

  // Convert to array and sort by cost
  const taskTypes = Object.values(byTaskType).sort((a, b) => b.totalCost - a.totalCost);

  res.json({
    taskTypes,
    totalTypes: taskTypes.length,
  });
}));

const timelineQuerySchema = z.object({
  hours: z.coerce.number().min(1).max(168).default(24),
});

/**
 * GET /api/cost-metrics/timeline?hours=24
 * Get hourly cost breakdown over a time period
 */
costMetricsRouter.get('/timeline', asyncHandler(async (req, res) => {
  const { hours } = timelineQuerySchema.parse(req.query);

  // Get logs from the specified time period
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

  const logs = await prisma.executionLog.findMany({
    where: {
      timestamp: {
        gte: cutoffTime,
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  // Group logs by hour
  const hourlyData: Record<string, {
    hour: string;
    timestamp: Date;
    totalCost: number;
    inputTokens: number;
    outputTokens: number;
    logCount: number;
    byModelTier: {
      free: number;
      remote: number;
      haiku: number;
      sonnet: number;
      opus: number;
    };
  }> = {};

  for (const log of logs) {
    // Round timestamp down to the hour
    const hourTimestamp = new Date(log.timestamp);
    hourTimestamp.setMinutes(0, 0, 0);
    const hourKey = hourTimestamp.toISOString();

    if (!hourlyData[hourKey]) {
      hourlyData[hourKey] = {
        hour: hourKey,
        timestamp: hourTimestamp,
        totalCost: 0,
        inputTokens: 0,
        outputTokens: 0,
        logCount: 0,
        byModelTier: {
          free: 0,
          remote: 0,
          haiku: 0,
          sonnet: 0,
          opus: 0,
        },
      };
    }
  }

  // Calculate costs per hour
  for (const hourKey of Object.keys(hourlyData)) {
    const hourLogs = logs.filter(l => {
      const logHour = new Date(l.timestamp);
      logHour.setMinutes(0, 0, 0);
      return logHour.toISOString() === hourKey;
    });

    const summary = aggregateCosts(hourLogs);

    hourlyData[hourKey].totalCost = summary.totalCost;
    hourlyData[hourKey].inputTokens = summary.totalInputTokens;
    hourlyData[hourKey].outputTokens = summary.totalOutputTokens;
    hourlyData[hourKey].logCount = summary.logCount;
    hourlyData[hourKey].byModelTier = summary.byModelTier;
  }

  // Convert to array and sort by timestamp
  const timeline = Object.values(hourlyData).sort((a, b) =>
    a.timestamp.getTime() - b.timestamp.getTime()
  );

  res.json({
    timeline,
    hours,
    startTime: cutoffTime,
    endTime: new Date(),
    totalCost: timeline.reduce((sum, h) => sum + h.totalCost, 0),
  });
}));
