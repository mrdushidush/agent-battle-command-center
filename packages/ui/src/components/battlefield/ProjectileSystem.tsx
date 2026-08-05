import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Color, CanvasTexture, InstancedMesh, Object3D, InstancedBufferAttribute, AdditiveBlending, DoubleSide, Camera } from 'three';
import { getAgentColor, type BattlefieldSquad, type BattlefieldBuilding } from './types';

interface ProjectileSystemProps {
  squads: BattlefieldSquad[];
  buildings: BattlefieldBuilding[];
}

interface Projectile {
  id: number;
  startPos: Vector3;
  endPos: Vector3;
  progress: number;
  color: string;
  active: boolean;
  trail: Vector3[]; // ring buffer of last 4 positions
  trailIdx: number;
}

const MAX_PROJECTILES = 50;
const TRAIL_SEGMENTS = 4;
const MAX_TRAILS = MAX_PROJECTILES * TRAIL_SEGMENTS; // 200
const FIRE_INTERVAL = 0.5;
const PROJECTILE_SPEED = 3.3;

/** Create a soft circular glow texture via canvas (for projectiles + trails) */
function createGlowTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Create a starburst flare texture via canvas (for impacts + flashes) */
function createFlareTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  // Core glow
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.7)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // 6 ray streaks
  ctx.globalCompositeOperation = 'lighter';
  const rays = 6;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const rayLen = size * 0.45;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * rayLen, cy + Math.sin(angle) * rayLen);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Energy bolt projectiles with billboard sprite glow, additive blending, and trailing particles.
 * Uses instanced meshes for performance.
 */
