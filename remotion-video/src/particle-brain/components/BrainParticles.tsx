/**
 * <BrainParticles> — the subject itself.
 *
 * Draws the pre-sampled particle field once per React render. Nothing is
 * resampled here: the field, and therefore the shape, is fixed for the
 * whole composition, and only brightness, a few pixels of orbit and the
 * passing signal pulses change from frame to frame. Resampling per frame
 * is the one mistake that would ruin this — the brain would boil.
 */
import React from "react";
import { DrawCanvas } from "../../lib/DrawCanvas";
import { drawParticleField, type FieldParticle } from "../../lib/particleField";
import type { BrainGeometry } from "../brainShape";
import { makeBrainPulse } from "../brainParticles";
import { DURATION_IN_FRAMES, HEIGHT, WIDTH } from "../config";
import type { Theme } from "../theme";

export const BrainParticles: React.FC<{
  geometry: BrainGeometry;
  field: FieldParticle[];
  frame: number;
  theme: Theme;
  cameraX: number;
  cameraY: number;
}> = ({ geometry, field, frame, theme, cameraX, cameraY }) => (
  <DrawCanvas
    width={WIDTH}
    height={HEIGHT}
    draw={(ctx) => {
      ctx.translate(cameraX, cameraY);
      drawParticleField(ctx, field, {
        frame,
        duration: DURATION_IN_FRAMES,
        colors: {
          base: theme.particleTeal,
          bright: theme.particleBright,
          peak: theme.particleWhite,
        },
        pulseAt: makeBrainPulse(geometry, frame),
      });
    }}
  />
);
