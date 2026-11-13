import { createNoise3D } from "./noise";
import type { RGB, TunnelPalette } from "./palettes";
import { mulberry32 } from "./random";

/**
 * Particle-string tunnel renderer (Canvas 2D, resolution independent).
 *
 * Model: a tube of concentric rings is viewed straight down its axis. Rings
 * are spaced geometrically in depth (z_k = Z0 * Q^k) so their projected radii
 * are evenly spaced in log-space, exactly like the reference. Every ring is a
 * thin glowing string carrying small bright beads. Over the shot the rings
 * drift towards the camera and a growing noise field bends, curls and finally
 * tangles them into each other ("collide"), while brightness and bloom rise.
 *
 * Everything is a pure function of time, so any frame can be rendered in
 * isolation (required for Remotion's parallel rendering).
 */

export const RING_COUNT = 80;
const Q = 1.042; // depth ratio between neighbouring rings
const Z0 = 0.42; // nearest ring depth (world units, ring radius = 1)
const FOCAL = 900; // focal length in 1920-wide design pixels
const RING_DRIFT = 1.55; // rings per second travelling towards the camera
const BEADS_PER_RING = 190;

const noiseX1 = createNoise3D(11);
const noiseY1 = createNoise3D(23);
const noiseX2 = createNoise3D(37);
const noiseY2 = createNoise3D(41);
const noiseZ = createNoise3D(53);

type Bead = { theta: number; speed: number; size: number; bright: number };

