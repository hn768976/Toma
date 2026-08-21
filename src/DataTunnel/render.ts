import { config } from "./config";
import {
  DUST,
  NEBULA,
  Projected,
  TunnelCamera,
  drifterDepth,
  dotHash,
  gridHalfWidth,
  loopDistance,
  makeCamera,
  mod,
  patchNoise,
  planeY,
  project,
} from "./tunnel";

export type Buffers = {
  width: number;
  height: number;
  /** Dots and dust, on transparent black, before bloom. */
  dots: HTMLCanvasElement;
  /** Nebula clouds, blurred as one layer. */
  nebula: HTMLCanvasElement;
  /** Threshold-extracted highlights, the bloom source. */
  bloom: HTMLCanvasElement;
  /** The same highlights repainted in the bloom tint, for the wide levels. */
  bloomTint: HTMLCanvasElement;
  /** Scratch for the depth-of-field pass on near dust. */
  scratch: HTMLCanvasElement;
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
  dots: makeCanvas(width, height),
  nebula: makeCanvas(width, height),
  bloom: makeCanvas(width, height),
  bloomTint: makeCanvas(width, height),
  scratch: makeCanvas(width, height),
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

const proj: Projected = { sx: 0, sy: 0, d: 0 };

/**
 * One plane of the corridor.
 *
 * Rows are walked from far to near, which means depth is monotonic: the dot
 * colour tier only changes a couple of times over the whole plane, so
 * `fillStyle` is set a handful of times instead of once per dot.
 */
const drawPlane = (
  ctx: CanvasRenderingContext2D,
  cam: TunnelCamera,
  sign: number,
  travel: number,
  width: number,
  height: number,
) => {
  const t = config.tunnel;
  const d = config.dot;
  const cells = config.motion.cellsPerLoop;

  // Rows that fall inside the depth window this frame.
  const rowFar = Math.floor((cam.z - t.far) / t.spacingZ);
  const rowNear = Math.ceil((cam.z - t.near) / t.spacingZ);

  const wavePhase = (travel / (t.spacingZ * d.wave.rowPeriod)) * Math.PI * 2;

  let tier = -1;
  for (let row = rowFar; row <= rowNear; row++) {
    const wz = row * t.spacingZ;
    const depth = cam.z - wz;
    if (depth <= t.near || depth >= t.far) continue;

    // Depth fades: in as dots rush past, out into the distance.
    const fadeNear = smoothstep(t.nearFade.start, t.nearFade.end, depth);
    const fadeFar = 1 - smoothstep(t.farFade.start, t.farFade.end, depth);
    const depthAlpha = fadeNear * fadeFar;
    if (depthAlpha <= 0.004) continue;

    // Colour tier by depth — near dots deep blue, far dots near-white cyan.
    const nextTier = depth > 22 ? 2 : depth > 8 ? 1 : 0;
    if (nextTier !== tier) {
      tier = nextTier;
      ctx.fillStyle =
        tier === 2
          ? config.palette.dotFar
          : tier === 1
            ? config.palette.dotMid
            : config.palette.dotNear;
    }

    // Row hashing must repeat with the loop, or the wrap would be visible.
    const rowMod = mod(row, cells);

    // Second noise octave. The lattice row and its neighbour are constant
    // across the row, so they are resolved once here rather than per dot; the
    // neighbour wraps on the loop period so the patches stay continuous across
    // the seam.
    const cell = d.patch.cellSize;
    const latticeRows = cells / cell;
    const ry = rowMod / cell;
    const ry0 = Math.floor(ry);
    const patchFy = ry - ry0;
    const patchRowA = mod(ry0, latticeRows);
    const patchRowB = mod(ry0 + 1, latticeRows);

    const wave =
      1 -
      d.wave.depth +
      d.wave.depth *
        (0.5 +
          0.5 * Math.sin((rowMod / d.wave.rowPeriod) * Math.PI * 2 - wavePhase));

    const dw = clamp((cam.f * d.width) / depth, d.minPx, d.maxPx);
    const dh = clamp((cam.f * d.height) / depth, d.minPx, d.maxPx);
    const halfW = dw * 0.5;
    const halfH = dh * 0.5;

    for (let col = -t.columns; col <= t.columns; col++) {
      const h0 = dotHash(col, rowMod, 1);
      if (h0 < d.dropout) continue;

      const wx = col * t.spacingX;
      project(cam, wx, planeY(wx, sign, cam.halfHeight, cam.curve), wz, proj);
      const sx = proj.sx;
      const sy = proj.sy;
      if (Number.isNaN(sx)) continue;
      if (sx < -halfW || sx > width + halfW) continue;
      if (sy < -halfH || sy > height + halfH) continue;

      // Fine octave: per-dot white noise.
      const bright =
        d.intensity.min +
        (d.intensity.max - d.intensity.min) * dotHash(col, rowMod, 2);

      // Coarse octave: soft patches, so the grid does not read mechanically even.
      const lx = col / cell;
      const lx0 = Math.floor(lx);
      const patch = patchNoise(lx0, lx - lx0, patchRowA, patchRowB, patchFy);
      // Mean-preserving: patch averages 0.5, so this varies around 1.0 rather
      // than darkening the whole grid.
      const patchGain = 1 + d.patch.depth * (patch - 0.5);

      const a = depthAlpha * bright * wave * patchGain;
      if (a <= 0.006) continue;

      ctx.globalAlpha = a;
      ctx.fillRect(sx - halfW, sy - halfH, dw, dh);
    }
  }
};

/** Soft radial blob, used for both nebula clouds and dust motes. */
const drawBlob = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  radius: number,
  inner: string,
  outer: string,
  alpha: number,
) => {
  if (radius < 0.4 || alpha <= 0.004) return;
  const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.45, outer);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fill();
};

