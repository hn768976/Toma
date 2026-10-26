import type { ClusterParams, RingSpec } from "./cluster";
import type { SceneSpec } from "./types";

// Both references loop seamlessly: frame 0 ≈ frame 152 ≈ frame 305.
const LOOP = 152.5;

const deg = (d: number) => (d * Math.PI) / 180;

// `n` rings stacked from y=0 (camera end) away from the camera, `step` apart.
const stack = (
  n: number,
  step: number,
  counts: number[],
  shade: (i: number) => number,
): RingSpec[] =>
  Array.from({ length: n }, (_, i) => ({
    y: -i * step,
    count: counts[i % counts.length],
    shade: Math.min(1, Math.max(0, shade(i))),
  }));

const baseCluster: ClusterParams = {
  kind: "arc",
  seed: 7,
  rings: stack(12, 0.6, [5, 6, 7, 5, 6, 7], (i) => (i - 1.4) / 1.8),
  orbit: [1.25, 1.6],
  stemLength: [0, 0],
  coreRadius: 0,
  tubeRadius: [0.23, 0.27],
  curlRadius: [0.42, 0.56],
  sweep: [deg(185), deg(225)],
  planeTilt: [deg(20), deg(55)],
  startAngle: [deg(150), deg(175)],
  phaseStep: 0.5,
  phaseJitter: 0.5,
  startTaper: 0,
  radialSegments: 32,
  tubularSegments: 56,
};

// ---------------------------------------------------------------------------
// Composition 1 — "Ember Bloom": glossy orange-red C-curls on black, viewed
// almost straight down a receding tunnel of curl rings that fade to black.
// ---------------------------------------------------------------------------
// Helical flow shared by the Ember cluster and its motion block.

// A crown of short, thick, glossy orange tubes seen from above: each tube
// leaves the centre and curls back inwards, its flat cut end facing the
// camera. The centre is a recessed well of charcoal tube stems (inner rings
// sunk to the shade colour) rather than a solid hub.
const EMBER_RINGS = [
  { polar: 88, count: 7, shade: 0 },
  { polar: 108, count: 8, shade: 0 },
  // Pointing away from the camera: the recessed dark well at the centre.
  { polar: 145, count: 6, shade: 1 },
  { polar: 162, count: 5, shade: 1 },
];

export const emberV1: SceneSpec = {
  look: {
    background: { top: "#000000", bottom: "#000000" },
    colors: {
      start: "#1a1a1d", // roots sink into the dark well as charcoal stems
      mid: "#ff4800",
      end: "#ff4800",
      cap: "#f04404",
      startCap: "#1a1a1d",
      shade: "#1a1a1d", // charcoal stems of the inner well
      gradient: [0.0, 0.24, 1],
    },
    material: {
      roughness: 0.14,
      metalness: 0.45,
      clearcoat: 0,
      clearcoatRoughness: 0.1,
      iridescence: 0,
      iridescenceIOR: 1.3,
      envIntensity: 0.3,
      specularColor: "#ffd090", // hot yellow-orange streaks
    },
    envRotation: [0, 0, 0],
    envTint: "#ff6a10", // warm studio: orange reflections, no blue
    lights: {
      // Light colours carry no blue, so grazing reflections stay orange.
      ambient: { color: "#ffa000", intensity: 0.15 },
      directional: [
        { color: "#ffb000", intensity: 2.2, direction: [-3, 3, 4] },
        { color: "#ff8000", intensity: 0.4, direction: [4, -1, 2] },
      ],
      // A long thin soft box paints one sharp streak along each tube.
      area: [
        { color: "#ffd8a0", intensity: 24, size: [9, 0.25], position: [-3, 5, 6], lookAt: [0, 0, 0] },
      ],
    },
    exposure: 1,
    knee: 0.85,
    vignette: 0,
    grain: 0.004,
  },
  cluster: {
    ...baseCluster,
    kind: "hook",
    seed: 21,
    coreRadius: 1.55, // hidden; opens the centre into a dark well
    coreVisible: false,
    rings: EMBER_RINGS.map((r) => ({ polar: deg(r.polar), count: r.count, shade: r.shade })),
    tubeRadius: [0.3, 0.32],
    stemLength: [0.15, 0.35],
    curlRadius: [0.6, 0.75],
    sweep: [deg(95), deg(125)],
    planeTilt: [deg(20), deg(42)], // curl sideways and up: a pinwheel crown
    phaseStep: 0.37,
    phaseJitter: 0.3,
    startTaper: 0.12, // roots narrow away inside the well
  },
  motion: {
    center: [0, 0, 0],
    orientation: [deg(78), 0, deg(-12)], // crown axis (+Y) turned towards camera
    loopFrames: LOOP,
    spinDirection: -1, // clockwise on screen
    wobble: [deg(4), deg(4)], // slow sway of the whole crown
    writhe: deg(7), // rings rock independently: the tubes writhe
    spins: 2,
  },
  shot: () => ({
    position: [0, 0, 7.3],
    target: [-1.05, -1.75, 0],
    fov: 35,
    focusDistance: 6.9,
    aperture: 0.22,
    maxBlur: 0.022,
  }),
  quality: { radScale1080: 1 },
};

