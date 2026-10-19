import React, { useCallback, useMemo } from "react";
import { P5Brush, type P5Draw } from "../paint/P5Brush";
import { blob } from "../paint/layers";
import { hashString, mulberry32 } from "../lib/random";
import type { BloomColourway } from "../palettes";
import { bloomState, makeBlooms } from "./WatercolourBloom";

/**
 * Benchmark only: clip 1 painted LIVE with p5.brush on every frame instead
 * of animating pre-painted layers. Same bloom layout and life cycle; the
 * whole canvas is cleared and repainted from scratch each frame.
 */
export const LiveBrushBloom: React.FC<{ colourway: BloomColourway; seedId: string; width: number; height: number }> = ({
  colourway,
  seedId,
  width,
  height,
}) => {
  const blooms = useMemo(() => makeBlooms(seedId, 3840, 2160), [seedId]);
  const draw = useCallback<P5Draw>(
    (p, brush, frame) => {
      const k = width / 3840;
      p.background(colourway.paper);
      blooms.forEach((b, i) => {
        const t = (frame + b.phase) % b.cycle;
        const rep = Math.floor((frame + b.phase) / b.cycle) % (600 / b.cycle);
        const st = bloomState(t / b.cycle);
        if (st.alpha < 0.01) return;
        const rng = mulberry32(hashString(`${seedId}:${i}:${rep}`));
        const r = b.r * Math.min(1, st.g) * k;
        brush.noStroke();
        brush.fill(colourway.pigments[(i + rep) % 4], 150 * st.alpha);
        brush.fillBleed(0.15 + 0.2 * st.wet, "out");
        brush.fillTexture(0.55, 0.8);
        brush.polygon(blob(rng, (b.x + Math.sin(rep * 2.1 + i) * 160) * k, (b.y + Math.cos(rep * 1.7 + i) * 110) * k, r, 0.16, 48));
      });
    },
    [blooms, colourway, seedId, width],
  );
  return <P5Brush width={width} height={height} seed={hashString(seedId)} draw={draw} />;
};
