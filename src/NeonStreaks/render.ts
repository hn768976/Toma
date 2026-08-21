import { config } from "./config";
import {
  Camera,
  contactPoint,
  makeCamera,
  makePath,
  Path,
  pointAt,
  project,
  Projected,
  WorldPoint,
} from "./geometry";
import { gateFor, phaseAt, STREAKS, Streak } from "./streaks";

/**
 * Off-screen buffers. Allocated once per resolution and reused every frame —
 * they hold no state between frames, they are cleared at the top of each draw.
 */
export type Buffers = {
  width: number;
  height: number;
  /** All streak geometry, on transparent black, before bloom. */
  streak: HTMLCanvasElement;
  /** Scratch used to blur one depth-of-field bucket at a time. */
  scratch: HTMLCanvasElement;
  /** Mirrored geometry for the floor reflection. */
  reflection: HTMLCanvasElement;
  /** Threshold-extracted highlights, the bloom source. */
  bloom: HTMLCanvasElement;
};

const makeCanvas = (width: number, height: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
};

export const createBuffers = (width: number, height: number): Buffers => ({
  width,
  height,
  streak: makeCanvas(width, height),
  scratch: makeCanvas(width, height),
  reflection: makeCanvas(width, height),
  bloom: makeCanvas(width, height),
});

const ctxOf = (c: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return ctx;
};

const reset = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.clearRect(0, 0, w, h);
};

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Head arclength for a streak at a given phase, including the off-screen run-up. */
const headArclength = (path: Path, trailLength: number, phase: number) => {
  const span = path.total + trailLength * 2;
  return -trailLength + phase * span;
};

/** Resolved per-frame state for one streak. */
type Live = {
  streak: Streak;
  path: Path;
  headS: number;
  /** Depth of the head, used for depth-of-field bucketing. */
  headDepth: number;
  /** Combined density gate, birth fade and per-streak intensity. */
  alpha: number;
};

const tmpPoint: WorldPoint = { x: 0, y: 0, z: 0 };
const tmpProjA: Projected = { sx: 0, sy: 0, d: 0 };
const tmpProjB: Projected = { sx: 0, sy: 0, d: 0 };

const resolveStreak = (
  streak: Streak,
  cam: Camera,
  frame: number,
  durationInFrames: number,
): Live | null => {
  const gate = gateFor(streak, frame, durationInFrames);
  if (gate <= 0.001) return null;

  const path = makePath(
    cam,
    streak.xNorm,
    streak.bendDepth,
    streak.runDepth,
    streak.bendRadius,
    streak.yaw,
  );
  const headS = headArclength(path, streak.trailLength, phaseAt(streak, frame, durationInFrames));

  pointAt(path, headS, tmpPoint);
  const headDepth = -tmpPoint.z;

  // Fade in over the first stretch of the path so nothing pops into existence.
  const birthLen = streak.trailLength * config.streaks.birthFade;
  const birth = smoothstep(-streak.trailLength, -streak.trailLength + birthLen, headS);

  const alpha = gate * birth * streak.intensity;
  if (alpha <= 0.002) return null;

  return { streak, path, headS, headDepth, alpha };
};

/** Depth-of-field blur in px for a depth, quantised into buckets. */
const blurBucket = (depth: number): number => {
  const { focusDistance, range, buckets } = config.dof;
  const t = clamp(Math.abs(depth - focusDistance) / range, 0, 1);
  const level = Math.round(t * (buckets - 1));
  return level;
};

const bucketBlurPx = (level: number): number =>
  (level / (config.dof.buckets - 1)) * config.dof.maxBlurPx;

type PassSpec = {
  color: string;
  widthMul: number;
  alphaMul: number;
  segments: number;
  bands: number;
};

const passes: readonly PassSpec[] = [
  {
    color: config.palette.glow,
    widthMul: config.glow.glowWidthMul,
    alphaMul: config.glow.glowAlpha,
    segments: config.streaks.haloSegments,
    bands: config.streaks.haloBands,
  },
  {
    color: config.palette.halo,
    widthMul: config.glow.haloWidthMul,
    alphaMul: config.glow.haloAlpha,
    segments: config.streaks.haloSegments,
    bands: config.streaks.haloBands,
  },
  {
    color: config.palette.core,
    widthMul: 1,
    alphaMul: config.glow.coreAlpha,
    segments: config.streaks.coreSegments,
    bands: config.streaks.coreBands,
  },
];

