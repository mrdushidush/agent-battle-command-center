import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, Mesh, MeshBasicMaterial, BufferGeometry, BufferAttribute, AdditiveBlending } from 'three';
import { createBuildingGeometries, disposeGeometries } from './BuildingGeometries';
import { HOLO_COLORS, type BattlefieldBuilding } from './types';

interface TaskBuildingProps {
  building: BattlefieldBuilding;
}

/** Deterministic hash from integer seed */
function hashSeed(seed: number): number {
  let h = seed ^ 0xdeadbeef;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Smoothstep interpolation */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Reusable color objects for lerping (avoid per-frame allocation)
const _colorA = new Color();
const _colorB = new Color();

/** Lerp between two hex colors */
function lerpColor(a: string, b: string, t: number): string {
  _colorA.set(a);
  _colorB.set(b);
  _colorA.lerp(_colorB, t);
  return '#' + _colorA.getHexString();
}

/**
 * Wireframe holographic building sized by complexity tier.
 * Features:
 * - Rise-from-ground entry animation (500ms)
 * - 4-phase progressive damage with debris
 * - Smooth damage interpolation for repair
 * - RepairShield geodesic dome effect
 * - Color shift based on damage level
 * - Hologram flicker effect
 */
export function TaskBuilding({ building }: TaskBuildingProps) {
  const groupRef = useRef<Group>(null);
  const entryProgress = useRef(0);
  const materialsRef = useRef<MeshBasicMaterial[]>([]);
  const geometriesRef = useRef<BufferGeometry[]>([]);
  const originalPositions = useRef<Float32Array[]>([]);
  const displayedDamageRef = useRef(0);

  // Pre-compute per-vertex noise seeds
  const vertexSeedsRef = useRef<number[][]>([]);

  // Create geometry for this building tier
  const geometries = useMemo(() => {
    const geos = createBuildingGeometries(building.tier);
    geometriesRef.current = geos;
    originalPositions.current = geos.map((g) => {
      const pos = g.getAttribute('position');
      return new Float32Array(pos.array);
    });
    // Pre-compute noise seeds per vertex per geometry
    vertexSeedsRef.current = geos.map((g, gIdx) => {
      const pos = g.getAttribute('position');
      const seeds: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        seeds.push(hashSeed(gIdx * 10000 + i));
      }
      return seeds;
    });
    return geos;
  }, [building.tier]);

  // Cleanup geometries on unmount
  useEffect(() => {
    return () => {
      disposeGeometries(geometriesRef.current);
      materialsRef.current.forEach((m) => m.dispose());
    };
  }, []);

  // Debris state (deterministic from building position)
  const debrisData = useMemo(() => {
    const debris: { offset: [number, number, number]; seed: number; phaseMin: number }[] = [];
    const bx = building.position[0];
    const bz = building.position[2];
    const scale = building.scale;

    // Phase 2: 3-6 pieces
    for (let i = 0; i < 6; i++) {
      const s = hashSeed(Math.floor(bx * 100) + i * 37);
      debris.push({
        offset: [
          ((s % 100) / 100 - 0.5) * scale * 0.8,
          ((hashSeed(s) % 100) / 100) * scale * 2,
          ((hashSeed(s + 1) % 100) / 100 - 0.5) * scale * 0.8,
        ],
        seed: s,
        phaseMin: i < 3 ? 0.25 : 0.35, // first 3 appear earlier
      });
    }
    // Phase 3: 4 more pieces
    for (let i = 0; i < 4; i++) {
      const s = hashSeed(Math.floor(bz * 100) + i * 53 + 1000);
      debris.push({
        offset: [
          ((s % 100) / 100 - 0.5) * scale,
          ((hashSeed(s) % 100) / 100) * scale * 2.5,
          ((hashSeed(s + 1) % 100) / 100 - 0.5) * scale,
        ],
        seed: s,
        phaseMin: 0.5,
      });
    }
    // Phase 4: 2 more
    for (let i = 0; i < 2; i++) {
      const s = hashSeed(Math.floor((bx + bz) * 100) + i * 71 + 2000);
      debris.push({
        offset: [
          ((s % 100) / 100 - 0.5) * scale * 1.2,
          ((hashSeed(s) % 100) / 100) * scale * 3,
          ((hashSeed(s + 1) % 100) / 100 - 0.5) * scale * 1.2,
        ],
        seed: s,
        phaseMin: 0.75,
      });
    }
    return debris;
  }, [building.position, building.scale]);

  // Get color from smoothly interpolated damage
  const getColor = (damage: number): string => {
    if (damage < 0.25) {
      // Green with subtle warm tinge as damage increases
      const t = damage / 0.25;
      return lerpColor(HOLO_COLORS.primary, '#44ff66', t);
    }
    if (damage < 0.5) {
      const t = smoothstep(0.25, 0.5, damage);
      return lerpColor(HOLO_COLORS.damage25, '#ff8800', t);
    }
    if (damage < 0.75) {
      const t = smoothstep(0.5, 0.75, damage);
      return lerpColor('#ff8800', '#ff4400', t);
    }
    const t = smoothstep(0.75, 1.0, damage);
    return lerpColor(HOLO_COLORS.damage75, '#ff1111', t);
  };

  // Animation loop
  useFrame(({ clock }, dt) => {
    if (!groupRef.current) return;

    const t = clock.elapsedTime;

    // Entry animation: rise from ground
    if (entryProgress.current < 1) {
      entryProgress.current = Math.min(1, entryProgress.current + dt * 2);
      const ease = 1 - Math.pow(1 - entryProgress.current, 3);
      groupRef.current.scale.y = ease;
      groupRef.current.position.y = -building.scale * (1 - ease);
    }

    // Smooth damage interpolation
    const targetDamage = building.damage;
    const displayed = displayedDamageRef.current;

    if (building.repairing) {
      // During repair: lerp from repairFromDamage → target over 1s with ease-out
      const elapsed = (Date.now() - building.repairStartTime) / 1000;
      const repairProgress = Math.min(1, elapsed);
      const easeOut = 1 - Math.pow(1 - repairProgress, 2);
      displayedDamageRef.current = building.repairFromDamage * (1 - easeOut) + targetDamage * easeOut;
    } else {
      // Normal: smooth toward target at 5% per frame
      displayedDamageRef.current = displayed + (targetDamage - displayed) * 0.05;
    }

    const damage = displayedDamageRef.current;

    // Phase-based flicker
    let flickerBase: number;
    let flickerGlitch: number;
    if (damage < 0.25) {
      // Phase 1: gentle flicker, increases with damage
      const freq = 3 + damage * 20;
      flickerBase = 0.7 + Math.sin(t * freq + building.position[0]) * 0.1;
      flickerGlitch = Math.random() > (0.97 - damage * 0.3) ? 0.3 : 0;
    } else if (damage < 0.5) {
      // Phase 2: moderate flicker
      flickerBase = 0.6 + Math.sin(t * 8 + building.position[0]) * 0.15;
      flickerGlitch = Math.random() > 0.93 ? 0.35 : 0;
    } else if (damage < 0.75) {
      // Phase 3: near-strobing
      flickerBase = 0.5 + Math.sin(t * 15 + building.position[0]) * 0.2;
      flickerGlitch = Math.random() > 0.88 ? 0.4 : 0;
    } else {
      // Phase 4: highly unstable
      flickerBase = 0.4 + Math.sin(t * 25 + building.position[0]) * 0.25;
      flickerGlitch = Math.random() > 0.82 ? 0.45 : 0;
    }

    // Update materials
    const color = getColor(damage);
    materialsRef.current.forEach((mat) => {
      mat.color.set(color);
      mat.opacity = Math.max(0.1, flickerBase - flickerGlitch);
    });

    // Apply damage displacement to vertices
    if (damage > 0.05) {
      geometries.forEach((geo, geoIdx) => {
        const pos = geo.getAttribute('position') as BufferAttribute;
        const orig = originalPositions.current[geoIdx];
        const seeds = vertexSeedsRef.current[geoIdx];
        if (!orig || !seeds) return;

        // Base intensity scales with phase
        let damageIntensity: number;
        if (damage < 0.25) {
          damageIntensity = damage * 0.3;
        } else if (damage < 0.5) {
          damageIntensity = 0.075 + (damage - 0.25) * 0.6; // doubles from baseline
        } else if (damage < 0.75) {
          damageIntensity = 0.225 + (damage - 0.5) * 1.0;
        } else {
          damageIntensity = 0.475 + (damage - 0.75) * 1.5; // maximum displacement
        }

        for (let i = 0; i < pos.count; i++) {
          const ox = orig[i * 3];
          const oy = orig[i * 3 + 1];
          const oz = orig[i * 3 + 2];
          const seed = seeds[i];
          const seedNorm = (seed % 1000) / 1000; // 0-1 deterministic noise

          // Deterministic noise based on vertex position + seed
          const noise = Math.sin(ox * 5 + t * 2 + seedNorm * 6.28) *
            Math.cos(oz * 5 + t * 1.5 + seedNorm * 3.14) * damageIntensity;

          let dx = noise * (0.5 + seedNorm * 0.5);
          let dy = Math.abs(noise) * 0.3;
          let dz = noise * (0.5 + ((seed >> 8) % 1000) / 1000 * 0.5);

          // Phase 3+: upper vertices sag downward (structural collapse)
          if (damage > 0.5) {
            const heightRatio = oy / (building.scale * 2 + 0.01);
            const sagAmount = smoothstep(0.5, 1.0, damage) * heightRatio * 0.5;
            dy -= sagAmount;
          }

          // Phase 4: vertical tear lines (alternating rows offset in opposite X)
          if (damage > 0.75) {
            const row = Math.floor(oy * 10);
            const tearOffset = (row % 2 === 0 ? 1 : -1) * smoothstep(0.75, 1.0, damage) * 0.2;
            dx += tearOffset;
          }

          // Phase 2+: scanline shifts (random horizontal offset for some vertex rows)
          if (damage > 0.25) {
            const scanRow = Math.floor(oy * 8);
            const scanShift = (hashSeed(scanRow + Math.floor(t * 5)) % 100) / 100;
            if (scanShift > 0.85) {
              dx += smoothstep(0.25, 0.5, damage) * 0.15 * ((seed % 2) * 2 - 1);
            }
          }

          pos.setXYZ(i, ox + dx, oy + dy, oz + dz);
        }
        pos.needsUpdate = true;
      });
    }
  });

  return (
    <group
      ref={groupRef}
      position={[building.position[0], 0, building.position[2]]}
      scale={[building.scale, 0, building.scale]}
    >
      {geometries.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshBasicMaterial
            ref={(mat: MeshBasicMaterial | null) => {
              if (mat) materialsRef.current[i] = mat;
            }}
            color={HOLO_COLORS.primary}
            wireframe
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Debris pieces */}
      {debrisData.map((d, i) => (
        <DebrisPiece
          key={i}
          offset={d.offset}
          seed={d.seed}
          phaseMin={d.phaseMin}
          damage={displayedDamageRef}
          buildingScale={building.scale}
        />
      ))}

      {/* Repair shield */}
      {building.repairing && (
        <RepairShield
          buildingScale={building.scale}
          startTime={building.repairStartTime}
        />
      )}
    </group>
  );
}

