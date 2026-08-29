import React, { useMemo, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { getAtlas } from "./sprites";
import { useFinalCanvasPass } from "./useCanvasPass";
import { VARIANTS, type VariantKey } from "./variants";

/**
 * Proofing sheet: every glyph in a variant's notation set, drawn at a size
 * where the science can actually be checked. Not part of the deliverable —
 * it exists so the subscripts, charges, bond angles and balances can be
 * eyeballed without hunting for a glyph in a moving field.
 */
export const NotationSheet: React.FC<{ variant: VariantKey }> = ({ variant: key }) => {
  const variant = VARIANTS[key];
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useMemo(() => ({ w: 3840, h: 2160 }), []);

  useFinalCanvasPass(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = variant.palette.deep;
    ctx.fillRect(0, 0, size.w, size.h);

    const atlas = getAtlas(variant);
    const cols = 4;
    const rows = Math.ceil(atlas.length / cols);
    const cw = size.w / cols;
    const chh = size.h / rows;
    ctx.font = "26px sans-serif";
    ctx.fillStyle = "#888";
    atlas.forEach((sprite, i) => {
      const cx = (i % cols) * cw + cw / 2;
      const cy = Math.floor(i / cols) * chh + chh / 2;
      const s = Math.min((cw - 90) / sprite.w, (chh - 110) / sprite.h);
      ctx.drawImage(
        sprite.tones[2],
        cx - (sprite.w * s) / 2,
        cy - (sprite.h * s) / 2,
        sprite.w * s,
        sprite.h * s,
      );
      ctx.fillStyle = "#7a7a7a";
      ctx.textAlign = "center";
      ctx.fillText(sprite.id, cx, Math.floor(i / cols) * chh + chh - 22);
      ctx.strokeStyle = "#1e1e1e";
      ctx.lineWidth = 1;
      ctx.strokeRect((i % cols) * cw, Math.floor(i / cols) * chh, cw, chh);
    });
  });

  return (
    <AbsoluteFill style={{ backgroundColor: variant.palette.deep }}>
      <canvas ref={ref} width={size.w} height={size.h} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
