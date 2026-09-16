import {ExtrudeGeometry, Path, Shape} from 'three/webgpu';

/**
 * The cell is a rhombus, not a square turned 45deg: in the reference the
 * diamonds are distinctly taller than they are wide even where the plane is
 * closest to the camera, so the shape carries the aspect rather than the
 * perspective.
 */
export const HALF_WIDTH = 0.85;
export const HALF_HEIGHT = 1;
/** Width of the glass slab that forms each side of the rhombus. */
export const BAND = 0.16;
/** Extrusion depth. The bars read as deep slabs, with a visible inner wall. */
export const DEPTH = 0.34;
/** Corners are mitred with only a small fillet. */
export const CORNER_RADIUS = 0.09;

/**
 * Pitch. Exact corner-to-corner tiling would be `2 * HALF_*`; the squeeze makes
 * neighbouring bars cross, which is what gives the lattice its woven look.
 */
export const PITCH_X = HALF_WIDTH * 2 * 0.94;
export const PITCH_Y = HALF_HEIGHT * 2 * 0.94;

/** Alternating z, so the bars weave over and under at every crossing. */
export const WEAVE = DEPTH * 0.55;

type Point = readonly [number, number];

const roundedPolygon = <T extends Shape | Path>(target: T, points: Point[], radius: number): T => {
  const count = points.length;

  for (let i = 0; i < count; i++) {
    const previous = points[(i - 1 + count) % count];
    const current = points[i];
    const next = points[(i + 1) % count];

    const toPrevious = [previous[0] - current[0], previous[1] - current[1]];
    const toNext = [next[0] - current[0], next[1] - current[1]];
    const previousLength = Math.hypot(toPrevious[0], toPrevious[1]);
    const nextLength = Math.hypot(toNext[0], toNext[1]);

    // Never eat more than half an edge, or adjacent fillets would overlap.
    const r = Math.min(radius, previousLength / 2, nextLength / 2);
    const enter = [
      current[0] + (toPrevious[0] / previousLength) * r,
      current[1] + (toPrevious[1] / previousLength) * r,
    ];
    const leave = [
      current[0] + (toNext[0] / nextLength) * r,
      current[1] + (toNext[1] / nextLength) * r,
    ];

    if (i === 0) {
      target.moveTo(enter[0], enter[1]);
    } else {
      target.lineTo(enter[0], enter[1]);
    }
    // The corner itself is the control point, so the fillet is tangent to both edges.
    target.quadraticCurveTo(current[0], current[1], leave[0], leave[1]);
  }

  target.closePath();
  return target;
};

const rhombus = (w: number, h: number): Point[] => [
  [w, 0],
  [0, h],
  [-w, 0],
  [0, -h],
];

/**
 * One cell: a rhombus ring of flat glass slabs, extruded with a fine bevel.
 *
 * The inner rhombus is the outer one offset inward by BAND. For a rhombus the
 * inward offset is a uniform scale: the distance from the centre to each edge
 * is `w * h / hypot(w, h)`, so subtracting BAND from that distance and dividing
 * gives the factor.
 */
export const createFrameGeometry = (): ExtrudeGeometry => {
  const edgeDistance = (HALF_WIDTH * HALF_HEIGHT) / Math.hypot(HALF_WIDTH, HALF_HEIGHT);
  const inner = 1 - BAND / edgeDistance;

  const shape = roundedPolygon(new Shape(), rhombus(HALF_WIDTH, HALF_HEIGHT), CORNER_RADIUS);
  shape.holes.push(
    roundedPolygon(
      new Path(),
      rhombus(HALF_WIDTH * inner, HALF_HEIGHT * inner),
      CORNER_RADIUS * inner,
    ),
  );

  const geometry = new ExtrudeGeometry(shape, {
    depth: DEPTH,
    curveSegments: 28,
    // A bevel is what catches the key light along every edge, but ExtrudeGeometry
    // folds it into itself at the rhombus's acute corners if it is anything but
    // small — which showed up as a dotted seam and a creased inner wall.
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelOffset: 0,
    bevelSegments: 1,
  });
  // ExtrudeGeometry already computes its own normals; recomputing here would
  // only flatten the corner walls.
  geometry.center();
  return geometry;
};

export type LatticeCell = {
  x: number;
  y: number;
  z: number;
};

export const createLayerCells = (cols: number, rows: number): LatticeCell[] => {
  const cells: LatticeCell[] = [];
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      cells.push({
        x: (ix - (cols - 1) / 2) * PITCH_X,
        y: (iy - (rows - 1) / 2) * PITCH_Y,
        z: (ix + iy) % 2 === 0 ? WEAVE : -WEAVE,
      });
    }
  }
  return cells;
};