/** Individual debris piece - small wireframe box that detaches from building */
function DebrisPiece({
  offset,
  seed,
  phaseMin,
  damage,
  buildingScale,
}: {
  offset: [number, number, number];
  seed: number;
  phaseMin: number;
  damage: React.MutableRefObject<number>;
  buildingScale: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<MeshBasicMaterial>(null);
  const seedNorm = (seed % 1000) / 1000;
  const isFalling = phaseMin >= 0.5; // Phase 3+ debris falls with gravity

  useFrame(({ clock }) => {
    if (!meshRef.current || !matRef.current) return;
    const t = clock.elapsedTime;
    const d = damage.current;

    // Only show when damage exceeds this piece's threshold
    if (d < phaseMin) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    const phaseProgress = smoothstep(phaseMin, phaseMin + 0.15, d);
    const debrisSize = 0.08 + seedNorm * 0.06;

    if (isFalling) {
      // Falling debris: gravity + slight horizontal drift
      const fallTime = (t * (0.5 + seedNorm * 0.5)) % 3; // loop every 3s
      const gy = -fallTime * fallTime * 0.5; // gravity
      meshRef.current.position.set(
        offset[0] + Math.sin(t * 2 + seed) * 0.05,
        offset[1] + gy,
        offset[2] + Math.cos(t * 1.5 + seed) * 0.05,
      );
      // Hide when fallen below ground
      if (meshRef.current.position.y < -0.5) {
        meshRef.current.visible = false;
        return;
      }
    } else {
      // Floating debris: drifts upward slowly, flickers in/out
      const floatY = offset[1] + Math.sin(t * 0.8 + seed) * 0.3 + t * 0.05;
      meshRef.current.position.set(
        offset[0] + Math.sin(t * 1.2 + seed) * 0.1,
        floatY % (buildingScale * 3),
        offset[2] + Math.cos(t * 0.9 + seed) * 0.1,
      );
      // Holographic flicker
      const flicker = Math.sin(t * 20 + seed) > 0.3 ? 1 : 0.2;
      matRef.current.opacity = 0.5 * phaseProgress * flicker;
    }

    meshRef.current.scale.setScalar(debrisSize * phaseProgress);
    meshRef.current.rotation.set(t * 2 + seed, t * 1.5, t * 3 + seed);

    if (isFalling) {
      // Falling debris is more opaque
      const fallDamageColor = d > 0.75 ? HOLO_COLORS.damage75 : '#ff8800';
      matRef.current.color.set(fallDamageColor);
      matRef.current.opacity = 0.6 * phaseProgress;
    } else {
      matRef.current.color.set(HOLO_COLORS.damage25);
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        wireframe
        transparent
        opacity={0}
        depthWrite={false}
        color={HOLO_COLORS.damage25}
      />
    </mesh>
  );
}

/** Geodesic dome force field that appears during repair */
function RepairShield({
  buildingScale,
  startTime,
}: {
  buildingScale: number;
  startTime: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<MeshBasicMaterial>(null);
  const DURATION_MS = 800;

  useFrame(({ clock }) => {
    if (!meshRef.current || !matRef.current) return;
    const t = clock.elapsedTime;
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / DURATION_MS);

    // Expand from building scale to 1.5x
    const expandScale = buildingScale * (1 + progress * 0.5);
    meshRef.current.scale.setScalar(expandScale);

    // Height offset to center on building
    meshRef.current.position.y = buildingScale * 1.2;

    // Bright flash at start, fades with pow(1 - progress, 2)
    const fade = Math.pow(1 - progress, 2);
    // High-frequency shimmer
    const shimmer = Math.sin(t * 30) * 0.05;
    matRef.current.opacity = Math.max(0, (0.4 + shimmer) * fade);
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        color="#00ff88"
        wireframe
        transparent
        opacity={0.4}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