const drawNebula = (
  ctx: CanvasRenderingContext2D,
  cam: TunnelCamera,
  travel: number,
  width: number,
  height: number,
) => {
  const L = loopDistance();
  ctx.globalCompositeOperation = "lighter";
  for (const blob of NEBULA) {
    const depth = drifterDepth(blob, travel);
    if (depth < config.nebula.nearFade.start || depth > config.tunnel.far)
      continue;
    project(cam, blob.x, blob.y, cam.z - depth, proj);
    if (Number.isNaN(proj.sx)) continue;
    const r = (cam.f * blob.size) / depth;
    if (proj.sx < -r || proj.sx > width + r) continue;
    if (proj.sy < -r || proj.sy > height + r) continue;

    // Fade at both ends of the slab so the wrap is invisible.
    const edge =
      smoothstep(config.nebula.nearFade.start, config.nebula.nearFade.end, depth) *
      (1 - smoothstep(L * 0.62, L, depth));
    drawBlob(
      ctx,
      proj.sx,
      proj.sy,
      r,
      blob.hue < 0.5 ? config.palette.nebulaA : config.palette.nebulaB,
      config.palette.nebulaA,
      config.nebula.alpha * blob.intensity * edge,
    );
  }
};

const drawDust = (
  ctx: CanvasRenderingContext2D,
  scratchCtx: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  cam: TunnelCamera,
  travel: number,
  width: number,
  height: number,
) => {
  const cfg = config.dust;
  const L = loopDistance();

  // Near dust is drawn to scratch so one blur covers the whole depth-of-field
  // group, rather than blurring each mote separately.
  reset(scratchCtx, width, height);
  scratchCtx.globalCompositeOperation = "lighter";
  let anyNear = false;

  ctx.globalCompositeOperation = "lighter";

  for (const mote of DUST) {
    const depth = drifterDepth(mote, travel);
    if (depth < 0.4 || depth > config.tunnel.far) continue;
    project(cam, mote.x, mote.y, cam.z - depth, proj);
    if (Number.isNaN(proj.sx)) continue;

    const r = clamp((cam.f * mote.size) / depth, cfg.minPx, cfg.maxPx);
    if (proj.sx < -r || proj.sx > width + r) continue;
    if (proj.sy < -r || proj.sy > height + r) continue;

    const edge =
      smoothstep(0.4, 3, depth) * (1 - smoothstep(L * 0.6, L, depth));
    const a = cfg.alpha * mote.intensity * edge;
    if (a <= 0.005) continue;

    const near = depth < cfg.blurNearerThan;
    if (near) anyNear = true;
    drawBlob(
      near ? scratchCtx : ctx,
      proj.sx,
      proj.sy,
      r,
      config.palette.dust,
      config.palette.dotMid,
      a,
    );
  }

  if (anyNear) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1;
    ctx.filter = `blur(${cfg.maxBlurPx}px)`;
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
  }
};

