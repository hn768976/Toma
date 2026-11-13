import * as THREE from "three";

/**
 * Procedural lead-frame strip.
 *
 * One "unit" is a 10 x 10 square site of the stamped metal sheet:
 *
 *   - a square die paddle in the middle, held by four diagonal tie bars
 *   - 4 x 21 thin lead fingers fanning out from the paddle to a dam bar
 *   - short outer leads between the dam bar and the frame
 *   - a frame rail with tooling slots, rounded pilot slots and a corner hole
 *
 * The outline is built as a THREE.Shape with real holes and extruded, so the
 * stamped openings have true side walls that catch the light. Slots that sit
 * on the border between two units are cut as half-notches into the outline,
 * which makes the units tile seamlessly when instanced on a grid.
 */

export const UNIT = 10;
export const HALF = UNIT / 2;
export const PLATE_THICKNESS = 0.26;

export const PADDLE_HALF = 1.78;
export const DIE_HALF = 1.55;
export const DIE_HEIGHT = 0.32;

const TIP = 2.02; // inner end of the lead fingers
const DAM_IN = 3.75; // inner edge of the dam bar
const DAM_OUT = 3.91;
const FRAME_IN = 4.32; // inner edge of the frame rail
const TIE_HALF_WIDTH = 0.13;
export const FINGERS_PER_SIDE = 21;
const FINGER_W_IN = 0.058;
const FINGER_W_OUT = 0.1;

const SLOT_HALF_LEN = 0.56;
const SLOT_HALF_DEPTH = 0.26;
const SLOT_CENTRES = [-2.65, 0, 2.65];
const CORNER_R = 0.2;

type P = [number, number];

const rot = (p: P, quarterTurns: number): P => {
  let [x, y] = p;
  for (let i = 0; i < quarterTurns; i++) {
    [x, y] = [-y, x];
  }
  return [x, y];
};

const pathFrom = (pts: P[]) => {
  const path = new THREE.Path();
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    path.lineTo(pts[i][0], pts[i][1]);
  }
  path.closePath();
  return path;
};

const rectHole = (x0: number, y0: number, x1: number, y1: number, turns: number) =>
  pathFrom(
    (
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ] as P[]
    ).map((p) => rot(p, turns)),
  );