export function ProjectileSystem({ squads, buildings }: ProjectileSystemProps) {
  const { camera } = useThree();
  const meshRef = useRef<InstancedMesh>(null);
  const trailMeshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const glowTexture = useMemo(() => createGlowTexture(), []);
  const flareTexture = useMemo(() => createFlareTexture(), []);

  // Dispose textures on unmount
  useEffect(() => {
    return () => {
      glowTexture.dispose();
      flareTexture.dispose();
    };
  }, [glowTexture, flareTexture]);

  const projectilesRef = useRef<Projectile[]>(
    Array.from({ length: MAX_PROJECTILES }, (_, i) => ({
      id: i,
      startPos: new Vector3(),
      endPos: new Vector3(),
      progress: 0,
      color: '#ffffff',
      active: false,
      trail: Array.from({ length: TRAIL_SEGMENTS }, () => new Vector3(0, -100, 0)),
      trailIdx: 0,
    })),
  );

  const fireTimers = useRef<Map<string, number>>(new Map());
  const impactParticles = useRef<{ pos: Vector3; life: number; color: string; vel: Vector3 }[]>([]);
  const impactFlashes = useRef<{ pos: Vector3; life: number; color: string }[]>([]);

  // Color arrays for instanced meshes
  const colorArray = useMemo(() => new Float32Array(MAX_PROJECTILES * 3).fill(0), []);
  const trailColorArray = useMemo(() => new Float32Array(MAX_TRAILS * 3).fill(0), []);

  // Attach instanceColor on mount
  useEffect(() => {
    if (meshRef.current && !meshRef.current.instanceColor) {
      meshRef.current.instanceColor = new InstancedBufferAttribute(colorArray, 3);
    }
    if (trailMeshRef.current && !trailMeshRef.current.instanceColor) {
      trailMeshRef.current.instanceColor = new InstancedBufferAttribute(trailColorArray, 3);
    }
  }, [colorArray, trailColorArray]);

  useFrame(({ clock }, dt) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;

    const firingSquads = squads.filter((s) => s.firing);

    // Fire new projectiles from squads
    for (const squad of firingSquads) {
      const lastFire = fireTimers.current.get(squad.agentId) ?? 0;
      if (t - lastFire < FIRE_INTERVAL) continue;

      const building = buildings.find((b) => b.taskId === squad.targetTaskId);
      if (!building) continue;

      const proj = projectilesRef.current.find((p) => !p.active);
      if (!proj) continue;

      fireTimers.current.set(squad.agentId, t);

      proj.active = true;
      proj.progress = 0;
      proj.color = getAgentColor(squad.tier);
      proj.trailIdx = 0;
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
      // Reset trail positions
      for (const tp of proj.trail) tp.set(0, -100, 0);
    }

    // Update and render projectiles
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const proj = projectilesRef.current[i];

      if (!proj.active) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);

        // Set color to black for inactive
        colorArray[i * 3] = 0;
        colorArray[i * 3 + 1] = 0;
        colorArray[i * 3 + 2] = 0;
        continue;
      }

      proj.progress += dt * PROJECTILE_SPEED;

      if (proj.progress >= 1) {
        // Impact! Create directional particles
        const impactDir = new Vector3().copy(proj.endPos).sub(proj.startPos).normalize();
        for (let p = 0; p < 5; p++) {
          impactParticles.current.push({
            pos: proj.endPos.clone(),
            life: 0.4,
            color: proj.color,
            vel: new Vector3(
              (Math.random() - 0.5) * 2 + impactDir.x * 0.5,
              Math.random() * 2,
              (Math.random() - 0.5) * 2 + impactDir.z * 0.5,
            ),
          });
        }
        // Flash
        impactFlashes.current.push({
          pos: proj.endPos.clone(),
          life: 0.25,
          color: proj.color,
        });

        proj.active = false;
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
      } else {
        // Lerp position with arc
        const p = proj.progress;
        const arcHeight = Math.sin(p * Math.PI) * 1.5;
        dummy.position.lerpVectors(proj.startPos, proj.endPos, p);
        dummy.position.y += arcHeight;

        // Billboard: face camera
        dummy.quaternion.copy(camera.quaternion);

        // Uniform scale for sprite
        dummy.scale.set(0.12, 0.12, 0.12);

        // Store trail position
        if (proj.trailIdx < TRAIL_SEGMENTS) {
          proj.trail[proj.trailIdx].copy(dummy.position);
          proj.trailIdx++;
        }
      }

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Set instance color
      const c = new Color(proj.active ? proj.color : '#000000');
      colorArray[i * 3] = c.r;
      colorArray[i * 3 + 1] = c.g;
      colorArray[i * 3 + 2] = c.b;
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    // Update trail instances
    if (trailMeshRef.current) {
      for (let i = 0; i < MAX_PROJECTILES; i++) {
        const proj = projectilesRef.current[i];
        for (let s = 0; s < TRAIL_SEGMENTS; s++) {
          const idx = i * TRAIL_SEGMENTS + s;
          const trailPos = proj.trail[s];

          if (!proj.active || trailPos.y < -50) {
            dummy.position.set(0, -100, 0);
            dummy.scale.setScalar(0);
          } else {
            dummy.position.copy(trailPos);
            // Billboard: face camera
            dummy.quaternion.copy(camera.quaternion);
            // Progressive shrink: first trail segment biggest, last smallest
            const scaleFactor = 0.06 - (s / TRAIL_SEGMENTS) * 0.04;
            dummy.scale.setScalar(scaleFactor);
          }
          dummy.updateMatrix();
          trailMeshRef.current.setMatrixAt(idx, dummy.matrix);

          // Color-match to projectile
          const tc = new Color(proj.active ? proj.color : '#000000');
          trailColorArray[idx * 3] = tc.r;
          trailColorArray[idx * 3 + 1] = tc.g;
          trailColorArray[idx * 3 + 2] = tc.b;
        }
      }
      trailMeshRef.current.instanceMatrix.needsUpdate = true;
      if (trailMeshRef.current.instanceColor) {
        trailMeshRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* Main projectile bolts — billboard glow sprites */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PROJECTILES]}>
        <planeGeometry args={[2.5, 2.5]} />
        <meshBasicMaterial
          map={glowTexture}
          transparent
          opacity={0.9}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </instancedMesh>

      {/* Trail particles — smaller billboard glow sprites */}
      <instancedMesh ref={trailMeshRef} args={[undefined, undefined, MAX_TRAILS]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial
          map={glowTexture}
          transparent
          opacity={0.6}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </instancedMesh>

      <ImpactParticles
        particlesRef={impactParticles}
        flashesRef={impactFlashes}
        flareTexture={flareTexture}
        camera={camera}
      />
    </group>
  );
}

