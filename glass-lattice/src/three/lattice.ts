import {ExtrudeGeometry, Path, Shape} from 'three/webgpu';

/** Side length of the square frame before it is rotated 45deg into a diamond. */
export const FRAME_SIZE = 1;
/** Width of the glass band. */
export const BAND = 0.105;
/** Extrusion depth — gives every frame a visible glassy side wall. */
export const DEPTH = 0.15;
/** Outer corner rounding. */
export const CORNER_RADIUS = 0.2;

/**
 * Grid pitch. Pure corner-to-corner tiling would be `FRAME_SIZE * SQRT2`; the
 * slight squeeze makes neighbouring bands overlap so the lattice reads as woven
 * rather than as separate tiles, which is what the reference does.
 */
export const PITCH = FRAME_SIZE * Math.SQRT2 * 0.94;

/** Alternating z used to weave the lattice at the overlaps. */
export const WEAVE = DEPTH * 0.62;

const roundedRect = <T extends Shape | Path>(target: T, size: number, radius: number): T => {
  const h = size / 2;
  const r = Math.min(radius, h);
  target.moveTo(-h + r, -h);
  target.lineTo(h - r, -h);
  target.absarc(h - r, -h + r, r, -Math.PI / 2, 0, false);
  target.lineTo(h, h - r);
  target.absarc(h - r, h - r, r, 0, Math.PI / 2, false);
  target.lineTo(-h + r, h);
  target.absarc(-h + r, h - r, r, Math.PI / 2, Math.PI, false);
  target.lineTo(-h, -h + r);
  target.absarc(-h + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
  return target;
};

/**
 * One frame of the lattice: a rounded square ring, extruded and bevelled. The
 * bevel is what catches the key light and draws the bright edge lines.
 */
export const createFrameGeometry = (): ExtrudeGeometry => {
  const outer = roundedRect(new Shape(), FRAME_SIZE, CORNER_RADIUS);
  outer.holes.push(roundedRect(new Path(), FRAME_SIZE - BAND * 2, Math.max(CORNER_RADIUS - BAND, 0.02)));

  const geometry = new ExtrudeGeometry(outer, {
    depth: DEPTH,
    curveSegments: 24,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelOffset: 0,
    bevelSegments: 3,
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
};

export type LatticeCell = {
  x: number;
  y: number;
  z: number;
};

/**
 * Cells of one lattice layer, laid out on a square grid and woven by parity.
 * Returned in lattice-local space; the caller rotates the whole layer 45deg.
 */
export const createLayerCells = (cols: number, rows: number): LatticeCell[] => {
  const cells: LatticeCell[] = [];
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      cells.push({
        x: (ix - (cols - 1) / 2) * PITCH,
        y: (iy - (rows - 1) / 2) * PITCH,
        z: (ix + iy) % 2 === 0 ? WEAVE : -WEAVE,
      });
    }
  }
  return cells;
};
