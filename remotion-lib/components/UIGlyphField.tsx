/**
 * <UIGlyphField> — scattered interface marks.
 *
 * Small generic HUD furniture: bordered squares containing simple line
 * icons, groups of horizontal bars, triangles, bracket pairs and dot
 * rows. They sit at low opacity around the edges of a frame and give a
 * technical, instrumented reading to whatever the subject is, without
 * ever resolving into a real interface. The icons are deliberately
 * generic line drawings — no product iconography.
 *
 * Placement is rejection-sampled toward the frame edges and away from an
 * exclusion disc, so the subject keeps a clear surround.
 *
 * Two things move: a seeded flicker (a handful per second brighten for a
 * few frames) and the bar groups, whose lengths breathe on slow cycles.
 * Both are periodic in `duration`, and the flicker windows wrap across
 * the loop boundary, so nothing pops at frame 0.
 *
 * @example
 * const glyphs = useMemo(() => buildGlyphs({
 *   width: 3840, height: 2160, count: 40, seed: "hud",
 *   exclusion: { x: 2554, y: 918, radius: 780 },
 * }), []);
 * <UIGlyphField glyphs={glyphs} width={3840} height={2160}
 *   frame={frame} duration={600} color="#2E9F8A" flickerColor="#7FD4C4" />
 */
import React from "react";
import { inLoopWindow, loopSine } from "./loopMath";
import { makeRng, range, rangeInt } from "./rng";
import { DrawCanvas } from "./DrawCanvas";

export type GlyphKind = "boxIcon" | "barGroup" | "triangle" | "brackets" | "dotRow";
export type IconKind = "magnifier" | "document" | "home" | "chevron" | "crosshair";

export type Bar = { base: number; amp: number; period: number; phase: number };

export type Glyph = {
  kind: GlyphKind;
  icon: IconKind;
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
  bars: Bar[];
  dots: number;
};

export type FlickerEvent = { glyph: number; start: number };

export type GlyphField = { glyphs: Glyph[]; flickers: FlickerEvent[] };

export type BuildGlyphsOptions = {
  width: number;
  height: number;
  count: number;
  seed: string;
  minSize?: number;
  maxSize?: number;
  minOpacity?: number;
  maxOpacity?: number;
  /** Keep glyphs out of this disc — the subject's immediate surround. */
  exclusion?: { x: number; y: number; radius: number };
  /** Total frames in the loop; flicker windows are scheduled within it. */
  duration: number;
  /** Flickers per second. */
  flickerRate?: number;
  fps?: number;
  /** Legal bar animation periods; each must divide `duration`. */
  barPeriods?: number[];
};

const KINDS: GlyphKind[] = ["boxIcon", "boxIcon", "barGroup", "barGroup", "triangle", "brackets", "dotRow"];
const ICONS: IconKind[] = ["magnifier", "document", "home", "chevron", "crosshair"];

