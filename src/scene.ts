import { Easing, interpolate, random } from 'remotion';
import { CONFIG, DURATION_IN_FRAMES, HEIGHT, WIDTH } from './config';
import type { Variant, VariantId } from './variants';
import { planeMatrix, setMat, type Mat } from './plane';

export type Scene = {
  frame: number;
  id: VariantId;
  v: Variant;
  /** Eased 0→1 draw progress of the curve; drives nodes and counters too. */
  progress: number;
  camScale: number;
  drift: [number, number];
  focus: [number, number];
};

/** Shared easing — the curve, the counters and the camera all ride this. */
export const growthEasing = Easing.out(Easing.cubic);

export const buildScene = (frame: number, id: VariantId, v: Variant): Scene => {
  const progress = interpolate(
    frame,
    [CONFIG.curveDrawStart, CONFIG.curveDrawEnd],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: growthEasing }
  );
  const camScale = interpolate(
    frame,
    [0, DURATION_IN_FRAMES],
    [CONFIG.pushFrom, CONFIG.pushTo],
    { extrapolateRight: 'clamp' }
  );
  // A slow closed figure-eight: returns to where it started, never repeats mid-shot.
  const th = (frame / DURATION_IN_FRAMES) * Math.PI * 2;
  const drift: [number, number] = [
    Math.sin(th) * CONFIG.driftAmplitude,
    (Math.sin(th * 2) * CONFIG.driftAmplitude) / 1.7,
  ];
  return {
    frame,
    id,
    v,
    progress,
    camScale,
    drift,
    focus: [v.shape.center[0] * WIDTH, v.shape.center[1] * HEIGHT],
  };
};

/** Depth-aware plane transform: near layers scale faster than far ones. */
export const layerMatrix = (
  scene: Scene,
  depthFactor: number,
  res: number
): Mat => {
  const scale = 1 + (scene.camScale - 1) * depthFactor;
  return planeMatrix({
    focus: scene.focus,
    scale,
    drift: [scene.drift[0] * depthFactor, scene.drift[1] * depthFactor],
    res,
  });
};

/** Applies the depth-aware plane transform to a context. */
export const setPlane = (
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  depthFactor: number,
  res: number
) => setMat(ctx, layerMatrix(scene, depthFactor, res));

/* ── curve geometry ─────────────────────────────────────────────────── */

export type CurveGeometry = {
  pts: [number, number][];
  cum: number[];
  length: number;
  /** Node anchors, ordered along the curve. */
  nodes: {
    at: number; // arc-length fraction
    x: number;
    y: number;
    tangent: number;
    value: number;
    labelled: boolean;
  }[];
};

const catmullRom = (
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number
): [number, number] => {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
};

const SAMPLES_PER_SEGMENT = 90;

/**
 * Turns the variant's control points into a dense polyline in frame pixels,
 * plus cumulative arc length so the dash reveal and the node timings can be
 * expressed as a single 0→1 progress value.
 */
export const buildCurve = (id: VariantId, v: Variant): CurveGeometry => {
  const cp = v.curve.map(([x, y]) => {
    // curveSteepness bends the whole set about the lower-left origin.
    const yy = 1 - Math.pow(1 - y, CONFIG.curveSteepness);
    return [x * WIDTH, yy * HEIGHT] as [number, number];
  });
  const ext = [cp[0], ...cp, cp[cp.length - 1]];
  const pts: [number, number][] = [];
  for (let i = 0; i < ext.length - 3; i++) {
    for (let s = 0; s < SAMPLES_PER_SEGMENT; s++) {
      pts.push(catmullRom(ext[i], ext[i + 1], ext[i + 2], ext[i + 3], s / SAMPLES_PER_SEGMENT));
    }
  }
  pts.push(ext[ext.length - 2]);

  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const length = cum[cum.length - 1];

  const at = (f: number): { x: number; y: number; tangent: number } => {
    const target = Math.min(Math.max(f, 0), 1) * length;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const midIdx = (lo + hi) >> 1;
      if (cum[midIdx] < target) lo = midIdx;
      else hi = midIdx;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const t = (target - cum[lo]) / seg;
    const x = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t;
    const y = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t;
    const j = Math.min(pts.length - 1, hi + 4);
    return { x, y, tangent: Math.atan2(pts[j][1] - pts[lo][1], pts[j][0] - pts[lo][0]) };
  };

  // Nodes only earn their keep where the curve is actually on screen — the
  // leading end runs off the top-right long before the path ends.
  let visibleEnd = 1;
  for (let i = pts.length - 1; i >= 0; i--) {
    const [x, y] = pts[i];
    if (x > -0.02 * WIDTH && x < 1.02 * WIDTH && y > -0.02 * HEIGHT && y < 1.02 * HEIGHT) {
      visibleEnd = cum[i] / length;
      break;
    }
  }

  const n = CONFIG.nodeCount;
  const [vStart, vEnd] = v.nodeValues;
  const nodes = Array.from({ length: n }, (_, k) => {
    const u = (k + 1) / (n + 1);
    // Bunches the markers toward the steep end of the climb.
    const f = visibleEnd * (1 - Math.pow(1 - u, CONFIG.nodeBunching));
    const p = at(f);
    const jitter = 0.94 + random(`node-val-${id}-${k}`) * 0.12;
    const value = Math.round(
      (vStart + (vEnd - vStart) * Math.pow(f / visibleEnd, 2.3)) * jitter
    );
    return {
      at: f,
      x: p.x,
      y: p.y,
      tangent: p.tangent,
      value,
      labelled: k >= n - 2 || random(`node-lbl-${id}-${k}`) > 0.28,
    };
  });

  return { pts, cum, length, nodes };
};
