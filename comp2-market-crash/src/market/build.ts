import * as THREE from "three";
import { Billboard, Line } from "../engine/layers";
import { clamp, createRng, lerp, Rng, smoothstep } from "../engine/random";
import { MKIND } from "./shapes";

export const FPS = 30;
export const DURATION_FRAMES = 400; // 13.333 s – identical to the reference
const DURATION = DURATION_FRAMES / FPS;

type V3 = [number, number, number];
type C4 = [number, number, number, number];
const v = (x: THREE.Vector3): V3 => [x.x, x.y, x.z];

/* ------------------------------------------------------------------------ */
/* Palette (monochrome red/orange – the essence of the "market crash" look)   */
/* ------------------------------------------------------------------------ */
export const COLORS = {
  text: [1.0, 0.26, 0.06] as V3,
  textHot: [1.0, 0.45, 0.16] as V3,
  line: [1.0, 0.42, 0.2] as V3,
  lineHot: [1.0, 0.72, 0.55] as V3,
  led: [1.0, 0.66, 0.5] as V3,
  candle: [1.0, 0.32, 0.1] as V3,
  flare: [1.0, 0.36, 0.06] as V3,
  spark: [1.0, 0.55, 0.25] as V3,
  dust: [1.0, 0.34, 0.1] as V3,
};
const sq = (s: number): [number, number] => [s, s];
const c4 = (c: V3, i: number): C4 => [c[0], c[1], c[2], i];

/* ------------------------------------------------------------------------ */
/* Timeline curves                                                           */
/* ------------------------------------------------------------------------ */
type Key = [number, number];
export const keyed = (keys: Key[], t: number) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (t <= t1) return lerp(v0, v1, smoothstep(t0, t1, t));
  }
  return keys[keys.length - 1][1];
};

/** Overall "energy" of the shot – bright glowing start, dark middle, bright end (as in the reference). */
export const GLOW_KEYS: Key[] = [
  [0, 0.78],
  [1.6, 0.95],
  [2.6, 1.0],
  [5.2, 1.0],
  [6.6, 0.75],
  [7.6, 0.42],
  [8.2, 0.22],
  [10.2, 0.26],
  [10.9, 0.5],
  [11.8, 0.62],
  [12.5, 0.8],
  [13.34, 0.72],
];

/* ------------------------------------------------------------------------ */
/* Camera                                                                    */
/* ------------------------------------------------------------------------ */
export type CameraFrame = {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  focus: number;
};

type CamKey = { t: number; pos: V3; tgt: V3; roll: number; focus: number };

// Version 1 – recreates the reference move: slow push-in on the flare cluster,
// swooping banked turn through the charts, a darker drift, a push into a
// ticker table and a final pull-focus onto glowing flares.
const V1_KEYS: CamKey[] = [
  { t: 0, pos: [0, 0, 34], tgt: [0, -0.5, 0], roll: 0, focus: 30 },
  { t: 2.4, pos: [1.2, 0.4, 23], tgt: [2.5, -0.6, -2], roll: -0.04, focus: 21 },
  { t: 3.6, pos: [3.5, 1.4, 14], tgt: [9, -1, -8], roll: -0.15, focus: 11 },
  { t: 5.0, pos: [8, 1.2, 4], tgt: [14, -0.5, -14], roll: -0.22, focus: 12 },
  { t: 6.4, pos: [12, 2, -6], tgt: [9, -1, -22], roll: -0.03, focus: 13 },
  { t: 7.8, pos: [10.5, 1.2, -15], tgt: [3, -2, -30], roll: 0.13, focus: 10 },
  { t: 9.4, pos: [6.5, 0, -23], tgt: [0, -3, -40], roll: 0.17, focus: 13 },
  { t: 10.6, pos: [3, -1, -30], tgt: [-1, -3, -48], roll: 0.08, focus: 10 },
  {
    t: 11.8,
    pos: [0.2, -2.2, -37.5],
    tgt: [-0.8, -2.8, -50],
    roll: 0.02,
    focus: 7.2,
  },
  {
    t: 12.5,
    pos: [-1.6, -2.0, -40],
    tgt: [-6, -1, -70],
    roll: -0.04,
    focus: 9,
  },
  {
    t: 13.0,
    pos: [-2.5, -1.8, -41.5],
    tgt: [-7.5, -0.6, -74],
    roll: -0.05,
    focus: 27,
  },
  {
    t: 13.5,
    pos: [-3.2, -1.5, -42.8],
    tgt: [-8.5, -0.4, -77],
    roll: -0.06,
    focus: 29,
  },
];

