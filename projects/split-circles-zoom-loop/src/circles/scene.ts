// Pure Canvas 2D renderer for one frame of the split-circles zoom loop.
// Units: 1 = frame height, origin at frame centre, +y down (canvas space).
import { Palette } from "./palettes";
import { Keys, smoothstep, spline } from "./spline";

const DEG = Math.PI / 180;
const R_DISK = 0.253; // split-disk radius (mid-cycle)
// Disks enter ~7% larger and settle to their resting size as they meet.
const DISK_SCALE: Keys = [[0, 1.07], [21, 1.07], [27, 1], [90, 1]];
const PLATFORM_ANGLE = 38 * DEG; // the stadium platform runs along the diagonal
const HALF_W = 16 / 9 / 2; // half frame width in height units

// ---------- choreography (loop-local frame t in [0, 90)) ----------
// Pair axis angle (maths convention, A -> B), measured from the reference.
const THETA: Keys = [
  [0, 34], [14, 18], [22, 0], [30, -46], [40, -103], [50, -167],
  [62, -247], [70, -278], [80, -300], [90, -310],
];
// Extra spin of each disk's split line relative to the pair axis.
const OFF_A: Keys = [
  [0, 40], [14, 22], [22, 0], [52, 0], [60, 22], [63, 52], [66, 78], [75, 90], [90, 90],
];
const OFF_B: Keys = [[0, 50], [14, 32], [22, 0], [90, 0]];
// Camera push-in (applies fully to trails & platform, partly to disks).
const ZOOM: Keys = [
  [0, 1], [60, 1], [64, 1.06], [67, 1.25], [70, 1.5], [73, 1.8],
  [76, 2.15], [79, 2.7], [82, 3.3], [87, 4.8], [90, 6],
];
// Radius (screen) of the centre circle that becomes the next background.
const MID_R: Keys = [
  [61, 0], [63, 0.014], [65.5, 0.075], [68, 0.15], [71.5, 0.26], [74.5, 0.4],
  [77.5, 0.55], [80.5, 0.72], [83.5, 0.9], [86.5, 1.08], [90, 1.45],
];
// Disks are pushed out of frame as the centre circle grows.
const EXTRA: Keys = [[63, 0], [71, 0], [77, 0.12], [83, 0.38], [90, 0.9]];
// Trails (the wide diagonal strips) rise behind the rolling disks.
const TRAIL_W: Keys = [[13, 0], [19, 1], [90, 1]];
const TRAIL_FREEZE = 36;
// Platform: wide stadium along the diagonal that retracts into a circle.
const PLAT_R: Keys = [[32.5, 0], [36.5, 0.47], [56, 0.52], [90, 0.52]];
const PLAT_LEN: Keys = [[0, 3.2], [42, 3.2], [54, 0], [90, 0]];

const ENTRY_SPAN = 2.25; // extra pair separation at t = 0
const diskR = (t: number) => R_DISK * spline(DISK_SCALE, t);
const pairDistance = (t: number) => {
  if (t >= 30) return 2 * diskR(t);
  return 2 * diskR(t) + ENTRY_SPAN * Math.pow(1 - t / 30, 1.6);
};

type V = { x: number; y: number };
const axisVec = (deg: number): V => ({ x: Math.cos(deg * DEG), y: -Math.sin(deg * DEG) });

export type SceneState = {
  zoom: number;
  diskZoom: number;
  theta: number;
  A: V;
  B: V;
  rDisk: number;
  splitA: number;
  splitB: number;
  trailW: number;
  platR: number;
  platLen: number;
  midR: number;
};

export const sceneAt = (t: number): SceneState => {
  const zoom = spline(ZOOM, t);
  const diskZoom = 1 + (zoom - 1) * 0.3;
  const theta = spline(THETA, t);
  const u = axisVec(theta);
  const midR = t >= 61 ? spline(MID_R, t) : 0;
  const rDisk = diskR(t) * diskZoom;
  let half = pairDistance(t) / 2;
  if (t > 61) half = Math.max(half, rDisk + midR + spline(EXTRA, t));
  return {
    zoom,
    diskZoom,
    theta,
    A: { x: -u.x * half, y: -u.y * half },
    B: { x: u.x * half, y: u.y * half },
    rDisk,
    splitA: theta + spline(OFF_A, t),
    splitB: theta + spline(OFF_B, t),
    trailW: spline(TRAIL_W, t),
    platR: spline(PLAT_R, t),
    platLen: spline(PLAT_LEN, t),
    midR,
  };
};

// Far-away start points of the two trails (where each disk came from).
const TAIL_A: V = (() => {
  const u = axisVec(spline(THETA, 0));
  const h = (pairDistance(0) / 2) * 3;
  return { x: -u.x * h, y: -u.y * h };
})();
const TAIL_B: V = { x: -TAIL_A.x, y: -TAIL_A.y };

// ---------- drawing ----------
const capsulePath = (ctx: CanvasRenderingContext2D, p1: V, p2: V, R: number) => {
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  ctx.moveTo(p2.x + R * Math.cos(angle - Math.PI / 2), p2.y + R * Math.sin(angle - Math.PI / 2));
  ctx.arc(p2.x, p2.y, R, angle - Math.PI / 2, angle + Math.PI / 2);
  ctx.arc(p1.x, p1.y, R, angle + Math.PI / 2, angle + (3 * Math.PI) / 2);
  ctx.closePath();
};

