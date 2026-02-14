import * as THREE from 'three';
import type { BuildingTier } from './types';

/**
 * Pure geometry factory functions for each building tier.
 * All buildings are wireframe holographic style - geometry only, no materials.
 * Returns a THREE.Group containing all geometry pieces for the building.
 */

/** Small hut/shed - complexity 1-2 */
function createHutGeometry(): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];

  // Base box
  const base = new THREE.BoxGeometry(1.2, 0.8, 1.2);
  base.translate(0, 0.4, 0);
  geometries.push(base);

  // Roof (pyramid via cone with 4 sides)
  const roof = new THREE.ConeGeometry(0.9, 0.6, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(0, 1.1, 0);
  geometries.push(roof);

  return geometries;
}

/** Barracks - complexity 3-4 */
function createBarracksGeometry(): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];

  // Main building - elongated
  const main = new THREE.BoxGeometry(2, 1.2, 1);
  main.translate(0, 0.6, 0);
  geometries.push(main);

  // Roof ridge
  const roof = new THREE.CylinderGeometry(0, 0.6, 0.5, 4);
  roof.rotateZ(Math.PI / 2);
  roof.scale(2, 1, 1);
  roof.translate(0, 1.45, 0);
  geometries.push(roof);

  // Door frame
  const door = new THREE.BoxGeometry(0.3, 0.6, 0.05);
  door.translate(0, 0.3, 0.525);
  geometries.push(door);

  return geometries;
}

/** Fortress with pillars - complexity 5-6 */
function createFortressGeometry(): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];

  // Main structure
  const base = new THREE.BoxGeometry(2, 1.5, 2);
  base.translate(0, 0.75, 0);
  geometries.push(base);

  // Four corner pillars
  const pillarPositions = [[-0.9, 0, -0.9], [0.9, 0, -0.9], [-0.9, 0, 0.9], [0.9, 0, 0.9]];
  for (const [px, , pz] of pillarPositions) {
    const pillar = new THREE.CylinderGeometry(0.12, 0.12, 2, 6);
    pillar.translate(px, 1, pz);
    geometries.push(pillar);
  }

  // Top battlement ring
  const ring = new THREE.TorusGeometry(1.1, 0.08, 4, 4);
  ring.rotateX(Math.PI / 2);
  ring.translate(0, 2, 0);
  geometries.push(ring);

  return geometries;
}

/** Citadel with towers - complexity 7-8 */
function createCitadelGeometry(): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];

  // Central keep
  const keep = new THREE.BoxGeometry(1.5, 2.5, 1.5);
  keep.translate(0, 1.25, 0);
  geometries.push(keep);

  // Outer walls
  const wall = new THREE.BoxGeometry(3, 1.2, 3);
  wall.translate(0, 0.6, 0);
  geometries.push(wall);

  // Four corner towers
  const towerPositions = [[-1.4, 0, -1.4], [1.4, 0, -1.4], [-1.4, 0, 1.4], [1.4, 0, 1.4]];
  for (const [tx, , tz] of towerPositions) {
    const tower = new THREE.CylinderGeometry(0.3, 0.35, 2, 8);
    tower.translate(tx, 1, tz);
    geometries.push(tower);

    // Tower top
    const cap = new THREE.ConeGeometry(0.35, 0.5, 8);
    cap.translate(tx, 2.25, tz);
    geometries.push(cap);
  }

  // Central spire
  const spire = new THREE.ConeGeometry(0.2, 1, 6);
  spire.translate(0, 3, 0);
  geometries.push(spire);

  return geometries;
}

/** Massive command castle - complexity 9-10 */
function createCastleGeometry(): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];

  // Central tower (tall)
  const central = new THREE.BoxGeometry(1.2, 3.5, 1.2);
  central.translate(0, 1.75, 0);
  geometries.push(central);

  // Central spire
  const spire = new THREE.ConeGeometry(0.8, 1.5, 6);
  spire.translate(0, 4.25, 0);
  geometries.push(spire);

  // Inner wall
  const innerWall = new THREE.BoxGeometry(3, 1.5, 3);
  innerWall.translate(0, 0.75, 0);
  geometries.push(innerWall);

  // Outer wall (lower)
  const outerWall = new THREE.BoxGeometry(4, 1, 4);
  outerWall.translate(0, 0.5, 0);
  geometries.push(outerWall);

  // Eight towers (4 corners + 4 mid-walls)
  const towerPositions = [
    [-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9],
    [0, -1.9], [0, 1.9], [-1.9, 0], [1.9, 0],
  ];
  for (let i = 0; i < towerPositions.length; i++) {
    const [tx, tz] = towerPositions[i];
    const isCorner = i < 4;
    const height = isCorner ? 2.5 : 1.8;
    const radius = isCorner ? 0.3 : 0.2;

    const tower = new THREE.CylinderGeometry(radius, radius + 0.05, height, 8);
    tower.translate(tx, height / 2, tz);
    geometries.push(tower);

    if (isCorner) {
      const cap = new THREE.ConeGeometry(radius + 0.05, 0.6, 8);
      cap.translate(tx, height + 0.3, tz);
      geometries.push(cap);
    }
  }

  // Gate
  const gate = new THREE.BoxGeometry(0.6, 0.8, 0.1);
  gate.translate(0, 0.4, 2.05);
  geometries.push(gate);

  return geometries;
}

/** Get building geometries for a given tier */
export function createBuildingGeometries(tier: BuildingTier): THREE.BufferGeometry[] {
  switch (tier) {
    case 'hut': return createHutGeometry();
    case 'barracks': return createBarracksGeometry();
    case 'fortress': return createFortressGeometry();
    case 'citadel': return createCitadelGeometry();
    case 'castle': return createCastleGeometry();
  }
}

/** Dispose all geometries in an array */
export function disposeGeometries(geometries: THREE.BufferGeometry[]): void {
  for (const g of geometries) {
    g.dispose();
  }
}