const gaussianSmooth = (arr: number[], sigma: number) => {
  if (sigma <= 0) return arr.slice();
  const r = Math.ceil(sigma * 3);
  return arr.map((_, i) => {
    let s = 0;
    let w = 0;
    for (let k = -r; k <= r; k++) {
      const j = clamp(i + k, 0, arr.length - 1);
      const g = Math.exp(-(k * k) / (2 * sigma * sigma));
      s += arr[j] * g;
      w += g;
    }
    return s / w;
  });
};

const smoothVecs = (vs: THREE.Vector3[], sigma: number) => {
  const xs = gaussianSmooth(
    vs.map((p) => p.x),
    sigma,
  );
  const ys = gaussianSmooth(
    vs.map((p) => p.y),
    sigma,
  );
  const zs = gaussianSmooth(
    vs.map((p) => p.z),
    sigma,
  );
  return vs.map((_, i) => new THREE.Vector3(xs[i], ys[i], zs[i]));
};

const sampleKeys = (keys: CamKey[]) => {
  const posCurve = new THREE.CatmullRomCurve3(
    keys.map((k) => new THREE.Vector3(...k.pos)),
    false,
    "centripetal",
  );
  const tgtCurve = new THREE.CatmullRomCurve3(
    keys.map((k) => new THREE.Vector3(...k.tgt)),
    false,
    "centripetal",
  );
  const idx = (t: number) => {
    for (let i = 0; i < keys.length - 1; i++) {
      if (t <= keys[i + 1].t) {
        return i + (t - keys[i].t) / (keys[i + 1].t - keys[i].t);
      }
    }
    return keys.length - 1;
  };
  const n = keys.length - 1;
  const pos: THREE.Vector3[] = [];
  const tgt: THREE.Vector3[] = [];
  const roll: number[] = [];
  const focus: number[] = [];
  for (let f = 0; f < DURATION_FRAMES; f++) {
    const t = f / FPS;
    const s = idx(t);
    pos.push(posCurve.getPoint(clamp(s / n, 0, 1)));
    tgt.push(tgtCurve.getPoint(clamp(s / n, 0, 1)));
    const i0 = Math.min(Math.floor(s), n - 1);
    const fr = smoothstep(0, 1, s - i0);
    roll.push(lerp(keys[i0].roll, keys[i0 + 1].roll, fr));
    focus.push(lerp(keys[i0].focus, keys[i0 + 1].focus, fr));
  }
  return { pos, tgt, roll, focus };
};

const toFrames = (
  pos: THREE.Vector3[],
  tgt: THREE.Vector3[],
  roll: number[],
  focus: number[],
  fov: number,
): CameraFrame[] => {
  const cam = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 1000);
  return pos.map((p, f) => {
    cam.position.copy(p);
    cam.up.set(0, 1, 0);
    cam.lookAt(tgt[f]);
    cam.rotateZ(roll[f]);
    return { pos: p.clone(), quat: cam.quaternion.clone(), focus: focus[f] };
  });
};

export const FOV = 45;

export const buildCameraV1 = () => {
  const k = sampleKeys(V1_KEYS);
  const pos = smoothVecs(k.pos, 4);
  const tgt = smoothVecs(k.tgt, 6);
  const roll = gaussianSmooth(k.roll, 6);
  const focus = gaussianSmooth(k.focus.map(Math.log), 5).map(Math.exp);
  return toFrames(pos, tgt, roll, focus, FOV);
};

/**
 * Version 2 – alternative camera: an elevated, steady crane/tracking shot that
 * glides along the same data landscape from high on the right, looking down
 * across the layers. No banking, heavily damped motion, slow focus pulls.
 */
