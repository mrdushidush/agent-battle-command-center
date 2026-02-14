import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getAgentColor, type BattlefieldSquad } from './types';

interface AgentSquadProps {
  squad: BattlefieldSquad;
}

/**
 * Three capsule-geometry infantry figures in triangle formation.
 * Lerps from grid edge to target building.
 * Glows in tier color (blue/green/purple).
 */
export function AgentSquad({ squad }: AgentSquadProps) {
  const groupRef = useRef<THREE.Group>(null);
  const moveProgress = useRef(squad.moveProgress);
  const color = useMemo(() => getAgentColor(squad.tier), [squad.tier]);

  // Triangle formation offsets
  const formationOffsets = useMemo<[number, number, number][]>(
    () => [
      [0, 0, -0.4],      // Point
      [-0.35, 0, 0.25],  // Left
      [0.35, 0, 0.25],   // Right
    ],
    [],
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const dt = clock.getDelta();

    // Lerp movement toward target (2s travel time)
    if (moveProgress.current < 1) {
      moveProgress.current = Math.min(1, moveProgress.current + dt * 0.5);
    }

    const t = moveProgress.current;
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease-in-out

    groupRef.current.position.set(
      THREE.MathUtils.lerp(squad.position[0], squad.targetPosition[0], ease),
      0.15,
      THREE.MathUtils.lerp(squad.position[2], squad.targetPosition[2], ease),
    );

    // Face the target building direction
    const dx = squad.targetPosition[0] - squad.position[0];
    const dz = squad.targetPosition[2] - squad.position[2];
    if (Math.abs(dx) + Math.abs(dz) > 0.1) {
      groupRef.current.rotation.y = Math.atan2(dx, dz);
    }

    // Idle bob when arrived
    if (moveProgress.current >= 1) {
      groupRef.current.position.y = 0.15 + Math.sin(clock.elapsedTime * 2) * 0.03;
    }
  });

  return (
    <group ref={groupRef} position={[squad.position[0], 0.15, squad.position[2]]}>
      {formationOffsets.map((offset, i) => (
        <InfantryFigure key={i} position={offset} color={color} index={i} />
      ))}
    </group>
  );
}

function InfantryFigure({
  position,
  color,
  index,
}: {
  position: [number, number, number];
  color: string;
  index: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    // Slight individual bob offset
    meshRef.current.position.y =
      position[1] + 0.2 + Math.sin(clock.elapsedTime * 3 + index * 0.8) * 0.02;
  });

  return (
    <mesh ref={meshRef} position={[position[0], position[1] + 0.2, position[2]]}>
      <capsuleGeometry args={[0.08, 0.25, 4, 8]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.8} />
    </mesh>
  );
}
