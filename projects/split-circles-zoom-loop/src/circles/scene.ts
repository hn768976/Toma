// Pure Canvas 2D renderer for one frame of the split-circles zoom loop.
// Units: 1 = frame height, origin at frame centre, +y down (canvas space).
import { Palette } from "./palettes";
import { Keys, smoothstep, spline } from "./spline";

const DEG = Math.PI / 180;
const R_DISK = 0.253; // split-disk radius
const BAND_ANGLE = 38 * DEG; // diagonal strips, rising to the right
const BAND_OFFSET = 0.22; // perpendicular offset of each strip from centre
const BAND_RADIUS_MAX = 0.28;
const HALF_W = 16 / 9 / 2; // half frame width in height units

// ---------- choreography (loop-local frame t in [0, 90)) ----------
// Pair axis angle (maths convention, A -> B), measured from the reference.
const THETA: Keys = [
  [0, 34], [14, 18], [22, 0], [30, -46], [40, -103], [50, -167],
  [62, -247], [70, -272], [80, -292], [90, -300],
];
// Extra spin of each disk's split line relative to the pair axis.
const OFF_A: Keys = [[0, 40], [14, 22], [22, 0], [50, 0], [56, 20], [62, 55], [66, 78], [75, 90], [90, 90]];
const OFF_B: Keys = [[0, 50], [14, 32], [22, 0], [90, 0]];
// Camera push-in (applies fully to strips & platform, partly to disks).
const ZOOM: Keys = [
  [0, 1], [58, 1], [62, 1.06], [65, 1.25], [68, 1.55], [71, 1.85],
  [74, 2.1], [77, 2.6], [80, 3.2], [86, 4.8], [90, 6],
];
// Radius (screen) of the centre circle that becomes the next background.
const MID_R: Keys = [
  [61, 0], [63, 0.014], [65.5, 0.075], [68, 0.15], [71, 0.267], [74, 0.4],
  [77, 0.55], [80, 0.73], [83, 0.93], [86, 1.12], [90, 1.5],
];
// Disks are pushed out of frame as the centre circle grows.
const EXTRA: Keys = [[60, 0], [68, 0], [74, 0.12], [80, 0.38], [90, 0.9]];
// Platform behind the pair: stadium that rounds itself into a circle.
const PLAT_R: Keys = [[29, 0], [37, 0.29], [56, 0.5], [90, 0.5]];
// Strips rise (grow in width) once the disks have rolled past them.
const BAND_R: Keys = [[15, 0], [22, BAND_RADIUS_MAX], [90, BAND_RADIUS_MAX]];

const pairDistance = (t: number) => {
  if (t >= 30) return 2 * R_DISK;
  return 2 * R_DISK + 2.49 * Math.pow(1 - t / 30, 1.6);
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
  bandHeadA: number;
  bandHeadB: number;
  platR: number;
  bandR: number;
  platL: number;
  midR: number;
};

export const sceneAt = (t: number): SceneState => {
  const zoom = spline(ZOOM, t);
  const diskZoom = 1 + (zoom - 1) * 0.3;
  const theta = spline(THETA, t);
  const u = axisVec(theta);
  const midR = t >= 61 ? spline(MID_R, t) : 0;
  const rDisk = R_DISK * diskZoom;
  let half = pairDistance(t) / 2;
  if (t > 60) half = Math.max(rDisk, rDisk + midR + spline(EXTRA, t)) ;
  const A = { x: -u.x * half, y: -u.y * half };
  const B = { x: u.x * half, y: u.y * half };

  // strip heads end where each disk's path meets the centre (projection at contact)
  const tb = 30;
  const ub = axisVec(spline(THETA, tb));
  const hb = pairDistance(tb) / 2;
  const dir = { x: Math.cos(BAND_ANGLE), y: -Math.sin(BAND_ANGLE) };
  const bandHeadA = -hb * (ub.x * dir.x + ub.y * dir.y);
  const bandHeadB = hb * (ub.x * dir.x + ub.y * dir.y);

  const platR = spline(PLAT_R, t);
  const platL = t < 56 ? Math.max(0, (pairDistance(t) / 2) * (1 - smoothstep(38, 56, t))) : 0;

  return {
    zoom,
    diskZoom,
    theta,
    A,
    B,
    rDisk,
    splitA: theta + spline(OFF_A, t),
    splitB: theta + spline(OFF_B, t),
    bandHeadA,
    bandHeadB,
    platR,
    bandR: spline(BAND_R, t),
    platL,
    midR,
  };
};

