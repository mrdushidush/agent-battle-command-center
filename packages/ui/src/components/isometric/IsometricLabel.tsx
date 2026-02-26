import { memo } from 'react';
import type { BuildingTier, AgentTier } from '../battlefield/types';
import { HOLO_COLORS } from '../battlefield/types';

interface TargetLabelProps {
  kind: 'target';
  tier: BuildingTier;
  title: string;
  complexity: number;
  underSiege: boolean;
  sx: number;
  sy: number;
  zIndex: number;
}

interface TankLabelProps {
  kind: 'tank';
  tier: AgentTier;
  agentId: string;
  firing: boolean;
  sx: number;
  sy: number;
  zIndex: number;
}

type Props = TargetLabelProps | TankLabelProps;

const TIER_COLORS: Record<BuildingTier, string> = {
  hut: '#6b7280',
  barracks: '#3b82f6',
  fortress: '#10b981',
  citadel: '#f59e0b',
  castle: '#ef4444',
};

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
}

/**
 * Labels rendered as plain positioned divs in screen space.
 * No counter-rotation needed — math-based projection keeps everything flat.
 */
export const IsometricLabel = memo(function IsometricLabel(props: Props) {
  if (props.kind === 'target') {
    const { tier, title, complexity, underSiege, sx, sy, zIndex } = props;
    const badgeColor = TIER_COLORS[tier];

    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: sx,
          top: sy,
          zIndex,
          transform: 'translate(-50%, -100%)',
        }}
      >
        <div
          className="flex flex-col items-center gap-0.5 whitespace-nowrap px-2 py-1 rounded"
          style={{ backgroundColor: 'rgba(10, 14, 20, 0.8)', backdropFilter: 'blur(2px)' }}
        >
          {/* Complexity badge */}
          <span
            className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: badgeColor + '44',
              color: badgeColor,
              border: `1px solid ${badgeColor}88`,
            }}
          >
            C{complexity}
          </span>

          {/* Title */}
          <span
            className="font-mono text-[11px] text-gray-300 font-medium"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
          >
            {truncate(title, 22)}
          </span>

          {/* Siege status */}
          {underSiege && (
            <span
              className="font-mono text-[10px] font-bold uppercase tracking-wider"
              style={{
                color: HOLO_COLORS.damage25,
                animation: 'iso-label-pulse 1s ease-in-out infinite',
                textShadow: `0 0 6px ${HOLO_COLORS.damage25}`,
              }}
            >
              UNDER SIEGE
            </span>
          )}
        </div>
      </div>
    );
  }

  // Tank label
  const { tier, agentId, firing, sx, sy, zIndex } = props;
  const color = HOLO_COLORS[tier];

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: sx,
        top: sy,
        zIndex,
        transform: 'translate(-50%, 4px)',
      }}
    >
      <div
        className="flex flex-col items-center gap-0.5 whitespace-nowrap px-2 py-1 rounded"
        style={{ backgroundColor: 'rgba(10, 14, 20, 0.8)', backdropFilter: 'blur(2px)' }}
      >
        <span
          className="font-mono text-[12px] font-bold"
          style={{ color, textShadow: `0 0 6px ${color}88` }}
        >
          {agentId}
        </span>
        {firing && (
          <span
            className="font-mono text-[10px] font-bold uppercase tracking-wider"
            style={{
              color: HOLO_COLORS.primary,
              animation: 'iso-label-pulse 0.8s ease-in-out infinite',
              textShadow: `0 0 6px ${HOLO_COLORS.primary}`,
            }}
          >
            ENGAGING
          </span>
        )}
      </div>
    </div>
  );
});