const drawVignette = (
  ctx: CanvasRenderingContext2D,
  cam: TunnelCamera,
  width: number,
  height: number,
) => {
  const { vignetteStrength, vignetteInner, coreShadow } = config.post;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.hypot(cx, cy);

  if (vignetteStrength > 0) {
    const grad = ctx.createRadialGradient(cx, cy, r * vignetteInner, cx, cy, r);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${vignetteStrength})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Keep the vanishing point deep rather than letting bloom fill it in.
  if (coreShadow.strength > 0) {
    const cr = r * coreShadow.radius;
    const grad = ctx.createRadialGradient(cam.cx, cam.cy, 0, cam.cx, cam.cy, cr);
    grad.addColorStop(0, `rgba(0,0,0,${coreShadow.strength})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
};

export type DrawOptions = { transparent?: boolean };

/**
 * Draw one frame. Pure function of `frame` — the buffers are scratch space and
 * are cleared on entry, nothing carries over.
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
  const travel = -cam.z;

  const dotsCtx = ctxOf(buffers.dots);
  const nebulaCtx = ctxOf(buffers.nebula);
  const bloomCtx = ctxOf(buffers.bloom);
  const bloomTintCtx = ctxOf(buffers.bloomTint);
  const scratchCtx = ctxOf(buffers.scratch);

  reset(target, width, height);
  reset(dotsCtx, width, height);
  reset(nebulaCtx, width, height);

  // ---- background -------------------------------------------------------
  if (!transparent) {
    const bg = target.createRadialGradient(
      cam.cx,
      cam.cy,
      0,
      cam.cx,
      cam.cy,
      Math.hypot(width, height) * 0.6,
    );
    bg.addColorStop(0, config.palette.background);
    bg.addColorStop(1, config.palette.backgroundEdge);
    target.fillStyle = bg;
    target.fillRect(0, 0, width, height);
  }

  // ---- nebula, behind everything ----------------------------------------
  drawNebula(nebulaCtx, cam, travel, width, height);
  target.save();
  target.globalCompositeOperation = "lighter";
  target.filter = `blur(${config.nebula.blurPx}px)`;
  target.drawImage(buffers.nebula, 0, 0);
  target.restore();

  // ---- the two dot planes -----------------------------------------------
  dotsCtx.globalCompositeOperation = "lighter";
  drawPlane(dotsCtx, cam, -1, travel, width, height); // floor
  drawPlane(dotsCtx, cam, 1, travel, width, height); // ceiling
  drawDust(dotsCtx, scratchCtx, buffers.scratch, cam, travel, width, height);
  dotsCtx.globalAlpha = 1;
  dotsCtx.filter = "none";

  target.save();
  target.globalCompositeOperation = "lighter";
  target.globalAlpha = 1;
  target.filter = "none";
  target.drawImage(buffers.dots, 0, 0);
  target.restore();

  // ---- atmospheric fog --------------------------------------------------
  // Every dot scatters light into the medium, so the space between dots stops
  // being black. The fog is painted in its OWN colour rather than inheriting
  // the dots': scattered light through a deep-blue medium is much bluer than
  // the cyan sources, and blurring the dots directly gives a washed-out cyan
  // haze instead of atmosphere.
  //
  // `source-in` repaints the dot buffer as a flat fog colour while keeping its
  // alpha, which is what turns the dot pattern into a tinted mask.
  if (config.fog.enabled) {
    reset(scratchCtx, width, height);
    scratchCtx.drawImage(buffers.dots, 0, 0);
    scratchCtx.globalCompositeOperation = "source-in";
    scratchCtx.fillStyle = config.palette.fog;
    scratchCtx.fillRect(0, 0, width, height);
    scratchCtx.globalCompositeOperation = "source-over";

    target.save();
    target.globalCompositeOperation = "lighter";
    for (const lvl of config.fog.levels) {
      target.globalAlpha = clamp(lvl.alpha * config.fog.strength, 0, 1);
      target.filter = `blur(${lvl.blurPx}px)`;
      target.drawImage(buffers.scratch, 0, 0);
    }
    target.restore();
  }

  // ---- bloom ------------------------------------------------------------
  if (config.bloom.enabled) {
    reset(bloomCtx, width, height);
    bloomCtx.drawImage(buffers.dots, 0, 0);
    bloomCtx.globalCompositeOperation = "multiply";
    bloomCtx.drawImage(buffers.dots, 0, 0);
    bloomCtx.globalCompositeOperation = "source-over";

    // The wide levels spill far into the dark middle band, and cyan spill is
    // what stops that band reading as deep blue. Repaint the highlights in the
    // bloom tint for those levels only — the narrow ones stay the dots' own
    // colour, since they sit on the dots and read as their glow.
    const needsTint = config.bloom.levels.some((l) => l.tinted);
    if (needsTint) {
      reset(bloomTintCtx, width, height);
      bloomTintCtx.drawImage(buffers.bloom, 0, 0);
      bloomTintCtx.globalCompositeOperation = "source-in";
      bloomTintCtx.fillStyle = config.palette.bloomTint;
      bloomTintCtx.fillRect(0, 0, width, height);
      bloomTintCtx.globalCompositeOperation = "source-over";
    }

    target.save();
    target.globalCompositeOperation = "lighter";
    for (const lvl of config.bloom.levels) {
      target.globalAlpha = clamp(lvl.alpha * config.bloom.strength, 0, 1);
      target.filter = `blur(${lvl.blurPx}px)`;
      target.drawImage(lvl.tinted ? buffers.bloomTint : buffers.bloom, 0, 0);
    }
    target.restore();
  }

  // ---- post -------------------------------------------------------------
  target.filter = "none";
  target.globalAlpha = 1;
  target.globalCompositeOperation = "source-over";
  if (!transparent) drawVignette(target, cam, width, height);
};

export { gridHalfWidth };
