import React from "react";
import { useCurrentFrame } from "remotion";
import type { Rect } from "../layout";
import { steppedSpring } from "../lib/anim";
import { alpha } from "../lib/color";
import { arc, line, ring, text } from "../lib/draw";
import type { Variant } from "../variants";
import { Layer } from "./Layer";

const TAU = Math.PI * 2;

/** Paired corner indicators: two circles with numeric values. */
export const CornerPods: React.FC<{
  rect: Rect;
  seed: string;
  labels: [string, string];
  variant: Variant;
  align: "left" | "right";
}> = ({ rect, seed, labels, variant, align }) => {
  const frame = useCurrentFrame();
  const p = variant.palette;
  const scale = variant.panels.textScale;
  const r = 48;

  return (
    <Layer
      x={rect.x}
      y={rect.y}
      w={rect.w}
      h={rect.h}
      bloom={{ radius: 10, alpha: 0.34 }}
      draw={(ctx) => {
        const cy = 66;
        [0, 1].forEach((i) => {
          const cx =
            align === "left" ? r + 8 + i * (r * 2 + 76) : rect.w - r - 8 - i * (r * 2 + 76);
          const v = steppedSpring(frame, `${seed}-pod-${i}`, 78, 0, 100, i * 26);
          ring(ctx, cx, cy, r, alpha(p.panelBorder, 0.9), 3);
          arc(ctx, cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (v / 100) * TAU, p.accent, 5, 0.95, "round");
          ring(ctx, cx, cy, r * 0.62, alpha(p.element, 0.6), 2);
          text(ctx, v.toFixed(0).padStart(2, "0"), cx, cy, {
            size: 40 * scale,
            color: p.textBright,
            weight: 700,
            align: "center",
            tabular: true,
          });
          text(ctx, labels[i], cx, cy + r + 22 * scale, {
            size: 22 * scale,
            color: p.textPale,
            weight: 600,
            align: "center",
            tracking: 2,
          });
        });
        const y = cy;
        const lastCx =
          align === "left" ? r + 8 + (r * 2 + 76) : rect.w - r - 8 - (r * 2 + 76);
        if (align === "left") {
          line(ctx, lastCx + r + 16, y, rect.w, y, alpha(p.panelBorder, 0.55), 2);
        } else {
          line(ctx, 0, y, lastCx - r - 16, y, alpha(p.panelBorder, 0.55), 2);
        }
      }}
    />
  );
};