// ---------- drawing ----------
const capsulePath = (
  ctx: CanvasRenderingContext2D,
  c: V,
  angle: number, // canvas radians
  L: number,
  R: number,
) => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const p1 = { x: c.x - L * dx, y: c.y - L * dy };
  const p2 = { x: c.x + L * dx, y: c.y + L * dy };
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

  const layer = (
    build: () => void,
    scale: number,
    fill: CanvasGradient | string,
    shadowScale = 1,
    withShadow = true,
  ) => {
    ctx.save();
    ctx.setTransform(S * scale, 0, 0, S * scale, W / 2, H / 2);
    ctx.beginPath();
    build();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (withShadow) {
      ctx.shadowColor = pal.shadow;
      ctx.shadowBlur = 0.06 * S * shadowScale;
      ctx.shadowOffsetX = 0.017 * S * shadowScale;
      ctx.shadowOffsetY = 0.024 * S * shadowScale;
    }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(1, 0.0022 * S);
    ctx.strokeStyle = pal.rim;
    ctx.stroke();
    ctx.restore();
  };

  // 1. background
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const z = s.zoom;
  const shadowZ = Math.min(z, 2.2);

  // 2. diagonal strips laid down behind the incoming disks
  const dir = { x: Math.cos(BAND_ANGLE), y: -Math.sin(BAND_ANGLE) };
  const nrm = { x: Math.sin(BAND_ANGLE), y: Math.cos(BAND_ANGLE) };
  const bandAngleCanvas = Math.atan2(dir.y, dir.x);
  const TAIL = 4.5;
  // strip A: from far bottom-left up to its head
  if (s.bandR > 0.002) {
    const a0 = -TAIL;
    const a1 = TAIL;
    const mid = (a0 + a1) / 2;
    const c = { x: dir.x * mid - nrm.x * BAND_OFFSET, y: dir.y * mid - nrm.y * BAND_OFFSET };
    layer(() => capsulePath(ctx, c, bandAngleCanvas, (a1 - a0) / 2, s.bandR), z, bgGrad, shadowZ);
  }
  // strip B: from far top-right down to its head
  if (s.bandR > 0.002) {
    const b0 = -TAIL;
    const b1 = TAIL;
    const mid = (b0 + b1) / 2;
    const c = { x: dir.x * mid + nrm.x * BAND_OFFSET, y: dir.y * mid + nrm.y * BAND_OFFSET };
    layer(() => capsulePath(ctx, c, bandAngleCanvas, (b1 - b0) / 2, s.bandR), z, bgGrad, shadowZ);
  }

  // 3. platform: stadium around the pair that rounds into a circle
  if (s.platR > 0.002) {
    const ang = Math.atan2(-Math.sin(s.theta * DEG), Math.cos(s.theta * DEG));
    layer(() => capsulePath(ctx, { x: 0, y: 0 }, ang, s.platL, s.platR), z, bgGrad, shadowZ);
  }

  // 4. the two split disks
  const drawDisk = (c: V, splitDeg: number, darkSide: 1 | -1) => {
    const r = s.rDisk;
    if (Math.abs(c.x) - r > HALF_W + 0.1 || Math.abs(c.y) - r > 0.6) return;
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
    const n = { x: -ly * darkSide, y: lx * darkSide };
    // n is the canvas direction of (phi + 90deg) for darkSide=+1
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
  // A: dark half on the (split - 90deg) side, B on the (split + 90deg) side
  drawDisk(s.A, s.splitA, 1);
  drawDisk(s.B, s.splitB, -1);

  // 5. centre circle that grows into the next background
  if (s.midR > 0.0005) {
    const r = s.midR;
    const G = r * 1.4 + (HALF_W - r * 1.4) * smoothstep(0.5, 1.02, r);
    layer(
      () => ctx.arc(0, 0, r, 0, Math.PI * 2),
      1,
      screenGrad(-G, G),
      Math.min(1 + r * 1.5, 2.6),
      r < 1.1,
    );
  }
};
