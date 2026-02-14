import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HOLO_COLORS } from './types';

/** Glowing holographic grid floor + ambient particle motes */
export function HolographicTable() {
  return (
    <group>
      <HoloGrid />
      <AmbientParticles count={150} />
      <TableBorder />
    </group>
  );
}

/** Flat glowing grid - holographic planning table */
function HoloGrid() {
  const gridRef = useRef<THREE.GridHelper>(null);

  useFrame(({ clock }) => {
    if (gridRef.current) {
      // Subtle opacity oscillation for hologram flicker
      const mat = gridRef.current.material as THREE.Material;
      mat.opacity = 0.15 + Math.sin(clock.elapsedTime * 2) * 0.03;
    }
  });

  return (
    <gridHelper
      ref={gridRef}
      args={[40, 20, HOLO_COLORS.primary, HOLO_COLORS.primary]}
      position={[0, -0.01, 0]}
    >
      <meshBasicMaterial
        attach="material"
        color={HOLO_COLORS.primary}
        transparent
        opacity={0.15}
        depthWrite={false}
      />
    </gridHelper>
  );
}

/** Floating green data motes drifting upward */
function AmbientParticles({ count }: { count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize random positions
  const particleData = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 40,
      y: Math.random() * 8,
      z: (Math.random() - 0.5) * 40,
      speed: 0.2 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const p = particleData[i];
      const y = (p.y + t * p.speed) % 8;
      dummy.position.set(
        p.x + Math.sin(t * 0.5 + p.phase) * 0.3,
        y,
        p.z + Math.cos(t * 0.4 + p.phase) * 0.3,
      );
      dummy.scale.setScalar(0.03 + Math.sin(t * 2 + p.phase) * 0.01);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color={HOLO_COLORS.primary} transparent opacity={0.6} />
    </instancedMesh>
  );
}

/** Corner bracket wireframes matching HUD aesthetic */
function TableBorder() {
  const corners = useMemo(() => {
    const size = 20;
    const len = 3;
    const positions: [number, number, number, number, number, number][] = [];

    // Four corners, two lines each (L-shape)
    const cornerCoords = [
      [-size, -size], [size, -size], [-size, size], [size, size],
    ];

    for (const [cx, cz] of cornerCoords) {
      const dx = cx > 0 ? -1 : 1;
      const dz = cz > 0 ? -1 : 1;
      // Horizontal segment
      positions.push([cx, 0.01, cz, cx + dx * len, 0.01, cz]);
      // Vertical segment
      positions.push([cx, 0.01, cz, cx, 0.01, cz + dz * len]);
    }

    return positions;
  }, []);

  return (
    <group>
      {corners.map((coords, i) => (
        <CornerLine key={i} start={[coords[0], coords[1], coords[2]]} end={[coords[3], coords[4], coords[5]]} />
      ))}
    </group>
  );
}

function CornerLine({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const lineObj = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([...start, ...end], 3));
    const material = new THREE.LineBasicMaterial({
      color: HOLO_COLORS.primary,
      transparent: true,
      opacity: 0.5,
    });
    return new THREE.Line(geometry, material);
  }, [start, end]);

  return <primitive object={lineObj} />;
}
