/**
 * Small marks scattered across the frame at varied depths.
 *
 * Each glyph is stroked once into a small offscreen canvas, keyed by kind,
 * colour and blur, and thereafter blitted. Re-stroking 45 glowing paths per
 * frame — each with its own shadowBlur — would be the most expensive thing in
 * the piece for no visible gain, since only position, scale and brightness
 * change frame to frame.
 *
 * Depth drives size, blur and opacity together: nearer marks are larger, softer
 * and stronger. The component is rendered twice, once for the far half and once
 * for the near half, so the globe can sit between them.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { glyphFieldScale, monoGlyph, type GlyphKind } from "../lib/glyphPaths";
import { closedDrift, rand, randRange, randWeighted } from "../lib/seededRandom";
import { scratchCanvas } from "../lib/scratchCanvas";
import { useStageLayer } from "../stage/CanvasStage";
import {
  DESIGN_HEIGHT,
  FIELD_EXCLUSION_RATIO,
  FIELD_GLYPH_COUNT,
  FIELD_SIZE_MAX,
  FIELD_SIZE_MIN,
  GLOBE_DIAMETER_RATIO,
} from "../config";
import type { FieldEntry, Palette } from "../variants";

/** Side of the offscreen tile each glyph is rasterised into, before blur padding. */
const TILE = 192;
/** Defocus is quantised to this many levels so the sprite cache stays small. */
const BLUR_LEVELS = 4;
/** Strongest defocus, in tile pixels, applied to the nearest marks. */
const MAX_DEFOCUS_PX = 7;

type FieldGlyph = {
  seed: string;
  kind: GlyphKind;
  /** 0 = furthest, 1 = nearest. */
  depth: number;
  /** Normalised frame position, before drift. */
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
  driftX: number;
  driftY: number;
  /** Whole cycles of brightness pulse across the loop. */
  pulseCycles: number;
  pulsePhase: number;
};

/**
 * Rasterises one glyph, glow and all, into a cached tile. The tile is padded so
 * neither the glow nor the defocus blur is clipped at its edges.
 *
 * Note that shadowBlur is a device-space quantity: it is not scaled by the
 * canvas transform, so it is set in tile pixels even though the glyph itself is
 * drawn in design units.
 */
const spriteFor = (
  kind: GlyphKind,
  color: string,
  defocusPx: number,
): HTMLCanvasElement => {
  const pad = Math.ceil(defocusPx * 3) + 26;
  const side = TILE + pad * 2;
  const key = `glyph:${kind}:${color}:${defocusPx}`;
  const canvas = scratchCanvas(key, side, side);
  if (canvas.dataset.drawn === "1") return canvas;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const glyph = monoGlyph(kind);
  const w = glyph.bounds.maxX - glyph.bounds.minX;
  const h = glyph.bounds.maxY - glyph.bounds.minY;
  const fit = TILE / Math.max(w, h);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, side, side);
  ctx.save();
  ctx.translate(side / 2, side / 2);
  ctx.scale(fit, fit);
  ctx.translate(
    -(glyph.bounds.minX + glyph.bounds.maxX) / 2,
    -(glyph.bounds.minY + glyph.bounds.maxY) / 2,
  );

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = glyph.monoWidth;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  // A single soft halo behind the stroke, then the stroke itself. At these
  // sizes the full four-pass neon build would be detail nobody can see.
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  for (const path of glyph.paths) ctx.stroke(path);
  for (const path of glyph.discPaths) ctx.fill(path);
  ctx.shadowBlur = 0;
  for (const path of glyph.paths) ctx.stroke(path);
  for (const path of glyph.discPaths) ctx.fill(path);
  ctx.restore();

  // Depth-of-field: bake the defocus in here rather than filtering per
  // instance, which would cost a full-canvas filter pass 45 times a frame.
  if (defocusPx > 0) {
    const copy = scratchCanvas(`${key}:copy`, side, side);
    const copyCtx = copy.getContext("2d");
    if (copyCtx) {
      copyCtx.setTransform(1, 0, 0, 1, 0, 0);
      copyCtx.globalCompositeOperation = "copy";
      copyCtx.filter = "none";
      copyCtx.drawImage(canvas, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "copy";
      ctx.filter = `blur(${defocusPx}px)`;
      ctx.drawImage(copy, 0, 0);
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
    }
  }

  canvas.dataset.drawn = "1";
  return canvas;
};

/**
 * Places the field once, deterministically. Positions are rejection-sampled
 * against a disc around the globe so the centre of frame stays clear; the retry
 * index is folded into the seed, which keeps it reproducible.
 */
