import React, { useLayoutEffect, useRef } from "react";
import { useJetSprite } from "./JetShape";
import { VARIANTS, type VariantName } from "./variants";
import { JET_GEOMETRY } from "./jet-geometry";

/**
 * Development-only: the aircraft sprite alone, unblurred and untilted.
 *
 * The only sane way to judge the airframe's silhouette and whether its four
 * tonal steps still read as a solid object — on the HUD it is moving, banked,
 * scaled and sitting over a busy interface.
 */
export const JetSpriteQA: React.FC<{ variant: VariantName }> = ({
  variant,
}) => {
  const v = VARIANTS[variant];
  const sprite = useJetSprite(v);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = v.palette.bgWash;
    ctx.fillRect(0, 0, JET_GEOMETRY.spriteW, JET_GEOMETRY.spriteH);
    ctx.drawImage(sprite.canvas, 0, 0);
  });
  return (
    <canvas
      ref={ref}
      width={JET_GEOMETRY.spriteW}
      height={JET_GEOMETRY.spriteH}
      style={{ width: "100%", height: "100%" }}
    />
  );
};
