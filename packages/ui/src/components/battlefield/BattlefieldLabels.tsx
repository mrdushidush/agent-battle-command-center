import { Html } from '@react-three/drei';
import { HOLO_COLORS, getAgentColor, type BattlefieldBuilding, type BattlefieldSquad } from './types';

interface BuildingLabelProps {
  building: BattlefieldBuilding;
}

interface SquadLabelProps {
  squad: BattlefieldSquad;
}

/** Floating HTML label above a building showing task title + complexity */
export function BuildingLabel({ building }: BuildingLabelProps) {
  const complexity = (building.task as any).complexity ?? building.task.priority ?? 5;
  const labelY = building.scale * 3 + 1;

  return (
    <group position={[building.position[0], labelY, building.position[2]]}>
      <Html
        center
        distanceFactor={15}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="flex flex-col items-center gap-0.5 whitespace-nowrap">
          {/* Complexity badge */}
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
            style={{
              backgroundColor: `${getBadgeColor(complexity)}22`,
              color: getBadgeColor(complexity),
              border: `1px solid ${getBadgeColor(complexity)}44`,
            }}
          >
            C{complexity}
          </span>
          {/* Task title */}
          <span
            className="text-[11px] font-mono max-w-[120px] truncate"
            style={{ color: HOLO_COLORS.primary, textShadow: `0 0 4px ${HOLO_COLORS.primary}` }}
          >
            {building.task.title.length > 20
              ? building.task.title.slice(0, 20) + '...'
              : building.task.title}
          </span>
          {/* Status indicator */}
          {building.underSiege && (
            <span className="text-[9px] font-mono animate-pulse" style={{ color: '#ffaa00' }}>
              UNDER SIEGE
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}

/** Floating HTML label above a squad showing agent name */
export function SquadLabel({ squad }: SquadLabelProps) {
  const color = getAgentColor(squad.tier);

  return (
    <group position={[squad.targetPosition[0], 1.5, squad.targetPosition[2]]}>
      <Html
        center
        distanceFactor={15}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="flex flex-col items-center whitespace-nowrap">
          <span
            className="text-[10px] font-mono font-bold uppercase"
            style={{ color, textShadow: `0 0 4px ${color}` }}
          >
            {squad.agent.name || squad.agentId}
          </span>
          {squad.firing && (
            <span className="text-[9px] font-mono animate-pulse" style={{ color }}>
              ENGAGING
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}

function getBadgeColor(complexity: number): string {
  if (complexity <= 4) return HOLO_COLORS.primary;
  if (complexity <= 6) return HOLO_COLORS.damage25;
  if (complexity <= 8) return '#ff8800';
  return HOLO_COLORS.damage75;
}
