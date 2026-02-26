import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { TaskQueue } from '../main-view/TaskQueue';
import { IsometricBattlefield } from '../isometric/IsometricBattlefield';
import { useUIStore } from '../../store/uiState';

// Lazy-load the heavy 3D canvas (Three.js ~600KB) for code splitting
const BattlefieldCanvas = lazy(() => import('./BattlefieldCanvas'));

/**
 * Main battlefield dispatcher.
 * - 'cards' mode → TaskQueue
 * - 'isometric' mode (default) → CSS sprite battlefield
 * - '3d' mode → legacy Three.js canvas (lazy-loaded)
 */
export function BattlefieldView() {
  const battlefieldEnabled = useUIStore((s) => s.battlefieldEnabled);
  const viewMode = useUIStore((s) => s.battlefieldViewMode);
  const [ever3D, setEver3D] = useState(false);

  // Track if we've ever switched to 3D (to trigger lazy load)
  const was3D = useRef(false);
  useEffect(() => {
    if (battlefieldEnabled && viewMode === '3d' && !was3D.current) {
      was3D.current = true;
      setEver3D(true);
    }
  }, [battlefieldEnabled, viewMode]);

  const showIsometric = battlefieldEnabled && viewMode === 'isometric';
  const show3D = battlefieldEnabled && viewMode === '3d';
  const showCards = !battlefieldEnabled;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* TaskQueue cards — shown when battlefield disabled */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ opacity: showCards ? 1 : 0, pointerEvents: showCards ? 'auto' : 'none' }}
      >
        <TaskQueue />
      </div>

      {/* Isometric Battlefield — default battlefield mode */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ opacity: showIsometric ? 1 : 0, pointerEvents: showIsometric ? 'auto' : 'none' }}
      >
        {(showIsometric || (battlefieldEnabled && viewMode === 'isometric')) && (
          <IsometricBattlefield />
        )}
      </div>

      {/* 3D Battlefield Canvas — lazy loaded on first switch to 3D */}
      {ever3D && (
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
            <BattlefieldCanvas show3D={show3D} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
