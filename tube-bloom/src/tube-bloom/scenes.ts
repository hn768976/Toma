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
// Three ring spacings of travel per loop down a gently narrowing horn (each
// ring 0.9× the size of the one before). The helix phase step sets the spin:
// 3 × 0.29 × 72° ≈ 63° per 5.08 s loop ≈ 12.4°/s, clockwise on screen.
// Brightness is keyed to each ring's flow index u: rings fade in from black
// at the front (so the large near rings are never seen), the next ~two rings
// are the bright tentacles, and deeper rings sink to warm near-black.
const EMBER_FLOW = {
  spacing: 0.7,
  phaseStep: 0.29,
  count: 5,
  extraTurns: 0,
  spacingsPerLoop: 3,
  scaleRatio: 0.9,
  frontRings: 2,
  ringFade: {
    fadeIn: [0.1, 1.0] as [number, number],
    sink: [1.25, 2.5] as [number, number],
    sinkMax: 0.97,
  },
};
const EMBER_RING_COUNT = 24;

export const emberV1: SceneSpec = {
  look: {
    background: { top: "#000000", bottom: "#000000" },
    colors: {
      start: "#f04800",
      mid: "#ff4c00",
      end: "#ff4c00",
      cap: "#f04a04",
      startCap: "#f04800",
      shade: "#1c0d07", // warm near-black of the deep rings
      gradient: [0, 0.3, 0.6],
    },
    material: {
      roughness: 0.12,
      metalness: 0.55,
      clearcoat: 0,
      clearcoatRoughness: 0.06,
      iridescence: 0,
      iridescenceIOR: 1.3,
      envIntensity: 0.3,
      specularColor: "#ffc060", // hot yellow-orange highlights
    },
    envRotation: [0, 0, 0],
    envTint: "#ff6a10", // warm studio: orange reflections and rims, no blue
    lights: {
      // Light colours carry no blue: Fresnel turns grazing reflections
      // towards the light colour, and any blue there reads as pink.
      ambient: { color: "#ffa000", intensity: 0.12 },
      directional: [
        { color: "#ffb000", intensity: 2.6, direction: [-3, 3, 4] },
        { color: "#ff8000", intensity: 0.15, direction: [4, -1, 2] },
      ],
      // A long soft box above-left of camera paints a streak along each tube.
      area: [
        { color: "#ffe0a0", intensity: 22, size: [9, 0.4], position: [-2, 4, 6], lookAt: [0, 0, 0] },
      ],
    },
    // Rings recede into warm darkness as they flow down the tunnel.
    exposure: 1,
    knee: 0.8,
    vignette: 0,
    grain: 0.004,
  },
  // Identical rings of hooked arcs (~120° of a circle): each tube rises out of
  // the depth, sweeps outward and curls back in, its cut end facing the
  // camera. Rings are stacked as a helix down a hollow tunnel so the motion
  // can flow along it.
  cluster: {
    ...baseCluster,
    kind: "arc",
    seed: 7,
    rings: Array.from({ length: EMBER_RING_COUNT }, (_, i) => ({
      y: 0, // placed per frame by the flow
      count: EMBER_FLOW.count,
      shade: 0,
    })),
    orbit: [0.75, 0.75],
    tubeRadius: [0.34, 0.34],
    curlRadius: [1.18, 1.18],
    sweep: [deg(120), deg(120)],
    startAngle: [deg(-70), deg(-70)],
    planeTilt: [deg(32), deg(32)],
    phaseStep: EMBER_FLOW.phaseStep,
    phaseJitter: 0,
    startTaper: 0.1,
  },
  motion: {
    center: [0, 0, 0],
    orientation: [deg(102), deg(8), 0],
    loopFrames: LOOP,
    spinDirection: -1, // clockwise on screen
    wobble: [deg(1.2), deg(1.2)],
    flow: EMBER_FLOW,
  },
  shot: () => ({
    position: [0, 0, 5.0],
    target: [-0.6, -0.84, 0],
    fov: 35,
    focusDistance: 5.4,
    aperture: 0.26,
    maxBlur: 0.018,
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
      end: "#7c3aa4",
      cap: "#7e3ca2",
      startCap: "#c8a8b4",
      shade: "#ddd3dc",
      gradient: [0.42, 0.52, 0.6],
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
    rings: Array.from({ length: 8 }, (_, i) => ({
      polar: deg(14 + i * 19),
      count: 26,
      shade: 0,
    })),
    tubeRadius: [0.11, 0.11],
    stemLength: [0.6, 0.6],
    curlRadius: [0.3, 0.3],
    sweep: [deg(100), deg(100)],
    planeTilt: [deg(-90), deg(-90)], // hooks curl sideways, against the roll
    phaseStep: 0.5,
    phaseJitter: 0,
  },
  motion: {
    center: [1.72, -0.28, -2.7],
    orientation: [0.5912, -0.1467, -0.4735], // roll axis up-right in screen, leaning to camera
    loopFrames: LOOP,
    spinDirection: 1,
    wobble: [0, 0], // constant-speed rigid roll, no easing
    // 5 tube spacings per loop: the picture repeats every 30.5 frames, as in
    // the reference (~14°/s with 26 tubes per ring).
    spins: 5,
  },
  shot: () => ({
    position: [0, 0, 0],
    target: [0, 0, -1],
    fov: 38,
    focusDistance: 2.75,
    aperture: 0.07,
    maxBlur: 0.022,
  }),
  quality: { radScale1080: 1 },
};

const DURATION = 305;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Composition 1 — Version 2: same Ember look, new camera MOVEMENT. The
// reference is a receding vortex, so the camera slowly pushes into it while
// arcing around the axis, then racks focus from the front curls into the
// tunnel.
// ---------------------------------------------------------------------------
export const emberV2: SceneSpec = {
  ...emberV1,
  shot: (frame) => {
    const t = frame / (DURATION - 1);
    const e = easeInOutSine(t);
    // Starts wide and centred on the whole bloom, pushes in while arcing
    // around the vortex axis, and ends close on the core.
    const dist = mix(8.2, 3.6, e);
    const yaw = deg(mix(-18, 14, e));
    const pitch = deg(mix(8, -6, e));
    return {
      position: [
        Math.sin(yaw) * dist,
        Math.sin(pitch) * dist,
        Math.cos(yaw) * Math.cos(pitch) * dist,
      ],
      target: [mix(-1.6, -0.1, e), mix(0.75, -0.15, e), mix(0, -0.6, e)],
      fov: 35,
      // Rack focus: front tentacles first, then pulled into the dark core.
      focusDistance: mix(dist + 0.4, dist + 2.2, smoothstep(0.55, 0.92, t)),
      aperture: 0.2,
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
      start: "#f5ece3",
      mid: "#f7e6dc",
      end: "#ff6f4e",
      cap: "#f0613f",
      startCap: "#efe6dc",
      shade: "#e3e9e4",
    },
    lights: {
      ambient: { color: "#fff6ee", intensity: 0.4 },
      directional: [
        { color: "#fff4e8", intensity: 1.6, direction: [-2, 3, 4] },
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
