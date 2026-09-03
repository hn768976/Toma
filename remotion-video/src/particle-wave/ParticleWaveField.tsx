import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { BACKGROUND_TOP, COLS, NOISE_SEED, ROWS } from "./constants";
import { drawWaveFrame } from "./draw";
import { buildLayout } from "./field";
import { createNoise4D } from "./noise";
import { PALETTES } from "./palette";

export const particleWaveFieldSchema = z.object({
  // Which of the three colourways to render. Choreography is identical
  // across all three; only the hue ramp changes.
  paletteId: z.enum(["magentaCyan", "blueWhite", "amberMagenta"]),
  // Grid density. Horizontal density is what makes the crests read, so
  // if a machine can't keep up, drop rows before columns.
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
  seed: z.number().int(),
});

export type ParticleWaveFieldProps = z.infer<typeof particleWaveFieldSchema>;

export const particleWaveFieldDefaults: ParticleWaveFieldProps = {
  paletteId: "magentaCyan",
  cols: COLS,
  rows: ROWS,
  seed: NOISE_SEED,
};

// A dot-matrix surface undulating across the lower half of frame, lit by
// a horizontal hue ramp that stays pinned to the frame while the wave
// rolls through it.
//
// This is a 2D canvas with a baked projection rather than a 3D scene:
// the camera never moves, so depth can be folded into the grid itself
// (row index -> vertical spacing, dot size, brightness and how far the
// row is displaced). Everything is drawn additively onto one canvas,
// which is the only way ~29,000 dots per frame stay affordable at 4K.
export const ParticleWaveField: React.FC<ParticleWaveFieldProps> = ({
  paletteId,
  cols,
  rows,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const palette = PALETTES[paletteId];
  const layout = useMemo(
    () => buildLayout(width, height, cols, rows, seed),
    [width, height, cols, rows, seed],
  );
  const noise = useMemo(() => createNoise4D(seed), [seed]);

  // Layout effect, not effect: the frame has to be fully painted before
  // Remotion captures it.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawWaveFrame({
      ctx,
      width,
      height,
      frame,
      durationInFrames,
      layout,
      palette,
      noise,
    });
  }, [frame, width, height, durationInFrames, layout, palette, noise]);

  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND_TOP }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </AbsoluteFill>
  );
};
