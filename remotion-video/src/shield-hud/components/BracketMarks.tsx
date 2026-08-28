import { useLayoutEffect } from "react";
import { onPlane, rgba, useScene } from "../scene";

/**
 * Short right-angle corner brackets scattered around the glyph, reading as a
 * targeting frame. Mid depth, so they carry a moderate defocus.
 */
export const BracketMarks: React.FC = () => {
  const { buffers, palette, layout, drift } = useScene();

  useLayoutEffect(() => {
    onPlane(buffers.mid, drift, (ctx) => {
      ctx.lineCap = "square";
      for (const bracket of layout.brackets) {
        const arm = bracket.size;
        ctx.strokeStyle = rgba(palette.tickPale, 0.75);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(bracket.x + bracket.flipX * arm, bracket.y);
        ctx.lineTo(bracket.x, bracket.y);
        ctx.lineTo(bracket.x, bracket.y + bracket.flipY * arm);
        ctx.stroke();

        // An inner tick, offset into the corner.
        ctx.strokeStyle = rgba(palette.tickPale, 0.4);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bracket.x + bracket.flipX * arm * 0.5, bracket.y + bracket.flipY * 26);
        ctx.lineTo(bracket.x + bracket.flipX * 26, bracket.y + bracket.flipY * 26);
        ctx.lineTo(bracket.x + bracket.flipX * 26, bracket.y + bracket.flipY * arm * 0.5);
        ctx.stroke();
      }
    });
  });

  return null;
};
