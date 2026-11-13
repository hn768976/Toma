import { mul, normalize, srgb } from "./math";
import type { PostSettings } from "../gl/renderer";

export type Palette = {
  uniforms: Record<string, number[]>;
  post: PostSettings;
};

/**
 * Both versions share the reference palette: salmon-pink dry skin with red
 * grooves, a cream-white serum drop, white-lavender light in the cracks and a
 * soft taupe studio backdrop. (Version 2 differs by camera, not by colour.)
 */
export const PALETTE: Palette = {
  uniforms: {
    uLightDir: normalize([-0.34, 0.8, -0.5]),
    uLightCol: mul(srgb(255, 240, 232), 0.82),
    uSkyCol: mul(srgb(255, 238, 232), 0.46),
    uBounceCol: mul(srgb(238, 212, 204), 0.30),
    uSkinDry: srgb(204, 172, 162),
    uSkinWet: srgb(232, 204, 188),
    uCrackCol: srgb(206, 138, 126),
    uSssCol: srgb(255, 104, 84),
    uBgLeft: srgb(206, 178, 164),
    uBgRight: srgb(176, 146, 134),
    uStripCol: srgb(255, 244, 236),
    uDropCol: srgb(252, 248, 244),
    uDropSss: srgb(248, 216, 206),
    uGlowCol: mul(srgb(236, 242, 255), 4.6),
    uHazeCol: srgb(254, 238, 226),
    uBgCenter: srgb(238, 214, 203),
  },
  post: {
    dofMaxRadius: 24,
    bloom: 0.95,
    bloomThreshold: 0.9,
    bloomTint: [0.9, 0.95, 1.0],
    exposure: 1.0,
    vignette: 0.12,
    grain: 0.008,
  },
};
