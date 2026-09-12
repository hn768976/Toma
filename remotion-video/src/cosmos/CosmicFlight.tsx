import React, { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

import {
  BASE_WIDTH,
  CLUSTER_STAR_COUNT,
  HERO_STAR_COUNT,
  PALETTES,
  STAR_COUNT,
  WARM_CLUSTER_COUNT,
} from "./constants";
import { drawFrame } from "./draw";
import { getScene } from "./scene";
import { getTextures } from "./textures";

export const cosmicFlightSchema = z.object({
  /**
   * "celestial" is the blue-teal reference look; "violet" swaps the
   * cloud palette to violet/magenta while keeping the warm accent knots.
   */
  variant: z.enum(["celestial", "violet"]),
  /** Re-roll the star field and cloud placement. */
  seed: z.number().int().min(0),
  /** Multiplier on the star population. 1 = as designed. */
  starDensity: z.number().min(0.2).max(2.5),
});

export type CosmicFlightProps = z.infer<typeof cosmicFlightSchema>;

export const cosmicFlightDefaults: CosmicFlightProps = {
  variant: "celestial",
  seed: 20260912,
  starDensity: 1,
};

export const CosmicFlight: React.FC<CosmicFlightProps> = ({
  variant,
  seed,
  starDensity,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Baking the nebula textures on the first frame is a multi-second
  // synchronous job. Holding a delayRender handle across it keeps
  // Remotion from screenshotting an empty canvas.
  const [handle] = useState(() => delayRender("Baking celestial textures"));
  const released = useRef(false);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const palette = PALETTES[variant];
    const resolutionScale = width / BASE_WIDTH;

    const textures = getTextures(variant, palette, resolutionScale);
    const scene = getScene(
      seed,
      Math.round(STAR_COUNT * starDensity),
      Math.round(CLUSTER_STAR_COUNT * starDensity),
      HERO_STAR_COUNT,
      WARM_CLUSTER_COUNT,
      palette.starTints.length,
    );

    drawFrame({
      ctx,
      width,
      height,
      frame,
      durationInFrames,
      palette,
      textures,
      scene,
      resolutionScale,
    });

    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [
    frame,
    width,
    height,
    durationInFrames,
    variant,
    seed,
    starDensity,
    handle,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
