/**
 * The look list - pure data.
 *
 * These four rows plus their palettes produce all eight compositions. Nothing
 * here imports a component; Root.tsx maps over this array to register the
 * compositions and PodiumStage.tsx switches on `scene`.
 */

import type { LookDefinition } from "./types";

/** Composition spec, shared by all eight. */
export const FPS = 30;
export const DURATION_IN_FRAMES = 300;
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Resolution used by `npx remotion still`. */
export const STILL_WIDTH = 6000;
export const STILL_HEIGHT = 3375;

/**
 * The fixed camera rig, identical for every look.
 *
 * Buyers composite their own product onto the podium top. A camera that
 * orbits, dollies or eases forces them to motion-track, which is the one thing
 * that stops these clips doing their job - so the camera does not move at all,
 * and per-look framing differences are absorbed by `stageOffsetY` instead.
 */
export const CAMERA = {
  /** ~50mm-equivalent on full frame: reads as a product lens, no wide-angle bow. */
  fov: 27,
  position: [0, 1.97, 9.4] as [number, number, number],
  /** Looking very slightly down onto the podium top, ~8 degrees. */
  pitchDegrees: -8,
  /**
   * Where the podium's top surface sits, as a fraction down from the top of
   * frame. 0.55 puts it just below centre: the clear space above it is the
   * part the buyer fills, and a 2-unit product (about one plinth diameter)
   * tops out around 10% without touching the frame edge. Each look's
   * `stageOffsetY` is solved against this so all eight share one camera.
   */
  podiumTopScreenFraction: 0.55,
  near: 0.1,
  far: 120,
};

