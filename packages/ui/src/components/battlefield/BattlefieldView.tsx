import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { TaskQueue } from '../main-view/TaskQueue';
import { useBattlefieldState } from '../../hooks/useBattlefieldState';

// Lazy-load the heavy 3D canvas (Three.js ~600KB) for code splitting
const BattlefieldCanvas = lazy(() => import('./BattlefieldCanvas'));

/**
 * Main battlefield orchestrator.
 * - Renders BOTH TaskQueue (cards) and R3F Canvas
 * - Crossfades between them based on active task state
 * - Falls back to TaskQueue on any WebGL error
 * - Lazy-loads Three.js bundle only when battlefield first activates
 */
export function BattlefieldView() {
  const [webglFailed, setWebglFailed] = useState(false);
  const [everActivated, setEverActivated] = useState(false);
  const { hasActiveTasks } = useBattlefieldState();

  // Show 3D when there are active tasks
  const show3D = hasActiveTasks && !webglFailed;

  // Track if we've ever activated (to start lazy loading)
  const wasActive = useRef(false);
  useEffect(() => {
    if (show3D && !wasActive.current) {
      wasActive.current = true;
      setEverActivated(true);
    }
  }, [show3D]);

  if (webglFailed) {
    return <TaskQueue />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* TaskQueue cards - always mounted, fades out when 3D active */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ opacity: show3D ? 0 : 1, pointerEvents: show3D ? 'none' : 'auto' }}
      >
        <TaskQueue />
      </div>

      {/* 3D Battlefield Canvas - lazy loaded on first activation */}
      {everActivated && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ opacity: show3D ? 1 : 0, pointerEvents: show3D ? 'auto' : 'none' }}
        >
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center">
                <div
                  className="text-sm font-mono animate-pulse"
                  style={{ color: '#00ff88', textShadow: '0 0 8px #00ff88' }}
                >
                  INITIALIZING HOLOGRAPHIC DISPLAY...
                </div>
              </div>
            }
          >
            <BattlefieldCanvas
              show3D={show3D}
              onWebGLError={() => setWebglFailed(true)}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
