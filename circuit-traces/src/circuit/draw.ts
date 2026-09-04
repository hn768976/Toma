import {
  ASPECT,
  Board,
  Lightable,
  Pt,
  TIER_WIDTH,
  Trace,
  X0,
  X1,
  Y0,
  Y1,
  pointAt,
  segmentAt,
} from "./geometry";
import { grainTiles, tileCount } from "./grain";
import {
  HUE_BUCKETS,
  Palette,
  PaletteLuts,
  TAIL_STEPS,
  bucketOf,
  buildLuts,
} from "./palette";
import { clamp, makeRng } from "./rng";

/** Bloom is rendered at 1/GLOW_DIV resolution, blurred small and upscaled. */
const GLOW_DIV = 4;

const make2d = (w: number, h: number) => {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w));
  cv.height = Math.max(1, Math.round(h));
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return { cv, ctx };
};

// ---------------------------------------------------------------------------
// Static assets, memoised on (palette, pixel size). These are pure functions of
// their key — no frame ever leaks into them — so caching is safe even though
// Remotion renders frames out of order.
// ---------------------------------------------------------------------------

type Assets = {
  base: HTMLCanvasElement;
  luts: PaletteLuts;
  sprites: HTMLCanvasElement[];
  glow: { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
  glowBlur: { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
  vignette: CanvasGradient;
};

const assetCache = new Map<string, Assets>();

const SPRITE_PX = 96;

const buildSprites = (palette: Palette): HTMLCanvasElement[] => {
  const out: HTMLCanvasElement[] = [];
  for (let b = 0; b < HUE_BUCKETS; b++) {
    const h = (b / HUE_BUCKETS) * 360;
    const { cv, ctx } = make2d(SPRITE_PX, SPRITE_PX);
    const r = SPRITE_PX / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, `hsla(${h},${palette.headS}%,99%,1)`);
    g.addColorStop(0.16, `hsla(${h},55%,82%,0.72)`);
    g.addColorStop(0.42, `hsla(${h},92%,58%,0.26)`);
    g.addColorStop(1, `hsla(${h},95%,50%,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
    out.push(cv);
  }
  return out;
};

/**
 * The unlit board: background mottling, the relief under every trace, the dim
 * trace cores, and all component outlines. Drawn once at design size and then
 * blitted with the camera offset each frame.
 */
const buildBase = (
  board: Board,
  palette: Palette,
  luts: PaletteLuts,
  S: number,
): HTMLCanvasElement => {
  const w = (X1 - X0) * S;
  const h = (Y1 - Y0) * S;
  const { cv, ctx } = make2d(w, h);
  const px = (x: number) => (x - X0) * S;
  const py = (y: number) => (y - Y0) * S;

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, cv.width, cv.height);

  // Faint mottling so the substrate isn't a flat field.
  const rng = makeRng(palette.id === "neon" ? 0xb0a12 : 0xb0a34);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 22; i++) {
    const cx = px(X0 + rng() * (X1 - X0));
    const cy = py(Y0 + rng() * (Y1 - Y0));
    const rad = S * (0.08 + rng() * 0.3);
    const hue =
      palette.substrate[0] +
      rng() * (palette.substrate[1] - palette.substrate[0]);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `hsla(${hue},60%,${palette.id === "neon" ? 22 : 18}%,0.05)`);
    g.addColorStop(1, `hsla(${hue},60%,10%,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  ctx.globalCompositeOperation = "source-over";

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const strokeTraces = (list: Trace[], lw: number) => {
    ctx.beginPath();
    for (const t of list) {
      ctx.moveTo(px(t.pts[0].x), py(t.pts[0].y));
      for (let i = 1; i < t.pts.length; i++) {
        ctx.lineTo(px(t.pts[i].x), py(t.pts[i].y));
      }
    }
    ctx.lineWidth = lw;
    ctx.stroke();
  };

  // Bin traces once: [bucket][tier].
  const bins: Trace[][][] = Array.from({ length: HUE_BUCKETS }, () => [
    [],
    [],
    [],
  ]);
  const byTier: Trace[][] = [[], [], []];
  for (const t of board.traces) {
    bins[bucketOf(palette, t.hx, t.hy)][t.tier].push(t);
    byTier[t.tier].push(t);
  }

  // Relief pass — a wide, near-black stroke that reads as etched solder mask.
  ctx.strokeStyle = palette.relief;
  for (let tier = 0; tier < 3; tier++) {
    strokeTraces(byTier[tier], TIER_WIDTH[tier] * S * 3.1);
  }

  // Dim trace cores, batched per colour bucket.
  for (let b = 0; b < HUE_BUCKETS; b++) {
    ctx.strokeStyle = luts.base[b];
    for (let tier = 0; tier < 3; tier++) {
      if (bins[b][tier].length === 0) continue;
      strokeTraces(bins[b][tier], TIER_WIDTH[tier] * S);
    }
  }

  // ---- Components --------------------------------------------------------
  const partColor = (x: number, y: number) =>
    luts.part[bucketOf(palette, x, y)];

  // Relief under the parts first, then the dim outlines.
  for (const pass of [0, 1]) {
    if (pass === 0) ctx.strokeStyle = palette.relief;

    for (const l of board.lines) {
      if (pass === 1) ctx.strokeStyle = partColor(l.x1, l.y1);
      ctx.lineWidth = l.w * S * (pass === 0 ? 3 : 1);
      ctx.beginPath();
      ctx.moveTo(px(l.x1), py(l.y1));
      ctx.lineTo(px(l.x2), py(l.y2));
      ctx.stroke();
    }

    for (const r of board.rects) {
      if (pass === 1) ctx.strokeStyle = partColor(r.x, r.y);
      ctx.lineWidth = r.lw * S * (pass === 0 ? 2.6 : 1);
      ctx.beginPath();
      ctx.roundRect(
        px(r.x - r.w / 2),
        py(r.y - r.h / 2),
        r.w * S,
        r.h * S,
        r.r * S,
      );
      ctx.stroke();
    }

    for (const c of board.circles) {
      if (pass === 1) ctx.strokeStyle = partColor(c.x, c.y);
      ctx.lineWidth = c.lw * S * (pass === 0 ? 2.6 : 1);
      ctx.beginPath();
      ctx.arc(px(c.x), py(c.y), c.r * S, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const d of board.dashes) {
      if (pass === 1) ctx.strokeStyle = partColor(d.x1, d.y1);
      ctx.lineWidth = d.w * S * (pass === 0 ? 2.6 : 1);
      ctx.setLineDash([d.dash * S, d.dash * S * 0.7]);
      ctx.beginPath();
      ctx.moveTo(px(d.x1), py(d.y1));
      ctx.lineTo(px(d.x2), py(d.y2));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  return cv;
};

const getAssets = (board: Board, palette: Palette, S: number): Assets => {
  const key = `${palette.id}:${Math.round(S)}`;
  const hit = assetCache.get(key);
  if (hit) return hit;

  const luts = buildLuts(palette);
  const glow = make2d(S / GLOW_DIV, (S * ASPECT) / GLOW_DIV);
  const glowBlur = make2d(S / GLOW_DIV, (S * ASPECT) / GLOW_DIV);

  const vctx = make2d(2, 2).ctx;
  const w = S;
  const h = S * ASPECT;
  const vignette = vctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.22,
    w / 2,
    h / 2,
    Math.hypot(w, h) * 0.62,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.62, `rgba(0,0,0,${palette.vignette * 0.34})`);
  vignette.addColorStop(1, `rgba(0,0,0,${palette.vignette})`);

  const assets: Assets = {
    base: buildBase(board, palette, luts, S),
    luts,
    sprites: buildSprites(palette),
    glow,
    glowBlur,
    vignette,
  };
  assetCache.set(key, assets);
  return assets;
};

// ---------------------------------------------------------------------------
// Per-frame drawing
// ---------------------------------------------------------------------------

const pA: Pt = { x: 0, y: 0 };
const pB: Pt = { x: 0, y: 0 };

/**
 * A pulse is drawn as a chain of short sub-segments running back from the head.
 * Sample positions are the even tail steps merged with the trace's own vertices,
 * so the tail turns exactly where the routing turns instead of cutting corners.
 */
const drawPulseTail = (
  ctx: CanvasRenderingContext2D,
  tr: Trace,
  sHead: number,
  tail: number,
  colors: string[],
  S: number,
  camX: number,
  camY: number,
  lw: number,
) => {
  const sEnd = Math.max(0, sHead - tail);
  if (sHead - sEnd < 1e-5) return;

  const samples: number[] = [];
  for (let i = 0; i < TAIL_STEPS; i++) {
    samples.push(sHead - (tail * i) / (TAIL_STEPS - 1));
  }
  // Merge in the vertices that fall inside the tail.
  const iHead = segmentAt(tr, Math.min(sHead, tr.len));
  const iEnd = segmentAt(tr, sEnd);
  for (let v = iEnd + 1; v <= iHead; v++) {
    const s = tr.cum[v];
    if (s < sEnd || s > sHead) continue;
    samples.push(s);
  }
  samples.sort((a, b) => b - a);

  ctx.lineWidth = lw;
  for (let i = 0; i < samples.length - 1; i++) {
    const s0 = samples[i];
    const s1 = samples[i + 1];
    if (s0 - s1 < 1e-6) continue;
    if (s0 < 0) break;
    pointAt(tr, s0, pA);
    pointAt(tr, s1, pB);
    const u = clamp((sHead - (s0 + s1) / 2) / tail, 0, 1);
    ctx.strokeStyle = colors[Math.min(TAIL_STEPS - 1, Math.round(u * (TAIL_STEPS - 1)))];
    ctx.beginPath();
    ctx.moveTo((pA.x - camX) * S, (pA.y - camY) * S);
    ctx.lineTo((pB.x - camX) * S, (pB.y - camY) * S);
    ctx.stroke();
  }
};

/** How far from a pulse head a component still catches light. Package pins get
 *  a wider reach so a signal arriving at a chip lights a run of the comb. */
const PART_LIGHT_R = 0.016;
const PIN_LIGHT_R = 0.03;
/** Falloff exponent for a lit pin run. Higher keeps the comb's individual pins
 *  readable instead of blowing the lit section into a solid block. */
const PIN_FALLOFF = 1.6;

/** Draws one lit component. Shared by the crisp pass and the bloom layer, so
 *  the two never drift apart. */
const strokeLightable = (
  c: CanvasRenderingContext2D,
  l: Lightable,
  S: number,
  camX: number,
  camY: number,
  widthMul: number,
) => {
  const x = (l.x - camX) * S;
  const y = (l.y - camY) * S;
  if (l.kind === "via") {
    c.lineWidth = 0.0013 * S * widthMul;
    c.beginPath();
    c.arc(x, y, l.r * S, 0, Math.PI * 2);
    c.stroke();
  } else if (l.kind === "pin") {
    // The signal runs the length of the pin and into the package.
    c.lineWidth = l.w * S * 1.5 * Math.min(widthMul, 1.4);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo((l.ix - camX) * S, (l.iy - camY) * S);
    c.stroke();
  } else {
    c.lineWidth = 0.0015 * S * widthMul;
    c.beginPath();
    c.roundRect(
      x - (l.w * S) / 2,
      y - (l.h * S) / 2,
      l.w * S,
      l.h * S,
      l.r * S,
    );
    c.stroke();
  }
};

export type FrameArgs = {
  ctx: CanvasRenderingContext2D;
  board: Board;
  palette: Palette;
  pulses: import("./pulses").Pulse[];
  /** Frame width in backing pixels — the single scale everything derives from. */
  S: number;
  frame: number;
  durationInFrames: number;
};

export const drawFrame = ({
  ctx,
  board,
  palette,
  pulses,
  S,
  frame,
  durationInFrames,
}: FrameArgs) => {
  const W = S;
  const H = S * ASPECT;
  const t = (frame % durationInFrames) / durationInFrames;
  const tau = Math.PI * 2;

  const assets = getAssets(board, palette, S);
  const { luts, sprites, glow, glowBlur } = assets;

  // Slow elliptical drift; exactly periodic over the loop.
  const camX = 0.022 * Math.sin(tau * t);
  const camY = 0.014 * Math.sin(tau * t + 1.9);
  // Long, gentle brightness breathing.
  const breathe = 0.5 + 0.5 * Math.sin(tau * t - 0.7);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);

  const baseX = (X0 - camX) * S;
  const baseY = (Y0 - camY) * S;
  ctx.globalAlpha = 0.87 + 0.13 * breathe;
  ctx.drawImage(assets.base, baseX, baseY);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.06 + 0.09 * breathe;
  ctx.drawImage(assets.base, baseX, baseY);
  ctx.globalAlpha = 1;

  // ---- Resolve pulse head positions once ---------------------------------
  const heads: { x: number; y: number; b: number; gain: number }[] = [];
  const headArc: number[] = [];
  for (const p of pulses) {
    const tr = board.traces[p.t];
    const s = ((p.phase + p.k * t) % 1) * tr.len;
    headArc.push(s);
    pointAt(tr, s, pA);
    heads.push({
      x: pA.x,
      y: pA.y,
      b: bucketOf(palette, tr.hx, tr.hy),
      gain: p.gain,
    });
  }

  // ---- Resolve which components an arriving pulse lights ----------------
  const lg = board.lightGrid;
  const lit = new Float32Array(board.lightables.length);
  for (let i = 0; i < heads.length; i++) {
    const hd = heads[i];
    const gc = Math.floor((hd.x - X0) / lg.cell);
    const gr = Math.floor((hd.y - Y0) / lg.cell);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const cc = gc + dc;
        const rr = gr + dr;
        if (cc < 0 || rr < 0 || cc >= lg.cols || rr >= lg.rows) continue;
        for (const li of lg.buckets[rr * lg.cols + cc]) {
          const l = board.lightables[li];
          // A pulse reaching a package lights a run of the pin comb, not just
          // the one pin it arrived on.
          const R = l.kind === "pin" ? PIN_LIGHT_R : PART_LIGHT_R;
          const d = Math.hypot(l.x - hd.x, l.y - hd.y);
          if (d > R) continue;
          const t0 = 1 - d / R;
          const v = (l.kind === "pin" ? Math.pow(t0, PIN_FALLOFF) : t0) * hd.gain;
          if (v > lit[li]) lit[li] = v;
        }
      }
    }
  }

  // ---- Bloom layer -------------------------------------------------------
  const g = glow.ctx;
  const gs = S / GLOW_DIV;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, glow.cv.width, glow.cv.height);
  g.globalCompositeOperation = "lighter";
  g.lineCap = "round";
  g.lineJoin = "round";
  for (let i = 0; i < pulses.length; i++) {
    const p = pulses[i];
    const tr = board.traces[p.t];
    g.globalAlpha = p.gain * 0.85;
    drawPulseTail(
      g,
      tr,
      headArc[i],
      p.tail,
      p.white ? luts.whiteTail : luts.tail[heads[i].b],
      gs,
      camX,
      camY,
      Math.max(1.2, TIER_WIDTH[tr.tier] * gs * 2.4),
    );
  }
  // Hot heads bloom hardest.
  for (let i = 0; i < pulses.length; i++) {
    const hd = heads[i];
    const r = gs * 0.02;
    g.globalAlpha = hd.gain * 0.9;
    g.drawImage(
      sprites[hd.b],
      (hd.x - camX) * gs - r,
      (hd.y - camY) * gs - r,
      r * 2,
      r * 2,
    );
  }
  // Lit components bloom alongside the pulses that lit them.
  for (let i = 0; i < lit.length; i++) {
    const v = lit[i];
    if (v < 0.02) continue;
    const l = board.lightables[i];
    g.globalAlpha = Math.min(1, v * (l.kind === "pin" ? 0.7 : 0.8));
    g.strokeStyle = luts.flash[bucketOf(palette, l.x, l.y)];
    strokeLightable(g, l, gs, camX, camY, l.kind === "pin" ? 1.4 : 2.2);
  }
  g.globalAlpha = 1;

  // Blur small, then upscale: bloom without the cost of a full-res filter.
  const gb = glowBlur.ctx;
  gb.setTransform(1, 0, 0, 1, 0, 0);
  gb.globalCompositeOperation = "source-over";
  gb.filter = "none";
  gb.clearRect(0, 0, glowBlur.cv.width, glowBlur.cv.height);
  gb.filter = `blur(${Math.max(1, gs * 0.006).toFixed(2)}px)`;
  gb.drawImage(glow.cv, 0, 0);
  gb.filter = "none";

  ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 1;
  ctx.drawImage(glowBlur.cv, 0, 0, W, H);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(glow.cv, 0, 0, W, H);
  ctx.globalAlpha = 1;

  // ---- Lit components ----------------------------------------------------
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < lit.length; i++) {
    const v = lit[i];
    if (v < 0.02) continue;
    const l = board.lightables[i];
    ctx.globalAlpha = Math.min(1, v * 0.95);
    ctx.strokeStyle = luts.flash[bucketOf(palette, l.x, l.y)];
    strokeLightable(ctx, l, S, camX, camY, 1);
  }
  ctx.globalAlpha = 1;

  // ---- Crisp pulses on top ----------------------------------------------
  for (let i = 0; i < pulses.length; i++) {
    const p = pulses[i];
    const tr = board.traces[p.t];
    ctx.globalAlpha = p.gain;
    drawPulseTail(
      ctx,
      tr,
      headArc[i],
      p.tail,
      p.white ? luts.whiteTail : luts.tail[heads[i].b],
      S,
      camX,
      camY,
      Math.max(1, TIER_WIDTH[tr.tier] * S * 1.15),
    );
  }
  for (let i = 0; i < pulses.length; i++) {
    const hd = heads[i];
    const r = S * 0.0062;
    ctx.globalAlpha = Math.min(1, hd.gain * 1.1);
    ctx.drawImage(
      sprites[hd.b],
      (hd.x - camX) * S - r,
      (hd.y - camY) * S - r,
      r * 2,
      r * 2,
    );
  }
  ctx.globalAlpha = 1;

  // ---- Vignette ----------------------------------------------------------
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = assets.vignette;
  ctx.fillRect(0, 0, W, H);

  // ---- Grain -------------------------------------------------------------
  const tiles = grainTiles();
  const tile = tiles[frame % tileCount];
  const pat = ctx.createPattern(tile, "repeat");
  if (pat) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.03;
    ctx.save();
    ctx.translate(
      -((frame * 37) % 256),
      -((frame * 61) % 256),
    );
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
};
