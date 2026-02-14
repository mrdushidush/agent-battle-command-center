import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getAgentColor, type BattlefieldSquad, type BattlefieldBuilding } from './types';

interface ProjectileSystemProps {
  squads: BattlefieldSquad[];
  buildings: BattlefieldBuilding[];
}

interface Projectile {
  id: number;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  progress: number;
  color: string;
  active: boolean;
}

const MAX_PROJECTILES = 50;
const FIRE_INTERVAL = 0.5; // seconds between shots per squad
const PROJECTILE_SPEED = 3.3; // progress per second (completes in ~300ms)

/**
 * Manages projectile firing from squads to buildings.
 * Uses a pooled approach with refs for performance (no React state updates per frame).
 */
export function ProjectileSystem({ squads, buildings }: ProjectileSystemProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const projectilesRef = useRef<Projectile[]>(
    Array.from({ length: MAX_PROJECTILES }, (_, i) => ({
      id: i,
      startPos: new THREE.Vector3(),
      endPos: new THREE.Vector3(),
      progress: 0,
      color: '#ffffff',
      active: false,
    })),
  );

  const fireTimers = useRef<Map<string, number>>(new Map());
  const impactParticles = useRef<{ pos: THREE.Vector3; life: number; color: string }[]>([]);

  // Color instances for each projectile
  const colorArray = useMemo(() => new Float32Array(MAX_PROJECTILES * 3).fill(0), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    const dt = clock.getDelta();

    const firingSquads = squads.filter((s) => s.firing);

    // Fire new projectiles from squads
    for (const squad of firingSquads) {
      const lastFire = fireTimers.current.get(squad.agentId) ?? 0;
      if (t - lastFire < FIRE_INTERVAL) continue;

      // Find the target building
      const building = buildings.find((b) => b.taskId === squad.targetTaskId);
      if (!building) continue;

      // Find an inactive projectile slot
      const proj = projectilesRef.current.find((p) => !p.active);
      if (!proj) continue;

      fireTimers.current.set(squad.agentId, t);

      proj.active = true;
      proj.progress = 0;
      proj.color = getAgentColor(squad.tier);
      proj.startPos.set(
        squad.targetPosition[0],
        0.5,
        squad.targetPosition[2],
      );
      proj.endPos.set(
        building.position[0] + (Math.random() - 0.5) * building.scale * 0.5,
        building.scale * 1.5 * Math.random(),
        building.position[2] + (Math.random() - 0.5) * building.scale * 0.5,
      );
    }

    // Update and render projectiles
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const proj = projectilesRef.current[i];

      if (!proj.active) {
        dummy.position.set(0, -100, 0); // Hide off-screen
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      proj.progress += dt * PROJECTILE_SPEED;

      if (proj.progress >= 1) {
        // Impact! Create particle
        impactParticles.current.push({
          pos: proj.endPos.clone(),
          life: 0.4,
          color: proj.color,
        });
        proj.active = false;
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
      } else {
        // Lerp position with slight arc
        const p = proj.progress;
        const arcHeight = Math.sin(p * Math.PI) * 1.5;
        dummy.position.lerpVectors(proj.startPos, proj.endPos, p);
        dummy.position.y += arcHeight;
        dummy.scale.setScalar(0.08 + (1 - p) * 0.04); // Shrink slightly as it travels
      }

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Set color
      const c = new THREE.Color(proj.active ? proj.color : '#000000');
      colorArray[i * 3] = c.r;
      colorArray[i * 3 + 1] = c.g;
      colorArray[i * 3 + 2] = c.b;
    }

    meshRef.current.instanceMatrix.needsUpdate = true;

    // Update instance colors
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PROJECTILES]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </instancedMesh>
      <ImpactParticles particlesRef={impactParticles} />
    </group>
  );
}

/** Particle burst on projectile impact */
function ImpactParticles({
  particlesRef,
}: {
  particlesRef: React.MutableRefObject<{ pos: THREE.Vector3; life: number; color: string }[]>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const MAX_IMPACTS = 30;

  // Pre-allocated burst offsets for each impact
  const burstOffsets = useMemo(
    () =>
      Array.from({ length: MAX_IMPACTS }, () => ({
        dx: (Math.random() - 0.5) * 0.6,
        dy: Math.random() * 0.4,
        dz: (Math.random() - 0.5) * 0.6,
      })),
    [],
  );

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const dt = clock.getDelta();

    // Age particles
    particlesRef.current = particlesRef.current.filter((p) => {
      p.life -= dt;
      return p.life > 0;
    });

    // Keep only most recent impacts
    while (particlesRef.current.length > MAX_IMPACTS) {
      particlesRef.current.shift();
    }

    for (let i = 0; i < MAX_IMPACTS; i++) {
      const impact = particlesRef.current[i];
      if (!impact) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
      } else {
        const fade = impact.life / 0.4; // 0-1 remaining life
        const burst = burstOffsets[i];
        dummy.position.set(
          impact.pos.x + burst.dx * (1 - fade),
          impact.pos.y + burst.dy * (1 - fade) + (1 - fade) * 0.5,
          impact.pos.z + burst.dz * (1 - fade),
        );
        dummy.scale.setScalar(0.04 * fade);
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_IMPACTS]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#ffaa00" transparent opacity={0.7} />
    </instancedMesh>
  );
}