/**
 * The reflection is blurred and sits at 25% anyway, so it is sampled coarsely.
 */
const reflectionPasses: readonly PassSpec[] = passes.map((p) => ({
  ...p,
  segments: config.streaks.haloSegments,
  bands: config.streaks.haloBands,
}));

/** Sample scratch, reused across every trail to keep the draw allocation-free. */
const MAX_SAMPLES = 129;
const sampleSx = new Float64Array(MAX_SAMPLES);
const sampleSy = new Float64Array(MAX_SAMPLES);
const sampleD = new Float64Array(MAX_SAMPLES);
const sampleY = new Float64Array(MAX_SAMPLES);

/**
 * Stroke one trail as a chain of short segments, each with its own alpha and
 * width. A single stroked path cannot fade along its length, and a linear
 * gradient would be wrong around the bend, so segment-wise it is.
 *
 * `mirror` flips the geometry about the floor plane for the reflection.
 */
const strokeTrail = (
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  live: Live,
  pass: PassSpec,
  mirror: boolean,
) => {
  const { path, headS, streak } = live;
  const { trailLength } = streak;
  const segs = Math.min(pass.segments, MAX_SAMPLES - 1);
  const { min: minPx, max: maxPx } = config.streaks.coreWidthPx;
  const fade = config.streaks.depthFade;
  const cf = config.streaks.climbFade;
  // Per-path, not per-camera: each streak bends at its own depth and so has
  // its own height at which it clears the top of the frame.
  const climbY0 = cf.startFrac * path.topY;
  const climbY1 = cf.endFrac * path.topY;

  // 1. Sample the trail once.
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; // 0 = tail, 1 = head
    pointAt(path, headS - trailLength * (1 - t), tmpPoint);
    sampleY[i] = tmpPoint.y;
    project(
      cam,
      tmpPoint.x,
      mirror ? -tmpPoint.y : tmpPoint.y,
      tmpPoint.z,
      tmpProjA,
    );
    sampleSx[i] = tmpProjA.sx;
    sampleSy[i] = tmpProjA.sy;
    sampleD[i] = tmpProjA.d;
  }

  // 2. Stroke it as a handful of constant-alpha bands, each one continuous.
  ctx.strokeStyle = pass.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const bands = Math.max(1, pass.bands);

  for (let b = 0; b < bands; b++) {
    const i0 = Math.round((b * segs) / bands);
    const i1 = Math.round(((b + 1) * segs) / bands);
    if (i1 <= i0) continue;

    const mid = (i0 + i1) >> 1;
    const dMid = sampleD[mid];
    if (!(dMid > 0)) continue;

    const tMid = (i0 + i1) / (2 * segs);
    const tailT = Math.pow(tMid, config.streaks.tailFalloff);
    const far = 1 - smoothstep(fade.start, fade.end, dMid);
    // The climb dims as it rises, keeping the top of the frame clear.
    const climb =
      1 - (1 - cf.minAlpha) * smoothstep(climbY0, climbY1, sampleY[mid]);
    const a = pass.alphaMul * tailT * far * climb * live.alpha;
    if (a <= 0.003) continue;

    const lineWidth =
      clamp((cam.f * streak.coreWidth) / dMid, minPx, maxPx) * pass.widthMul;
    const margin = lineWidth + 2;

    // Skip bands entirely outside the frame.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let ok = false;
    for (let i = i0; i <= i1; i++) {
      const sx = sampleSx[i];
      const sy = sampleSy[i];
      if (Number.isNaN(sx) || Number.isNaN(sy)) continue;
      ok = true;
      if (sx < minX) minX = sx;
      if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy;
      if (sy > maxY) maxY = sy;
    }
    if (!ok) continue;
    if (maxX < -margin || minX > w + margin) continue;
    if (maxY < -margin || minY > h + margin) continue;

    ctx.globalAlpha = a;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    let started = false;
    for (let i = i0; i <= i1; i++) {
      const sx = sampleSx[i];
      const sy = sampleSy[i];
      if (Number.isNaN(sx) || Number.isNaN(sy)) {
        started = false;
        continue;
      }
      if (started) ctx.lineTo(sx, sy);
      else {
        ctx.moveTo(sx, sy);
        started = true;
      }
    }
    ctx.stroke();
  }
};

/**
 * Soft elliptical pool where a streak meets the floor. A circle on the floor
 * projects to an ellipse squashed vertically by roughly eyeHeight / depth.
 */
