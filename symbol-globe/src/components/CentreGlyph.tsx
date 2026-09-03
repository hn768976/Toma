/**
 * The large mark held in front of the globe.
 *
 * It is built as a variable-width silhouette and then *stroked*, never filled,
 * so what you see is the contour of the letterform and the globe keeps turning
 * visibly through its middle. Four additive passes — a wide atmospheric haze, a
 * tighter glow, a bright mid channel, and a thin near-white core — make it the
 * brightest thing in frame by a clear margin.
 *
 * It does not rotate. It holds dead centre and pulses; the globe turns behind
 * it.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { outlineGlyph, type GlyphKind } from "../lib/glyphPaths";
import { neonPasses, neonStroke } from "../lib/neonStroke";
import { useStageLayer } from "../stage/CanvasStage";
import { CENTRE_GLYPH_HEIGHT_RATIO, DESIGN_HEIGHT } from "../config";
import type { Palette, PulseMode } from "../variants";

/** Frames per breath in "breathe" mode. Divides the 450-frame loop exactly. */
const BREATHE_PERIOD = 150;
/** Frames per alarm cycle in "alarm" mode. Also divides 450 exactly. */
const ALARM_PERIOD = 90;

/** A raised-cosine bump: 1 at `centre`, 0 at `centre +/- halfWidth`. */
const bump = (t: number, centre: number, halfWidth: number): number => {
  const d = Math.abs(t - centre);
  if (d >= halfWidth) return 0;
  return 0.5 * (1 + Math.cos((Math.PI * d) / halfWidth));
};

/**
 * Glow intensity over time, as a multiplier around 1.
 *
 * "breathe" is a single slow sine at +/-10%: a held, open question.
 * "alarm" is two quick strikes and then a pause inside a much shorter cycle.
 * That rhythm, more than the colour, is what makes the second version read as a
 * warning rather than a query.
 */
const pulseAt = (mode: PulseMode, frame: number): number => {
  if (mode === "breathe") {
    return 1 + 0.1 * Math.sin((Math.PI * 2 * frame) / BREATHE_PERIOD);
  }
  const t = (frame % ALARM_PERIOD) / ALARM_PERIOD;
  return 1 + 0.34 * (bump(t, 0.1, 0.1) + bump(t, 0.3, 0.1));
};

export type CentreGlyphProps = {
  palette: Palette;
  kind: GlyphKind;
  pulse: PulseMode;
  z: number;
};

export const CentreGlyph: React.FC<CentreGlyphProps> = ({
  palette,
  kind,
  pulse,
  z,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const scale = height / DESIGN_HEIGHT;

  const glyph = useMemo(() => outlineGlyph(kind), [kind]);

  const passes = useMemo(
    () => neonPasses(palette.glyphMid, palette.glyphCore, 4 * scale),
    [palette.glyphMid, palette.glyphCore, scale],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    const targetHeight = height * CENTRE_GLYPH_HEIGHT_RATIO;
    const designHeight = glyph.bounds.maxY - glyph.bounds.minY;
    const s = targetHeight / designHeight;
    const intensity = pulseAt(pulse, frame);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(s, s);
    ctx.translate(
      -(glyph.bounds.minX + glyph.bounds.maxX) / 2,
      -(glyph.bounds.minY + glyph.bounds.maxY) / 2,
    );
    // Pass widths and blurs are expressed in frame pixels, so undo the glyph's
    // own scale before handing them to the stroker.
    ctx.lineWidth = 1;
    neonStroke(
      ctx,
      glyph.paths,
      passes.map((p) => ({ ...p, width: p.width / s, blur: p.blur })),
      { intensity, bloomScale: 0.85 + 0.15 * intensity },
    );
    ctx.restore();
  };

  useStageLayer({ id: "centre-glyph", z, draw });
  return null;
};
