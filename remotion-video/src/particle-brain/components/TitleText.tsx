/**
 * <TitleText> — the "AI" lettering, in the same particle material as the
 * brain. See titleParticles.ts for how the letterforms are sampled.
 */
import React from "react";
import { DrawCanvas } from "../../lib/DrawCanvas";
import { drawParticleField, type FieldParticle } from "../../lib/particleField";
import { DURATION_IN_FRAMES, HEIGHT, WIDTH } from "../config";
import type { Theme } from "../theme";

export const TitleText: React.FC<{
  field: FieldParticle[];
  frame: number;
  theme: Theme;
  cameraX: number;
  cameraY: number;
}> = ({ field, frame, theme, cameraX, cameraY }) => (
  <DrawCanvas
    width={WIDTH}
    height={HEIGHT}
    draw={(ctx) => {
      ctx.translate(cameraX, cameraY);
      drawParticleField(ctx, field, {
        frame,
        duration: DURATION_IN_FRAMES,
        colors: {
          base: theme.textPale,
          bright: theme.particleBright,
          peak: theme.particleWhite,
        },
      });
    }}
  />
);
