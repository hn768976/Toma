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
    uSkinDry: srgb(228, 208, 202),
    uSkinWet: srgb(236, 196, 178),
    uCrackCol: srgb(208, 156, 128),
    uSssCol: srgb(255, 120, 90),
    uBgTop: srgb(250, 236, 228),
    uBgHorizon: srgb(253, 242, 236),
    uBgLow: srgb(246, 226, 216),
    uStripCol: srgb(255, 250, 246),
    uDropTint: srgb(128, 214, 240),
    uDropBody: srgb(176, 232, 246),
    uDropCore: srgb(246, 254, 255),
    uDropRim: srgb(150, 196, 214),
    uDropShadow: srgb(176, 200, 232),
    uCellCol: srgb(238, 196, 186),
    uCellDeep: srgb(176, 124, 112),
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
    uDropCore: srgb(255, 244, 206),
    uDropRim: srgb(206, 124, 40),
    uDropShadow: srgb(214, 150, 96),
    uCellCol: srgb(206, 132, 104),
    uCellDeep: srgb(96, 50, 40),
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