export const buildCameraV2 = () => {
  const k = sampleKeys(V1_KEYS);
  const basePos = smoothVecs(k.pos, 22);
  const baseTgt = smoothVecs(k.tgt, 22);
  const pos: THREE.Vector3[] = [];
  const tgt: THREE.Vector3[] = [];
  const roll: number[] = [];
  const focus: number[] = [];
  for (let f = 0; f < DURATION_FRAMES; f++) {
    const t = f / FPS;
    const u = t / DURATION;
    // lift and offset to the right; slowly descend while tracking
    const off = new THREE.Vector3(
      lerp(14, 6, u),
      lerp(11, 3.5, u),
      lerp(4, 6, u),
    );
    const p = basePos[f].clone().add(off);
    // look at a point between the V1 camera position and its target
    const look = basePos[f]
      .clone()
      .lerp(baseTgt[f], 0.55)
      .add(new THREE.Vector3(-2, -2.5, 0));
    pos.push(p);
    tgt.push(look);
    roll.push(0);
    focus.push(p.distanceTo(look) * 0.8);
  }
  const fs = gaussianSmooth(focus, 12);
  return toFrames(pos, tgt, roll, fs, 40);
};

/* ------------------------------------------------------------------------ */
/* Scene                                                                     */
/* ------------------------------------------------------------------------ */

export type TableSpec = {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  width: number;
  height: number;
  texIndex: number;
  intensity: number;
  appear: number;
  fadeOut?: [number, number];
  nearFade?: number;
  tint: V3;
  uvRect?: [number, number, number, number];
};

export type MarketScene = {
  billboards: Billboard[];
  lines: Line[];
  tables: TableSpec[];
  cameraV1: CameraFrame[];
};

/** Random-walk "crash" curve: x in 0..1, y in -1..1 (descending). */
const crashCurve = (rng: Rng, n: number, steep = 1) => {
  const pts: [number, number][] = [];
  let y = rng.range(0.5, 0.9);
  const crashAt = rng.range(0.35, 0.65);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const drift =
      x > crashAt && x < crashAt + 0.18 ? -0.045 * steep : -0.012 * steep;
    y +=
      drift +
      rng.gauss() * 0.03 +
      (rng.chance(0.08) ? rng.range(0.03, 0.08) : 0);
    pts.push([x, clamp(y, -1, 1.1)]);
  }
  // normalise to start high, end low
  const ys = pts.map((p) => p[1]);
  const mn = Math.min(...ys);
  const mx = Math.max(...ys);
  return pts.map(
    ([x, yy]) => [x, ((yy - mn) / (mx - mn)) * 2 - 1] as [number, number],
  );
};

type Frame = { origin: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3 };

const planeFrame = (
  cam: CameraFrame,
  cx: number,
  cy: number,
  cz: number,
  yaw: number,
  pitch = 0,
): Frame => {
  const q = cam.quat
    .clone()
    .multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0)),
    );
  const origin = cam.pos
    .clone()
    .add(new THREE.Vector3(cx, cy, cz).applyQuaternion(cam.quat));
  return {
    origin,
    right: new THREE.Vector3(1, 0, 0).applyQuaternion(q),
    up: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
  };
};

const onPlane = (fr: Frame, x: number, y: number) =>
  fr.origin
    .clone()
    .add(fr.right.clone().multiplyScalar(x))
    .add(fr.up.clone().multiplyScalar(y));

