// Looks 5-6 · Pale eyes in the dark: long, narrow, soft grey-white eyes with
// a thin dark-red rim and round black pupils, slightly blurred. Look 6
// scatters ~24 pairs of them that open, look, blink and close on their own
// cycles.
import { makeCanvas, type DrawFn } from "../lib/CanvasHost";
import { buildActing, type Pose } from "../lib/acting";
import { lidPath, lids, makeJitter, type AlmondJitter, type AlmondSpec } from "../lib/eye";
import { freehand } from "../lib/freehand";
import { clamp, easeInOut, lerp, mod } from "../lib/math";
import { makeRng } from "../lib/rng";

// ---- data ------------------------------------------------------------------
export const PALE = {
  eyeW: 0.3, // look 5: fraction of frame width per eye
  aspect: 0.27,
  eyeY: 0.5,
  spacing: 0.43, // centre-to-centre, fraction of frame width
  white: "#D8D4CE",
  corner: "#3A3230", // the whites darken towards the corners
  rim: "#4A1414",
  blurPx: 2.2, // softness at 4K, for a 960px eye (scales with size)
  boilHold: 3,
  boilVariants: 4,
};

export const CROWD = {
  pairs: { large: 4, medium: 8, small: 12 }, // 24 pairs in all
  eyeW: { large: 0.075, medium: 0.05, small: 0.032 }, // fraction of frame width
  brightness: { large: 1, medium: 0.68, small: 0.42 },
  periods: [100, 150, 300], // each divides the 300-frame loop
  openFraction: 0.67, // about two-thirds open at any time
};

const W = 3840;
const H = 2160;
const LOOP = 300;

export const paleSpec = (w: number): AlmondSpec => ({
  w,
  h: w * PALE.aspect,
  upperPow: 0.8,
  lowerPow: 0.85,
  upperSkew: 0,
  lowerSkew: 0,
  closeAt: 0.6,
});

// Draws one eye in eye-local coordinates (centre 0,0) onto ctx.
const drawPaleEye = (
  ctx: CanvasRenderingContext2D,
  spec: AlmondSpec,
  jit: AlmondJitter,
  pose: Pose,
  mirror: number,
) => {
  const { w, h } = spec;
  const L = lids(spec, jit, pose.open);
  // Frayed, hand-drawn edge: per-variant high-frequency offsets.
  const fray = (pts: typeof L.upper, k: number) =>
    pts.map(([x, y], i): [number, number] => {
      const t = i / (pts.length - 1);
      const env = Math.sin(Math.PI * t);
      return [x, y + env * w * 0.0065 * (Math.sin(i * 2.7 + jit.up[0].phase * 7 + k) + 0.6 * Math.sin(i * 5.3 + jit.lo[1].phase * 5))];
    });
  L.upper = fray(L.upper, 0);
  L.lower = fray(L.lower, 3);
  const path = lidPath(L);
  if (pose.open > 0.02) {
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    // Local +x is the inner corner (towards the nose) for both eyes.
    g.addColorStop(0, PALE.corner);
    g.addColorStop(0.18, "#6E6662");
    g.addColorStop(0.3, "#B9B3AC");
    g.addColorStop(0.45, PALE.white);
    g.addColorStop(0.88, PALE.white);
    g.addColorStop(1, "#A8A29C");
    ctx.fillStyle = g;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    // Shadow under the upper lid.
    const sh = ctx.createLinearGradient(0, -h / 2, 0, h * 0.15);
    sh.addColorStop(0, "rgba(40,14,12,0.18)");
    sh.addColorStop(1, "rgba(30,14,12,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(-w / 2, -h, w, h * 1.15);
    const lo = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.1);
    lo.addColorStop(0, "rgba(70,60,58,0.15)");
    lo.addColorStop(1, "rgba(70,60,58,0)");
    ctx.fillStyle = lo;
    ctx.fillRect(-w / 2, 0, w, h);
    // Pupil (and a faint grey iris around it).
    const px = pose.gx * mirror * w * 0.24;
    const py = h * 0.02 + pose.gy * h * 0.12;
    const pr = h * 0.29 * pose.slit;
    // Soft dark red-brown ring, then a slightly wobbly black pupil.
    ctx.save();
    ctx.filter = `blur(${(w / 960) * 3 * Math.hypot(ctx.getTransform().a, ctx.getTransform().b)}px)`;
    // Soft, lumpy brown-red falloff around the pupil (no hard ring).
    const fall = ctx.createRadialGradient(px, py, pr * 0.9, px + pr * 0.06, py + pr * 0.06, pr + (w / 960) * 34);
    fall.addColorStop(0, "rgba(70,34,28,0.95)");
    fall.addColorStop(1, "rgba(70,34,28,0)");
    ctx.fillStyle = fall;
    ctx.beginPath();
    ctx.arc(px, py, pr + (w / 960) * 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = pr * (1 + 0.035 * Math.sin(a * 3 + jit.up[1].phase) + 0.025 * Math.sin(a * 5 + jit.lo[0].phase));
      if (i === 0) ctx.moveTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
      else ctx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
    }
    ctx.fill();
    ctx.restore();
  }
  // Thin dark-red rim along both lids (pressure strokes), over a faint red halo.
  // Deep blood-red glow outside the lids, then the dull maroon line.
  ctx.save();
  ctx.strokeStyle = "rgba(140,0,0,0.4)";
  ctx.lineWidth = (w / 960) * 60;
  ctx.filter = `blur(${(w / 960) * 16 * Math.hypot(ctx.getTransform().a, ctx.getTransform().b)}px)`;
  ctx.stroke(path);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "rgba(66,50,48,0.6)";
  ctx.lineWidth = (w / 960) * 26;
  ctx.filter = `blur(${(w / 960) * 6 * Math.hypot(ctx.getTransform().a, ctx.getTransform().b)}px)`;
  ctx.stroke(path);
  ctx.restore();
  ctx.fillStyle = PALE.rim;
  ctx.globalAlpha = 0.9;
  const s = w / 960;
  ctx.fill(freehand(L.upper, { size: 15 * s, thinning: 0.5, smoothing: 0.6, streamline: 0.3 }));
  ctx.fill(freehand(L.lower, { size: 10 * s, thinning: 0.5, smoothing: 0.6, streamline: 0.3 }));
  ctx.globalAlpha = 1;
};

