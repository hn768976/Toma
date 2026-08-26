import {COLOR, DESIGN_H, DESIGN_W, DURATION, RGB, TILT, rgba} from './theme';
import {Series, buildSeries} from './series';
import {
  BokehDef,
  LabelDef,
  bokehStateAt,
  buildBokeh,
  buildLabels,
  labelStateAt,
} from './labels';
import {GrainTiles, GRAIN_SIZE, buildGrain, grainOffsetAt} from './grain';
import {CACHE_FONT, TextCache, getDashTile, getTextTile} from './text';

const TAU = Math.PI * 2;

/** How far past the visible frame we keep drawing the series, in world px. */
const CULL_MARGIN = 1320;
/** The trend sits a little below centre, like the reference framing. */
const LINE_Y_OFFSET = 60;
/**
 * The bloom is blurred in fixed-size low-res buffers, deliberately independent
 * of the render resolution, so the spill looks identical at 1080p and at 4K.
 * Two taps: a tight one that thickens the neon, a wide one that spills into
 * the black.
 */
const BLOOM_W = 640;
const BLOOM_H = 360;
const HALO_W = 360;
const HALO_H = 203;

export type Scene = {
  series: Series;
  labels: LabelDef[];
  bokeh: BokehDef[];
  grain: GrainTiles;
  textCache: TextCache;
  lineLayer: HTMLCanvasElement;
  bloom: HTMLCanvasElement;
  halo: HTMLCanvasElement;
  measure: CanvasRenderingContext2D;
  /** the (compositionWidth / DESIGN_W) x devicePixelRatio the caches were baked at */
  unit: number;
};

export const buildScene = (): Scene => {
  const lineLayer = document.createElement('canvas');
  const bloom = document.createElement('canvas');
  bloom.width = BLOOM_W;
  bloom.height = BLOOM_H;
  const halo = document.createElement('canvas');
  halo.width = HALO_W;
  halo.height = HALO_H;
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = 8;
  measureCanvas.height = 8;
  return {
    series: buildSeries(),
    labels: buildLabels(),
    bokeh: buildBokeh(),
    grain: buildGrain(),
    textCache: new Map(),
    lineLayer,
    bloom,
    halo,
    measure: measureCanvas.getContext('2d') as CanvasRenderingContext2D,
    unit: 0,
  };
};

type Pass = {w: number; a: number; blur: number; color: RGB};

/** Wide glow -> mid body -> hot core. The layering is what makes it read neon. */
const MAIN_PASSES: Pass[] = [
  {w: 15, a: 0.26, blur: 42, color: COLOR.lineGlow},
  {w: 7, a: 1, blur: 17, color: COLOR.lineMid},
  {w: 2.4, a: 1, blur: 0, color: COLOR.lineCore},
];

/** The moving average: same construction, thinner and dimmer. */
const MA_PASSES: Pass[] = [
  {w: 8, a: 0.14, blur: 26, color: COLOR.lineGlow},
  {w: 3, a: 0.42, blur: 11, color: COLOR.lineMid},
  {w: 1.2, a: 0.6, blur: 0, color: COLOR.lineCore},
];

const strokeSeries = (
  ctx: CanvasRenderingContext2D,
  s: Series,
  ys: Float64Array,
  camX: number,
  passes: Pass[],
  breathe: number,
) => {
  for (let k = -1; k <= 1; k++) {
    const x0 = k * s.tileWidth;
    const lo = Math.max(0, Math.floor((camX - CULL_MARGIN - x0) / s.dx) - 1);
    const hi = Math.min(s.n, Math.ceil((camX + CULL_MARGIN - x0) / s.dx) + 1);
    if (hi - lo < 2) continue;

    const yShift = -k * s.tileRise;
    const path = new Path2D();
    for (let i = lo; i <= hi; i++) {
      const x = x0 + i * s.dx;
      const y = ys[i] + yShift;
      if (i === lo) path.moveTo(x, y);
      else path.lineTo(x, y);
    }

    for (const p of passes) {
      const glowing = p.blur > 0;
      ctx.lineWidth = p.w;
      ctx.strokeStyle = rgba(p.color, glowing ? p.a * breathe : p.a);
      ctx.shadowBlur = glowing ? p.blur * breathe : 0;
      ctx.shadowColor = glowing ? rgba(p.color, 1) : 'rgba(0,0,0,0)';
      ctx.stroke(path);
    }
  }
};