const beads: Bead[][] = (() => {
  const rand = mulberry32(2024);
  const out: Bead[][] = [];
  for (let k = 0; k < RING_COUNT; k++) {
    const ring: Bead[] = [];
    for (let j = 0; j < BEADS_PER_RING; j++) {
      ring.push({
        theta: rand() * Math.PI * 2,
        speed: (rand() - 0.5) * 0.16,
        size: 0.55 + rand() * 0.9,
        bright: 0.45 + rand() * 0.55,
      });
    }
    out.push(ring);
  }
  return out;
})();

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const rgba = (c: readonly number[], a: number) =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(4)})`;

/** Displacement state for one moment in the shot. */
type Field = {
  a1: number; // low-frequency warp amplitude (fraction of ring radius)
  a2: number; // high-frequency curl amplitude
  w1: number; // noise time coordinates
  w2: number;
  rot: number; // global slow spin
};

const displace = (
  field: Field,
  ringKey: number,
  theta: number,
  out: Float64Array,
) => {
  const ang = theta + field.rot;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  // Sampling noise on a circle keeps every ring a closed loop.
  const f1 = 1.25;
  const f2 = 2.7;
  // Large per-ring offsets decorrelate neighbouring strings so each one
  // wanders on its own instead of the whole tunnel bending as one shape.
  const k1 = ringKey * 0.47 + field.w1;
  const k2 = ringKey * 1.13 + field.w2;
  const dx =
    field.a1 * noiseX1(c * f1, s * f1, k1) +
    field.a2 * noiseX2(c * f2, s * f2, k2);
  const dy =
    field.a1 * noiseY1(c * f1, s * f1, k1) +
    field.a2 * noiseY2(c * f2, s * f2, k2);
  const dz = field.a2 * 0.35 * noiseZ(c * f2 + 7.1, s * f2, k2);
  out[0] = c + dx;
  out[1] = s + dy;
  out[2] = dz;
};

const canvasCache = new Map<string, HTMLCanvasElement>();
const getCanvas = (key: string, w: number, h: number) => {
  let c = canvasCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    canvasCache.set(key, c);
  }
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  return c;
};

export const drawTunnel = (
  target: HTMLCanvasElement,
  timeSec: number,
  durationSec: number,
  palette: TunnelPalette,
) => {
  const W = target.width;
  const H = target.height;
  const K = W / 1920; // design-pixel to device-pixel scale (2 at 4K)
  const cx = W / 2;
  const cy = H / 2;
  const F = FOCAL * K;
  const p = clamp(timeSec / durationSec, 0, 1);

  const field: Field = {
    // Low-frequency wobble eases in from the first second (strands cross by
    // ~2 s); the high-frequency curls build steadily to a full tangle at the end.
    a1: 0.01 + 0.075 * (1 - Math.pow(1 - p, 2.2)),
    a2: 0.25 * Math.pow(smoothstep(0.08, 1.0, p), 1.05),
    w1: timeSec * 0.1,
    w2: timeSec * 0.22,
    rot: timeSec * 0.025,
  };
  // Brightness holds for the first ~3.5 s, then builds to the end.
  const intensity = 1.05 + 0.75 * Math.pow(smoothstep(0.3, 1.0, p), 1.4);

  // ---- Strings + beads on a transparent FX layer --------------------------
  const fx = getCanvas("fx", W, H);
  const g = fx.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, W, H);
  g.globalCompositeOperation = "lighter";
  g.lineJoin = "round";
  g.lineCap = "round";

  const tmp = new Float64Array(3);
  // Back to front so near strings sit on top of the dense far field.
  const order: { k: number; z: number }[] = [];
  for (let k = 0; k < RING_COUNT; k++) {
    let s = (k - RING_DRIFT * timeSec) % RING_COUNT;
    if (s < 0) s += RING_COUNT;
    order.push({ k, z: Z0 * Math.pow(Q, s) });
  }
  order.sort((a, b) => b.z - a.z);

  for (const { k, z } of order) {
    const nearFade = smoothstep(0.3, 0.55, z);
    const lineFar = 1 - smoothstep(1.4, 4.2, z);
    const dotFar = 1 - smoothstep(10.0, 14.5, z);
    if (nearFade <= 0 || dotFar <= 0) continue;
    // Deep rings stay calmer so the vanishing point keeps its ordered dot field.
    const ringField: Field = {
      ...field,
      a2: field.a2 * (0.4 + 0.6 * (1 - smoothstep(1.0, 7.0, z))),
    };

    const lineColor =
      z < 2.4
        ? mix(palette.lineNear, palette.lineMid, smoothstep(0.55, 2.4, z))
        : mix(palette.lineMid, palette.lineFar, smoothstep(2.4, 8, z));

    // --- string
    // Centre-weighted: the mid-radius band is brightest, the outskirts dimmer.
    const rDesign = FOCAL / z;
    const radial =
      (1 - (0.72 + 0.12 * p) * smoothstep(620, 1300, rDesign)) *
      (1 + 0.35 * p * (1 - smoothstep(380, 900, rDesign)));
    const lineAlpha = intensity * nearFade * lineFar * radial * 0.75;
    if (lineAlpha > 0.004) {
      const rPx = F / z;
      const n = Math.round(clamp((Math.PI * 2 * rPx) / (2.5 * K), 240, 2600));
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const theta = (i / n) * Math.PI * 2;
        displace(ringField, k, theta, tmp);
        const zz = z * (1 + tmp[2]);
        const x = cx + (F * tmp[0]) / zz;
        const y = cy + (F * tmp[1]) / zz;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      const width = K * clamp(3.4 / z, 1.5, 7.5) * (1 + 0.3 * p);
      g.lineWidth = width;
      g.strokeStyle = rgba(lineColor, lineAlpha);
      g.stroke();
    }

    // --- beads
    const beadColor = mix(
      palette.beadNear,
      palette.beadFar,
      smoothstep(0.7, 6.5, z),
    );
    const beadBase = K * clamp(3.4 / z, 1.9, 8.0);
    const ringBeads = beads[k];
    for (let j = 0; j < ringBeads.length; j++) {
      const b = ringBeads[j];
      const theta = b.theta + b.speed * timeSec;
      displace(ringField, k, theta, tmp);
      const zz = z * (1 + tmp[2]);
      const x = cx + (F * tmp[0]) / zz;
      const y = cy + (F * tmp[1]) / zz;
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      // Dense, bright speckle band around the core, fading softly into it.
      const coreFade =
        Math.pow(smoothstep(60, 340, rDesign), 1.3) *
        (1 + 0.3 * (1 - smoothstep(300, 600, rDesign)));
      const a =
        b.bright * nearFade * dotFar * radial * coreFade * (0.75 + 0.25 * intensity) * (1 + 0.3 * p);
      if (a < 0.01) continue;
      const r = beadBase * b.size;
      g.fillStyle = rgba(beadColor, a);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  // ---- Bloom (quarter resolution blur of the FX layer) --------------------
  const bw = Math.round(W / 4);
  const bh = Math.round(H / 4);
  const bloom = getCanvas("bloom", bw, bh);
  const bg = bloom.getContext("2d")!;
  bg.setTransform(1, 0, 0, 1, 0, 0);
  bg.globalCompositeOperation = "source-over";
  bg.clearRect(0, 0, bw, bh);
  bg.filter = `blur(${(3.5 * K).toFixed(2)}px)`;
  bg.drawImage(fx, 0, 0, bw, bh);
  bg.filter = "none";

  // ---- Final composite ----------------------------------------------------
  const ctx = target.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const diag = Math.hypot(cx, cy);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, diag);
  grad.addColorStop(0, rgba(palette.bgCenter, 1));
  grad.addColorStop(0.42, rgba(palette.bgMid, 1));
  grad.addColorStop(1, rgba(palette.bgEdge, 1));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(fx, 0, 0);
  ctx.globalAlpha = 0.8 + 0.7 * smoothstep(0.3, 1.0, p);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bloom, 0, 0, W, H);
  ctx.globalAlpha = 1;

  // Dark core at the vanishing point.
  ctx.globalCompositeOperation = "source-over";
  // Soft, slightly wide dark core (feathered, not a hard disc); late
  // tangles are allowed to bleed into it.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.3, 1);
  const holeR = 150 * K;
  const hole = ctx.createRadialGradient(0, 0, 0, 0, 0, holeR);
  const core = 0.94 - 0.18 * smoothstep(0.6, 1.0, p);
  hole.addColorStop(0, rgba(palette.bgCenter, core));
  hole.addColorStop(0.22, rgba(palette.bgCenter, core * 0.88));
  hole.addColorStop(0.55, rgba(palette.bgCenter, core * 0.4));
  hole.addColorStop(1, rgba(palette.bgCenter, 0));
  ctx.fillStyle = hole;
  ctx.fillRect(-holeR, -holeR, holeR * 2, holeR * 2);
  ctx.restore();

  // Vignette: corners about 50% darker, as in the reference.
  const vig = ctx.createRadialGradient(cx, cy, diag * 0.3, cx, cy, diag);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.5, "rgba(0,0,0,0.2)");
  vig.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
};
