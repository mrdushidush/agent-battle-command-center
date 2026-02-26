import { memo, useMemo } from 'react';
import type { BattlefieldSquad, AgentTier } from '../battlefield/types';
import { HOLO_COLORS } from '../battlefield/types';
import {
  worldToScreen,
  isoZIndex,
  Z_LAYER,
} from './isoProjection';

const SPRITE_SIZE = 280; // display size in px

interface Props {
  squad: BattlefieldSquad;
  originX: number;
  originY: number;
}

const AGENT_COLORS: Record<AgentTier, string> = {
  coder: HOLO_COLORS.coder,
  qa: HOLO_COLORS.qa,
  cto: HOLO_COLORS.cto,
};

/** Map agent tier to sprite prefix */
const SPRITE_PREFIX: Record<AgentTier, string> = {
  coder: 'coder',
  qa: 'qa',
  cto: 'cto',
};

type Direction = 'N' | 'E' | 'S' | 'W';

/** Pick cardinal direction based on screen-space vector from agent to building */
function getDirection(dx: number, dy: number): Direction {
  if (Math.abs(dx) === 0 && Math.abs(dy) === 0) return 'S';
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle >= -45 && angle < 45) return 'E';
  if (angle >= 45 && angle < 135) return 'S';
  if (angle >= -135 && angle < -45) return 'N';
  return 'W';
}

/** Get sprite URL for agent state */
function getSpriteUrl(tier: AgentTier, direction: Direction, firing: boolean, selected: boolean): string {
  const prefix = SPRITE_PREFIX[tier];
  if (tier === 'coder') {
    // Coder GIFs: only E (right) and W (left) variants exist, single animated state
    const d = direction === 'E' ? 'E' : 'W';
    return `/sprites/${prefix}-${d}-attacking.gif`;
  }
  const state = firing ? 'attacking' : selected ? 'selected' : 'idle';
  return `/sprites/${prefix}-${direction}-${state}.png`;
}

export const IsometricTank = memo(function IsometricTank({ squad, originX, originY }: Props) {
  const color = AGENT_COLORS[squad.tier];

  const screen = useMemo(
    () => worldToScreen(squad.targetPosition[0], squad.targetPosition[2], originX, originY),
    [squad.targetPosition[0], squad.targetPosition[2], originX, originY],
  );

  // Direction: face toward the building (position = building, targetPosition = agent offset)
  const direction = useMemo(() => {
    const buildingScreen = worldToScreen(squad.position[0], squad.position[2], originX, originY);
    const dx = buildingScreen.sx - screen.sx;
    const dy = buildingScreen.sy - screen.sy;
    return getDirection(dx, dy);
  }, [squad.position[0], squad.position[2], screen.sx, screen.sy, originX, originY]);

  const spriteUrl = getSpriteUrl(squad.tier, direction, squad.firing, !squad.firing);

  const zIndex = isoZIndex(squad.targetPosition[0], squad.targetPosition[2], Z_LAYER.agent);

  return (
    <div
      className="absolute"
      style={{
        left: screen.sx - SPRITE_SIZE / 2,
        top: screen.sy - SPRITE_SIZE + 10,
        width: SPRITE_SIZE,
        height: SPRITE_SIZE,
        zIndex,
        // Slow fade in
        animation: 'iso-fade-in 3s ease-out forwards',
      }}
    >
      {/* Selection ring glow (ellipse under the sprite) */}
      <div
        className="absolute"
        style={{
          left: '50%',
          bottom: 4,
          width: SPRITE_SIZE * 0.8,
          height: SPRITE_SIZE * 0.25,
          marginLeft: -(SPRITE_SIZE * 0.8) / 2,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${color}55, ${color}22, transparent)`,
          boxShadow: `0 0 12px ${color}44`,
          animation: squad.firing ? 'iso-hex-glow 1s ease-in-out infinite' : undefined,
        }}
      />

      {/* Sprite image */}
      <img
        src={spriteUrl}
        alt={squad.agentId}
        width={SPRITE_SIZE}
        height={SPRITE_SIZE}
        style={{
          imageRendering: 'auto',
          pointerEvents: 'none',
          filter: squad.firing ? `drop-shadow(0 0 6px ${color})` : undefined,
          // Skip idle bob for coder (animated GIF handles it)
          animation: squad.tier === 'coder' ? undefined : squad.firing ? undefined : 'iso-tank-idle 2s ease-in-out infinite',
        }}
        draggable={false}
      />
    </div>
  );
});
