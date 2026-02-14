import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createBuildingGeometries, disposeGeometries } from './BuildingGeometries';
import { HOLO_COLORS, type BattlefieldBuilding } from './types';

interface TaskBuildingProps {
  building: BattlefieldBuilding;
}

/**
 * Wireframe holographic building sized by complexity tier.
 * Features:
 * - Rise-from-ground entry animation (500ms)
 * - Progressive damage via vertex displacement
 * - Color shift based on damage level
 * - Hologram flicker effect
 */
export function TaskBuilding({ building }: TaskBuildingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const entryProgress = useRef(0);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const geometriesRef = useRef<THREE.BufferGeometry[]>([]);
  const originalPositions = useRef<Float32Array[]>([]);

  // Create geometry for this building tier
  const geometries = useMemo(() => {
    const geos = createBuildingGeometries(building.tier);
    geometriesRef.current = geos;
    // Store original vertex positions for damage displacement
    originalPositions.current = geos.map((g) => {
      const pos = g.getAttribute('position');
      return new Float32Array(pos.array);
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

  // Get current color based on damage
  const getColor = (damage: number): string => {
    if (damage < 0.25) return HOLO_COLORS.primary;
    if (damage < 0.5) return HOLO_COLORS.damage25;
    if (damage < 0.75) return '#ff8800';
    return HOLO_COLORS.damage75;
  };

  // Animation loop
  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    // Entry animation: rise from ground
    if (entryProgress.current < 1) {
      entryProgress.current = Math.min(1, entryProgress.current + dt * 2); // 500ms
      const ease = 1 - Math.pow(1 - entryProgress.current, 3); // ease-out cubic
      groupRef.current.scale.y = ease;
      groupRef.current.position.y = -building.scale * (1 - ease);
    }

    // Hologram flicker
    const flickerBase = 0.7 + Math.sin(t * 3 + building.position[0]) * 0.1;
    const flickerGlitch = Math.random() > 0.97 ? 0.3 : 0; // Rare glitch flash

    // Update materials
    const color = getColor(building.damage);
    materialsRef.current.forEach((mat) => {
      mat.color.set(color);
      mat.opacity = flickerBase - flickerGlitch;
    });

    // Apply damage displacement to vertices
    if (building.damage > 0.1) {
      geometries.forEach((geo, geoIdx) => {
        const pos = geo.getAttribute('position') as THREE.BufferAttribute;
        const orig = originalPositions.current[geoIdx];
        if (!orig) return;

        const damageIntensity = building.damage * 0.3;
        for (let i = 0; i < pos.count; i++) {
          const ox = orig[i * 3];
          const oy = orig[i * 3 + 1];
          const oz = orig[i * 3 + 2];

          // Noise-based displacement that increases with damage
          const noise = Math.sin(ox * 5 + t * 2) * Math.cos(oz * 5 + t * 1.5) * damageIntensity;
          pos.setXYZ(
            i,
            ox + noise * (0.5 + Math.random() * 0.5),
            oy + Math.abs(noise) * 0.3 * (building.damage > 0.75 ? -1 : 1),
            oz + noise * (0.5 + Math.random() * 0.5),
          );
        }
        pos.needsUpdate = true;
      });
    }
  });

  return (
    <group
      ref={groupRef}
      position={[building.position[0], 0, building.position[2]]}
      scale={[building.scale, 0, building.scale]} // Y starts at 0 for entry animation
    >
      {geometries.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshBasicMaterial
            ref={(mat) => {
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
    </group>
  );
}
