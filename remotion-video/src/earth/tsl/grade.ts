import { length, screenUV, smoothstep, vec2, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { hash31 } from "./common";

export type GradeOptions = {
  width: number;
  height: number;
  /** 0 leaves the frame flat, 1 is a heavy falloff. */
  vignette: number;
  /** Advances the grain pattern so it never freezes across the shot. */
  grainSeed: Node;
};

/**
 * Final grade.
 *
 * A soft vignette and a whisper of grain — both are what separates a clean
 * render from something that reads as photographed footage, and the grain
 * doubles as dither, which the huge smooth gradient from the limb into the
 * black would otherwise band across.
 */
export const applyGrade = (color: Node, options: GradeOptions): Node => {
  const centred = screenUV.sub(vec2(0.5, 0.5)).mul(vec2(1, 0.86));
  const falloff = smoothstep(0.9, 0.28, length(centred))
    .mul(options.vignette)
    .add(1 - options.vignette);

  const grain = hash31(
    vec3(screenUV.x.mul(options.width), screenUV.y.mul(options.height), options.grainSeed),
  )
    .sub(0.5)
    .mul(0.0045);

  return color.mul(falloff).add(grain);
};
