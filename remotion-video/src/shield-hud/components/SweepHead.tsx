import { useLayoutEffect, useMemo } from "react";
import { onPlane, rgba, useScene } from "../scene";
import { pointAt, toPath2D } from "../paths";

/** Length of the hot leading segment, as a fraction of the outline. */
const HEAD_FRACTION = 0.007;

/**
 * The bright head of the sweep: a short hot segment of outline plus a soft
 * blob of light sitting on it. Drawn after the glyph so it lands on top of
 * the trail it leaves behind.
 */
export const SweepHead: React.FC = () => {
  const { buffers, palette, layout, drift, frame, sweep, geometry, breath } = useScene();

  const outlinePaths = useMemo(() => geometry.outline.map(toPath2D), [geometry]);

  useLayoutEffect(() => {
    const { head, flicker } = sweep.sample(frame);
    const at = pointAt(geometry.nominal, true, head);
    const segment = geometry.outlineLength * HEAD_FRACTION;

    onPlane(buffers.glyph, drift, (ctx) => {
      ctx.translate(layout.glyphCentre.x, layout.glyphCentre.y);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([segment, geometry.outlineLength + segment]);

      // Two strokes over the segment just behind the head: a pale halo and a
      // white core. On a fractured outline this simply draws nothing while
      // the head is sitting in a gap.
      const strokes = [
        { colour: palette.glyphPale, width: 12, alpha: 0.6 * flicker, blur: 26 },
        { colour: palette.glyphWhite, width: 4, alpha: 1 * flicker, blur: 0 },
      ];
      for (const stroke of strokes) {
        ctx.strokeStyle = stroke.colour;
        ctx.lineWidth = stroke.width;
        ctx.globalAlpha = stroke.alpha * breath;
        ctx.shadowBlur = stroke.blur;
        ctx.shadowColor = stroke.blur > 0 ? stroke.colour : "transparent";
        for (let i = 0; i < geometry.outline.length; i++) {
          const sub = geometry.outline[i];
          for (const shift of [0, -geometry.outlineLength, geometry.outlineLength]) {
            const from = head - segment + shift;
            if (from + segment <= sub.start || from >= sub.start + sub.length) continue;
            ctx.lineDashOffset = -(from - sub.start);
            ctx.stroke(outlinePaths[i]);
          }
        }
      }
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.shadowBlur = 0;

      // The blob of light riding on the head itself.
      const radius = 78;
      const glow = ctx.createRadialGradient(at.point.x, at.point.y, 0, at.point.x, at.point.y, radius);
      // Tight in the middle so the head reads as a single point of light
      // rather than a soft patch.
      glow.addColorStop(0, rgba(palette.glyphWhite, 1 * flicker));
      glow.addColorStop(0.12, rgba(palette.glyphWhite, 0.72 * flicker));
      glow.addColorStop(0.32, rgba(palette.glyphPale, 0.34 * flicker));
      glow.addColorStop(1, rgba(palette.glyphMid, 0));
      ctx.globalAlpha = breath;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(at.point.x, at.point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  return null;
};
