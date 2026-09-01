import React, { useLayoutEffect, useMemo, useRef } from "react";
import { ambientDrift } from "./ambient";
import { applyBloom, createBloomBuffers } from "./bloom";
import {
  buildBokehSprite,
  discBreath,
  discPosition,
  generateBokeh,
  type BokehSprite,
} from "./bokeh";
import { scaleFor } from "./config";
import type { Theme } from "./theme";
import { useLoopFrame } from "./useLoopFrame";

type Props = {
  width: number;
  height: number;
  theme: Theme;
};

/**
 * The out-of-focus disc field. Every disc is baked to a sprite once — the
 * rim gradient, the blur and the glow halo are all in the sprite — so a
 * frame costs 90 drawImage calls and nothing else.
 */
export const BokehField: React.FC<Props> = ({ width, height, theme }) => {
  const frame = useLoopFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scale = scaleFor(width);
  const discs = useMemo(
    () => generateBokeh(width, height, scale),
    [width, height, scale],
  );
  const sprites = useMemo(
    () => discs.map((disc) => buildBokehSprite(disc, theme)),
    [discs, theme],
  );
  const bloom = useMemo(
    () => createBloomBuffers(width, height),
    [width, height],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const drift = ambientDrift(frame, scale);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(drift.x, drift.y);

    discs.forEach((disc, index) => {
      const sprite = sprites[index] as BokehSprite | null;
      if (!sprite) return;

      const { x, y } = discPosition(disc, frame);
      ctx.globalCompositeOperation = disc.additive ? "lighter" : "source-over";
      // Breathing rides on alpha rather than on a redrawn gradient, which
      // keeps the sprite valid for the whole loop.
      ctx.globalAlpha = Math.min(1, discBreath(disc, frame));
      ctx.drawImage(sprite.canvas, x - sprite.half, y - sprite.half);
    });

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (bloom) applyBloom(ctx, canvas, bloom);
  }, [frame, discs, sprites, bloom, width, height, scale]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};
