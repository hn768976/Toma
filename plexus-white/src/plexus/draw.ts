import {
  ACCENT_RADIUS_BOOST,
  BACKGROUND,
  BUCKET_BLUR,
  DEPTH_BUCKETS,
  DEPTH_SPAN,
  LINE_ALPHA_FAR,
  LINE_ALPHA_NEAR,
  LINE_GREY_FAR,
  LINE_GREY_NEAR,
  LINE_WIDTH_FAR,
  LINE_WIDTH_NEAR,
  LINK_RADIUS,
  NODE_BLUE_FAR,
  NODE_BLUE_NEAR,
  NODE_GREY_FAR,
  NODE_GREY_NEAR,
  NODE_RADIUS_FAR,
  NODE_RADIUS_NEAR,
  REF_WIDTH,
  SCRATCH_MARGIN,
  SCRATCH_SCALE,
  TONE_GAMMA,
} from "./constants";
import { nodeX, nodeY, nodeZ, type PlexusNode } from "./field";

const TAU = Math.PI * 2;

type RGB = readonly [number, number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const mixRGB = (a: RGB, b: RGB, t: number) =>
  `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;

/** Every length in constants.ts is in reference (4K) px; this converts to the
 *  actual canvas. Blur radii go through the same factor, which is what keeps
 *  the depth of field matching between the studio preview and a 4K render. */
export const scaleOf = (width: number) => width / REF_WIDTH;

/** Depth remapped for appearance only — see TONE_GAMMA. Bucketing (and so the
 *  blur) still keys off raw depth. */
const toneOf = (zn: number) => Math.pow(zn, TONE_GAMMA);

const bucketOf = (zn: number) =>
  Math.min(DEPTH_BUCKETS - 1, Math.max(0, Math.floor(zn * DEPTH_BUCKETS)));

// ---------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------
// Draw calls are batched: styles are set once per band and many primitives go
// into a single path, rather than a style change per line.
//
// The bands have to be fine enough that crossing one is invisible, because a
// pair's depth and separation both drift continuously — a coarse band means
// every line in the field occasionally *jumps* in weight, which is the same
// flicker the smooth distance falloff exists to prevent.
//
// Lines get that for free: every line is stroked in one colour (LINE_GREY_NEAR)
// with depth folded into its alpha instead. Over a white ground that is
// algebraically identical to fading the colour towards LINE_GREY_FAR — see
// toneToAlphaScale — so the only quantised quantity left is alpha, and alpha
// can afford many bands because they cost nothing but a globalAlpha write.
const LINE_ALPHA_BANDS = 48;
const LINE_WIDTH_BANDS = 10;
const DOT_TONE_BANDS = 32;

// Compositing a colour C over white at alpha a leaves 255 - a*(255 - C).
// Restating every line in terms of LINE_GREY_NEAR therefore only needs the
// alpha scaled by (255 - C(tone)) / (255 - LINE_GREY_NEAR).
const LINE_FAR_INK = 255 - LINE_GREY_FAR[0];
const LINE_NEAR_INK = 255 - LINE_GREY_NEAR[0];
const toneToAlphaScale = (tone: number) =>
  lerp(LINE_FAR_INK, LINE_NEAR_INK, tone) / LINE_NEAR_INK;

const LINE_STROKE = `rgb(${LINE_GREY_NEAR[0]},${LINE_GREY_NEAR[1]},${LINE_GREY_NEAR[2]})`;

// Below roughly one 8-bit level of ink over white, a line contributes nothing.
const MIN_INK = 0.005;

type Line = { x1: number; y1: number; x2: number; y2: number };
type Dot = { x: number; y: number; r: number };
type Sample = { x: number; y: number; zn: number; accent: boolean };

/** Bins indexed [bucket][band][band] -> primitives. Allocated once and reused
 *  across frames; rebuilding them every frame would just churn the GC. */
type Bins<T> = T[][][][];

const makeBins = <T,>(a: number, b: number): Bins<T> =>
  Array.from({ length: DEPTH_BUCKETS }, () =>
    Array.from({ length: a }, () => Array.from({ length: b }, (): T[] => [])),
  );

const clearBins = <T,>(bins: Bins<T>) => {
  for (const bucket of bins)
    for (const row of bucket) for (const cell of row) cell.length = 0;
};

export type RenderState = {
  a: HTMLCanvasElement;
  b: HTMLCanvasElement;
  margin: number;
  lines: Bins<Line>;
  dots: Bins<Dot>;
  samples: Sample[];
};

export const makeRenderState = (
  width: number,
  height: number,
): RenderState => {
  const margin = SCRATCH_MARGIN * width;
  const w = Math.ceil((width + margin * 2) * SCRATCH_SCALE);
  const h = Math.ceil((height + margin * 2) * SCRATCH_SCALE);
  const make = () => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  return {
    a: make(),
    b: make(),
    margin,
    lines: makeBins<Line>(LINE_WIDTH_BANDS, LINE_ALPHA_BANDS),
    dots: makeBins<Dot>(DOT_TONE_BANDS, 2),
    samples: [],
  };
};

/**
 * Resolves every node's position for this frame and bins nodes and connections
 * into depth buckets and style bands.
 *
 * The connection search is O(n^2), which is nothing at this node count. If the
 * count is raised substantially, add a spatial grid — do not fall back to a
 * screen-space distance test, which is what produces connections between nodes
 * at completely different depths.
 */
const buildFrame = (state: RenderState, field: PlexusNode[], t: number) => {
  clearBins(state.lines);
  clearBins(state.dots);

  const samples = state.samples;
  samples.length = 0;
  for (const n of field) {
    samples.push({
      x: nodeX(n, t),
      y: nodeY(n, t),
      zn: nodeZ(n, t),
      accent: n.accent,
    });
  }

  const r2 = LINK_RADIUS * LINK_RADIUS;

  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    for (let j = i + 1; j < samples.length; j++) {
      const b = samples[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = (a.zn - b.zn) * DEPTH_SPAN;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= r2) continue;

      // Opacity falls off with separation, and does so smoothly at both ends:
      // a connection eases in from nothing as the pair closes and eases back
      // out as it opens. Without this the whole field flickers as links snap
      // on and off — it is the single most important detail in a plexus.
      const u = 1 - Math.sqrt(d2) / LINK_RADIUS;
      const falloff = u * u * (3 - 2 * u);

      const zn = (a.zn + b.zn) / 2;
      const tone = toneOf(zn);
      const ink =
        falloff *
        lerp(LINE_ALPHA_FAR, LINE_ALPHA_NEAR, tone) *
        toneToAlphaScale(tone);
      if (ink < MIN_INK) continue;

      const bucket = bucketOf(zn);
      const wBand = Math.min(
        LINE_WIDTH_BANDS - 1,
        Math.floor(tone * LINE_WIDTH_BANDS),
      );
      const aBand = Math.min(
        LINE_ALPHA_BANDS - 1,
        Math.floor(ink * LINE_ALPHA_BANDS),
      );
      state.lines[bucket][wBand][aBand].push({
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
      });
    }
  }

  for (const n of samples) {
    const tone = toneOf(n.zn);
    const bucket = bucketOf(n.zn);
    const band = Math.min(
      DOT_TONE_BANDS - 1,
      Math.floor(tone * DOT_TONE_BANDS),
    );
    state.dots[bucket][band][n.accent ? 1 : 0].push({
      x: n.x,
      y: n.y,
      r: lerp(NODE_RADIUS_FAR, NODE_RADIUS_NEAR, tone),
    });
  }
};

/** Draws one depth bucket — its connections, then its nodes on top. */
const paintBucket = (
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  bucket: number,
  s: number,
  accentEnabled: boolean,
) => {
  ctx.lineCap = "round";
  ctx.strokeStyle = LINE_STROKE;

  for (let w = 0; w < LINE_WIDTH_BANDS; w++) {
    const bands = state.lines[bucket][w];
    let styled = false;
    for (let a = 0; a < LINE_ALPHA_BANDS; a++) {
      const lines = bands[a];
      if (lines.length === 0) continue;
      if (!styled) {
        const tone = (w + 0.5) / LINE_WIDTH_BANDS;
        ctx.lineWidth = lerp(LINE_WIDTH_FAR, LINE_WIDTH_NEAR, tone) * s;
        styled = true;
      }
      ctx.globalAlpha = (a + 0.5) / LINE_ALPHA_BANDS;
      ctx.beginPath();
      for (const l of lines) {
        // Sub-pixel precision throughout: thin dark lines on white show
        // stair-stepping instantly if coordinates are rounded.
        ctx.moveTo(l.x1 * s, l.y1 * s);
        ctx.lineTo(l.x2 * s, l.y2 * s);
      }
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;

  for (let band = 0; band < DOT_TONE_BANDS; band++) {
    const tone = (band + 0.5) / DOT_TONE_BANDS;
    for (let accent = 0; accent < 2; accent++) {
      const dots = state.dots[bucket][band][accent];
      if (dots.length === 0) continue;
      const isAccent = accent === 1 && accentEnabled;
      ctx.fillStyle = isAccent
        ? mixRGB(NODE_BLUE_FAR, NODE_BLUE_NEAR, tone)
        : mixRGB(NODE_GREY_FAR, NODE_GREY_NEAR, tone);
      const boost = isAccent ? ACCENT_RADIUS_BOOST : 1;
      ctx.beginPath();
      for (const d of dots) {
        const r = d.r * boost * s;
        ctx.moveTo(d.x * s + r, d.y * s);
        ctx.arc(d.x * s, d.y * s, r, 0, TAU);
      }
      ctx.fill();
    }
  }
};

export type DrawOptions = {
  ctx: CanvasRenderingContext2D;
  state: RenderState;
  field: PlexusNode[];
  t: number;
  width: number;
  height: number;
  accentEnabled: boolean;
};

export const drawPlexus = ({
  ctx,
  state,
  field,
  t,
  width,
  height,
  accentEnabled,
}: DrawOptions) => {
  const s = scaleOf(width);
  buildFrame(state, field, t);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  const actx = state.a.getContext("2d") as CanvasRenderingContext2D;
  const bctx = state.b.getContext("2d") as CanvasRenderingContext2D;
  const { margin } = state;

  // Buckets are composited far -> near, so nearer material lands on top.
  for (let bucket = 0; bucket < DEPTH_BUCKETS; bucket++) {
    const blur = BUCKET_BLUR[bucket] * s;

    if (blur <= 0) {
      // The sharp slab goes straight onto the frame at full resolution.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      paintBucket(ctx, state, bucket, s, accentEnabled);
      continue;
    }

    // Blurred buckets are drawn small, blurred at that small size (a quarter of
    // the pixels, and the softness hides the resolution), then scaled up. The
    // scratch is oversized by `margin` so the blur has real content to pull
    // from at the frame edges instead of fading into transparency.
    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.globalAlpha = 1;
    actx.filter = "none";
    actx.clearRect(0, 0, state.a.width, state.a.height);
    actx.setTransform(
      SCRATCH_SCALE,
      0,
      0,
      SCRATCH_SCALE,
      margin * SCRATCH_SCALE,
      margin * SCRATCH_SCALE,
    );
    paintBucket(actx, state, bucket, s, accentEnabled);

    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalAlpha = 1;
    bctx.filter = "none";
    bctx.clearRect(0, 0, state.b.width, state.b.height);
    bctx.filter = `blur(${(blur * SCRATCH_SCALE).toFixed(3)}px)`;
    bctx.drawImage(state.a, 0, 0);
    bctx.filter = "none";

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(
      state.b,
      -margin,
      -margin,
      width + margin * 2,
      height + margin * 2,
    );
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = "none";
};
