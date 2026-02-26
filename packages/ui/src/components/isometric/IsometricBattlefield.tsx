import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useBattlefieldState } from '../../hooks/useBattlefieldState';
import { getAgentColor } from '../battlefield/types';
import { IsometricGrid } from './IsometricGrid';
import { IsometricTarget } from './IsometricTarget';
import { IsometricTank } from './IsometricTank';
import { IsometricLabel } from './IsometricLabel';
import { IsometricProjectile } from './IsometricProjectile';
import { IsometricExplosion } from './IsometricExplosion';
import {
  worldToScreen,
  isoZIndex,
  Z_LAYER,
  getDiamondDimensions,
  GRID_RANGE,
  TILE_HW,
  TILE_HH,
} from './isoProjection';
import './isometric.css';

const MAX_PROJECTILES = 20;
const PROJECTILE_INTERVAL = 500;

interface ProjectileState {
  id: string;
  fromSx: number;
  fromSy: number;
  toSx: number;
  toSy: number;
  color: string;
}

interface ExplosionState {
  id: string;
  sx: number;
  sy: number;
  success: boolean;
}

let projectileIdCounter = 0;

export function IsometricBattlefield() {
  const { buildings, squads, recentlyFinished } = useBattlefieldState();
  const [projectiles, setProjectiles] = useState<ProjectileState[]>([]);
  const [explosions, setExplosions] = useState<ExplosionState[]>([]);
  const projectileTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const seenFinishedRef = useRef<Set<string>>(new Set());
  const seenTasksRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [scale, setScale] = useState(1);

  // Responsive sizing via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ w: width, h: height });

        const { diamondW, diamondH } = getDiamondDimensions();
        // Fit diamond + generous padding for bottom-anchored sprites
        const padW = diamondW + 400;
        const padH = diamondH + 500;
        const fitScale = Math.min(width / padW, height / padH, 1.2);
        setScale(Math.max(fitScale, 0.25));
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Origin: center of the canvas (before scaling)
  const canvasW = containerSize.w / scale;
  const canvasH = containerSize.h / scale;
  const originX = canvasW / 2;
  const originY = canvasH / 2;

  // Spawn projectiles for firing squads
  useEffect(() => {
    projectileTimerRef.current = setInterval(() => {
      setProjectiles((prev) => {
        if (prev.length >= MAX_PROJECTILES) return prev;

        const newProjectiles: ProjectileState[] = [];
        for (const squad of squads) {
          if (!squad.firing) continue;

          const building = buildings.find((b) => b.taskId === squad.targetTaskId);
          if (!building) continue;

          const tankPos = worldToScreen(
            squad.targetPosition[0],
            squad.targetPosition[2],
            originX,
            originY,
          );
          const buildingPos = worldToScreen(
            building.position[0],
            building.position[2],
            originX,
            originY,
          );
          const color = getAgentColor(squad.tier);

          newProjectiles.push({
            id: `proj-${++projectileIdCounter}`,
            fromSx: tankPos.sx,
            fromSy: tankPos.sy,
            toSx: buildingPos.sx,
            toSy: buildingPos.sy,
            color,
          });
        }

        if (newProjectiles.length === 0) return prev;
        return [...prev, ...newProjectiles].slice(-MAX_PROJECTILES);
      });
    }, PROJECTILE_INTERVAL);

    return () => {
      if (projectileTimerRef.current) clearInterval(projectileTimerRef.current);
    };
  }, [squads, buildings, originX, originY]);

  // Track recently finished tasks → spawn explosions
  useEffect(() => {
    for (const task of recentlyFinished) {
      if (seenFinishedRef.current.has(task.id)) continue;
      seenFinishedRef.current.add(task.id);

      const building = buildings.find((b) => b.taskId === task.id);
      let screen: { sx: number; sy: number };

      if (building) {
        screen = worldToScreen(building.position[0], building.position[2], originX, originY);
      } else {
        // Hash fallback
        let hash = 0;
        for (let i = 0; i < task.id.length; i++) {
          hash = ((hash << 5) - hash) + task.id.charCodeAt(i);
          hash |= 0;
        }
        const halfGrid = GRID_RANGE - 2;
        const x = ((Math.abs(hash) % (halfGrid * 20)) / 10) - halfGrid;
        const z = ((Math.abs(hash * 31) % (halfGrid * 20)) / 10) - halfGrid;
        screen = worldToScreen(x, z, originX, originY);
      }

      setExplosions((prev) => [
        ...prev,
        { id: `expl-${task.id}`, sx: screen.sx, sy: screen.sy, success: task.status === 'completed' },
      ]);
    }

    // Prune old seen IDs
    if (seenFinishedRef.current.size > 100) {
      const currentIds = new Set(recentlyFinished.map((t) => t.id));
      for (const id of seenFinishedRef.current) {
        if (!currentIds.has(id)) seenFinishedRef.current.delete(id);
      }
    }
  }, [recentlyFinished, buildings, originX, originY]);

  const removeProjectile = useCallback((id: string) => {
    setProjectiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const removeExplosion = useCallback((id: string) => {
    setExplosions((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Pre-compute building label positions (above bottom-anchored sprite)
  const buildingLabels = useMemo(() => {
    const tierSize: Record<string, number> = { hut: 220, barracks: 260, fortress: 300, citadel: 340, castle: 380 };
    return buildings.map((b) => {
      const screen = worldToScreen(b.position[0], b.position[2], originX, originY);
      const complexity = (b.task as any).complexity ?? b.task.priority ?? 5;
      const spriteH = tierSize[b.tier] ?? 120;
      // Compute retreat offset for labels to track retreating targets
      let retreatSx = 0, retreatSy = 0;
      if (b.underSiege) {
        const squad = squads.find((s) => s.targetTaskId === b.taskId);
        if (squad) {
          const dx = squad.targetPosition[0] - b.position[0];
          const dz = squad.targetPosition[2] - b.position[2];
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > 0) {
            const retreatWorld = b.damage * 2.5;
            const rx = (-dx / dist) * retreatWorld;
            const rz = (-dz / dist) * retreatWorld;
            retreatSx = (rx - rz) * TILE_HW;
            retreatSy = (rx + rz) * TILE_HH;
          }
        }
      }
      return {
        taskId: b.taskId,
        tier: b.tier,
        title: b.task.title || b.task.description?.slice(0, 30) || 'Task',
        complexity,
        underSiege: b.underSiege,
        sx: screen.sx + retreatSx,
        sy: screen.sy - spriteH + 10 - 8 + retreatSy,
        zIndex: isoZIndex(b.position[0], b.position[2], Z_LAYER.label),
      };
    });
  }, [buildings, squads, originX, originY]);

  // Pre-compute squad label positions (below bottom-anchored agent sprite)
  const squadLabels = useMemo(() => {
    return squads.map((s) => {
      const screen = worldToScreen(s.targetPosition[0], s.targetPosition[2], originX, originY);
      return {
        agentId: s.agentId,
        tier: s.tier,
        firing: s.firing,
        sx: screen.sx,
        sy: screen.sy + 18,
        zIndex: isoZIndex(s.targetPosition[0], s.targetPosition[2], Z_LAYER.label + 50),
      };
    });
  }, [squads, originX, originY]);

  // Generate ambient particles (static array, positions randomized via CSS)
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${10 + (i * 37) % 80}%`,
      top: `${20 + (i * 53) % 60}%`,
      delay: `${(i * 1.3) % 8}s`,
      duration: `${4 + (i % 4) * 2}s`,
      size: 1 + (i % 3),
    }));
  }, []);

  // Track all unique task IDs seen — rotate background every 10 tasks
  for (const b of buildings) seenTasksRef.current.add(b.taskId);
  for (const t of recentlyFinished) seenTasksRef.current.add(t.id);
  const bgIndex = Math.floor(seenTasksRef.current.size / 10);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-command-bg">
      {/* HUD badge */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-2 pointer-events-none">
        <span className="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded font-display text-[11px] tracking-widest text-hud-green/80 uppercase">
          Battlefield
        </span>
        <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-hud-green animate-pulse" />
          <span className="font-mono text-[10px] text-hud-green/70 uppercase">Live</span>
        </span>
      </div>

      {/* Entity count */}
      <div className="absolute top-3 right-4 z-10 flex items-center gap-3 pointer-events-none">
        <span className="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded font-mono text-[10px] text-gray-300">
          {buildings.length} targets
        </span>
        <span className="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded font-mono text-[10px] text-gray-300">
          {squads.length} squads
        </span>
      </div>

      {/* Ambient floating particles */}
      {particles.map((p) => (
        <div
          key={`particle-${p.id}`}
          className="iso-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
            opacity: 0,
          }}
        />
      ))}

      {/* Battlefield background — full bleed, rotates every 10 tasks */}
      <IsometricGrid bgIndex={bgIndex} />

      {/* Horizontal scan line */}
      <div className="iso-hscan-line" style={{ zIndex: 2 }} />

      {/* Scaled isometric canvas — explicit centering, no flex */}
      <div
        style={{
          position: 'absolute',
          left: (containerSize.w - canvasW * scale) / 2,
          top: (containerSize.h - canvasH * scale) / 2,
          width: canvasW,
          height: canvasH,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >

          {/* Ground glow markers under buildings */}
          {buildings.map((b) => {
            const screen = worldToScreen(b.position[0], b.position[2], originX, originY);
            return (
              <div
                key={`glow-${b.taskId}`}
                className="iso-ground-marker"
                style={{
                  left: screen.sx - 50,
                  top: screen.sy - 15,
                  width: 100,
                  height: 30,
                  background: b.underSiege
                    ? 'radial-gradient(ellipse, rgba(255,170,0,0.2), transparent)'
                    : 'radial-gradient(ellipse, rgba(0,255,136,0.12), transparent)',
                  zIndex: 1,
                  transition: 'left 3s ease-out, top 3s ease-out',
                }}
              />
            );
          })}

          {/* Target buildings (tanks) — retreat away from attacker */}
          {buildings.map((b) => {
            const screen = worldToScreen(b.position[0], b.position[2], originX, originY);
            // Determine direction: face toward attacking agent
            // Sprites only have left (W) and right (E) variants
            let dir: 'N' | 'E' | 'S' | 'W' = 'W';
            let retreatSx = 0;
            let retreatSy = 0;
            if (b.underSiege) {
              const squad = squads.find((s) => s.targetTaskId === b.taskId);
              if (squad) {
                // Face toward agent: E if agent is to the right, W if to the left
                const agentScreen = worldToScreen(squad.targetPosition[0], squad.targetPosition[2], originX, originY);
                dir = agentScreen.sx > screen.sx ? 'E' : 'W';

                const dx = squad.targetPosition[0] - b.position[0];
                const dz = squad.targetPosition[2] - b.position[2];
                // Retreat: target drifts away from attacker as damage increases
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist > 0) {
                  const retreatWorld = b.damage * 2.5; // up to 2.5 world units at full damage
                  const rx = (-dx / dist) * retreatWorld;
                  const rz = (-dz / dist) * retreatWorld;
                  retreatSx = (rx - rz) * TILE_HW;
                  retreatSy = (rx + rz) * TILE_HH;
                }
              }
            }
            return (
              <IsometricTarget
                key={b.taskId}
                building={b}
                sx={screen.sx + retreatSx}
                sy={screen.sy + retreatSy}
                zIndex={isoZIndex(b.position[0], b.position[2], Z_LAYER.building)}
                direction={dir}
              />
            );
          })}

          {/* Agent hex tokens */}
          {squads.map((s) => (
            <IsometricTank
              key={s.agentId}
              squad={s}
              originX={originX}
              originY={originY}
            />
          ))}

          {/* Projectiles */}
          {projectiles.map((p) => (
            <IsometricProjectile
              key={p.id}
              id={p.id}
              fromSx={p.fromSx}
              fromSy={p.fromSy}
              toSx={p.toSx}
              toSy={p.toSy}
              color={p.color}
              onComplete={removeProjectile}
            />
          ))}

          {/* Explosions */}
          {explosions.map((e) => (
            <IsometricExplosion
              key={e.id}
              id={e.id}
              sx={e.sx}
              sy={e.sy}
              success={e.success}
              onComplete={removeExplosion}
            />
          ))}

          {/* Building labels */}
          {buildingLabels.map((l) => (
            <IsometricLabel
              key={`lbl-${l.taskId}`}
              kind="target"
              tier={l.tier}
              title={l.title}
              complexity={l.complexity}
              underSiege={l.underSiege}
              sx={l.sx}
              sy={l.sy}
              zIndex={l.zIndex}
            />
          ))}

          {/* Squad labels */}
          {squadLabels.map((l) => (
            <IsometricLabel
              key={`lbl-${l.agentId}`}
              kind="tank"
              tier={l.tier}
              agentId={l.agentId}
              firing={l.firing}
              sx={l.sx}
              sy={l.sy}
              zIndex={l.zIndex}
            />
          ))}
      </div>

      {/* Vignette overlay — dark edges for depth */}
      <div className="iso-vignette" />
    </div>
  );
}
