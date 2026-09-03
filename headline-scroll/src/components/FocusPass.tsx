/**
 * <FocusPass> — the finishing pass over the assembled frame.
 *
 * Grain then vignette, both from the shared library. No bloom: this is a
 * document surface, not an emissive screen. The vignette LIGHTENS the corners,
 * because on a pale ground a dark vignette reads as dirt rather than falloff.
 */
import type { Ctx } from "../vendor/canvas2d";
import { grainPass } from "../vendor/grain-pass";
import { vignettePass } from "../vendor/vignette-pass";

export interface FocusPassOptions {
  frame: number;
  loopLength: number;
  width: number;
  height: number;
  grainAlpha: number;
  vignetteColor: string;
  vignetteStrength: number;
}

export const FocusPass = (ctx: Ctx, o: FocusPassOptions): void => {
  grainPass(ctx, {
    frame: o.frame,
    loopLength: o.loopLength,
    width: o.width,
    height: o.height,
    alpha: o.grainAlpha,
  });
  vignettePass(ctx, {
    width: o.width,
    height: o.height,
    color: o.vignetteColor,
    strength: o.vignetteStrength,
  });
};