const drawLabelSet = (
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  frame: number,
  near: boolean,
  unit: number,
  fontFamily: string,
  fontReady: boolean,
) => {
  if (!fontReady) return;
  for (const L of scene.labels) {
    if (L.z >= 0.5 !== near) continue;
    const st = labelStateAt(L, frame);
    if (Math.abs(st.u) > 1500 || Math.abs(st.v) > 940) continue;

    const tile = L.isDash
      ? getDashTile(scene.textCache, Math.round(L.dashLen / 4), unit)
      : getTextTile(
          scene.textCache,
          scene.measure,
          st.text,
          L.white,
          unit,
          L.blurTile,
          fontFamily,
        );

    const scale = L.isDash ? 0.7 + L.z : L.sizePx / CACHE_FONT;
    const w = tile.cssW * scale;
    const h = tile.cssH * scale;

    // Motion blur: the fastest near labels would strobe at 30fps, so smear
    // them across roughly one frame of travel. Five taps, not three — three
    // leaves a visible triple image at the speeds the near plane runs at.
    const smear = L.z > 0.7 ? 5 : 1;
    const weights = smear === 5 ? [0.3, 0.24, 0.19, 0.15, 0.12] : [1];

    for (let s = 0; s < smear; s++) {
      const u = st.u + L.speed * 0.75 * (s / smear);
      ctx.globalAlpha = L.alpha * weights[s];
      ctx.drawImage(tile.canvas, u - w / 2, st.v - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }
};

const drawBokeh = (ctx: CanvasRenderingContext2D, scene: Scene, frame: number) => {
  for (const B of scene.bokeh) {
    const st = bokehStateAt(B, frame);
    if (Math.abs(st.u) > 1400 || Math.abs(st.v) > 900) continue;
    const g = ctx.createRadialGradient(st.u, st.v, 0, st.u, st.v, B.radius);
    g.addColorStop(0, rgba(COLOR.lineGlow, B.alpha));
    g.addColorStop(0.5, rgba(COLOR.lineGlow, B.alpha * 0.5));
    g.addColorStop(0.82, rgba(COLOR.lineGlow, B.alpha * 0.14));
    g.addColorStop(1, rgba(COLOR.lineGlow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(st.u, st.v, B.radius, 0, TAU);
    ctx.fill();
  }
};

export const drawFrame = (
  canvas: HTMLCanvasElement,
  scene: Scene,
  frame: number,
  compositionWidth: number,
  fontFamily: string,
  fontReady: boolean,
) => {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  // One scale for everything: composition size relative to the 1920x1080
  // design space, times the device pixel ratio.
  const unit = (compositionWidth / DESIGN_W) * dpr;
  // Label tiles are baked at the render unit but capped at 2x, which keeps the
  // 4K cache the same size as the 1080p one without ever upscaling below 4K.
  const tileUnit = Math.min(unit, 2);
  const dw = Math.round(DESIGN_W * unit);
  const dh = Math.round(DESIGN_H * unit);

  if (scene.unit !== tileUnit) {
    scene.unit = tileUnit;
    scene.textCache.clear(); // tiles are baked at the old resolution
  }
  if (canvas.width !== dw || canvas.height !== dh) {
    canvas.width = dw;
    canvas.height = dh;
  }
  if (scene.lineLayer.width !== dw || scene.lineLayer.height !== dh) {
    scene.lineLayer.width = dw;
    scene.lineLayer.height = dh;
  }

  const ctx = canvas.getContext('2d', {alpha: false});
  const lctx = scene.lineLayer.getContext('2d');
  const bctx = scene.bloom.getContext('2d');
  const hctx = scene.halo.getContext('2d');
  if (!ctx || !lctx || !bctx || !hctx) return;

  const f = ((frame % DURATION) + DURATION) % DURATION;
  const t = f / DURATION;
  const s = scene.series;

  // ---- camera ------------------------------------------------------------
  // Tracks along the trend: right by exactly one tile width and up by exactly
  // one tile rise over 840 frames, so the loop closes on the geometry.
  const camX = t * s.tileWidth;
  const camY = -t * s.tileRise;
  // A very slight ambient drift on a closed Lissajous path so the shot never
  // feels locked. Integer harmonics, so it closes too.
  const ax = 8 * Math.sin(TAU * t * 3);
  const ay = 8 * Math.sin(TAU * t * 2 + 1.1);
  // Glow breathes +/-8%; period 420 is a divisor of 840.
  const breathe = 1 + 0.08 * Math.sin((TAU * f) / 420);

  const applyWorld = (c: CanvasRenderingContext2D) => {
    c.setTransform(unit, 0, 0, unit, 0, 0);
    c.translate(DESIGN_W / 2 + ax, DESIGN_H / 2 + ay + LINE_Y_OFFSET);
    c.rotate(TILT);
    c.translate(-camX, -camY);
  };
  const applyTilt = (c: CanvasRenderingContext2D) => {
    c.setTransform(unit, 0, 0, unit, 0, 0);
    c.translate(DESIGN_W / 2 + ax, DESIGN_H / 2 + ay);
    c.rotate(TILT);
  };

  // ---- background + ambient wash -----------------------------------------
  ctx.setTransform(unit, 0, 0, unit, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  const wash = ctx.createRadialGradient(300, 940, 0, 300, 940, 1320);
  wash.addColorStop(0, rgba(COLOR.ambient, 0.9));
  wash.addColorStop(0.45, rgba(COLOR.ambient, 0.45));
  wash.addColorStop(1, rgba(COLOR.ambient, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // ---- far labels sit behind the line ------------------------------------
  applyTilt(ctx);
  ctx.globalCompositeOperation = 'lighter';
  drawLabelSet(ctx, scene, f, false, tileUnit, fontFamily, fontReady);

  // ---- the line, on its own layer so it can be bloomed --------------------
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, dw, dh);
  applyWorld(lctx);
  lctx.globalCompositeOperation = 'lighter';
  lctx.lineJoin = 'round';
  lctx.lineCap = 'round';
  strokeSeries(lctx, s, s.ma, camX, MA_PASSES, breathe);
  strokeSeries(lctx, s, s.main, camX, MAIN_PASSES, breathe);
  lctx.shadowBlur = 0;

  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.globalCompositeOperation = 'source-over';
  bctx.clearRect(0, 0, BLOOM_W, BLOOM_H);
  bctx.filter = 'blur(8px)'; // 24px in design space
  bctx.drawImage(scene.lineLayer, 0, 0, BLOOM_W, BLOOM_H);
  bctx.filter = 'none';

  hctx.setTransform(1, 0, 0, 1, 0, 0);
  hctx.globalCompositeOperation = 'source-over';
  hctx.clearRect(0, 0, HALO_W, HALO_H);
  hctx.filter = 'blur(12px)'; // 64px in design space
  hctx.drawImage(scene.lineLayer, 0, 0, HALO_W, HALO_H);
  hctx.filter = 'none';

  ctx.setTransform(unit, 0, 0, unit, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = 0.5 * breathe;
  ctx.drawImage(scene.halo, 0, 0, DESIGN_W, DESIGN_H);
  ctx.globalAlpha = 0.8 * breathe;
  ctx.drawImage(scene.bloom, 0, 0, DESIGN_W, DESIGN_H);
  ctx.globalAlpha = 1;
  ctx.drawImage(scene.lineLayer, 0, 0, DESIGN_W, DESIGN_H);

  // ---- bokeh, then near labels in front ----------------------------------
  applyTilt(ctx);
  ctx.globalCompositeOperation = 'lighter';
  drawBokeh(ctx, scene, f);
  drawLabelSet(ctx, scene, f, true, tileUnit, fontFamily, fontReady);

  // ---- vignette ----------------------------------------------------------
  ctx.setTransform(unit, 0, 0, unit, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const vr = Math.hypot(DESIGN_W, DESIGN_H) / 2;
  const vg = ctx.createRadialGradient(
    DESIGN_W / 2,
    DESIGN_H / 2,
    0,
    DESIGN_W / 2,
    DESIGN_H / 2,
    vr,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.55, 'rgba(0,0,0,0)');
  vg.addColorStop(0.8, 'rgba(0,0,0,0.1)');
  vg.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // ---- grain -------------------------------------------------------------
  const go = grainOffsetAt(f);
  const tile = scene.grain[go.tile];
  if (tile) {
    // Grain is drawn at whole-pixel scale so a noise pixel keeps the same
    // apparent size at 1080p and at 4K rather than dissolving.
    const gs = Math.max(1, Math.round(unit));
    ctx.setTransform(gs, 0, 0, gs, 0, 0);
    const pattern = ctx.createPattern(tile, 'repeat');
    if (pattern) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.04;
      ctx.save();
      ctx.translate(-go.x, -go.y);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, dw / gs + GRAIN_SIZE, dh / gs + GRAIN_SIZE);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
};