export const buildMarketScene = (seed = 21): MarketScene => {
  const rng = createRng(seed);
  const cam = buildCameraV1();
  const at = (t: number) =>
    cam[clamp(Math.round(t * FPS), 0, DURATION_FRAMES - 1)];
  const billboards: Billboard[] = [];
  const lines: Line[] = [];
  const tables: TableSpec[] = [];

  /* ------------------------------ charts -------------------------------- */
  const thinChart = (
    fr: Frame,
    w: number,
    h: number,
    start: number,
    dur: number,
    intensity: number,
    steep = 1,
  ) => {
    const pts = crashCurve(rng, rng.int(70, 120), steep).map(([x, y]) =>
      onPlane(fr, (x - 0.5) * w, y * h * 0.5),
    );
    for (let i = 0; i < pts.length - 1; i++) {
      const tt = start + (i / pts.length) * dur;
      lines.push({
        a: v(pts[i]),
        b: v(pts[i + 1]),
        colorA: c4(COLORS.lineHot, intensity * 1.6),
        colorB: c4(COLORS.lineHot, intensity * 1.6),
        widthPx: 4.6,
        timing: [tt, dur / pts.length, 0, 0],
      });
      lines.push({
        a: v(pts[i]),
        b: v(pts[i + 1]),
        colorA: c4(COLORS.line, intensity * 0.3),
        colorB: c4(COLORS.line, intensity * 0.3),
        widthPx: 18,
        timing: [tt, dur / pts.length, 0, 0],
      });
    }
  };

  const ledChart = (
    fr: Frame,
    w: number,
    h: number,
    start: number,
    dur: number,
    intensity: number,
    pitch = 0.16,
  ) => {
    const pts = crashCurve(rng, 60, 1.3).map(([x, y]) =>
      onPlane(fr, (x - 0.5) * w, y * h * 0.5),
    );
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const segLen = a.distanceTo(b);
      const n = Math.max(1, Math.round(segLen / pitch));
      for (let k = 0; k < n; k++) {
        const p = a.clone().lerp(b, k / n);
        const tt = start + ((i + k / n) / pts.length) * dur;
        for (let row = -1; row <= 1; row++) {
          billboards.push({
            pos: v(p.clone().add(fr.up.clone().multiplyScalar(row * pitch))),
            size: [pitch * 0.62, pitch * 0.62],
            color: c4(COLORS.led, intensity * (row === 0 ? 1.6 : 1.3)),
            kind: MKIND.square,
            timing: [tt, 0.15, 0, 0],
            minPx: 2.5,
          });
        }
      }
      acc += segLen;
    }
    return acc;
  };

  const candleChart = (
    fr: Frame,
    w: number,
    h: number,
    count: number,
    appear: number,
    intensity: number,
  ) => {
    let level = rng.range(0.4, 0.8);
    const cw = (w / count) * 0.55;
    for (let i = 0; i < count; i++) {
      const open = level;
      const close = level + rng.gauss() * 0.08 - 0.03;
      const hi = Math.max(open, close) + rng.range(0.02, 0.12);
      const lo = Math.min(open, close) - rng.range(0.02, 0.12);
      level = close;
      const mid = (hi + lo) / 2;
      const half = Math.max((hi - lo) / 2, 0.02);
      const pos = onPlane(fr, (i / count - 0.5) * w, mid * h * 0.5);
      const norm = (yy: number) => (yy - mid) / half;
      billboards.push({
        pos: v(pos),
        size: [cw, half * h],
        color: c4(COLORS.candle, intensity),
        kind: MKIND.candle,
        params: [
          norm(Math.max(open, close)),
          norm(Math.min(open, close)),
          1,
          -1,
        ],
        timing: [appear + (i / count) * 0.8, 0.25, 0, 0],
        minPx: 3,
      });
    }
  };

  /* ------------------------------ flares -------------------------------- */
  const flare = (
    p: THREE.Vector3,
    h: number,
    intensity: number,
    streak = 1,
    timing?: [number, number, number, number],
  ) => {
    billboards.push({
      pos: v(p),
      size: [h * 2.4 * 5, h * 2.4],
      color: c4(COLORS.flare, intensity * 1.4),
      kind: MKIND.flare,
      params: [rng.range(2, 6), rng.range(0, 6), rng.range(0, 6), streak],
      timing: timing ?? [-10, 0.01, 0, 0],
      minPx: 10,
    });
  };

  const scatterAround = (
    center: THREE.Vector3,
    spread: V3,
    count: number,
    kind: "dust" | "square",
    appear = -10,
  ) => {
    for (let i = 0; i < count; i++) {
      const p = center
        .clone()
        .add(
          new THREE.Vector3(
            rng.gauss() * spread[0],
            rng.gauss() * spread[1],
            rng.gauss() * spread[2],
          ),
        );
      if (kind === "dust") {
        billboards.push({
          pos: v(p),
          size: sq(rng.range(0.04, 0.1)),
          color: c4(COLORS.dust, rng.range(0.4, 1.1)),
          kind: MKIND.dot,
          timing: [appear, 0.5, 0, 0],
          vel: [
            rng.gauss() * 0.15,
            rng.gauss() * 0.1 + 0.05,
            rng.gauss() * 0.15,
          ],
          minPx: 2.5,
        });
      } else {
        const s = rng.range(0.08, 0.28);
        billboards.push({
          pos: v(p),
          size: [s * rng.range(1, 2.2), s],
          color: c4(COLORS.spark, rng.range(0.35, 0.9)),
          kind: MKIND.square,
          timing: [appear, 0.4, 0, 0],
          vel: [rng.gauss() * 0.3, rng.gauss() * 0.2, rng.gauss() * 0.3],
          minPx: 3,
        });
      }
    }
  };

  // Opening flare cluster (bright glowing centre of the reference's first beat)
  const c0 = at(0);
  const fr0 = planeFrame(c0, 0, -1.2, -32, 0);
  const clusterCenter = fr0.origin;
  flare(onPlane(fr0, -3.2, -2.8), 4.2, 1.5, 1.3);
  flare(onPlane(fr0, 4.8, 1.0), 3.0, 1.25, 1.1);
  flare(onPlane(fr0, -1.0, 1.8), 2.2, 1.0, 0.9);
  flare(onPlane(fr0, 10.5, 3.8), 1.4, 0.7, 1.0);
  flare(onPlane(fr0, -9.5, 2.6), 1.2, 0.6, 1.0);
  flare(onPlane(fr0, 1.8, -6.5), 1.1, 0.55, 0.7);
  flare(onPlane(fr0, -13, -4), 1.0, 0.5, 0.6);
  flare(onPlane(fr0, 14, -2.5), 1.2, 0.6, 0.8);
  scatterAround(clusterCenter, [14, 6, 8], 260, "dust");
  scatterAround(clusterCenter, [10, 5, 6], 70, "square");

  // spark burst (reference ~2.2 s, lower left)
  {
    const c = at(2.25);
    const fr = planeFrame(c, -4.6, -2.4, -13.5, 0);
    const center = fr.origin;
    billboards.push({
      pos: v(center),
      size: [9, 9],
      color: c4(COLORS.spark, 1.3),
      kind: MKIND.burst,
      params: [0, rng.range(0, 6), 0, 0],
      timing: [1.85, 0.7, 2.9, 1.0],
      minPx: 10,
    });
    flare(center, 2.6, 1.3, 1.3, [1.7, 0.4, 3.2, 1.4]);
    for (let i = 0; i < 26; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const len = rng.range(2.5, 6.5);
      const dir = fr.right
        .clone()
        .multiplyScalar(Math.cos(ang))
        .add(fr.up.clone().multiplyScalar(Math.sin(ang)));
      const a = center.clone().add(dir.clone().multiplyScalar(0.4));
      const b = center.clone().add(dir.clone().multiplyScalar(len));
      lines.push({
        a: v(a),
        b: v(b),
        colorA: c4(COLORS.lineHot, 0.9),
        colorB: c4(COLORS.line, 0.05),
        widthPx: rng.range(1.5, 2.6),
        timing: [1.9 + rng.range(0, 0.25), 0.45, 0, 0],
      });
    }
    for (let i = 0; i < 90; i++) {
      const d = rng.unitVec();
      const sp = rng.range(1.5, 6.5);
      const s = rng.range(0.06, 0.16);
      billboards.push({
        pos: v(center),
        size: [s * rng.range(1, 1.8), s],
        color: c4(COLORS.spark, rng.range(0.5, 1.2)),
        kind: MKIND.square,
        timing: [1.95 + rng.range(0, 0.3), 0.1, 2.6 + rng.range(0, 1.5), 0.8],
        vel: [d[0] * sp, d[1] * sp, d[2] * sp * 0.5],
        minPx: 3,
      });
    }
  }

  // Hero thin chart across the opening frame
  thinChart(planeFrame(c0, -1, 2.2, -24, 0.05), 30, 8, 0.0, 3.0, 0.8, 1);
  thinChart(planeFrame(c0, 3, 3.5, -40, -0.1), 34, 9, 0.3, 3.5, 0.45, 1);

  // Hero LED chart sweeping through foreground (~4.2 s)
  ledChart(planeFrame(at(4.2), 1.8, 0.5, -9.5, -0.25), 9, 13, 2.6, 2.0, 1.0);
  // Second beat thin charts + candles (5–7 s)
  thinChart(planeFrame(at(5.6), -3, 1.5, -13, 0.2), 20, 9, 3.6, 2.5, 0.85, 1.2);
  thinChart(planeFrame(at(6.0), 4, -1, -16, -0.3), 22, 10, 4.0, 2.4, 0.6, 1.1);
  candleChart(planeFrame(at(5.2), 7, 3.0, -17, -0.35), 22, 6, 46, 3.4, 0.9);
  candleChart(planeFrame(at(6.6), -5, 4.5, -20, 0.25), 18, 5, 36, 4.6, 0.7);
  // Close blurred LED chart + diagonal light streak (~7.2 s)
  ledChart(
    planeFrame(at(7.2), -0.8, -0.4, -4.6, 0.05),
    6.0,
    3.2,
    5.6,
    1.6,
    1.1,
    0.11,
  );
  {
    const fr = planeFrame(at(6.9), 0, 0, -7, 0);
    const a = onPlane(fr, -2, 4.5);
    const b = onPlane(fr, 7, -5);
    lines.push({
      a: v(a),
      b: v(b),
      colorA: c4(COLORS.lineHot, 1.6),
      colorB: c4(COLORS.lineHot, 0.6),
      widthPx: 5,
      timing: [6.4, 0.35, 0, 0],
    });
    lines.push({
      a: v(a),
      b: v(b),
      colorA: c4(COLORS.flare, 0.35),
      colorB: c4(COLORS.flare, 0.1),
      widthPx: 60,
      timing: [6.4, 0.35, 0, 0],
    });
    const sq = onPlane(planeFrame(at(8.0), 0, 0, -6, 0), -0.6, -1.0);
    billboards.push({
      pos: v(sq),
      size: [0.75, 0.45],
      color: c4(COLORS.lineHot, 0.9),
      kind: MKIND.square,
      timing: [7.0, 0.3, 0, 0],
      minPx: 4,
    });
  }
  // Dark middle section – thin red charts (8–10 s)
  thinChart(
    planeFrame(at(8.6), -2.5, 1.2, -13, 0.1),
    18,
    9,
    6.8,
    2.6,
    0.75,
    1.1,
  );
  thinChart(planeFrame(at(9.0), 5, 3.5, -22, -0.2), 26, 9, 7.2, 2.5, 0.5, 1.0);
  candleChart(planeFrame(at(8.4), 6, 4.5, -18, -0.3), 18, 5, 40, 6.6, 0.55);
  thinChart(
    planeFrame(at(9.6), 1.5, 0.5, -14, 0.15),
    16,
    10,
    7.8,
    2.2,
    0.7,
    1.3,
  );
  // LED chart in foreground (~10.4 s)
  ledChart(planeFrame(at(10.35), 0.6, 0.2, -9, -0.15), 7, 12, 8.6, 1.8, 1.0);

  // Final flare cluster beyond the hero table
  {
    const c = at(13.2);
    const fr = planeFrame(c, 0, -0.6, -28, 0);
    flare(onPlane(fr, -1.6, -1.6), 3.4, 1.6, 1.3, [11.4, 1.0, 0, 0]);
    flare(onPlane(fr, 4.4, 0.9), 2.4, 1.2, 1.1, [11.6, 1.0, 0, 0]);
    flare(onPlane(fr, -6.5, 1.8), 1.2, 0.7, 1.0, [11.8, 1.0, 0, 0]);
    flare(onPlane(fr, 9.0, -3.2), 1.0, 0.6, 0.8, [11.8, 1.0, 0, 0]);
    flare(onPlane(fr, 1.0, 3.6), 1.0, 0.55, 0.8, [11.8, 1.0, 0, 0]);
    scatterAround(fr.origin, [12, 5, 6], 200, "dust", 11.2);
    scatterAround(fr.origin, [9, 4, 5], 40, "square", 11.2);
    thinChart(planeFrame(c, -4, 1.0, -36, 0.1), 14, 4, 11.4, 1.6, 0.35, 1);
  }

  /* ------------------------------ tables -------------------------------- */
  const pushTable = (
    c: CameraFrame,
    cx: number,
    cy: number,
    cz: number,
    yaw: number,
    w: number,
    intensity: number,
    appear: number,
    tex: number,
    fadeOut?: [number, number],
    nearFade?: number,
  ) => {
    const q = c.quat
      .clone()
      .multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
      );
    const pos = c.pos
      .clone()
      .add(new THREE.Vector3(cx, cy, cz).applyQuaternion(c.quat));
    tables.push({
      pos,
      quat: q,
      width: w,
      height: w / 2,
      texIndex: tex,
      intensity,
      appear,
      fadeOut,
      nearFade,
      tint: COLORS.text,
    });
  };
  // background table walls along the path
  for (let i = 0; i < 13; i++) {
    const t = rng.range(0, DURATION - 1.5);
    const c = at(t);
    const side = rng.chance(0.5) ? 1 : -1;
    const cx = side * rng.range(3, 20);
    const cy = rng.range(-6, 6);
    const cz = -rng.range(22, 46);
    pushTable(
      c,
      cx,
      cy,
      cz,
      -side * rng.range(0.1, 0.65),
      rng.range(12, 20),
      rng.range(0.35, 0.7),
      -10,
      rng.int(0, 5),
    );
  }
  // tables framing the opening shot (faint, behind the flares)
  pushTable(c0, -14, 4, -46, 0.15, 22, 0.32, -10, 0);
  pushTable(c0, 12, 4.5, -48, -0.1, 22, 0.32, -10, 1);
  pushTable(c0, 2, -10, -44, 0.0, 22, 0.25, -10, 2);
  // second-beat tables (top right in the reference around 3–5 s)
  pushTable(at(4.2), 7, 4.5, -19, -0.3, 13, 0.8, -10, 3);
  pushTable(at(5.6), 8, 4, -18, -0.25, 11, 0.8, -10, 4);
  pushTable(at(9.6), -0.5, -0.5, -16, 0.1, 13, 0.6, -10, 2);
  // hero table – the camera pushes into it (~11.8 s)
  pushTable(
    at(11.9),
    -0.5,
    -0.7,
    -7.6,
    0.06,
    13.5,
    1.15,
    -10,
    5,
    [12.15, 0.55],
    2.5,
  );
  pushTable(at(11.0), -14, 0, -14, 0.25, 14, 0.7, -10, 1);

  /* ------------------------------ ambient ------------------------------- */
  for (let i = 0; i < 26; i++) {
    const t = rng.range(0, DURATION);
    const c = at(t);
    const p = c.pos
      .clone()
      .add(
        new THREE.Vector3(
          rng.range(-14, 14),
          rng.range(-6, 6),
          -rng.range(10, 40),
        ).applyQuaternion(c.quat),
      );
    flare(p, rng.range(0.5, 1.2), rng.range(0.3, 0.7), rng.range(0.5, 1));
  }
  for (let i = 0; i < 1800; i++) {
    const t = rng.range(0, DURATION);
    const c = at(t);
    const p = c.pos
      .clone()
      .add(
        new THREE.Vector3(
          rng.range(-22, 22),
          rng.range(-12, 12),
          -rng.range(3, 45),
        ).applyQuaternion(c.quat),
      );
    billboards.push({
      pos: v(p),
      size: sq(rng.range(0.03, 0.08)),
      color: c4(COLORS.dust, rng.range(0.25, 0.7)),
      kind: MKIND.dot,
      vel: [rng.gauss() * 0.1, rng.gauss() * 0.1, rng.gauss() * 0.1],
      minPx: 2.5,
    });
  }
  for (let i = 0; i < 160; i++) {
    const t = rng.range(0, DURATION);
    const c = at(t);
    const p = c.pos
      .clone()
      .add(
        new THREE.Vector3(
          rng.range(-16, 16),
          rng.range(-8, 8),
          -rng.range(5, 30),
        ).applyQuaternion(c.quat),
      );
    const s = rng.range(0.1, 0.35);
    billboards.push({
      pos: v(p),
      size: [s * rng.range(1, 2.4), s],
      color: c4(COLORS.spark, rng.range(0.2, 0.55)),
      kind: MKIND.square,
      vel: [rng.gauss() * 0.25, rng.gauss() * 0.15, rng.gauss() * 0.25],
      minPx: 3,
    });
  }
  // ambient thin charts
  for (let i = 0; i < 10; i++) {
    const t = rng.range(0, DURATION - 1);
    const c = at(t);
    const side = rng.chance(0.5) ? 1 : -1;
    thinChart(
      planeFrame(
        c,
        side * rng.range(4, 14),
        rng.range(-3, 5),
        -rng.range(18, 40),
        -side * rng.range(0, 0.5),
      ),
      rng.range(16, 30),
      rng.range(6, 10),
      t - 2.5,
      2.5,
      rng.range(0.3, 0.6),
      1,
    );
  }
  for (let i = 0; i < 4; i++) {
    const t = rng.range(1, DURATION - 2);
    const c = at(t);
    const side = rng.chance(0.5) ? 1 : -1;
    candleChart(
      planeFrame(
        c,
        side * rng.range(5, 14),
        rng.range(-2, 5),
        -rng.range(20, 36),
        -side * 0.3,
      ),
      rng.range(14, 22),
      5,
      34,
      t - 2,
      rng.range(0.4, 0.6),
    );
  }

  return { billboards, lines, tables, cameraV1: cam };
};