export const drawScene = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  pal: Palette,
) => {
  const s = sceneAt(t);
  const S = H; // pixels per unit
  const screenGrad = (x0: number, x1: number) => {
    const g = ctx.createLinearGradient(W / 2 + x0 * S, 0, W / 2 + x1 * S, 0);
    g.addColorStop(0, pal.left);
    g.addColorStop(1, pal.right);
    return g;
  };
  const bgGrad = screenGrad(-HALF_W, HALF_W);
  const planeGrad = ctx.createLinearGradient(0, 0, W, 0);
  planeGrad.addColorStop(0, pal.planeLeft);
  planeGrad.addColorStop(1, pal.planeRight);

  // Paper layer with two stacked drop shadows (light from the upper-left):
  // a wide soft ambient shadow plus a tight dark contact shadow.
  const layer = (
    build: () => void,
    scale: number,
    fill: CanvasGradient | string,
    shadowScale = 1,
    withShadow = true,
    rim = true,
  ) => {
    ctx.save();
    ctx.setTransform(S * scale, 0, 0, S * scale, W / 2, H / 2);
    ctx.beginPath();
    build();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = fill;
    if (withShadow) {
      const k = S * shadowScale;
      ctx.shadowColor = pal.shadowWide;
      ctx.shadowBlur = 0.11 * k;
      ctx.shadowOffsetX = 0.03 * k;
      ctx.shadowOffsetY = 0.04 * k;
      ctx.fill();
      ctx.shadowColor = pal.shadow;
      ctx.shadowBlur = 0.035 * k;
      ctx.shadowOffsetX = 0.012 * k;
      ctx.shadowOffsetY = 0.017 * k;
    }
    ctx.fill();
    ctx.shadowColor = "transparent";
    if (rim) {
      ctx.lineWidth = Math.max(1, 0.0018 * S);
      ctx.strokeStyle = pal.rim;
      ctx.stroke();
    }
    ctx.restore();
  };

  // 1. background
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const z = s.zoom;
  const shadowZ = Math.min(z, 2.2);

  // 2. trails: wide strips laid down behind each disk, from where it entered
  //    to its current centre (the rounded head is hidden under the disk).
  if (s.trailW > 0.001) {
    // Heads follow the disks until the platform has covered them (t = 36),
    // then stay put so the strips remain in frame until the zoom takes over.
    const h = t < TRAIL_FREEZE ? s : sceneAt(TRAIL_FREEZE);
    const r = h.rDisk * 0.97 * s.trailW; // layer units (scaled by the zoom)
    const headA = { x: h.A.x, y: h.A.y };
    const headB = { x: h.B.x, y: h.B.y };
    layer(() => capsulePath(ctx, TAIL_A, headA, r), z, planeGrad, shadowZ, true, false);
    layer(() => capsulePath(ctx, TAIL_B, headB, r), z, planeGrad, shadowZ, true, false);
  }

  // 3. platform: wide diagonal stadium (lower-left end round the pair) that
  //    retracts into a circle under the pair.
  if (s.platR > 0.002) {
    const far = { x: Math.cos(PLATFORM_ANGLE) * s.platLen, y: -Math.sin(PLATFORM_ANGLE) * s.platLen };
    layer(() => capsulePath(ctx, { x: 0, y: 0 }, far, s.platR), z, planeGrad, shadowZ);
  }

  // 4. the two split disks
  const drawDisk = (c: V, splitDeg: number, darkSide: 1 | -1) => {
    const r = s.rDisk;
    if (Math.abs(c.x) - r > HALF_W + 0.25 || Math.abs(c.y) - r > 0.75) return;
    layer(() => ctx.arc(c.x, c.y, r, 0, Math.PI * 2), 1, bgGrad, s.diskZoom);
    // dark half: clip to disk, fill the half-plane on the dark side of the split
    ctx.save();
    ctx.setTransform(S, 0, 0, S, W / 2, H / 2);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r - 0.0005, 0, Math.PI * 2);
    ctx.clip();
    const phi = splitDeg * DEG;
    const lx = Math.cos(phi);
    const ly = -Math.sin(phi);
    // canvas direction of (phi - 90deg) for darkSide = +1, (phi + 90deg) for -1
    const n = { x: -ly * darkSide, y: lx * darkSide };
    const big = r * 2;
    ctx.beginPath();
    ctx.moveTo(c.x + lx * big, c.y + ly * big);
    ctx.lineTo(c.x - lx * big, c.y - ly * big);
    ctx.lineTo(c.x - lx * big + n.x * big, c.y - ly * big + n.y * big);
    ctx.lineTo(c.x + lx * big + n.x * big, c.y + ly * big + n.y * big);
    ctx.closePath();
    ctx.fillStyle = pal.dark;
    ctx.fill();
    ctx.restore();
  };
  drawDisk(s.A, s.splitA, 1);
  drawDisk(s.B, s.splitB, -1);

  // 5. centre circle that grows into the next background
  if (s.midR > 0.0005) {
    const r = s.midR;
    const G = r * 2 + (HALF_W - r * 2) * smoothstep(0.4, 1.02, r);
    layer(
      () => ctx.arc(0, 0, r, 0, Math.PI * 2),
      1,
      screenGrad(-G, G),
      Math.min(1 + r * 1.2, 2.2),
      r < 1.15,
    );
  }
};
