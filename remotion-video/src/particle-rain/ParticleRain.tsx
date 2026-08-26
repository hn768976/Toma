import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import { BLOOM_DOWNSCALE, HEIGHT, WIDTH } from "./constants";
import { buildField } from "./field";
import { drawFrame } from "./draw";
import { buildSprites } from "./sprites";
import { THEMES, THEME_NAMES } from "./themes";

export const particleRainSchema = z.object({
  variant: z.enum(THEME_NAMES),
});

export type ParticleRainProps = z.infer<typeof particleRainSchema>;

export const particleRainDefaults: ParticleRainProps = {
  variant: "cyan",
};

const createCanvas = (width: number, height: number) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

/**
 * Vertical streams of glowing dots falling through dark space, drawn to a
 * single 3840x2160 canvas.
 *
 * Two rules hold the whole thing together:
 *
 * - The field (streams, dots, flare schedule) is generated once, seeded, and
 *   reused for every frame. Regenerating per frame would make the dots
 *   re-roll their identity each frame and the field would boil.
 * - Every frame is a pure function of `useCurrentFrame()`. No rAF, no CSS
 *   animation, no state, no clock. Remotion renders frames out of order
 *   across workers, so anything else would desynchronise them.
 */
export const ParticleRain: React.FC<ParticleRainProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const theme = THEMES[variant];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Independent of `variant`: dots hold a tone *index*, resolved to a colour
  // at draw time, so recolouring never rebuilds the field.
  const field = useMemo(() => buildField(), []);
  const sprites = useMemo(() => buildSprites(theme), [theme]);

  const bloom = useMemo(
    () => createCanvas(WIDTH / BLOOM_DOWNSCALE, HEIGHT / BLOOM_DOWNSCALE),
    [],
  );
  const bloomBlur = useMemo(
    () => createCanvas(WIDTH / BLOOM_DOWNSCALE, HEIGHT / BLOOM_DOWNSCALE),
    [],
  );

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    const bloomCtx = bloom?.getContext("2d");
    const bloomBlurCtx = bloomBlur?.getContext("2d");
    if (!ctx || !bloomCtx || !bloomBlurCtx || !sprites) return;

    drawFrame({ ctx, bloomCtx, bloomBlurCtx }, frame, field, sprites, theme);
  }, [frame, field, sprites, theme, bloom, bloomBlur]);

  return (
    <AbsoluteFill>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
