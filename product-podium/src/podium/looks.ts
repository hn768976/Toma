/**
 * The set, as data.
 *
 * Four looks, each shipping two variants, from one rig. A new look is a new
 * `params` shape plus a scene component; a new variant of an existing look
 * is a row in this file and nothing else — which is why look 3's two plinth
 * geometries cost a data row rather than a second lighting setup.
 */
import { seedFromString } from "./random";
import type { FoliageConfig, StageConfig } from "./types";

/** Every stage is framed with the same lens. */
const LENS = 23; // ≈ 50mm on 16:9 full frame — a real product lens, no wide-angle bow

/**
 * The foliage canopy shared by looks 3 and 4. It is a real occluder in the
 * light path, not a layer painted over the wall: a plane carrying a
 * procedurally generated leaf alpha, hung between the key and the stage and
 * out of the camera frustum. Everything the brief asks of a gobo falls out
 * of that — the pattern crosses wall and floor and bends at the seam
 * because it is one projection through one occluder, it wraps the plinth
 * because the plinth is in the same light, and it softens with distance
 * because the shadow is PCSS.
 */
const canopy = (seed: string, o: Partial<FoliageConfig> = {}): FoliageConfig => ({
  seed: seedFromString(seed),
  branches: 70,
  leavesPerBranch: 5,
  // Leaf size on the occluder, in world units. What lands on the wall is
  // this times the light-to-receiver over light-to-occluder ratio, so
  // moving the canopy changes the pattern scale as well as its softness.
  leafSize: 0.42,
  branchSize: 0.62,
  blur: 0.055,
  density: 0.88,
  clumping: 0.5,
  planeSize: 21,
  position: [-4.6, 9.5, 2.2],
  rotation: [-Math.PI / 2, 0, 0.35],
  swayAmplitude: 0.022,
  swayCycles: 1,
  driftAmplitude: 0.09,
  driftCycles: 2,
  lightPosition: [-7, 17, 9],
  lightAim: [0, 1.6, -2.2],
  lightIntensity: 420,
  lightColor: "#fff6ec",
  lightAngle: 0.72,
  softness: 0.02,
  ...o,
});

/**
 * Look 4's canopy. Hung much lower than look 3's and lit by a smaller
 * source, which is the whole difference between look 3's very soft
 * out-of-focus foliage and look 4's defined leaf edges.
 */
const WOOD_CANOPY = (lightColor: string): FoliageConfig =>
  canopy("wood-leaf", {
    branches: 60,
    leavesPerBranch: 7,
    leafSize: 0.38,
    branchSize: 0.5,
    blur: 0.012,
    density: 0.92,
    clumping: 0.9,
    planeSize: 18,
    position: [-5.2, 4.6, 2.2],
    rotation: [-Math.PI / 2, 0, 0.5],
    lightPosition: [-6, 14, 7],
    lightAim: [0, 0.9, -1.6],
    lightIntensity: 900,
    lightColor,
    lightAngle: 0.62,
    softness: 0.008,
    swayAmplitude: 0.02,
    swayCycles: 1,
    driftAmplitude: 0.05,
    driftCycles: 2,
  });