type Layer = ReturnType<typeof makeCanvas>;
const layers = new Map<string, Layer>();
const getLayer = (key: string, w: number, h: number) => {
  let l = layers.get(key);
  if (!l || l.c.width !== Math.ceil(w) || l.c.height !== Math.ceil(h)) {
    l = makeCanvas(w, h);
    layers.set(key, l);
  }
  return l;
};

// Draws a pair of pale eyes centred at (cx, cy) through an offscreen layer
// so the whole pair can be softened with one blur.
const drawPair = (
  ctx: CanvasRenderingContext2D,
  dpr: number,
  key: string,
  cx: number,
  cy: number,
  eyeW: number,
  spacing: number,
  jit: [AlmondJitter, AlmondJitter],
  pose: Pose,
  brightness: number,
) => {
  const spec = paleSpec(eyeW);
  const pw = spacing + eyeW * 1.3;
  const ph = spec.h * 2.2;
  const L = getLayer(key, pw * dpr, ph * dpr);
  const lc = L.ctx;
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.clearRect(0, 0, L.c.width, L.c.height);
  for (let e = 0; e < 2; e++) {
    const mirror = e === 1 ? -1 : 1;
    const ex = pw / 2 + (e === 0 ? -spacing / 2 : spacing / 2);
    lc.setTransform(dpr * mirror, 0, 0, dpr, ex * dpr, (ph / 2) * dpr);
    drawPaleEye(lc, spec, jit[e], pose, mirror);
  }
  ctx.save();
  ctx.globalAlpha = brightness;
  ctx.filter = `blur(${Math.max(0.6, PALE.blurPx * (eyeW / 960) * dpr * 1.6)}px)`;
  ctx.drawImage(L.c, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.restore();
};

// ---- Look 5 ------------------------------------------------------------------
export const makePaleEyes = (id: string): DrawFn => {
  const ew = W * PALE.eyeW;
  const jit = Array.from({ length: PALE.boilVariants }, (_, v) =>
    [0, 1].map((e) => makeJitter(makeRng(id, "eye", e, v), ew * 0.0045)) as [AlmondJitter, AlmondJitter],
  );
  const acting = buildActing(makeRng(id, "acting"), {
    duration: LOOP,
    glanceDur: [16, 24],
    holdRange: [34, 60],
    blinkLen: 10,
    blinks: 2,
    narrow: true,
    widen: false,
    amplitude: 0.85,
  });
  return (ctx, frame, { dpr }) => {
    const v = mod(Math.floor(frame / PALE.boilHold), PALE.boilVariants);
    drawPair(ctx, dpr, id, W / 2, H * PALE.eyeY, ew, W * PALE.spacing, jit[v], acting.poseAt(frame), 1);
  };
};

// ---- Look 6 ------------------------------------------------------------------
type CrowdPair = {
  x: number;
  y: number;
  eyeW: number;
  brightness: number;
  period: number;
  phase: number;
  openLen: number;
  rest: [number, number]; // gaze while "staring" (camera or a neighbour)
  glance: [number, number];
  glanceAt: number;
  blinkAt: number;
  jit: [AlmondJitter, AlmondJitter][];
};

export const makeEyesCrowd = (id: string): DrawFn => {
  const rng = makeRng(id, "layout");
  const pairs: CrowdPair[] = [];
  const boxes: [number, number, number, number][] = [];
  const sizes: ("large" | "medium" | "small")[] = [
    ...Array(CROWD.pairs.large).fill("large"),
    ...Array(CROWD.pairs.medium).fill("medium"),
    ...Array(CROWD.pairs.small).fill("small"),
  ];
  for (const size of sizes) {
    const eyeW = W * CROWD.eyeW[size] * rng.range(0.9, 1.1);
    const spacing = eyeW * 1.45;
    const bw = spacing + eyeW * 1.25;
    const bh = eyeW * 0.75;
    for (let tries = 0; tries < 4000; tries++) {
      const x = rng.range(bw / 2 + 60, W - bw / 2 - 60);
      const y = rng.range(bh / 2 + 80, H - bh / 2 - 80);
      const ok = boxes.every(
        ([bx, by, bW, bH]) => Math.abs(x - bx) > (bw + bW) / 2 + 40 || Math.abs(y - by) > (bh + bH) / 2 + 40,
      );
      if (!ok) continue;
      boxes.push([x, y, bw, bh]);
      const period = rng.pick(CROWD.periods);
      const openLen = 2 * Math.round((period * CROWD.openFraction * rng.range(0.92, 1.08)) / 2);
      pairs.push({
        x,
        y,
        eyeW,
        brightness: CROWD.brightness[size] * rng.range(0.85, 1),
        period,
        phase: rng.int(0, period - 1),
        openLen,
        rest: [rng.range(-0.15, 0.15), rng.range(-0.1, 0.15)],
        glance: [rng.pick([-1, 1]) * rng.range(0.6, 1), rng.range(-0.5, 0.5)],
        glanceAt: Math.round(openLen * rng.range(0.3, 0.45)),
        blinkAt: Math.round(openLen * rng.range(0.6, 0.72)),
        jit: Array.from({ length: PALE.boilVariants }, (_, v) =>
          [0, 1].map((e) => makeJitter(makeRng(id, "eye", pairs.length, e, v), eyeW * 0.0045)) as [AlmondJitter, AlmondJitter],
        ),
      });
      break;
    }
  }
  // A few pairs look at each other: the two closest neighbours, twice.
  const used = new Set<number>();
  for (let k = 0; k < 2; k++) {
    let best: [number, number, number] | null = null;
    for (let i = 0; i < pairs.length; i++)
      for (let j = i + 1; j < pairs.length; j++) {
        if (used.has(i) || used.has(j)) continue;
        const d = Math.hypot(pairs[i].x - pairs[j].x, (pairs[i].y - pairs[j].y) * 2);
        if (!best || d < best[2]) best = [i, j, d];
      }
    if (!best) break;
    const [i, j] = best;
    used.add(i);
    used.add(j);
    for (const [a, b] of [[i, j], [j, i]]) {
      const dx = pairs[b].x - pairs[a].x;
      const dy = pairs[b].y - pairs[a].y;
      const n = Math.hypot(dx, dy) || 1;
      pairs[a].rest = [(dx / n) * 0.95, (dy / n) * 0.7];
      pairs[a].glance = pairs[a].rest; // they keep staring at each other
    }
  }

  const poseFor = (p: CrowdPair, frame: number): Pose | null => {
    const f = frame - mod(frame, 2); // on twos
    const t = mod(f + p.phase, p.period);
    if (t >= p.openLen) return null;
    const ramp = 10;
    let open = 1;
    if (t < ramp) open = easeInOut(t / ramp);
    else if (t > p.openLen - ramp) open = easeInOut((p.openLen - t) / ramp);
    const bk = (t - p.blinkAt) / 8;
    if (bk >= 0 && bk < 1) open *= bk < 0.35 ? 1 - bk / 0.35 : bk < 0.5 ? 0 : (bk - 0.5) / 0.5;
    const ge = easeInOut((t - p.glanceAt) / 12) - easeInOut((t - p.glanceAt - 40) / 12);
    return {
      gx: lerp(p.rest[0], p.glance[0], ge),
      gy: lerp(p.rest[1], p.glance[1], ge),
      open,
      slit: 1,
    };
  };

  return (ctx, frame, { dpr }) => {
    const v = mod(Math.floor(frame / PALE.boilHold), PALE.boilVariants);
    pairs.forEach((p, i) => {
      const pose = poseFor(p, frame);
      if (!pose) return;
      // Opening out of the darkness: brightness follows the lids up.
      const b = p.brightness * clamp(0.25 + pose.open * 0.75);
      drawPair(ctx, dpr, `${id}:${i}`, p.x, p.y, p.eyeW, p.eyeW * 1.45, p.jit[v], pose, b);
    });
  };
};

export const drawPaleEyesDark = makePaleEyes("PaleEyes_Dark");
export const drawEyesCrowdDark = makeEyesCrowd("EyesCrowd_Dark");
