import { memo } from 'react';
import type { BattlefieldBuilding, BuildingTier } from '../battlefield/types';
import { HOLO_COLORS } from '../battlefield/types';

interface Props {
  building: BattlefieldBuilding;
  /** Screen position (sx, sy) from worldToScreen */
  sx: number;
  sy: number;
  zIndex: number;
  /** Optional direction the building faces (toward attacker) */
  direction?: 'N' | 'E' | 'S' | 'W';
}

/**
 * Building display sizes per tier.
 * Larger tiers = bigger sprite + more imposing presence.
 */
const TIER_CONFIG: Record<BuildingTier, { size: number }> = {
  hut:      { size: 220 },
  barracks: { size: 260 },
  fortress: { size: 300 },
  citadel:  { size: 340 },
  castle:   { size: 380 },
};

function getDamagePhase(damage: number): string {
  if (damage < 0.25) return 'iso-target--phase-1';
  if (damage < 0.50) return 'iso-target--phase-2';
  if (damage < 0.75) return 'iso-target--phase-3';
  return 'iso-target--phase-4';
}

/** Get building sprite URL — only E (right) and W (left) variants exist */
function getBuildingSprite(dir: string): string {
  const d = dir === 'E' ? 'E' : 'W';
  return `/sprites/building-${d}-attacking.gif`;
}

export const IsometricTarget = memo(function IsometricTarget({
  building,
  sx,
  sy,
  zIndex,
  direction = 'S',
}: Props) {
  const { tier, damage, underSiege, repairing } = building;
  const cfg = TIER_CONFIG[tier];
  const phaseClass = getDamagePhase(damage);
  const spriteUrl = getBuildingSprite(direction);

  // Glow color: damage-dependent
  const glowColor = damage < 0.25 ? HOLO_COLORS.primary
    : damage < 0.50 ? HOLO_COLORS.damage25
    : damage < 0.75 ? HOLO_COLORS.damage25
    : HOLO_COLORS.failure;

  return (
    <div
      className={`absolute ${phaseClass}`}
      style={{
        left: sx - cfg.size / 2,
        top: sy - cfg.size + 10,
        width: cfg.size,
        height: cfg.size,
        zIndex,
        pointerEvents: 'none',
        transition: 'left 3s ease-out, top 3s ease-out',
      }}
    >
      {/* Ground shadow / selection ellipse */}
      <div
        className="absolute"
        style={{
          left: '50%',
          bottom: 0,
          width: cfg.size * 0.85,
          height: cfg.size * 0.22,
          marginLeft: -(cfg.size * 0.85) / 2,
          borderRadius: '50%',
          background: underSiege
            ? `radial-gradient(ellipse, ${glowColor}44, ${glowColor}11, transparent)`
            : `radial-gradient(ellipse, rgba(0,0,0,0.4), transparent)`,
          boxShadow: underSiege ? `0 0 16px ${glowColor}33` : undefined,
        }}
      />

      {/* Main sprite image */}
      <img
        src={spriteUrl}
        alt={building.taskId}
        width={cfg.size}
        height={cfg.size}
        style={{
          imageRendering: 'auto',
          pointerEvents: 'none',
          filter: underSiege
            ? `drop-shadow(0 0 4px ${glowColor}88)`
            : `drop-shadow(0 2px 4px rgba(0,0,0,0.5))`,
        }}
        draggable={false}
      />

      {/* Siege dashed ring */}
      {underSiege && (
        <svg
          className="absolute iso-siege-outline"
          style={{
            left: -8,
            top: -8,
            width: cfg.size + 16,
            height: cfg.size + 16,
          }}
        >
          <ellipse
            cx={(cfg.size + 16) / 2}
            cy={(cfg.size + 16) / 2}
            rx={(cfg.size + 16) / 2 - 2}
            ry={(cfg.size + 16) / 3}
            fill="none"
            stroke="#ffaa00"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
        </svg>
      )}

      {/* Repair shield glow */}
      {repairing && (
        <div
          className="absolute"
          style={{
            inset: -10,
            borderRadius: '50%',
            border: '2px solid #00ff88',
            animation: 'iso-repair-glow 1s ease-in-out infinite',
            background: `radial-gradient(circle, ${HOLO_COLORS.primary}15, transparent 70%)`,
          }}
        />
      )}
    </div>
  );
});
