import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HOLO_COLORS } from './types';

/**
 * Transparent plane sweeping across the scene like a radar scan.
 * Matches the existing CSS scanline HUD aesthetic.
 */
export function ScanLine() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const t = clock.elapsedTime;

    // Sweep across Z axis over 4 seconds, then repeat
    const cycle = (t % 4) / 4; // 0 to 1
    const z = (cycle - 0.5) * 40; // -20 to 20

    meshRef.current.position.z = z;

    // Fade at edges
    if (matRef.current) {
      const edgeFade = 1 - Math.abs(cycle - 0.5) * 2; // Peaks at center
      matRef.current.opacity = 0.06 * edgeFade;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <planeGeometry args={[40, 0.3]} />
      <meshBasicMaterial
        ref={matRef}
        color={HOLO_COLORS.primary}
        transparent
        opacity={0.06}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