/** Particle burst + flash on projectile impact */
function ImpactParticles({
  particlesRef,
  flashesRef,
  flareTexture,
  camera,
}: {
  particlesRef: React.MutableRefObject<{ pos: Vector3; life: number; color: string; vel: Vector3 }[]>;
  flashesRef: React.MutableRefObject<{ pos: Vector3; life: number; color: string }[]>;
  flareTexture: CanvasTexture;
  camera: Camera;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const flashMeshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const MAX_IMPACTS = 50;
  const MAX_FLASHES = 10;

  const impactColorArray = useMemo(() => new Float32Array(MAX_IMPACTS * 3).fill(0), []);
  const flashColorArray = useMemo(() => new Float32Array(MAX_FLASHES * 3).fill(0), []);

  useEffect(() => {
    if (meshRef.current && !meshRef.current.instanceColor) {
      meshRef.current.instanceColor = new InstancedBufferAttribute(impactColorArray, 3);
    }
    if (flashMeshRef.current && !flashMeshRef.current.instanceColor) {
      flashMeshRef.current.instanceColor = new InstancedBufferAttribute(flashColorArray, 3);
    }
  }, [impactColorArray, flashColorArray]);

  useFrame((_state, dt) => {
    if (!meshRef.current) return;

    // Age and move particles
    particlesRef.current = particlesRef.current.filter((p) => {
      p.life -= dt;
      p.pos.add(p.vel.clone().multiplyScalar(dt));
      p.vel.y -= dt * 5; // gravity
      return p.life > 0;
    });

    while (particlesRef.current.length > MAX_IMPACTS) {
      particlesRef.current.shift();
    }

    for (let i = 0; i < MAX_IMPACTS; i++) {
      const impact = particlesRef.current[i];
      if (!impact) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
        impactColorArray[i * 3] = 0;
        impactColorArray[i * 3 + 1] = 0;
        impactColorArray[i * 3 + 2] = 0;
      } else {
        const fade = impact.life / 0.4;
        dummy.position.copy(impact.pos);
        // Billboard: face camera
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.setScalar(0.05 * fade);
        const c = new Color(impact.color);
        impactColorArray[i * 3] = c.r;
        impactColorArray[i * 3 + 1] = c.g;
        impactColorArray[i * 3 + 2] = c.b;
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    // Flash planes
    if (flashMeshRef.current) {
      flashesRef.current = flashesRef.current.filter((f) => {
        f.life -= dt;
        return f.life > 0;
      });
      while (flashesRef.current.length > MAX_FLASHES) {
        flashesRef.current.shift();
      }

      for (let i = 0; i < MAX_FLASHES; i++) {
        const flash = flashesRef.current[i];
        if (!flash) {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0);
          flashColorArray[i * 3] = 0;
          flashColorArray[i * 3 + 1] = 0;
          flashColorArray[i * 3 + 2] = 0;
        } else {
          const progress = 1 - flash.life / 0.25;
          dummy.position.copy(flash.pos);
          // Billboard: face camera
          dummy.quaternion.copy(camera.quaternion);
          // Expand quickly then fade
          const scale = progress < 0.2 ? progress * 2.5 : 0.5 * (1 - progress);
          dummy.scale.setScalar(Math.max(0, scale));
          const c = new Color(flash.color);
          flashColorArray[i * 3] = c.r;
          flashColorArray[i * 3 + 1] = c.g;
          flashColorArray[i * 3 + 2] = c.b;
        }
        dummy.updateMatrix();
        flashMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      flashMeshRef.current.instanceMatrix.needsUpdate = true;
      if (flashMeshRef.current.instanceColor) {
        flashMeshRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <>
      {/* Impact streak particles — flare sprites */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_IMPACTS]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial
          map={flareTexture}
          transparent
          opacity={0.8}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </instancedMesh>

      {/* Impact flash bursts — larger flare sprites */}
      <instancedMesh ref={flashMeshRef} args={[undefined, undefined, MAX_FLASHES]}>
        <planeGeometry args={[3, 3]} />
        <meshBasicMaterial
          map={flareTexture}
          transparent
          opacity={0.6}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </instancedMesh>
    </>
  );
}