export const buildGlyphs = (opts: BuildGlyphsOptions): GlyphField => {
  const {
    width,
    height,
    count,
    seed,
    minSize = 30,
    maxSize = 72,
    minOpacity = 0.2,
    maxOpacity = 0.6,
    exclusion,
    duration,
    flickerRate = 2.5,
    fps = 30,
    barPeriods = [100, 120, 150, 200, 300],
  } = opts;

  const rng = makeRng(seed + ":glyphs");
  const glyphs: Glyph[] = [];
  let attempts = 0;

  while (glyphs.length < count && attempts < count * 500) {
    attempts++;
    const x = rng() * width;
    const y = rng() * height;
    if (exclusion) {
      const d = Math.hypot(x - exclusion.x, y - exclusion.y);
      if (d < exclusion.radius) continue;
    }
    // Prefer the frame edges, and the left side generally.
    const edge = Math.min(x, y, width - x, height - y);
    const edgeWeight = Math.exp(-edge / (height * 0.17));
    const leftWeight = x < width * 0.42 ? 0.7 : 0.06;
    if (rng() > Math.min(1, Math.max(edgeWeight, leftWeight))) continue;

    const kind = KINDS[Math.floor(rng() * KINDS.length)];
    const bars: Bar[] = [];
    if (kind === "barGroup") {
      const n = rangeInt(rng, 3, 5);
      for (let b = 0; b < n; b++) {
        bars.push({
          base: range(rng, 0.35, 1),
          amp: range(rng, 0.1, 0.4),
          period: barPeriods[Math.floor(rng() * barPeriods.length)],
          phase: rng(),
        });
      }
    }
    glyphs.push({
      kind,
      icon: ICONS[Math.floor(rng() * ICONS.length)],
      x,
      y,
      size: range(rng, minSize, maxSize),
      opacity: range(rng, minOpacity, maxOpacity),
      rotation: rng() < 0.16 ? range(rng, -0.25, 0.25) : 0,
      bars,
      dots: rangeInt(rng, 3, 7),
    });
  }

  const flickerRng = makeRng(seed + ":flicker");
  const flickerCount = Math.max(1, Math.round((flickerRate * duration) / fps));
  const flickers: FlickerEvent[] = [];
  for (let i = 0; i < flickerCount; i++) {
    flickers.push({
      glyph: Math.floor(flickerRng() * Math.max(1, glyphs.length)),
      start: Math.floor(flickerRng() * duration),
    });
  }

  return { glyphs, flickers };
};

// ------------------------------------------------------------------ icons

const drawIcon = (ctx: CanvasRenderingContext2D, icon: IconKind, s: number): void => {
  ctx.beginPath();
  switch (icon) {
    case "magnifier":
      ctx.arc(s * 0.43, s * 0.43, s * 0.23, 0, Math.PI * 2);
      ctx.moveTo(s * 0.6, s * 0.6);
      ctx.lineTo(s * 0.8, s * 0.8);
      break;
    case "document":
      ctx.moveTo(s * 0.28, s * 0.16);
      ctx.lineTo(s * 0.62, s * 0.16);
      ctx.lineTo(s * 0.74, s * 0.3);
      ctx.lineTo(s * 0.74, s * 0.84);
      ctx.lineTo(s * 0.28, s * 0.84);
      ctx.closePath();
      ctx.moveTo(s * 0.4, s * 0.5);
      ctx.lineTo(s * 0.62, s * 0.5);
      ctx.moveTo(s * 0.4, s * 0.64);
      ctx.lineTo(s * 0.62, s * 0.64);
      break;
    case "home":
      ctx.moveTo(s * 0.18, s * 0.5);
      ctx.lineTo(s * 0.5, s * 0.18);
      ctx.lineTo(s * 0.82, s * 0.5);
      ctx.moveTo(s * 0.3, s * 0.46);
      ctx.lineTo(s * 0.3, s * 0.82);
      ctx.lineTo(s * 0.7, s * 0.82);
      ctx.lineTo(s * 0.7, s * 0.46);
      break;
    case "chevron":
      ctx.moveTo(s * 0.36, s * 0.22);
      ctx.lineTo(s * 0.66, s * 0.5);
      ctx.lineTo(s * 0.36, s * 0.78);
      break;
    case "crosshair":
      ctx.arc(s * 0.5, s * 0.5, s * 0.24, 0, Math.PI * 2);
      ctx.moveTo(s * 0.5, s * 0.12);
      ctx.lineTo(s * 0.5, s * 0.3);
      ctx.moveTo(s * 0.5, s * 0.7);
      ctx.lineTo(s * 0.5, s * 0.88);
      ctx.moveTo(s * 0.12, s * 0.5);
      ctx.lineTo(s * 0.3, s * 0.5);
      ctx.moveTo(s * 0.7, s * 0.5);
      ctx.lineTo(s * 0.88, s * 0.5);
      break;
  }
  ctx.stroke();
};

