import { mul, normalize, srgb } from "./math";
import type { PostSettings } from "../gl/renderer";

export type Variant = "v1" | "v2";

export type Palette = {
  uniforms: Record<string, number[]>;
  post: PostSettings;
};

const lightDir = normalize([0.42, 0.78, -0.46]);

/**
 * Version 1 - matches the reference: pale peach skin, aqua water spheres,
 * bright airy studio backdrop.
 */
const v1: Palette = {
  uniforms: {
    uLightDir: lightDir,
    uLightCol: mul(srgb(255, 244, 236), 0.78),
    uSkyCol: mul(srgb(255, 236, 228), 0.50),
    uBounceCol: mul(srgb(250, 214, 200), 0.34),
    uSkinDry: srgb(214, 200, 195),
    uSkinWet: srgb(236, 204, 190),
    uCrackCol: srgb(212, 182, 166),
    uSssCol: srgb(255, 120, 90),
    uBgTop: srgb(251, 238, 231),
    uBgHorizon: srgb(247, 226, 217),
    uBgLow: srgb(246, 226, 216),
    uStripCol: srgb(255, 250, 246),
    uDropTint: srgb(104, 214, 226),
    uDropBody: srgb(150, 228, 234),
    uFilmCol: [0.86, 0.9, 0.91],
    uDropCore: srgb(246, 254, 255),
    uFrontCol: mul(srgb(246, 254, 255), 0.1),
    uDropRim: srgb(104, 172, 184),
    uDropShadow: srgb(176, 200, 232),
    uCellCol: srgb(222, 182, 172),
    uCellDeep: srgb(150, 110, 102),
  },
  post: {
    dofMaxRadius: 26,
    bloom: 0.55,
    bloomThreshold: 0.86,
    bloomTint: [1, 1, 1],
    exposure: 1.0,
    vignette: 0.1,
    grain: 0.006,
  },
};

/**
 * Version 2 - alternative colour palette: deep, rich skin tone hydrated by
 * golden amber oil droplets in a warm cocoa studio. Camera, timing and
 * animation are identical to Version 1.
 */
const v2: Palette = {
  uniforms: {
    uLightDir: lightDir,
    uLightCol: mul(srgb(255, 232, 204), 0.95),
    uSkyCol: mul(srgb(255, 214, 176), 0.42),
    uBounceCol: mul(srgb(214, 140, 96), 0.30),
    uSkinDry: srgb(126, 92, 80),
    uSkinWet: srgb(146, 92, 62),
    uCrackCol: srgb(66, 36, 28),
    uSssCol: srgb(255, 96, 40),
    uBgTop: srgb(86, 58, 46),
    uBgHorizon: srgb(196, 150, 112),
    uBgLow: srgb(104, 70, 54),
    uStripCol: srgb(255, 226, 180),
    uDropTint: srgb(246, 176, 62),
    uDropBody: srgb(255, 206, 110),
    uFilmCol: [0.9, 0.8, 0.62],
    uDropCore: srgb(255, 244, 206),
    uFrontCol: mul(srgb(255, 170, 96), 0.035),
    uDropRim: srgb(206, 124, 40),
    uDropShadow: srgb(214, 150, 96),
    uCellCol: srgb(206, 132, 104),
    uCellDeep: srgb(140, 78, 60),
  },
  post: {
    dofMaxRadius: 26,
    bloom: 0.6,
    bloomThreshold: 0.8,
    bloomTint: [1.0, 0.9, 0.72],
    exposure: 1.0,
    vignette: 0.22,
    grain: 0.006,
  },
};

export const PALETTES: Record<Variant, Palette> = { v1, v2 };
