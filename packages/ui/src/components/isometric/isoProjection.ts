/**
 * Math-based 2:1 isometric projection utilities.
 *
 * Classic diamond-grid isometric (SimCity / Advance Wars style).
 * No CSS 3D transforms needed — all positioning is screen-space math.
 *
 *   sx = (x - z) * TILE_HW + originX
 *   sy = (x + z) * TILE_HH + originY
 */

/** Half-tile dimensions for 2:1 isometric */
export const TILE_HW = 64; // half-width (bigger tiles = less empty space)
export const TILE_HH = 32; // half-height

/** Grid range in world units (−GRID_RANGE..+GRID_RANGE) */
export const GRID_RANGE = 8;

/** Convert world (x, z) to screen (sx, sy) */
export function worldToScreen(
  x: number,
  z: number,
  originX: number,
  originY: number,
): { sx: number; sy: number } {
  return {
    sx: (x - z) * TILE_HW + originX,
    sy: (x + z) * TILE_HH + originY,
  };
}

/**
 * Z-index for isometric depth sorting.
 * Objects further south-east (higher x+z) render on top.
 */
export function isoZIndex(x: number, z: number, layerOffset = 0): number {
  // Base offset of 500 ensures all sprites are above the background (z-index:0)
  // Without this, sprites at negative (x+z) would be behind the background
  return Math.round((x + z) * 10) + layerOffset + 500;
}

/** Layer offsets for z-ordering */
export const Z_LAYER = {
  building: 0,
  agent: 100,
  projectile: 200,
  explosion: 300,
  label: 400,
} as const;

/**
 * Compute the 3 visible faces of an isometric cube/block.
 * Returns SVG polygon point strings for top, left, and right faces.
 *
 * @param cx - Center X on screen
 * @param cy - Center Y on screen (top of the cube body)
 * @param hw - Half-width of the block
 * @param hh - Half-height of the block (hw/2 for standard 2:1 iso)
 * @param blockHeight - Visual height of the block in pixels
 */
export function isoCubeFaces(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  blockHeight: number,
): { top: string; left: string; right: string } {
  // Top diamond face
  const top = [
    `${cx},${cy - hh}`,        // north
    `${cx + hw},${cy}`,        // east
    `${cx},${cy + hh}`,        // south
    `${cx - hw},${cy}`,        // west
  ].join(' ');

  // Left face (west-south)
  const left = [
    `${cx - hw},${cy}`,                       // top-left
    `${cx},${cy + hh}`,                        // top-right
    `${cx},${cy + hh + blockHeight}`,           // bottom-right
    `${cx - hw},${cy + blockHeight}`,           // bottom-left
  ].join(' ');

  // Right face (east-south)
  const right = [
    `${cx + hw},${cy}`,                        // top-left
    `${cx},${cy + hh}`,                         // top-right (south)
    `${cx},${cy + hh + blockHeight}`,            // bottom-right
    `${cx + hw},${cy + blockHeight}`,            // bottom-left
  ].join(' ');

  return { top, left, right };
}

/**
 * Compute the 3 visible faces of an isometric hexagonal prism.
 * Returns SVG polygon point strings for top hex, left face, and right face.
 *
 * @param cx - Center X on screen
 * @param cy - Center Y on screen (top of the prism)
 * @param r  - Radius of the hexagon
 * @param prismHeight - Visual height of the prism in pixels
 */
export function isoHexFaces(
  cx: number,
  cy: number,
  r: number,
  prismHeight: number,
): { top: string; left: string; right: string } {
  // Flat-top hexagon vertices (0° = right)
  const hexPts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i; // 0, 60, 120, 180, 240, 300
    hexPts.push([
      cx + r * Math.cos(angle),
      cy + r * 0.6 * Math.sin(angle), // squish Y for iso perspective
    ]);
  }

  const top = hexPts.map(([x, y]) => `${x},${y}`).join(' ');

  // Left face: vertices 2,3,4 (120°–240°) + extruded
  const left = [
    `${hexPts[2][0]},${hexPts[2][1]}`,
    `${hexPts[3][0]},${hexPts[3][1]}`,
    `${hexPts[4][0]},${hexPts[4][1]}`,
    `${hexPts[4][0]},${hexPts[4][1] + prismHeight}`,
    `${hexPts[3][0]},${hexPts[3][1] + prismHeight}`,
    `${hexPts[2][0]},${hexPts[2][1] + prismHeight}`,
  ].join(' ');

  // Right face: vertices 4,5,0 (240°–360°) + extruded
  const right = [
    `${hexPts[4][0]},${hexPts[4][1]}`,
    `${hexPts[5][0]},${hexPts[5][1]}`,
    `${hexPts[0][0]},${hexPts[0][1]}`,
    `${hexPts[0][0]},${hexPts[0][1] + prismHeight}`,
    `${hexPts[5][0]},${hexPts[5][1] + prismHeight}`,
    `${hexPts[4][0]},${hexPts[4][1] + prismHeight}`,
  ].join(' ');

  return { top, left, right };
}

/** Damage color: green → amber → red based on 0-1 ratio */
export function damageColor(damage: number): string {
  if (damage < 0.25) return '#00ff88';
  if (damage < 0.50) return '#88cc44';
  if (damage < 0.75) return '#ffaa00';
  return '#ff4444';
}

/**
 * Face brightness multiplier for isometric 3-face shading.
 * Top = brightest (lit from above), Left = medium, Right = darkest.
 */
export function faceBrightness(face: 'top' | 'left' | 'right'): number {
  switch (face) {
    case 'top': return 1.0;
    case 'left': return 0.7;
    case 'right': return 0.45;
  }
}

/**
 * Apply brightness to a hex color string.
 * e.g. applyBrightness('#ff8800', 0.7) → darker shade
 */
export function applyBrightness(hexColor: string, brightness: number): string {
  const hex = hexColor.replace('#', '');
  const r = Math.round(parseInt(hex.substring(0, 2), 16) * brightness);
  const g = Math.round(parseInt(hex.substring(2, 4), 16) * brightness);
  const b = Math.round(parseInt(hex.substring(4, 6), 16) * brightness);
  return `rgb(${r},${g},${b})`;
}

/** Diamond dimensions for responsive scaling */
export function getDiamondDimensions() {
  const diamondW = GRID_RANGE * 2 * TILE_HW * 2; // px
  const diamondH = GRID_RANGE * 2 * TILE_HH * 2; // px
  return { diamondW, diamondH };
}