/** A rounded ("stadium") slot centred on (cx, cy), long axis along x. */
const stadiumHole = (cx: number, cy: number, halfLen: number, r: number, turns: number) => {
  const pts: P[] = [];
  const SEG = 6;
  for (let i = 0; i <= SEG; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / SEG;
    pts.push([cx + halfLen - r + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  for (let i = 0; i <= SEG; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / SEG;
    pts.push([cx - halfLen + r + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pathFrom(pts.map((p) => rot(p, turns)));
};

/** x position of finger k at its inner tip / at the dam bar (side facing +y). */
const fingerX = (k: number) => {
  const delta = TIE_HALF_WIDTH * Math.SQRT2;
  const a = TIP - delta - 0.2;
  const b = DAM_IN - delta - 0.32;
  const u = k / (FINGERS_PER_SIDE - 1);
  return { xi: -a + 2 * a * u, xo: -b + 2 * b * u };
};

/** The comb-shaped opening between paddle, tie bars, fingers and dam bar. */
const combHole = (turns: number) => {
  const delta = TIE_HALF_WIDTH * Math.SQRT2;
  const pts: P[] = [];
  pts.push([-(PADDLE_HALF - delta), PADDLE_HALF]);
  pts.push([PADDLE_HALF - delta, PADDLE_HALF]);
  pts.push([DAM_IN - delta, DAM_IN]);
  for (let k = FINGERS_PER_SIDE - 1; k >= 0; k--) {
    const { xi, xo } = fingerX(k);
    pts.push([xo + FINGER_W_OUT / 2, DAM_IN]);
    pts.push([xi + FINGER_W_IN / 2, TIP]);
    pts.push([xi - FINGER_W_IN / 2, TIP]);
    pts.push([xo - FINGER_W_OUT / 2, DAM_IN]);
  }
  pts.push([-(DAM_IN - delta), DAM_IN]);
  return pathFrom(pts.map((p) => rot(p, turns)));
};

const outline = () => {
  const pts: P[] = [];
  // One side (the bottom edge, travelling in +x), then rotated three times.
  const side: P[] = [];
  // corner arc at (-HALF, -HALF): from the point on the left edge to the bottom edge
  const ARC = 6;
  for (let i = 0; i <= ARC; i++) {
    const a = (Math.PI / 2) * (1 - i / ARC);
    side.push([-HALF + Math.cos(a) * CORNER_R, -HALF + Math.sin(a) * CORNER_R]);
  }
  for (const c of SLOT_CENTRES) {
    side.push([c - SLOT_HALF_LEN, -HALF]);
    side.push([c - SLOT_HALF_LEN, -HALF + SLOT_HALF_DEPTH]);
    side.push([c + SLOT_HALF_LEN, -HALF + SLOT_HALF_DEPTH]);
    side.push([c + SLOT_HALF_LEN, -HALF]);
  }
  for (let t = 0; t < 4; t++) {
    for (const p of side) {
      pts.push(rot(p, t));
    }
  }
  return pts;
};

export const buildUnitGeometry = (): THREE.BufferGeometry => {
  const o = outline();
  const shape = new THREE.Shape();
  shape.moveTo(o[0][0], o[0][1]);
  for (let i = 1; i < o.length; i++) {
    shape.lineTo(o[i][0], o[i][1]);
  }
  shape.closePath();

  for (let t = 0; t < 4; t++) {
    shape.holes.push(combHole(t));
    // openings between the outer leads (dam bar -> frame)
    for (let k = 0; k < FINGERS_PER_SIDE - 1; k++) {
      const x0 = fingerX(k).xo + FINGER_W_OUT / 2;
      const x1 = fingerX(k + 1).xo - FINGER_W_OUT / 2;
      shape.holes.push(rectHole(x0, DAM_OUT, x1, FRAME_IN, t));
    }
    // rounded pilot slots on the rail, between the tooling slots
    for (const x of [-3.85, -1.33, 1.33, 3.85]) {
      shape.holes.push(stadiumHole(x, 4.7, 0.3, 0.105, t));
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: PLATE_THICKNESS,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  // Shape lives in XY; lay it flat with the top face at y = 0.
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -PLATE_THICKNESS, 0);

  // The underside of the sheet is never seen: drop its triangles.
  // (ExtrudeGeometry is non-indexed: every three vertices form a triangle.)
  const pos = geo.getAttribute("position");
  const kept: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(c.clone().sub(a));
    if (n.y < 0 && Math.abs(n.y) > 0.5 * n.length()) {
      continue;
    }
    kept.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(kept, 3));
  out.computeVertexNormals();
  geo.dispose();
  return out;
};

/** Positions (unit-local, on the plate) of the raised tie-bar ribs. */
export const tieBars = (): { x: number; z: number; angle: number; length: number }[] => {
  const out = [];
  const d0 = PADDLE_HALF * Math.SQRT2 + 0.1;
  const d1 = DAM_OUT * Math.SQRT2 - 0.1;
  const mid = (d0 + d1) / 2;
  for (let t = 0; t < 4; t++) {
    const a = Math.PI / 4 + (t * Math.PI) / 2;
    out.push({ x: Math.cos(a) * mid, z: Math.sin(a) * mid, angle: a, length: d1 - d0 });
  }
  return out;
};

/** Bond pads ringing the die (unit-local). */
export const bondPads = (): { x: number; z: number; alongX: boolean }[] => {
  const out = [];
  const N = 21;
  const r = DIE_HALF + 0.085;
  for (let t = 0; t < 4; t++) {
    for (let i = 0; i < N; i++) {
      const u = -1.4 + (2.8 * i) / (N - 1);
      const p = rot([u, r], t);
      out.push({ x: p[0], z: p[1], alongX: t % 2 === 0 });
    }
  }
  return out;
};

/** Embossed dimples on the rails (unit-local). */
export const railDimples = (): { x: number; z: number }[] => {
  const out = [];
  for (let t = 0; t < 4; t++) {
    for (const x of [-4.5, -3.15, -2.1, 2.1, 3.15, 4.5]) {
      const p = rot([x, 4.47], t);
      out.push({ x: p[0], z: p[1] });
    }
  }
  return out;
};