const drawPool = (
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  wx: number,
  wz: number,
  worldRadius: number,
  alpha: number,
) => {
  project(cam, wx, 0, wz, tmpProjB);
  if (Number.isNaN(tmpProjB.sx)) return;
  const d = tmpProjB.d;
  const rx = (cam.f * worldRadius) / d;
  if (rx < 0.5) return;
  const squash = clamp(cam.y / d, 0.04, 0.6);

  ctx.save();
  ctx.translate(tmpProjB.sx, tmpProjB.sy);
  ctx.rotate(Math.atan2(cam.sinRoll, cam.cosRoll));
  ctx.scale(1, squash);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  grad.addColorStop(0, config.palette.pool);
  grad.addColorStop(0.45, config.palette.glow);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawPoolsFor = (
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  live: Live,
  mirror: boolean,
) => {
  if (!config.floor.pool.enabled || mirror) return;
  const { path, headS, streak } = live;
  const cfg = config.floor.pool;
  const fade = config.streaks.depthFade;

  // 1. A pool riding under the head while it is still running along the floor.
  if (headS > 0 && headS < path.runLen) {
    pointAt(path, headS, tmpPoint);
    const near = 1 - smoothstep(fade.start, fade.end, -tmpPoint.z);
    drawPool(
      ctx,
      cam,
      tmpPoint.x,
      tmpPoint.z,
      cfg.radius * 0.7,
      cfg.alpha * live.alpha * near * 0.7,
    );
  }

  // 2. A brighter pool at the foot of the bend while the trail is turning —
  //    the "impact" glow where the streak hits the wall.
  const rampIn = path.runLen - streak.trailLength * 0.35;
  const rampOut = path.runLen + path.bendLen + streak.trailLength;
  if (headS > rampIn && headS < rampOut) {
    const ramp =
      smoothstep(rampIn, path.runLen, headS) *
      (1 - smoothstep(path.runLen + path.bendLen, rampOut, headS));
    contactPoint(path, tmpPoint);
    drawPool(
      ctx,
      cam,
      tmpPoint.x,
      tmpPoint.z,
      cfg.radius,
      cfg.alpha * live.alpha * ramp,
    );
  }
};

/** Faint atmospheric band sitting on the horizon. */
const drawHaze = (
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  width: number,
  height: number,
) => {
  const { alpha, spread } = config.floor.haze;
  const top = cam.cy - spread * height * 0.55;
  const bottom = cam.cy + spread * height;
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.42, config.palette.haze);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.fillRect(0, top, width, bottom - top);
  ctx.restore();
};

const drawVignette = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => {
  const { vignetteStrength, vignetteInner } = config.post;
  if (vignetteStrength <= 0) return;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.hypot(cx, cy);
  const grad = ctx.createRadialGradient(cx, cy, r * vignetteInner, cx, cy, r);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, `rgba(0,0,0,${vignetteStrength})`);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

export type DrawOptions = {
  /**
   * Skip the opaque background and the black vignette, so the frame can be
   * rendered to ProRes 4444 with a real alpha channel and keyed over footage.
   */
  transparent?: boolean;
};

/**
 * Draw one frame. Pure function of `frame` — nothing carries over between
 * calls, the buffers are cleared on entry.
 */
