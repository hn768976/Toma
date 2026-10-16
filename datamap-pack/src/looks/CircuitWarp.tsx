import React, { useMemo } from "react";
import * as THREE from "three";
import { hexToRgb } from "../lib/color";
import { applyDof, DofParams, makeLines } from "../lib/gl/primitives";
import { PostParams } from "../lib/gl/post";
import { GLStage, SceneFactory } from "../lib/gl/Stage";
import { mulberry32 } from "../lib/random";
import type { CircuitWarpRow } from "../versions";

// Fragments live in a cylinder around the camera path, periodic in depth
// with period L. The camera travels exactly L in 600 frames, so frame 600
// is frame 0. Instead of moving the camera, each fragment's depth is
// wrapped into [-L - NEAR_GAP, -NEAR_GAP) relative to the camera.
const L = 60;
const NEAR_GAP = 0.3;
const R_MIN = 0.15;
const R_MAX = 9;
const POLYLINES = 6000;
const DASHES = 1500;
const BRACKETS = 6;
const FOV = 62;
const ASPECT = 16 / 9;

// Travel speed: L per 600 frames.
const SPEED = L / 600;
const TRAIL = SPEED * 3; // dash trail length (world units), from the speed alone

type Frag = {
  anchorZ: number;
  extent: number; // depth extent behind the anchor (>= 0)
  segs: number[]; // flat [ax,ay,az,bx,by,bz,...] relative to anchor z
  bright: number; // 0..1 mix dim -> bright colour
  alpha: number;
  width: number;
  dash: boolean;
};

const cache = new Map<number, { frags: Frag[]; segCount: number }>();
const buildField = (seed: number) => {
  const c = cache.get(seed);
  if (c) return c;
  const rng = mulberry32(seed);
  const frags: Frag[] = [];
  let segCount = 0;
  const pickRadius = () => R_MIN + (R_MAX - R_MIN) * Math.sqrt(rng());
  const add = (f: Omit<Frag, "extent">) => {
    let extent = 0;
    for (let i = 2; i < f.segs.length; i += 3) extent = Math.max(extent, -f.segs[i]);
    frags.push({ ...f, extent: extent + (f.dash ? TRAIL : 0) });
    segCount += f.segs.length / 6;
  };
  // Right-angle circuit traces: 2-5 axis-aligned segments; z runs (along
  // the travel direction) are long so they streak radially in perspective.
  for (let n = 0; n < POLYLINES; n++) {
    const r = pickRadius();
    const th = rng() * Math.PI * 2;
    let x = Math.cos(th) * r;
    let y = Math.sin(th) * r;
    // A share sits on the planes of a box tunnel (floor heaviest, then the
    // walls), which gives the field its floor/wall perspective structure.
    const plane = rng();
    if (plane < 0.1) {
      x = (rng() - 0.5) * 9;
      y = -1.7 - rng() * 0.3;
    } else if (plane < 0.2) {
      x = (rng() < 0.5 ? -1 : 1) * (3.0 + rng() * 0.3);
      y = (rng() - 0.5) * 5;
    }
    let z = 0;
    const k = 2 + Math.floor(rng() * 4);
    const segs: number[] = [];
    let lastAxis = -1;
    for (let s = 0; s < k; s++) {
      let axis = Math.floor(rng() * 3);
      if (axis === lastAxis) axis = (axis + 1 + Math.floor(rng() * 2)) % 3;
      lastAxis = axis;
      const len = axis === 2 ? 0.08 + rng() * 0.45 : 0.04 + rng() * 0.22;
      const sign = rng() < 0.5 ? -1 : 1;
      const nx = x + (axis === 0 ? len * sign : 0);
      const ny = y + (axis === 1 ? len * sign : 0);
      const nz = z + (axis === 2 ? -len : 0);
      segs.push(x, y, z, nx, ny, nz);
      x = nx;
      y = ny;
      z = nz;
    }
    add({ anchorZ: rng() * L, segs, bright: rng() ** 0.8, alpha: 0.8 + rng() * 0.2, width: 1.1 + rng() * 0.7, dash: false });
  }
  // Faint long traces further out (fill the frame edges, as on a board).
  for (let n = 0; n < 500; n++) {
    const r = 4 + rng() * 8;
    const th = rng() * Math.PI * 2;
    const x = Math.cos(th) * r;
    const y = Math.sin(th) * r;
    const horiz = rng() < 0.5;
    const len = 0.5 + rng() * 1.6;
    const segs = horiz ? [x, y, 0, x + len, y, 0] : [x, y, 0, x, y + len, 0];
    if (rng() < 0.5) segs.push(segs[3], segs[4], 0, segs[3], segs[4], -(0.2 + rng() * 0.6));
    add({ anchorZ: rng() * L, segs, bright: 0.25 * rng(), alpha: 0.5, width: 1.5, dash: false });
  }
  // Deep faint layer: many dim right-angle fragments that fill the gaps
  // between the bright ones and give the field its blue texture.
  for (let n = 0; n < 3500; n++) {
    const r = R_MIN + (R_MAX - R_MIN) * Math.sqrt(rng());
    const th = rng() * Math.PI * 2;
    const x = Math.cos(th) * r;
    const y = Math.sin(th) * r;
    const a = rng() < 0.5;
    const l1 = 0.05 + rng() * 0.25;
    const l2 = 0.05 + rng() * 0.25;
    const segs = a ? [x, y, 0, x + l1, y, 0, x + l1, y, 0, x + l1, y + l2, 0] : [x, y, 0, x, y + l1, 0, x, y + l1, 0, x, y + l1, -l2];
    add({ anchorZ: rng() * L, segs, bright: 0, alpha: 0.28, width: 1.1, dash: false });
  }
  // Large stepped traces and long hairlines near the frame edges.
  for (let n = 0; n < 170; n++) {
    const r = 2.0 + rng() * 6;
    const th = rng() * Math.PI * 2;
    const x = Math.cos(th) * r;
    const y = Math.sin(th) * r;
    const w = (0.6 + rng() * 1.8) * (rng() < 0.5 ? -1 : 1);
    const h = (0.6 + rng() * 2.4) * (rng() < 0.5 ? -1 : 1);
    const segs = rng() < 0.4
      ? [x, y, 0, x, y + h * 1.8, 0]
      : [x, y, 0, x + w, y, 0, x + w, y, 0, x + w, y + h, 0, x + w, y + h, 0, x + w * 1.6, y + h, 0];
    add({ anchorZ: rng() * L, segs, bright: 0.3 * rng(), alpha: 0.5, width: 1.3, dash: false });
  }
  // Bright dashes: short z-runs, drawn with a speed trail.
  for (let n = 0; n < DASHES; n++) {
    const r = pickRadius();
    const th = rng() * Math.PI * 2;
    const x = Math.cos(th) * r;
    const y = Math.sin(th) * r;
    const len = 0.03 + rng() * 0.12;
    add({ anchorZ: rng() * L, segs: [x, y, 0, x, y, -len], bright: 0.85 + rng() * 0.15, alpha: 1.0, width: 2.1, dash: true });
  }
  // A few larger brackets / dotted runs that fly close past the camera.
  for (let n = 0; n < BRACKETS; n++) {
    const side = n % 4;
    const r = 0.9 + rng() * 0.8;
    const th = (side / 4) * Math.PI * 2 + (rng() - 0.5) * 0.9;
    const x = Math.cos(th) * r;
    const y = Math.sin(th) * r;
    const segs: number[] = [];
    const dotted = rng() < 0.5;
    const tx = -Math.sin(th);
    const ty = Math.cos(th);
    const w = 0.5 + rng() * 0.6;
    if (dotted) {
      for (let d = 0; d < 14; d++) {
        const a = d * 0.08;
        segs.push(x + tx * a, y + ty * a, 0, x + tx * (a + 0.035), y + ty * (a + 0.035), 0);
      }
    } else {
      segs.push(x, y, 0, x + tx * w, y + ty * w, 0);
      segs.push(x + tx * w, y + ty * w, 0, x + tx * w, y + ty * w, -1.6);
      segs.push(x, y, 0, x, y, -0.25);
    }
    add({ anchorZ: (n / BRACKETS) * L + rng() * 2, segs, bright: 0.8, alpha: 0.55, width: 2.4, dash: false });
  }
  const out = { frags, segCount };
  cache.set(seed, out);
  return out;
};

