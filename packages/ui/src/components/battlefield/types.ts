import type { Task, Agent } from '@abcc/shared';

/** Complexity-based building tier */
export type BuildingTier = 'hut' | 'barracks' | 'fortress' | 'citadel' | 'castle';

/** Agent tier determines glow color */
export type AgentTier = 'coder' | 'qa' | 'cto';

/** Building state in the 3D scene */
export interface BattlefieldBuilding {
  taskId: string;
  task: Task;
  tier: BuildingTier;
  scale: number;
  position: [number, number, number];
  /** 0-1 damage progress based on iteration progress */
  damage: number;
  /** Whether this building is under active siege */
  underSiege: boolean;
  /** Assigned agent info */
  assignedAgent: Agent | null;
}

/** Squad state for an agent working on a task */
export interface BattlefieldSquad {
  agentId: string;
  agent: Agent;
  tier: AgentTier;
  targetTaskId: string;
  /** Current position (lerped toward target) */
  position: [number, number, number];
  /** Target position (near the building) */
  targetPosition: [number, number, number];
  /** 0-1 movement progress */
  moveProgress: number;
  /** Whether actively firing */
  firing: boolean;
}

/** GPU throttle context value */
export interface GpuThrottleState {
  /** True when Ollama is actively inferring */
  throttled: boolean;
}

/** Colors for the holographic theme */
export const HOLO_COLORS = {
  primary: '#00ff88',
  primaryDim: '#00ff8833',
  grid: '#00ff8822',
  coder: '#3B82F6',
  qa: '#10B981',
  cto: '#aa55ff',
  damage25: '#ffaa00',
  damage75: '#ff4444',
  success: '#00ff88',
  failure: '#ff2222',
} as const;

/** Building tier configuration */
export const BUILDING_TIERS: Record<BuildingTier, { minComplexity: number; maxComplexity: number; scale: number }> = {
  hut:      { minComplexity: 1, maxComplexity: 2, scale: 1.0 },
  barracks: { minComplexity: 3, maxComplexity: 4, scale: 1.5 },
  fortress: { minComplexity: 5, maxComplexity: 6, scale: 2.0 },
  citadel:  { minComplexity: 7, maxComplexity: 8, scale: 3.0 },
  castle:   { minComplexity: 9, maxComplexity: 10, scale: 4.0 },
};

/** Get building tier from complexity score */
export function getBuildingTier(complexity: number): BuildingTier {
  if (complexity <= 2) return 'hut';
  if (complexity <= 4) return 'barracks';
  if (complexity <= 6) return 'fortress';
  if (complexity <= 8) return 'citadel';
  return 'castle';
}

/** Get agent tier from agent type */
export function getAgentTier(agent: Agent): AgentTier {
  if (agent.type === 'coder') return 'coder';
  // QA agents handle both qa and cto roles based on their id
  if (agent.id.startsWith('cto')) return 'cto';
  return 'qa';
}

/** Get glow color for agent tier */
export function getAgentColor(tier: AgentTier): string {
  return HOLO_COLORS[tier];
}

/** Deterministic hash for positioning - converts task ID to grid coords */
export function hashTaskPosition(taskId: string, gridSize: number, minSpacing: number, existingPositions: [number, number][]): [number, number] {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    const char = taskId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }

  const halfGrid = gridSize / 2 - 2; // Keep away from edges
  let x = ((Math.abs(hash) % (halfGrid * 2 * 10)) / 10) - halfGrid;
  let z = ((Math.abs(hash * 31) % (halfGrid * 2 * 10)) / 10) - halfGrid;

  // Enforce minimum spacing from existing buildings
  for (let attempt = 0; attempt < 20; attempt++) {
    let tooClose = false;
    for (const [ex, ez] of existingPositions) {
      const dist = Math.sqrt((x - ex) ** 2 + (z - ez) ** 2);
      if (dist < minSpacing) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) break;
    // Nudge position
    x += (attempt % 2 === 0 ? 1 : -1) * minSpacing * 0.7;
    z += (attempt % 3 === 0 ? 1 : -1) * minSpacing * 0.5;
    // Clamp to grid
    x = Math.max(-halfGrid, Math.min(halfGrid, x));
    z = Math.max(-halfGrid, Math.min(halfGrid, z));
  }

  return [x, z];
}