// ---------------------------------------------------------------------------
// Composition 2 — "Pearl Bloom": pearlescent white hooks with violet tips on
// a lavender-grey studio backdrop, seen in profile along the cluster's limb.
// ---------------------------------------------------------------------------
export const pearlV1: SceneSpec = {
  look: {
    background: { top: "#bdc2d3", bottom: "#bdc2d3" },
    colors: {
      start: "#c8a8b4", // pinkish pearl
      mid: "#c4a8c4",
      end: "#9a4cc0",
      cap: "#9048b4",
      startCap: "#c8a8b4",
      shade: "#ddd3dc",
      gradient: [0.52, 0.62, 0.7],
    },
    material: {
      roughness: 0.3,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      iridescence: 0.7,
      iridescenceIOR: 1.3,
      envIntensity: 0.75,
    },
    envRotation: [0, 0, 0],
    lights: {
      ambient: { color: "#ffffff", intensity: 0.18 },
      directional: [
        { color: "#ffffff", intensity: 1.15, direction: [-2, 3, 4] },
        { color: "#e8e0ff", intensity: 0.6, direction: [3, -2, 1] },
      ],
    },
    exposure: 1,
    knee: 0.8,
    vignette: 0,
    grain: 0.004,
  },
  // A ball of identical hooks (straight pearl shaft, ~115° violet hook)
  // rooted on a core just off the right edge. It rolls about an axis that
  // points up-right and leans toward the camera, so the visible face drifts
  // down-right while the hooks on the left limb read in profile.
  cluster: {
    ...baseCluster,
    kind: "hook",
    seed: 11,
    coreRadius: 0.9,
    rings: Array.from({ length: 6 }, (_, i) => ({
      polar: deg(49 + i * 19),
      count: 20,
      shade: 0,
    })),
    tubeRadius: [0.11, 0.11],
    stemLength: [0.38, 0.38],
    curlRadius: [0.36, 0.36],
    sweep: [deg(110), deg(110)],
    planeTilt: [0, 0], // hooks curl up and out, caps facing left / up-left
    phaseStep: 0.5,
    phaseJitter: 0,
  },
  motion: {
    center: [1.72, -0.28, -2.7],
    orientation: [0.5912, -0.1467, -0.4735], // roll axis up-right in screen, leaning to camera
    loopFrames: LOOP,
    spinDirection: 1,
    wobble: [0, 0], // constant-speed rigid roll, no easing
    // 4 tube spacings per loop (period 38 frames): matches the reference's
    // on-screen speed with these larger hooks.
    spins: 4,
  },
  shot: () => ({
    position: [0, 0, 0.3],
    target: [0.08, 0, -1],
    fov: 38,
    focusDistance: 3.2,
    aperture: 0.07,
    maxBlur: 0.022,
  }),
  quality: { radScale1080: 1 },
};

const DURATION = 305;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Composition 1 — Version 2: same Ember look, new camera MOVEMENT. The
// reference is a receding vortex, so the camera slowly pushes into it while
// arcing around the axis.
// ---------------------------------------------------------------------------
export const emberV2: SceneSpec = {
  ...emberV1,
  shot: (frame) => {
    const t = frame / (DURATION - 1);
    const e = easeInOutSine(t);
    // Starts wide and centred on the whole bloom, pushes in while arcing
    // around the bloom's axis, and ends on a close top-right crop.
    const dist = mix(12.5, 7.3, e);
    const yaw = deg(mix(-18, 14, e));
    const pitch = deg(mix(8, -6, e));
    return {
      position: [
        Math.sin(yaw) * dist,
        Math.sin(pitch) * dist,
        Math.cos(yaw) * Math.cos(pitch) * dist,
      ],
      target: [mix(-0.2, -1.05, e), mix(-0.4, -1.75, e), 0],
      fov: 35,
      // Focus rides on the front tentacles throughout the push-in.
      focusDistance: dist - 0.4,
      aperture: 0.22,
      maxBlur: 0.018,
    };
  },

};

// ---------------------------------------------------------------------------
// Composition 2 — Version 2: same shot and motion, new COLOUR PALETTE. The
// reference is a soft pastel studio piece, so the palette swaps to warm
// cream-pearl tubes with coral tips on a sage-mint backdrop.
// ---------------------------------------------------------------------------
export const pearlV2: SceneSpec = {
  ...pearlV1,
  look: {
    ...pearlV1.look,
    background: { top: "#c3d6cc", bottom: "#c7d9cf" },
    colors: {
      ...pearlV1.look.colors,
      start: "#e2d2bc", // cream pearl
      mid: "#e6d2c0",
      end: "#ff6f4e",
      cap: "#f0613f",
      startCap: "#e2d2bc",
      shade: "#e3e9e4",
    },
    lights: {
      ambient: { color: "#fff6ee", intensity: 0.2 },
      directional: [
        { color: "#fff4e8", intensity: 1.2, direction: [-2, 3, 4] },
        { color: "#e0f0e8", intensity: 0.6, direction: [3, -2, 1] },
      ],
    },
  },
};

export const SCENES = {
  "Ember-V1": emberV1,
  "Ember-V2": emberV2,
  "Pearl-V1": pearlV1,
  "Pearl-V2": pearlV2,
} satisfies Record<string, SceneSpec>;

export type SceneId = keyof typeof SCENES;
