import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { H4K, W4K } from "../engine/dof";
import { smoothstep } from "../engine/math";
import { AURORA, ORIGINAL } from "./palettes";
import { DURATION_FRAMES, FPS, createAssets, renderScene } from "./scene";

export type ParticleCollisionProps = {
  /** "original" = reference look (V1); "aurora" = alternative palette (V2) */
  palette: "original" | "aurora";
  /** Internal canvas resolution relative to the 4K composition (1 = native 3840x2160). */
  renderScale: number;
};

// The reference loops: the last second dissolves back into the opening shot.
const LOOP_A = 770;
const LOOP_B = 793;

export const ParticleCollision: React.FC<ParticleCollisionProps> = ({ palette, renderScale }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const q = renderScale;
  const assets = useMemo(() => createAssets(palette === "aurora" ? AURORA : ORIGINAL, q), [palette, q]);
  const aux = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = Math.round(W4K * q);
    c.height = Math.round(H4K * q);
    return c;
  }, [q]);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    renderScene(ctx, assets, frame / FPS, frame);
    const w = smoothstep(LOOP_A, LOOP_B, frame);
    if (w > 0) {
      const actx = aux.getContext("2d")!;
      renderScene(actx, assets, (frame - DURATION_FRAMES) / FPS, frame);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = w;
      ctx.drawImage(aux, 0, 0);
      ctx.restore();
    }
  }, [frame, assets, aux]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={ref}
        width={Math.round(W4K * q)}
        height={Math.round(H4K * q)}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