export const drawFrame = (
  target: CanvasRenderingContext2D,
  buffers: Buffers,
  frame: number,
  durationInFrames: number,
  options: DrawOptions = {},
) => {
  const { width, height } = buffers;
  const transparent = options.transparent ?? false;
  const cam = makeCamera(frame, durationInFrames, width, height);

  const streakCtx = ctxOf(buffers.streak);
  const scratchCtx = ctxOf(buffers.scratch);
  const reflCtx = ctxOf(buffers.reflection);
  const bloomCtx = ctxOf(buffers.bloom);

  reset(streakCtx, width, height);
  reset(reflCtx, width, height);
  reset(target, width, height);

  // ---- background -------------------------------------------------------
  if (!transparent) {
    target.fillStyle = config.palette.background;
    target.fillRect(0, 0, width, height);
  }

  // ---- resolve every streak for this frame ------------------------------
  const live: Live[] = [];
  for (const streak of STREAKS) {
    const l = resolveStreak(streak, cam, frame, durationInFrames);
    if (l) live.push(l);
  }

  // ---- streaks, bucketed by depth-of-field blur -------------------------
  const byBucket = new Map<number, Live[]>();
  for (const l of live) {
    const b = blurBucket(l.headDepth);
    const arr = byBucket.get(b);
    if (arr) arr.push(l);
    else byBucket.set(b, [l]);
  }

  streakCtx.globalCompositeOperation = "lighter";

  for (const [level, group] of [...byBucket.entries()].sort((a, b) => b[0] - a[0])) {
    const blurPx = bucketBlurPx(level);
    // Sharp bucket goes straight onto the streak buffer; blurred buckets are
    // drawn to scratch first so the blur is applied to the whole trail at once
    // instead of to each little segment.
    const ctx = blurPx < 0.25 ? streakCtx : scratchCtx;
    if (ctx === scratchCtx) {
      reset(scratchCtx, width, height);
      scratchCtx.globalCompositeOperation = "lighter";
    }

    for (const l of group) {
      drawPoolsFor(ctx, cam, l, false);
      for (const pass of passes) strokeTrail(ctx, cam, l, pass, false);
    }

    if (ctx === scratchCtx) {
      streakCtx.save();
      streakCtx.globalCompositeOperation = "lighter";
      streakCtx.globalAlpha = 1;
      streakCtx.filter = `blur(${blurPx.toFixed(2)}px)`;
      streakCtx.drawImage(buffers.scratch, 0, 0);
      streakCtx.restore();
      streakCtx.globalCompositeOperation = "lighter";
    }
  }
  streakCtx.filter = "none";
  streakCtx.globalAlpha = 1;

  // ---- floor reflection: mirror the world, do not flip the image ---------
  if (config.floor.reflectionOpacity > 0) {
    reflCtx.globalCompositeOperation = "lighter";
    for (const l of live) {
      for (const pass of reflectionPasses) strokeTrail(reflCtx, cam, l, pass, true);
    }
    // Fade the reflection out as it approaches the viewer.
    reflCtx.setTransform(1, 0, 0, 1, 0, 0);
    reflCtx.globalCompositeOperation = "destination-out";
    reflCtx.globalAlpha = 1;
    reflCtx.filter = "none";
    const fadeEnd = cam.cy + config.floor.reflectionFade * height;
    const mask = reflCtx.createLinearGradient(0, cam.cy, 0, fadeEnd);
    mask.addColorStop(0, "rgba(0,0,0,0)");
    mask.addColorStop(1, "rgba(0,0,0,1)");
    reflCtx.fillStyle = mask;
    reflCtx.fillRect(0, cam.cy, width, height - cam.cy);

    target.save();
    target.globalCompositeOperation = "lighter";
    target.globalAlpha = config.floor.reflectionOpacity;
    target.filter = `blur(${config.floor.reflectionBlurPx}px)`;
    target.drawImage(buffers.reflection, 0, 0);
    target.restore();
  }

  // ---- haze sits behind the streaks -------------------------------------
  drawHaze(target, cam, width, height);

  // ---- the streaks themselves -------------------------------------------
  target.save();
  target.globalCompositeOperation = "lighter";
  target.globalAlpha = clamp(config.post.exposure, 0, 1);
  target.filter = "none";
  target.drawImage(buffers.streak, 0, 0);
  target.restore();

  // ---- bloom ------------------------------------------------------------
  if (config.bloom.enabled) {
    // Threshold: multiplying the buffer by itself squares both colour and
    // alpha, which crushes the dim halo and keeps only genuinely hot pixels.
    reset(bloomCtx, width, height);
    bloomCtx.drawImage(buffers.streak, 0, 0);
    bloomCtx.globalCompositeOperation = "multiply";
    bloomCtx.drawImage(buffers.streak, 0, 0);
    bloomCtx.globalCompositeOperation = "source-over";

    target.save();
    target.globalCompositeOperation = "lighter";
    for (const lvl of config.bloom.levels) {
      target.globalAlpha = clamp(lvl.alpha * config.bloom.strength, 0, 1);
      target.filter = `blur(${lvl.blurPx}px)`;
      target.drawImage(buffers.bloom, 0, 0);
    }
    target.restore();
  }

  // ---- post -------------------------------------------------------------
  target.filter = "none";
  target.globalAlpha = 1;
  target.globalCompositeOperation = "source-over";
  // A black vignette would print black into the alpha channel, so the
  // transparent variant leaves it off — key it and vignette downstream.
  if (!transparent) drawVignette(target, width, height);
};