const drawGlyph = (
  ctx: CanvasRenderingContext2D,
  g: Glyph,
  frame: number,
  lineWidth: number,
): void => {
  const s = g.size;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";

  switch (g.kind) {
    case "boxIcon": {
      ctx.strokeRect(0, 0, s, s);
      ctx.save();
      ctx.translate(s * 0.2, s * 0.2);
      drawIcon(ctx, g.icon, s * 0.6);
      ctx.restore();
      break;
    }
    case "barGroup": {
      const gap = s / Math.max(1, g.bars.length);
      const h = Math.max(1.5, gap * 0.36);
      for (let i = 0; i < g.bars.length; i++) {
        const b = g.bars[i];
        const len = s * 1.5 * Math.max(0.12, b.base + b.amp * loopSine(frame, b.period, b.phase));
        ctx.fillRect(0, i * gap, len, h);
      }
      break;
    }
    case "triangle": {
      ctx.beginPath();
      ctx.moveTo(s * 0.5, 0);
      ctx.lineTo(s, s * 0.86);
      ctx.lineTo(0, s * 0.86);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "brackets": {
      const arm = s * 0.3;
      const w = s * 1.25;
      ctx.beginPath();
      ctx.moveTo(arm, 0);
      ctx.lineTo(0, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(arm, s);
      ctx.moveTo(w - arm, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, s);
      ctx.lineTo(w - arm, s);
      ctx.stroke();
      break;
    }
    case "dotRow": {
      const r = Math.max(1.2, s * 0.075);
      const step = s * 0.26;
      for (let i = 0; i < g.dots; i++) {
        ctx.beginPath();
        ctx.arc(i * step, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
};

export type DrawGlyphsOptions = {
  frame: number;
  duration: number;
  color: string;
  flickerColor: string;
  /** Frames a flicker lasts. */
  flickerFrames?: number;
  scale?: number;
  /** Translation applied before drawing — use for a parallax camera drift. */
  offsetX?: number;
  offsetY?: number;
  /** Draw only the glyphs currently flickering — a bloom source pass. */
  flickeringOnly?: boolean;
};

const rgbaFrom = (hex: string, alpha: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha.toFixed(3)})`;
};

export const drawGlyphs = (
  ctx: CanvasRenderingContext2D,
  field: GlyphField,
  opts: DrawGlyphsOptions,
): void => {
  const { frame, duration, flickerFrames = 3 } = opts;
  const scale = opts.scale ?? 1;

  const lit = new Set<number>();
  for (let i = 0; i < field.flickers.length; i++) {
    const f = field.flickers[i];
    if (inLoopWindow(frame, f.start, flickerFrames, duration)) lit.add(f.glyph);
  }

  ctx.save();
  if (scale !== 1) ctx.scale(scale, scale);
  if (opts.offsetX || opts.offsetY) ctx.translate(opts.offsetX ?? 0, opts.offsetY ?? 0);

  for (let i = 0; i < field.glyphs.length; i++) {
    const g = field.glyphs[i];
    const flickering = lit.has(i);
    if (opts.flickeringOnly && !flickering) continue;
    const alpha = flickering ? Math.min(1, g.opacity * 2.4 + 0.25) : g.opacity;
    const style = rgbaFrom(flickering ? opts.flickerColor : opts.color, alpha);
    ctx.save();
    ctx.translate(g.x, g.y);
    if (g.rotation !== 0) ctx.rotate(g.rotation);
    ctx.strokeStyle = style;
    ctx.fillStyle = style;
    drawGlyph(ctx, g, frame, Math.max(1.4, g.size * 0.045));
    ctx.restore();
  }
  ctx.restore();
};

export const UIGlyphField: React.FC<
  DrawGlyphsOptions & {
    glyphs: GlyphField;
    width: number;
    height: number;
    style?: React.CSSProperties;
  }
> = ({ glyphs, width, height, style, ...drawOpts }) => (
  <DrawCanvas
    width={width}
    height={height}
    style={style}
    draw={(ctx) => drawGlyphs(ctx, glyphs, drawOpts)}
  />
);