export const STAGES: StageConfig[] = [
  /* ---------------------------------------------------------------- */
  /* Look 1 — Duotone Glass                                            */
  /* ---------------------------------------------------------------- */
  {
    id: "DuotoneGlass-PodiumMagentaCyan",
    outName: "DuotoneGlass_PodiumMagentaCyan",
    look: "duotone-glass",
    lookLabel: "Duotone Glass",
    variant: "A",
    variantLabel: "Magenta / cyan",
    stillFrame: 42,
    camera: { fovDeg: LENS, height: 1.14, distance: 6.0, tiltDeg: 7.0, push: 0 },
    tone: { mapping: "neutral", exposure: 1.05 },
    dof: {
      layers: [
        { blur: 0.007, top: 0.0, bottom: 0.4 },
        { blur: 0.004, top: 0.35, bottom: 0.62 },
      ],
      sharp: { cx: 0.5, cy: 0.56, rx: 0.3, ry: 0.22, feather: 0.55 },
    },
    grade: { grain: 0.015, vignette: 0.34 },
    clear: "#000000",
    params: {
      kind: "duotone-glass",
      keyLeft: "#ff2fb4",
      keyRight: "#17c8ff",
      backdropTop: "#0e0d16",
      backdropBase: "#2b2939",
      floorColor: "#2a2833",
      floorRoughness: 0.26,
      disc: { radius: 1.0, height: 0.52, bevel: 0.05 },
      glass: {
        transmission: 0.9,
        roughness: 0.45,
        thickness: 1.05,
        ior: 1.48,
        attenuationColor: "#dfe6ff",
        attenuationDistance: 2.4,
      },
      pool: 0.62,
    },
  },
  {
    id: "DuotoneGlass-PodiumAmberTeal",
    outName: "DuotoneGlass_PodiumAmberTeal",
    look: "duotone-glass",
    lookLabel: "Duotone Glass",
    variant: "B",
    variantLabel: "Amber / teal",
    stillFrame: 42,
    camera: { fovDeg: LENS, height: 1.14, distance: 6.0, tiltDeg: 7.0, push: 0 },
    tone: { mapping: "neutral", exposure: 1.05 },
    dof: {
      layers: [
        { blur: 0.007, top: 0.0, bottom: 0.4 },
        { blur: 0.004, top: 0.35, bottom: 0.62 },
      ],
      sharp: { cx: 0.5, cy: 0.56, rx: 0.3, ry: 0.22, feather: 0.55 },
    },
    grade: { grain: 0.015, vignette: 0.34 },
    clear: "#000000",
    params: {
      kind: "duotone-glass",
      keyLeft: "#ffa321",
      keyRight: "#12d6c0",
      backdropTop: "#0d0f0e",
      backdropBase: "#233330",
      floorColor: "#2b2a26",
      floorRoughness: 0.26,
      disc: { radius: 1.0, height: 0.52, bevel: 0.05 },
      glass: {
        transmission: 0.9,
        roughness: 0.45,
        thickness: 1.05,
        ior: 1.48,
        attenuationColor: "#ffeedd",
        attenuationDistance: 2.4,
      },
      pool: 0.62,
    },
  },

  /* ---------------------------------------------------------------- */
  /* Look 2 — Neon Double Ring                                         */
  /* ---------------------------------------------------------------- */
  {
    id: "NeonRing-PodiumBlue",
    outName: "NeonRing_PodiumBlue",
    look: "neon-ring",
    lookLabel: "Neon Double Ring",
    variant: "A",
    variantLabel: "Electric blue",
    stillFrame: 96,
    camera: { fovDeg: LENS, height: 0.76, distance: 5.4, tiltDeg: 7.0, push: 0 },
    tone: { mapping: "none", exposure: 1.0 },
    // No DOF: the field is empty, so there is nothing behind the disc to
    // soften and a blur pass would only risk lifting the black.
    dof: null,
    grade: { grain: 0.015, vignette: 0.3 },
    clear: "#000000",
    params: {
      kind: "neon-ring",
      ring: "#0a6bff",
      ringCore: "#cfe6ff",
      // Thin and wide, as the reference slab is: a thick disc reads as a
      // drum rather than a plate.
      disc: { radius: 1.0, height: 0.13, bevel: 0.016 },
      float: 0.1,
      travelCyclesTop: 1,
      travelCyclesBottom: 2,
      pulseCycles: 2,
    },
  },
  {
    id: "NeonRing-PodiumMagenta",
    outName: "NeonRing_PodiumMagenta",
    look: "neon-ring",
    lookLabel: "Neon Double Ring",
    variant: "B",
    variantLabel: "Magenta",
    stillFrame: 96,
    camera: { fovDeg: LENS, height: 0.76, distance: 5.4, tiltDeg: 7.0, push: 0 },
    tone: { mapping: "none", exposure: 1.0 },
    dof: null,
    grade: { grain: 0.015, vignette: 0.3 },
    clear: "#000000",
    params: {
      kind: "neon-ring",
      ring: "#ff1e9c",
      ringCore: "#ffd4ee",
      // Thin and wide, as the reference slab is: a thick disc reads as a
      // drum rather than a plate.
      disc: { radius: 1.0, height: 0.13, bevel: 0.016 },
      float: 0.1,
      travelCyclesTop: 1,
      travelCyclesBottom: 2,
      pulseCycles: 2,
    },
  },

  /* ---------------------------------------------------------------- */
  /* Look 3 — Fluted Plaster                                           */
  /* ---------------------------------------------------------------- */
  {
    id: "FlutedPlaster-PodiumCylinder",
    outName: "FlutedPlaster_PodiumCylinder",
    look: "fluted-plaster",
    lookLabel: "Fluted Plaster",
    variant: "A",
    variantLabel: "Single fluted cylinder",
    stillFrame: 150,
    camera: { fovDeg: LENS, height: 2.279, distance: 8.88, tiltDeg: 7.0, push: 0 },
    tone: { mapping: "neutral", exposure: 0.74 },
    // Noticeably shallow — the soft wall against the sharp plinth is a large
    // part of this look.
    dof: {
      layers: [
        { blur: 0.011, top: 0.0, bottom: 0.44 },
        { blur: 0.005, top: 0.38, bottom: 0.68 },
      ],
      sharp: { cx: 0.5, cy: 0.63, rx: 0.3, ry: 0.32, feather: 0.3 },
    },
    grade: { grain: 0.015, vignette: 0 },
    clear: "#e9e7e4",
    params: {
      kind: "fluted-plaster",
      plinth: "cylinder",
      wall: "#eceae7",
      plaster: "#f2f0ed",
      wallDistance: 3.4,
      foliage: canopy("fluted-plaster"),
    },
  },
  {
    id: "FlutedPlaster-PodiumColumnPair",
    outName: "FlutedPlaster_PodiumColumnPair",
    look: "fluted-plaster",
    lookLabel: "Fluted Plaster",
    variant: "B",
    variantLabel: "Classical column pair",
    stillFrame: 150,
    camera: { fovDeg: LENS, height: 2.279, distance: 8.88, tiltDeg: 7.0, push: 0 },
    tone: { mapping: "neutral", exposure: 0.74 },
    dof: {
      layers: [
        { blur: 0.013, top: 0.0, bottom: 0.46 },
        { blur: 0.006, top: 0.4, bottom: 0.72 },
      ],
      sharp: { cx: 0.5, cy: 0.64, rx: 0.36, ry: 0.32, feather: 0.3 },
    },
    grade: { grain: 0.015, vignette: 0 },
    clear: "#e9e7e4",
    params: {
      kind: "fluted-plaster",
      plinth: "columns",
      wall: "#eceae7",
      plaster: "#f2f0ed",
      wallDistance: 3.4,
      foliage: canopy("fluted-plaster"),
    },
  },

  /* ---------------------------------------------------------------- */
  /* Look 4 — Wood and Leaf                                            */
  /* ---------------------------------------------------------------- */
  {
    id: "WoodLeaf-PodiumCool",
    outName: "WoodLeaf_PodiumCool",
    look: "wood-leaf",
    lookLabel: "Wood and Leaf",
    variant: "A",
    variantLabel: "Cool blue-white, light oak",
    stillFrame: 210,
    camera: { fovDeg: LENS, height: 1.224, distance: 8.83, tiltDeg: 7.0, push: 0 },
    tone: { mapping: "neutral", exposure: 0.56 },
    dof: {
      layers: [
        { blur: 0.006, top: 0.0, bottom: 0.34 },
        { blur: 0.0035, top: 0.3, bottom: 0.52 },
      ],
      sharp: { cx: 0.5, cy: 0.52, rx: 0.26, ry: 0.16, feather: 0.5 },
    },
    grade: { grain: 0.015, vignette: 0 },
    clear: "#d7dde6",
    params: {
      kind: "wood-leaf",
      wall: "#dde4ee",
      floor: "#d5dce7",
      wallDistance: 3.2,
      wood: {
        light: "#cba87c",
        dark: "#8a6743",
        rings: 7,
        turbulence: 0.42,
      },
      disc: { radius: 1.15, height: 0.32, bevel: 0.03 },
      foliage: WOOD_CANOPY("#fdfbff"),
    },
  },
  {
    id: "WoodLeaf-PodiumWarmWalnut",
    outName: "WoodLeaf_PodiumWarmWalnut",
    look: "wood-leaf",
    lookLabel: "Wood and Leaf",
    variant: "B",
    variantLabel: "Warm sand, dark walnut",
    stillFrame: 210,
    camera: { fovDeg: LENS, height: 1.224, distance: 8.83, tiltDeg: 7.0, push: 0 },
    tone: { mapping: "neutral", exposure: 0.56 },
    dof: {
      layers: [
        { blur: 0.006, top: 0.0, bottom: 0.34 },
        { blur: 0.0035, top: 0.3, bottom: 0.52 },
      ],
      sharp: { cx: 0.5, cy: 0.52, rx: 0.26, ry: 0.16, feather: 0.5 },
    },
    grade: { grain: 0.015, vignette: 0 },
    clear: "#e6dccd",
    params: {
      kind: "wood-leaf",
      wall: "#ece1d0",
      floor: "#e5d9c6",
      wallDistance: 3.2,
      wood: {
        light: "#6b4630",
        dark: "#33201a",
        rings: 8,
        turbulence: 0.5,
      },
      disc: { radius: 1.15, height: 0.32, bevel: 0.03 },
      foliage: WOOD_CANOPY("#fff4e2"),
    },
  },
];

export const stageById = (id: string) => {
  const s = STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`No stage configured with id "${id}"`);
  return s;
};