export const LOOKS: LookDefinition[] = [
  {
    id: "blind-shadow",
    name: "BlindShadow",
    description:
      "Warm plaster wall with a venetian blind gobo drifting across it; matte charcoal disc.",
    scene: "blindShadow",
    plinth: {
      radius: 2.05,
      tierHeight: 0.6,
      tiers: 1,
      tierInset: 0,
      bevel: 0.055,
      radialSegments: 256,
      bevelSegments: 8,
    },
    stageOffsetY: -0.18,
    post: {
      // Photographic look: no bloom at all.
      bloom: null,
      vignette: 0,
      dof: { focusRange: 4.2, bokehScale: 3.6 },
      grain: 0.015,
      dither: 0.6,
      toneMapping: "neutral",
      exposure: 1.0,
      envIntensity: 0.75,
    },
    stillFrame: 96,
    pushIn: 0,
    palettes: [
      {
        suffix: "A",
        name: "Terracotta",
        backdrop: "#b78a7e",
        backdropAlt: "#9a7064",
        plinth: "#46464b",
        ambient: "#9e7a70",
        key: "#ffe6d0",
      },
      {
        suffix: "B",
        name: "Grey-green",
        backdrop: "#93a094",
        backdropAlt: "#74817a",
        plinth: "#e6e2d9",
        ambient: "#75827a",
        key: "#f5f7f0",
      },
    ],
  },
  {
    id: "halo-ring",
    name: "HaloRing",
    description:
      "Glowing neon ring hovering over a dark disc in a fogged void, with a volumetric light cone.",
    scene: "haloRing",
    plinth: {
      radius: 2.2,
      tierHeight: 0.38,
      tiers: 1,
      tierInset: 0,
      bevel: 0.045,
      radialSegments: 256,
      bevelSegments: 8,
    },
    stageOffsetY: 0.04,
    post: {
      bloom: { intensity: 1.35, threshold: 0.62, smoothing: 0.5 },
      vignette: 0.42,
      dof: { focusRange: 3.8, bokehScale: 3.4 },
      grain: 0.015,
      dither: 0.6,
      toneMapping: "aces",
      exposure: 1.05,
      envIntensity: 0.12,
    },
    // The cone is the defining element of this look. If the render cost is
    // unworkable, drop this before touching the ground-fog quality.
    volumetricSteps: 48,
    stillFrame: 38,
    pushIn: 0,
    palettes: [
      {
        suffix: "Cyan",
        name: "Cyan / blue",
        backdrop: "#02061a",
        backdropAlt: "#0a1f52",
        plinth: "#0d1c3b",
        accent: "#63e6ff",
        ambient: "#0d2f6e",
        key: "#8fefff",
        fog: "#1b57c0",
      },
      {
        suffix: "Magenta",
        name: "Magenta / violet",
        backdrop: "#06021a",
        backdropAlt: "#1d0b52",
        plinth: "#1a0f3a",
        accent: "#e968ff",
        ambient: "#2d0f74",
        key: "#f39dff",
        fog: "#5b2fd2",
      },
    ],
  },
  {
    id: "neon-tier",
    name: "NeonTier",
    description:
      "Two-tier black plinth ringed with neon strips on a polished floor, slab wall behind.",
    scene: "neonTier",
    plinth: {
      radius: 2.45,
      tierHeight: 0.3,
      tiers: 2,
      tierInset: 0.19,
      bevel: 0.035,
      radialSegments: 256,
      bevelSegments: 6,
    },
    stageOffsetY: -0.18,
    post: {
      bloom: { intensity: 1.15, threshold: 0.6, smoothing: 0.55 },
      vignette: 0.5,
      dof: { focusRange: 4.0, bokehScale: 3.0 },
      grain: 0.015,
      dither: 0.6,
      toneMapping: "aces",
      exposure: 1.0,
      envIntensity: 0.3,
    },
    stillFrame: 120,
    pushIn: 0,
    palettes: [
      {
        suffix: "Cyan",
        name: "Cyan neon",
        backdrop: "#111316",
        backdropAlt: "#22262b",
        plinth: "#1b1e23",
        accent: "#2bb8ff",
        ambient: "#10243a",
        key: "#cfe8ff",
        fog: "#0a1420",
      },
      {
        suffix: "Amber",
        name: "Amber neon",
        backdrop: "#161210",
        backdropAlt: "#2a231b",
        plinth: "#231d17",
        accent: "#ffa62b",
        ambient: "#3a2410",
        key: "#ffe4c0",
        fog: "#201408",
      },
    ],
  },
  {
    id: "bubble-drift",
    name: "BubbleDrift",
    description:
      "High-key lilac void with translucent spheres drifting down past a white cylinder plinth.",
    scene: "bubbleDrift",
    plinth: {
      radius: 1.95,
      tierHeight: 1.05,
      tiers: 1,
      tierInset: 0,
      bevel: 0.07,
      radialSegments: 256,
      bevelSegments: 10,
    },
    // Taller plinth: drop the stage so its top still lands at ~45% of frame
    // height without moving the camera.
    stageOffsetY: -0.63,
    post: {
      // The only light look in the set. Bloom would flatten it.
      bloom: null,
      vignette: 0,
      dof: { focusRange: 1.9, bokehScale: 6.0 },
      // The soft lilac field is the worst banding case in the set.
      grain: 0.016,
      dither: 0.9,
      toneMapping: "neutral",
      exposure: 1.06,
      envIntensity: 0.9,
    },
    stillFrame: 40,
    pushIn: 0,
    palettes: [
      {
        suffix: "Lilac",
        name: "Lilac",
        backdrop: "#b3a9e2",
        backdropAlt: "#cec7f3",
        plinth: "#f7f5fc",
        ambient: "#9a90cf",
        key: "#ffffff",
        props: "#8f83d4",
      },
      {
        suffix: "Mint",
        name: "Mint",
        backdrop: "#a4d4be",
        backdropAlt: "#c9ebda",
        plinth: "#f8f4e9",
        ambient: "#8ac0a8",
        key: "#ffffff",
        props: "#79c39c",
      },
    ],
  },
];

/**
 * Composition id for a look/palette pair, e.g. "HaloRing-PodiumCyan".
 *
 * Hyphenated because Remotion only accepts a-z, A-Z, 0-9 and "-" in a
 * composition id. The delivered files use the underscored spelling from the
 * brief - see `outputName` - so the render commands in the README pass the
 * hyphenated id and the underscored output path.
 */
export const compositionId = (look: LookDefinition, paletteIndex: number): string =>
  `${look.name}-Podium${look.palettes[paletteIndex].suffix}`;

/** Delivered file stem, e.g. "HaloRing_PodiumCyan". */
export const outputName = (look: LookDefinition, paletteIndex: number): string =>
  `${look.name}_Podium${look.palettes[paletteIndex].suffix}`;

/** Every look/palette pair, flattened - what Root.tsx registers. */
export const ALL_COMPOSITIONS = LOOKS.flatMap((look) =>
  look.palettes.map((palette, index) => ({
    id: compositionId(look, index),
    output: outputName(look, index),
    look,
    palette,
    paletteIndex: index,
  })),
);
