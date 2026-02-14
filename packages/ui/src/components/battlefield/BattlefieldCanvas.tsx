import { Suspense, createContext, useContext, useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Task } from '@abcc/shared';
import { useBattlefieldState } from '../../hooks/useBattlefieldState';
import { HolographicTable } from './HolographicTable';
import { TaskBuilding } from './TaskBuilding';
import { BattlefieldCamera } from './BattlefieldCamera';
import { AgentSquad } from './AgentSquad';
import { BuildingLabel, SquadLabel } from './BattlefieldLabels';
import { ProjectileSystem } from './ProjectileSystem';
import { BuildingExplosion } from './BuildingExplosion';
import { ScanLine } from './ScanLine';
import type { GpuThrottleState } from './types';

/** Context for GPU throttle state - consumed by ThrottledRenderer */
const GpuThrottleContext = createContext<GpuThrottleState>({ throttled: false });

interface BattlefieldCanvasProps {
  show3D: boolean;
  onWebGLError: () => void;
}

interface ActiveExplosion {
  id: string;
  task: Task;
  position: [number, number, number];
  success: boolean;
}

/**
 * The actual R3F Canvas with all 3D scene content.
 * This is the heavy chunk that gets code-split via lazy loading.
 */
export default function BattlefieldCanvas({ show3D, onWebGLError }: BattlefieldCanvasProps) {
  const {
    hasOllamaInProgress,
    buildings,
    squads,
    recentlyFinished,
  } = useBattlefieldState();

  // Track active explosions
  const [explosions, setExplosions] = useState<ActiveExplosion[]>([]);
  const processedExplosions = useRef(new Set<string>());

  // Trigger explosions for recently finished tasks
  const buildingPositionMap = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    for (const b of buildings) {
      map.set(b.taskId, b.position);
    }
    return map;
  }, [buildings]);

  // Check for new explosions when tasks finish
  useEffect(() => {
    for (const task of recentlyFinished) {
      if (processedExplosions.current.has(task.id)) continue;
      processedExplosions.current.add(task.id);

      const pos = buildingPositionMap.get(task.id);
      if (!pos) continue;

      setExplosions((prev) => [
        ...prev,
        {
          id: task.id,
          task,
          position: pos,
          success: task.status === 'completed',
        },
      ]);
    }

    // Clean up old processed explosion ids
    if (processedExplosions.current.size > 100) {
      processedExplosions.current.clear();
    }
  }, [recentlyFinished, buildingPositionMap]);

  const handleExplosionComplete = useCallback((id: string) => {
    setExplosions((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <>
      <GpuThrottleContext.Provider value={{ throttled: hasOllamaInProgress }}>
        <Canvas
          frameloop={show3D ? 'always' : 'demand'}
          dpr={[1, 2]}
          camera={{ position: [20, 25, 20], fov: 45, near: 0.1, far: 200 }}
          onCreated={({ gl }) => {
            gl.setClearColor('#0a0f0a', 1);
            gl.toneMapping = 0; // NoToneMapping for raw wireframe colors
          }}
          onError={onWebGLError}
          style={{ background: '#0a0f0a' }}
        >
          <Suspense fallback={null}>
            <ThrottledRenderer />

            {/* Scene lighting */}
            <ambientLight intensity={0.3} />

            {/* Holographic table (grid + particles + border) */}
            <HolographicTable />

            {/* Camera controls */}
            <BattlefieldCamera active={show3D} />

            {/* Task buildings */}
            {buildings.map((b) => (
              <TaskBuilding key={b.taskId} building={b} />
            ))}

            {/* Building labels */}
            {buildings.map((b) => (
              <BuildingLabel key={`label-${b.taskId}`} building={b} />
            ))}

            {/* Agent squads */}
            {squads.map((s) => (
              <AgentSquad key={s.agentId} squad={s} />
            ))}

            {/* Squad labels */}
            {squads.map((s) => (
              <SquadLabel key={`slabel-${s.agentId}`} squad={s} />
            ))}

            {/* Projectile system */}
            <ProjectileSystem squads={squads} buildings={buildings} />

            {/* Destruction animations */}
            {explosions.map((e) => (
              <BuildingExplosion
                key={`explode-${e.id}`}
                task={e.task}
                position={e.position}
                success={e.success}
                onComplete={() => handleExplosionComplete(e.id)}
              />
            ))}

            {/* Scan line effect */}
            <ScanLine />
          </Suspense>
        </Canvas>
      </GpuThrottleContext.Provider>

      {/* HUD overlay - battlefield info */}
      {show3D && (
        <div className="absolute top-2 left-2 pointer-events-none">
          <div
            className="px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-wider"
            style={{
              borderColor: '#00ff8844',
              backgroundColor: '#00ff8811',
              color: '#00ff88',
              textShadow: '0 0 4px #00ff88',
            }}
          >
            HOLOGRAPHIC BATTLEFIELD {hasOllamaInProgress ? '// GPU THROTTLED' : '// LIVE'}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Throttles the render loop when Ollama is actively inferring.
 * Drops to ~2fps to avoid GPU contention with CUDA inference.
 */
function ThrottledRenderer() {
  const { throttled } = useContext(GpuThrottleContext);
  const frameCount = useRef(0);

  useFrame(({ gl, scene, camera }) => {
    frameCount.current++;

    // When throttled, only render every 8th frame (~8fps at 60fps)
    if (throttled && frameCount.current % 8 !== 0) {
      return;
    }

    gl.render(scene, camera);
  }, 1); // Priority 1 = runs after other useFrame hooks

  return null;
}
