import { useLayoutEffect, useMemo } from "react";
import { onPlane, useScene } from "../scene";
import { toPath2D, type GlyphGeometry, type SubPath } from "../paths";
import { TRAIL_FRACTION } from "../sweep";
import type { GlyphIntegrity, Palette } from "../variants";

type Pass = {
  width: number;
  hue: keyof Pick<Palette, "glyphMid" | "glyphPale" | "glyphWhite">;
  /** Alpha at the head of the trail. */
  peak: number;
  /** Alpha everywhere else — the dim ember on the far side. */
  ember: number;
  shadowBlur: number;
  /** How finely the trail decay is stepped for this pass. */
  bands: number;
};

/**
 * Four passes, composited additively. The thin near-white core inside the
 * wide soft glow is the whole effect — a single thick semi-transparent
 * stroke does not read the same way at any width.
 */
const PASSES: Pass[] = [
  { width: 104, hue: "glyphMid", peak: 0.1, ember: 0.045, shadowBlur: 80, bands: 4 },
  { width: 44, hue: "glyphMid", peak: 0.28, ember: 0.05, shadowBlur: 36, bands: 6 },
  { width: 16, hue: "glyphMid", peak: 1, ember: 0.13, shadowBlur: 12, bands: 14 },
  { width: 5, hue: "glyphWhite", peak: 1, ember: 0.05, shadowBlur: 0, bands: 14 },
];

/** Detail strokes — frays and the crack — sit at 60% of the outline's level. */
const DETAIL_BRIGHTNESS = 0.6;

/**
 * Strokes the slice of the outline covering [start, start + length) in the
 * glyph's own arc length, using a dash pattern long enough that only one
 * band can ever be on.
 */
const strokeBand = (
  ctx: CanvasRenderingContext2D,
  subs: SubPath[],
  paths: Path2D[],
  start: number,
  length: number,
  outlineLength: number,
) => {
  const wrapped = ((start % outlineLength) + outlineLength) % outlineLength;
  ctx.setLineDash([length, outlineLength + length]);
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    // The band can straddle the seam where the outline closes, so each
    // sub-path is tested against the band shifted a full circuit either way.
    for (const shift of [0, -outlineLength, outlineLength]) {
      const from = wrapped + shift;
      if (from + length <= sub.start || from >= sub.start + sub.length) continue;
      ctx.lineDashOffset = -(from - sub.start);
      ctx.stroke(paths[i]);
    }
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
};

/**
 * The centre glyph: an outline, drawn as an outline only, with no fill and
 * no interior detail. Brightness runs uneven along the path — full where the
 * sweep head has just been, decaying to an ember over 40% of the outline.
 *
 * `integrity` selects how the same path is treated: "solid" strokes one
 * continuous closed run, "fractured" strokes the broken runs and adds the
 * frayed ends and interior crack that come with them.
 */
export const CentreGlyph: React.FC<{ path: GlyphGeometry; integrity: GlyphIntegrity }> = ({
  path,
  integrity,
}) => {
  const { buffers, palette, layout, drift, frame, sweep, breath } = useScene();

  const outlinePaths = useMemo(() => path.outline.map(toPath2D), [path]);
  const detailPaths = useMemo(() => path.detail.map(toPath2D), [path]);

  useLayoutEffect(() => {
    const { head } = sweep.sample(frame);

    onPlane(buffers.glyph, drift, (ctx) => {
      ctx.translate(layout.glyphCentre.x, layout.glyphCentre.y);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const pass of PASSES) {
        const colour = palette[pass.hue];
        ctx.strokeStyle = colour;
        ctx.lineWidth = pass.width;
        ctx.shadowBlur = pass.shadowBlur;
        ctx.shadowColor = pass.shadowBlur > 0 ? colour : "transparent";

        // The ember: the whole outline, dim, so the far side never vanishes.
        ctx.globalAlpha = pass.ember * breath;
        outlinePaths.forEach((p) => ctx.stroke(p));

        // The trail: a run of bands behind the head, each dimmer than the
        // last, fading out over 40% of the outline.
        if (pass.bands > 0) {
          const bandLength = (TRAIL_FRACTION * path.outlineLength) / pass.bands;
          for (let k = 0; k < pass.bands; k++) {
            const decay = Math.pow(1 - k / pass.bands, 1.7);
            ctx.globalAlpha = pass.peak * decay * breath;
            strokeBand(
              ctx,
              path.outline,
              outlinePaths,
              head - (k + 1) * bandLength,
              bandLength,
              path.outlineLength,
            );
          }
        }
      }

      // The crack and the frays get the same four passes at 60% brightness.
      // No sweep runs along them — they simply glow.
      if (integrity === "fractured") {
        for (const pass of PASSES) {
          const colour = palette[pass.hue];
          ctx.strokeStyle = colour;
          ctx.lineWidth = pass.width * 0.62;
          ctx.shadowBlur = pass.shadowBlur * 0.7;
          ctx.shadowColor = pass.shadowBlur > 0 ? colour : "transparent";
          ctx.globalAlpha = pass.peak * DETAIL_BRIGHTNESS * breath;
          detailPaths.forEach((p) => ctx.stroke(p));
        }
      }

      ctx.shadowBlur = 0;
    });
  });

  return null;
};
