import { useMemo, useRef } from 'react';
import { useUIStore } from '../store/uiState';
import { GRID_RANGE } from '../components/isometric/isoProjection';
import {
  getBuildingTier,
  getAgentTier,
  BUILDING_TIERS,
  type BattlefieldBuilding,
  type BattlefieldSquad,
} from '../components/battlefield/types';

const REPAIR_DURATION_MS = 1500;

/**
 * Derives 3D battlefield state from Zustand store.
 * Bridges the flat task/agent data to positioned 3D scene objects.
 */
export function useBattlefieldState() {
  const tasks = useUIStore((s) => s.tasks);
  const agents = useUIStore((s) => s.agents);

  // Track previous iteration counts to detect decreases (repair)
  const prevIterationsRef = useRef<Map<string, number>>(new Map());
  // Track active repair states
  const repairStateRef = useRef<Map<string, { fromDamage: number; startTime: number }>>(new Map());

  const hasActiveTasks = useMemo(
    () => tasks.some((t) => t.status === 'in_progress' || t.status === 'assigned'),
    [tasks],
  );

  const hasOllamaInProgress = useMemo(
    () =>
      tasks.some((t) => {
        if (t.status !== 'in_progress') return false;
        const agent = agents.find((a) => a.id === t.assignedAgentId);
        return agent?.type === 'coder';
      }),
    [tasks, agents],
  );

  // Only show ONE active task at a time (assigned or in_progress)
  const visibleTasks = useMemo(() => {
    const active = tasks.filter((t) => ['assigned', 'in_progress'].includes(t.status));
    return active.length > 0 ? [active[0]] : [];
  }, [tasks]);

  // Recently completed/failed tasks (for destruction animations) - last 10 seconds
  const recentlyFinished = useMemo(() => {
    const tenSecondsAgo = Date.now() - 10_000;
    return tasks.filter((t) => {
      if (!['completed', 'failed'].includes(t.status)) return false;
      const completedTime = t.completedAt ? new Date(t.completedAt).getTime() : 0;
      return completedTime > tenSecondsAgo;
    });
  }, [tasks]);

  // Build positioned building data
  const buildings: BattlefieldBuilding[] = useMemo(() => {
    const existingPositions: [number, number][] = [];
    const allTasks = [...visibleTasks];
    const now = Date.now();
    const prevIter = prevIterationsRef.current;
    const repairState = repairStateRef.current;

    // Clean up expired repair states
    for (const [taskId, state] of repairState) {
      if (now - state.startTime > REPAIR_DURATION_MS) {
        repairState.delete(taskId);
      }
    }

    const result = allTasks.map((task) => {
      const complexity = (task as any).complexity ?? task.priority ?? 5;
      const tier = getBuildingTier(complexity);
      const tierConfig = BUILDING_TIERS[tier];

      // Only 1 task on screen — place building dead center
      const x = 0;
      const z = 0;
      existingPositions.push([x, z]);

      const assignedAgent = task.assignedAgentId
        ? agents.find((a) => a.id === task.assignedAgentId) ?? null
        : null;

      const maxIter = task.maxIterations || 10;
      const currentIter = task.currentIteration || 0;
      const damage = task.status === 'in_progress' ? Math.min(currentIter / maxIter, 1) : 0;

      // Detect iteration decrease → trigger repair
      const prevIterCount = prevIter.get(task.id) ?? 0;
      if (currentIter < prevIterCount && task.status === 'in_progress') {
        const prevDamage = Math.min(prevIterCount / maxIter, 1);
        repairState.set(task.id, { fromDamage: prevDamage, startTime: now });
      }
      prevIter.set(task.id, currentIter);

      // Check if currently repairing
      const activeRepair = repairState.get(task.id);
      const repairing = !!activeRepair && (now - activeRepair.startTime < REPAIR_DURATION_MS);

      return {
        taskId: task.id,
        task,
        tier,
        scale: tierConfig.scale,
        position: [x, 0, z] as [number, number, number],
        damage,
        underSiege: task.status === 'in_progress',
        assignedAgent,
        repairing,
        repairFromDamage: activeRepair?.fromDamage ?? 0,
        repairStartTime: activeRepair?.startTime ?? 0,
      };
    });

    return result;
  }, [visibleTasks, recentlyFinished, agents]);

  // Build squad data for agents with assigned tasks
  const squads: BattlefieldSquad[] = useMemo(() => {
    return buildings
      .filter((b) => b.assignedAgent && ['assigned', 'in_progress'].includes(b.task.status))
      .map((b) => {
        const agent = b.assignedAgent!;
        const tier = getAgentTier(agent);

        // Agent fades in offset from building — no scrolling
        const offsetDist = 5; // world units (~350px screen distance)
        // Pick a direction based on TASK id hash (varies per task, not per agent)
        let hash = 0;
        for (let i = 0; i < b.taskId.length; i++) {
          hash = ((hash << 5) - hash) + b.taskId.charCodeAt(i);
          hash |= 0;
        }
        const angle = (Math.abs(hash) % 8) * (Math.PI / 4) + Math.PI / 8; // 8 directions for variety
        const rawX = b.position[0] + Math.cos(angle) * offsetDist;
        const rawZ = b.position[2] + Math.sin(angle) * offsetDist;
        // Clamp to grid bounds so agent stays within background area
        const targetX = Math.max(-GRID_RANGE + 1, Math.min(GRID_RANGE - 1, rawX));
        const targetZ = Math.max(-GRID_RANGE + 1, Math.min(GRID_RANGE - 1, rawZ));

        return {
          agentId: agent.id,
          agent,
          tier,
          targetTaskId: b.taskId,
          position: [b.position[0], 0, b.position[2]] as [number, number, number],
          targetPosition: [targetX, 0, targetZ] as [number, number, number],
          moveProgress: b.task.status === 'in_progress' ? 1 : 0,
          firing: b.task.status === 'in_progress',
        };
      });
  }, [buildings]);

  return {
    hasActiveTasks,
    hasOllamaInProgress,
    buildings,
    squads,
    visibleTasks,
    recentlyFinished,
  };
}
