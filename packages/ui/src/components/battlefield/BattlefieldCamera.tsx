import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface BattlefieldCameraProps {
  /** Whether the battlefield is actively showing (triggers zoom-in) */
  active: boolean;
}

/**
 * Isometric camera with constrained orbit controls.
 * Zooms in from distance 50 to 30 when activated.
 */
export function BattlefieldCamera({ active }: BattlefieldCameraProps) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const targetDistance = useRef(50);
  const currentDistance = useRef(50);

  useEffect(() => {
    // Set initial isometric position
    camera.position.set(20, 25, 20);
    camera.lookAt(0, 0, 0);
    targetDistance.current = active ? 30 : 50;
  }, [camera, active]);

  useEffect(() => {
    targetDistance.current = active ? 30 : 50;
  }, [active]);

  // Smooth zoom transition
  useFrame(() => {
    const diff = targetDistance.current - currentDistance.current;
    if (Math.abs(diff) > 0.1) {
      currentDistance.current += diff * 0.03; // Smooth ease

      // Maintain direction, just adjust distance
      const dir = camera.position.clone().normalize();
      camera.position.copy(dir.multiplyScalar(currentDistance.current));
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableDamping
      dampingFactor={0.1}
      minDistance={15}
      maxDistance={60}
      minPolarAngle={Math.PI / 6}     // Don't go too flat
      maxPolarAngle={Math.PI / 3}      // Don't go too overhead
      target={new THREE.Vector3(0, 0, 0)}
    />
  );
}
