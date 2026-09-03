/**
 * Finishing passes, drawn over the composited frame.
 *
 * Bloom first, so it picks up the centre glyph's hot core and the globe's limb
 * while they are still at full strength; then the vignette, which should darken
 * the bloom too; then grain last, so it sits on top of everything as a single
 * even film rather than being blurred or tinted by the passes above it.
 *
 * This layer opts out of the ambient camera drift: the finish belongs to the
 * lens, not to the scene.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { bloomPass } from "../lib/bloomPass";
import { grainPass } from "../lib/grainPass";
import { vignettePass } from "../lib/vignettePass";
import { useStageLayer } from "../stage/CanvasStage";
import type { Palette } from "../variants";

export type PostFxProps = {
  palette: Palette;
  /**
   * Frames in one full loop. Passed explicitly rather than read from the
   * composition so the same component can be rendered past the end of its loop
   * (frame 450 of a 450-frame cycle) to prove the loop actually closes.
   */
  loopLength: number;
  z: number;
};

export const PostFx: React.FC<PostFxProps> = ({ palette, loopLength, z }) => {
  const frame = useCurrentFrame();

  const draw = (ctx: CanvasRenderingContext2D) => {
    bloomPass(ctx, {
      scale: 0.16,
      blur: 9,
      brightness: 1.15,
      contrast: 3.2,
      alpha: 0.45,
    });
    vignettePass(ctx, { color: palette.backgroundDeep, strength: 0.22 });
    grainPass(ctx, { frame, loopLength, alpha: 0.04 });
  };

  useStageLayer({ id: "post-fx", z, drift: false, draw });
  return null;
};