const FADE_FAR = 0.45 * L;

const makeFactory = (row: CircuitWarpRow): SceneFactory => () => {
  const { frags, segCount } = buildField(row.seed);
  const lines = makeLines(segCount, true);
  const dim = hexToRgb(row.dim);
  const bright = hexToRgb(row.bright);
  // Static colour/width; only positions and alpha change per frame.
  let n = 0;
  for (const f of frags) {
    const c = dim.map((d, i) => d + (bright[i] - d) * f.bright);
    for (let s = 0; s < f.segs.length; s += 6) {
      lines.color.set([c[0], c[1], c[2], f.alpha], n * 4);
      lines.width[n] = f.width;
      n++;
    }
  }
  lines.touch({ color: true, width: true });
  const scene = new THREE.Scene();
  scene.add(lines.mesh);
  const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.05, 200);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  camera.updateMatrixWorld();
  const dof: DofParams = {
    focus: 9,
    coc: 6,
    cocMax: 5,
    // Fade in from the far end (no popping at the wrap), fade out right
    // before the camera.
    fade: [NEAR_GAP + 1.2, 4.6, FADE_FAR * 0.5, FADE_FAR],
    near: 0.05,
  };
  return {
    scene,
    camera,
    update: (frame, res) => {
      const travel = frame * SPEED;
      let m = 0;
      for (const f of frags) {
        // Depth of the anchor relative to the camera, wrapped into one period.
        const rel = (((f.anchorZ + travel) % L) + L) % L; // 0..L, grows as we fly
        // The deepest vertex reaches the near fade exactly when the anchor
        // wraps, so a fragment is invisible on both sides of the wrap.
        const zBase = -L - NEAR_GAP + rel + f.extent;
        for (let s = 0; s < f.segs.length; s += 6) {
          const o = m * 3;
          lines.a[o] = f.segs[s];
          lines.a[o + 1] = f.segs[s + 1];
          lines.a[o + 2] = f.segs[s + 2] + zBase;
          lines.b[o] = f.segs[s + 3];
          lines.b[o + 1] = f.segs[s + 4];
          lines.b[o + 2] = f.segs[s + 5] + zBase - (f.dash ? TRAIL : 0);
          m++;
        }
      }
      lines.touch({ pos: true });
      applyDof(lines.material, dof, res);
    },
  };
};

export const CircuitWarp: React.FC<{ row: CircuitWarpRow }> = ({ row }) => {
  const build = useMemo(() => makeFactory(row), [row]);
  const post = useMemo<PostParams>(
    () => ({
      bgTop: row.bgEdge,
      bgBottom: row.bgEdge,
      bgCenter: row.bgCenter,
      bgCenterPos: [0.47, 0.53, 0.4],
      bgCenterAmt: 0.15,
      vignette: 0.1,
      grain: 0.01,
      bloom: { strength: 0.6, threshold: 0.1, radius: 1.6 },
    }),
    [row],
  );
  return <GLStage build={build} post={post} />;
};