const buildField = (
  count: number,
  fieldSet: FieldEntry[],
  exclusionRadius: number,
  aspect: number,
): FieldGlyph[] => {
  const glyphs: FieldGlyph[] = [];
  for (let i = 0; i < count; i++) {
    const seed = `glyph-${i}`;
    let x = 0.5;
    let y = 0.5;
    for (let attempt = 0; attempt < 40; attempt++) {
      x = randRange(`${seed}-x-${attempt}`, 0.03, 0.97);
      y = randRange(`${seed}-y-${attempt}`, 0.04, 0.96);
      // Measured in frame-height units so the exclusion zone is a circle on
      // screen rather than an ellipse.
      const dx = (x - 0.5) * aspect;
      const dy = y - 0.5;
      if (Math.hypot(dx, dy) > exclusionRadius) break;
    }
    const depth = rand(`${seed}-depth`);
    glyphs.push({
      seed,
      kind: randWeighted(`${seed}-kind`, fieldSet).kind,
      depth,
      x,
      y,
      size:
        FIELD_SIZE_MIN + (FIELD_SIZE_MAX - FIELD_SIZE_MIN) * Math.pow(depth, 1.4),
      opacity: 0.25 + 0.55 * depth,
      rotation: randRange(`${seed}-rot`, -0.13, 0.13),
      driftX: randRange(`${seed}-dx`, 0.008, 0.03),
      driftY: randRange(`${seed}-dy`, 0.008, 0.03),
      // Whole numbers of cycles per loop, so every pulse closes at frame 450.
      pulseCycles: 2 + Math.floor(rand(`${seed}-pc`) * 5),
      pulsePhase: rand(`${seed}-pp`) * Math.PI * 2,
    });
  }
  return glyphs;
};

export type GlyphFieldProps = {
  palette: Palette;
  fieldSet: FieldEntry[];
  /** Which depth slice to draw, as [min, max). */
  depthRange: [number, number];
  id: string;
  /**
   * Frames in one full loop. Passed explicitly rather than read from the
   * composition so the same component can be rendered past the end of its loop
   * (frame 450 of a 450-frame cycle) to prove the loop actually closes.
   */
  loopLength: number;
  z: number;
};

export const GlyphField: React.FC<GlyphFieldProps> = ({
  palette,
  fieldSet,
  depthRange,
  id,
  loopLength,
  z,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const scale = height / DESIGN_HEIGHT;
  const aspect = width / height;

  const exclusionRadius = (GLOBE_DIAMETER_RATIO / 2) * FIELD_EXCLUSION_RATIO;

  const glyphs = useMemo(
    () => buildField(FIELD_GLYPH_COUNT, fieldSet, exclusionRadius, aspect),
    [fieldSet, exclusionRadius, aspect],
  );

  const slice = useMemo(
    () =>
      glyphs.filter(
        (g) => g.depth >= depthRange[0] && g.depth < depthRange[1],
      ),
    [glyphs, depthRange],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    const t = frame / loopLength;
    ctx.globalCompositeOperation = "lighter";
    for (const glyph of slice) {
      const offset = closedDrift(
        `${glyph.seed}-drift`,
        t,
        glyph.driftX * width,
        glyph.driftY * height,
        3,
      );
      // A minority of the field takes the pale tint, which keeps the layer from
      // reading as one flat colour.
      const color =
        rand(`${glyph.seed}-tint`) < 0.22 ? palette.fieldPale : palette.fieldMain;
      // Quantised so the sprite cache stays a handful of tiles rather than one
      // per glyph.
      const defocus =
        Math.round(glyph.depth * (BLUR_LEVELS - 1)) *
        (MAX_DEFOCUS_PX / (BLUR_LEVELS - 1));
      const sprite = spriteFor(glyph.kind, color, defocus);

      const pulse =
        0.82 +
        0.18 *
          Math.sin(Math.PI * 2 * glyph.pulseCycles * t + glyph.pulsePhase);
      const size = glyph.size * scale * glyphFieldScale(glyph.kind);
      // The sprite's tile is TILE units across for a glyph of that size, plus
      // padding; scale the whole tile so the glyph itself lands at `size`.
      const drawSide = (sprite.width / TILE) * size;

      ctx.save();
      ctx.globalAlpha = Math.min(1, glyph.opacity * pulse);
      ctx.translate(glyph.x * width + offset.x, glyph.y * height + offset.y);
      ctx.rotate(glyph.rotation);
      ctx.drawImage(sprite, -drawSide / 2, -drawSide / 2, drawSide, drawSide);
      ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
  };

  useStageLayer({ id, z, draw });
  return null;
};
