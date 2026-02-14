import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createBuildingGeometries, disposeGeometries } from './BuildingGeometries';
import { HOLO_COLORS, getBuildingTier, BUILDING_TIERS } from './types';
import type { Task } from '@abcc/shared';

interface BuildingExplosionProps {
  task: Task;
  position: [number, number, number];
  success: boolean;
  onComplete: () => void;
}

const EXPLOSION_DURATION = 1.5;
const COLLAPSE_DURATION = 2.0;

/**
 * Animated building destruction:
 * - Success: shatter into face pieces flying outward + green particle burst
 * - Failure: red tint, vertices collapse to ground, red particles
 */
export function BuildingExplosion({ task, position, success, onComplete }: BuildingExplosionProps) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const [done, setDone] = useState(false);

  const complexity = (task as any).complexity ?? task.priority ?? 5;
  const tier = getBuildingTier(complexity);
  const scale = BUILDING_TIERS[tier].scale;
  const duration = success ? EXPLOSION_DURATION : COLLAPSE_DURATION;
  const color = success ? HOLO_COLORS.success : HOLO_COLORS.failure;

  // Create building geometry to explode
  const geometries = useMemo(() => createBuildingGeometries(tier), [tier]);

  // Pre-compute explosion directions for each geometry piece
  const explosionDirs = useMemo(
    () =>
      geometries.map(() => ({
        dx: (Math.random() - 0.5) * 8,
        dy: 2 + Math.random() * 6,
        dz: (Math.random() - 0.5) * 8,
        rx: (Math.random() - 0.5) * 10,
        ry: (Math.random() - 0.5) * 10,
        rz: (Math.random() - 0.5) * 10,
      })),
    [geometries],
  );

  useEffect(() => {
    return () => {
      disposeGeometries(geometries);
    };
  }, [geometries]);

  useFrame(({ clock }) => {
    if (done || !groupRef.current) return;
    const dt = clock.getDelta();

    progressRef.current += dt / duration;
    const p = Math.min(progressRef.current, 1);

    if (p >= 1) {
      setDone(true);
      onComplete();
      return;
    }

    const children = groupRef.current.children;

    if (success) {
      // Explosion: pieces fly outward
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as THREE.Mesh;
        if (!child.isMesh) continue;

        const dir = explosionDirs[i];
        if (!dir) continue;

        const ease = p * p; // Accelerating
        child.position.set(dir.dx * ease, dir.dy * ease - 2 * ease * ease, dir.dz * ease);
        child.rotation.set(dir.rx * p, dir.ry * p, dir.rz * p);

        // Fade out
        const mat = child.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - p) * 0.8;
      }
    } else {
      // Collapse: vertices sink to y=0
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as THREE.Mesh;
        if (!child.isMesh) continue;

        // Scale Y to 0 (melt)
        child.scale.y = 1 - p;
        child.position.y = -(p * scale);

        // Fade and redden
        const mat = child.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - p * 0.8) * 0.7;
      }
    }
  });

  if (done) return null;

  return (
    <group
      ref={groupRef}
      position={[position[0], 0, position[2]]}
      scale={[scale, scale, scale]}
    >
      {geometries.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshBasicMaterial
            color={color}
            wireframe
            transparent
            opacity={0.8}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* Particle burst */}
      <ExplosionParticles color={color} success={success} />
    </group>
  );
}

/** Burst of particles on destruction */
function ExplosionParticles({
  color,
  success,
}: {
  color: string;
  success: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const COUNT = 40;

  const particleData = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        dir: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 2,
          (Math.random() - 0.5) * 2,
        ).normalize(),
        speed: 1 + Math.random() * 3,
        size: 0.03 + Math.random() * 0.05,
      })),
    [],
  );

  const birthTime = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    if (birthTime.current === null) {
      birthTime.current = clock.elapsedTime;
    }

    const age = clock.elapsedTime - birthTime.current;
    const maxAge = success ? 1.5 : 2;

    for (let i = 0; i < COUNT; i++) {
      const pd = particleData[i];
      const life = Math.min(age / maxAge, 1);

      if (life >= 1) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
      } else {
        const gravity = success ? -2 : -4;
        dummy.position.set(
          pd.dir.x * pd.speed * age,
          pd.dir.y * pd.speed * age + gravity * age * age * 0.5,
          pd.dir.z * pd.speed * age,
        );
        dummy.scale.setScalar(pd.size * (1 - life));
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </instancedMesh>
  );
}
