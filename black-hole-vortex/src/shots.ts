// One data row per composition. Everything that differs between shots lives
// here: camera, colours, disc / vortex parameters, post, and quality.
//
// Camera drift is always a closed cycle (sin/cos of the loop phase), so frame
// 600 == frame 0.

export type Vec3 = [number, number, number];

export type QualityLevel = {
  /** black hole: max geodesic steps */
  steps: number;
  /** black hole: step length as a fraction of radius */
  stepScale: number;
  /** black hole (cloud deck): march steps to find the deck surface */
  deckSteps: number;
  /** black hole (cloud deck): bisection steps refining the deck surface hit */
  deckBisect: number;
  /** fbm octaves (both looks) */
  octaves: number;
  /** vortex funnel: gas shells */
  layers: number;
  /** vortex funnel: march steps per shell before bisection */
  marchSteps: number;
};

export type PostRow = {
  exposure: number;
  bloom: number;
  bloomThreshold: number;
  bloomScatter: number;
  streak: number;
  streakColor: string;
  /** HDR threshold feeding the anamorphic streak */
  streakThreshold: number;
  halo: number;
  haloColor: string;
  /** halo ring radius in frame heights */
  haloRadius: number;
  /** light source for halo ghosts (uv, 0..1, y up) */
  haloSrc: [number, number];
  tint: Vec3;
  saturation: number;
  vignette: number;
  grain: number;
  lift: number;
};

export type BlackHoleRow = {
  look: "blackhole";
  id: string;
  refId: string;
  camera: {
    dist: number;
    elevDeg: number;
    azDeg: number;
    rollDeg: number;
    fovDeg: number;
    /** lens shift in NDC: where the hole sits in frame */
    shift: [number, number];
    target: Vec3;
    drift: { dist: number; elevDeg: number; azDeg: number; shift: [number, number] };
  };
  disc: {
    rin: number;
    rout: number;
    thick: number;
    /** 0: thickness grows with radius; 1: flat deck of half-thickness thick * thickR */
    thickFlat: number;
    thickR: number;
    bright: number;
    absorb: number;
    fallPow: number;
    streakFreq: [number, number];
    streakSharp: number;
    streakMix: number;
    cloudFreq: number;
    innerTurns: number;
    doppler: number;
    colHot: string;
    colMid: string;
    colOuter: string;
  };
  /** thick cloud deck over the outer disc (shot 3) */
  deck: {
    enabled: boolean;
    top: number;
    amp: number;
    r0: number;
    freq: number;
    fog: number;
    glow: number;
    color: string;
    colorHi: string;
    fogColor: string;
    /** soft foreground blur: footprint widening within dofDist of the camera */
    dofDist: number;
    dofAmt: number;
  };
  dust: { amount: number; azDeg: number; width: number; thick: number; color: string };
  ring: number;
  /** 0 = uniform photon ring, 1 = ring only over the top of the shadow */
  ringTop: number;
  haze: {
    color: string;
    glow: number;
    radius: number;
    bg: string;
    bgTop: string;
    /** faint galactic band across the sky */
    band: number;
    bandNormal: Vec3;
    bandColor: string;
  };
  stars: { density: number; bright: number; seed: number; lens: number };
  post: PostRow;
  quality: { preview: QualityLevel; high: QualityLevel };
};

export type VortexRow = {
  look: "vortex";
  id: string;
  refId: string;
  mode: 0 | 1 | 2;
  center: [number, number];
  zoom: { base: number; amp: number };
  drift: [number, number];
  twist: number;
  turns: Vec3;
  freq: [number, number];
  streak: number;
  streakMix: number;
  contrast: [number, number];
  /** [angle deg, squash]: oblique view of a flat swirl (modes 0, 2) */
  tilt: [number, number];
  /** [count, strength]: spiral-arm modulation (count must be an integer) */
  arms: [number, number];
  /** [strength, radius]: core bloom (mode 0) */
  glow: [number, number];
  colGlow: string;
  /** [strength, angle deg]: one-sided brightening of the eye rim */
  rim: [number, number];
  /** [strength, angle deg]: one-sided brightening of the gas */
  side: [number, number];
  /** funnel: darken the gas on the camera's side (dark foreground) */
  nearFade?: number;
  warp: number;
  evolve: number;
  coreR: number;
  outerR: number;
  gain: number;
  colBg: string;
  colGas: string;
  colHi: string;
  colAccent: string;
  eyeR: number;
  ringBright: number;
  darkR: number;
  stars: { density: number; bright: number; seed: number };
  funnel: {
    camDist: number;
    elevDeg: number;
    azDeg: number;
    fovDeg: number;
    target: Vec3;
    depth: number;
    throat: number;
    layerSep: number;
    holeR: number;
  };
  post: PostRow;
  quality: { preview: QualityLevel; high: QualityLevel };
};

export type ShotRow = BlackHoleRow | VortexRow;

const basePost: PostRow = {
  exposure: 1,
  bloom: 0.35,
  bloomThreshold: 0.6,
  bloomScatter: 0.75,
  streak: 0,
  streakColor: "#ffffff",
  streakThreshold: 1.5,
  halo: 0,
  haloColor: "#a0b4d0",
  haloRadius: 0.8,
  haloSrc: [0.5, 0.5],
  tint: [1, 1, 1],
  saturation: 1,
  vignette: 0.25,
  grain: 0.02,
  lift: 0.0,
};

const bhQuality = {
  preview: { steps: 160, stepScale: 0.07, deckSteps: 64, deckBisect: 6, octaves: 5, layers: 1, marchSteps: 1 },
  high: { steps: 360, stepScale: 0.03, deckSteps: 160, deckBisect: 8, octaves: 7, layers: 1, marchSteps: 1 },
};
const vxQuality = {
  preview: { steps: 1, stepScale: 1, deckSteps: 1, deckBisect: 1, octaves: 5, layers: 3, marchSteps: 40 },
  high: { steps: 1, stepScale: 1, deckSteps: 1, deckBisect: 1, octaves: 7, layers: 3, marchSteps: 96 },
};

export const SHOTS: ShotRow[] = [
  {
    look: "blackhole",
    id: "BlackHole_EdgeOnPink",
    refId: "2257559949",
    camera: {
      dist: 60,
      elevDeg: 10,
      azDeg: 0,
      rollDeg: -9,
      fovDeg: 23,
      shift: [-0.04, 0.12],
      target: [0, 0, 0],
      drift: { dist: 0.8, elevDeg: 0.6, azDeg: 3, shift: [0.01, 0.005] },
    },
    disc: {
      rin: 4.5,
      rout: 19,
      thick: 0.012,
      thickFlat: 0,
      thickR: 1,
      bright: 5,
      absorb: 9,
      fallPow: 1.1,
      streakFreq: [6, 0.6],
      streakSharp: 2.4,
      streakMix: 0.9,
      cloudFreq: 0.6,
      innerTurns: 2,
      doppler: 0.6,
      colHot: "#fff4ee",
      colMid: "#FF8A5A",
      colOuter: "#c05020",
    },
    deck: { enabled: false, top: 0, amp: 0, r0: 0, freq: 1, fog: 1, glow: 0, color: "#000000", colorHi: "#000000", fogColor: "#000000", dofDist: 0, dofAmt: 0 },
    dust: { amount: 0, azDeg: 0, width: 1, thick: 0.05, color: "#000000" },
    ring: 0.0,
    ringTop: 1,
    haze: { color: "#ffb8b0", glow: 0.35, radius: 2.0, bg: "#26120c", bgTop: "#1c0d08", band: 0, bandNormal: [0, 1, 0], bandColor: "#000000" },
    stars: { density: 0.04, bright: 0.3, seed: 11, lens: 0.25 },
    post: { ...basePost, exposure: 1.4, bloom: 0.6, bloomThreshold: 1.0, bloomScatter: 0.7, saturation: 1.05, vignette: 0.45 },
    quality: bhQuality,
  },
  {
    look: "blackhole",
    id: "BlackHole_GoldFlare",
    refId: "1439316983",
    camera: {
      dist: 40,
      elevDeg: 25,
      azDeg: 0,
      rollDeg: -20,
      fovDeg: 42,
      shift: [-0.12, 0.15],
      target: [0, 0, 0],
      drift: { dist: 3, elevDeg: 1, azDeg: 4, shift: [0.015, 0.008] },
    },
    disc: {
      rin: 2.8,
      rout: 16,
      thick: 0.015,
      thickFlat: 0,
      thickR: 1,
      bright: 6,
      absorb: 1.2,
      fallPow: 1.6,
      streakFreq: [3, 0.6],
      streakSharp: 1.0,
      streakMix: 0.45,
      cloudFreq: 0.45,
      innerTurns: 2,
      doppler: 0.95,
      colHot: "#fff2dc",
      colMid: "#FFB850",
      colOuter: "#A05A1A",
    },
    deck: { enabled: false, top: 0, amp: 0, r0: 0, freq: 1, fog: 1, glow: 0, color: "#000000", colorHi: "#000000", fogColor: "#000000", dofDist: 0, dofAmt: 0 },
    dust: { amount: 1.0, azDeg: 176, width: 0.5, thick: 0.1, color: "#a86a34" },
    ring: 0.08,
    ringTop: 0,
    haze: { color: "#ffc080", glow: 0.0, radius: 4, bg: "#16110c", bgTop: "#120e0a", band: 0.12, bandNormal: [0, 1, 0.35], bandColor: "#b0a898" },
    stars: { density: 0.08, bright: 0.35, seed: 23, lens: 0.25 },
    post: {
      ...basePost,
      bloom: 0.9,
      bloomThreshold: 0.8,
      saturation: 1.0,
      streak: 3,
      streakThreshold: 4,
      streakColor: "#ffd890",
      halo: 0.035,
      haloColor: "#a8b8d8",
      haloRadius: 0.82,
      haloSrc: [0.5, 0.5],
    },
    quality: bhQuality,
  },
  {
    look: "blackhole",
    id: "BlackHole_DiscSkim",
    refId: "2257562038",
    camera: {
      dist: 16,
      elevDeg: 2.6,
      azDeg: 0,
      rollDeg: 0,
      fovDeg: 15,
      shift: [-0.78, -0.5],
      target: [0, 0, 0],
      drift: { dist: 0.6, elevDeg: 0.15, azDeg: 1.5, shift: [0.0, 0.0] },
    },
    disc: {
      rin: 2.6,
      rout: 9,
      thick: 0.05,
      thickFlat: 1,
      thickR: 5,
      bright: 2.2,
      absorb: 3,
      fallPow: 2.2,
      streakFreq: [18, 1.0],
      streakSharp: 2.4,
      streakMix: 0.9,
      cloudFreq: 1.2,
      innerTurns: 2,
      doppler: 0.2,
      colHot: "#FFD0C0",
      colMid: "#E8604A",
      colOuter: "#8a3424",
    },
    deck: {
      enabled: true,
      top: 0.52,
      amp: 0.15,
      r0: 5,
      freq: 2.0,
      fog: 16,
      glow: 5,
      color: "#b84028",
      colorHi: "#ff9a70",
      fogColor: "#c86454",
      dofDist: 4,
      dofAmt: 0.15,
    },
    dust: { amount: 0, azDeg: 0, width: 1, thick: 0.05, color: "#000000" },
    ring: 0.0,
    ringTop: 0,
    haze: { color: "#ff9a8a", glow: 2.5, radius: 1.4, bg: "#3a1414", bgTop: "#200a0a", band: 0, bandNormal: [0, 1, 0], bandColor: "#000000" },
    stars: { density: 0.0, bright: 0, seed: 5, lens: 0.25 },
    post: { ...basePost, bloom: 0.5, bloomThreshold: 1.0, bloomScatter: 0.6, exposure: 0.85 },
    quality: bhQuality,
  },
  {
    look: "vortex",
    id: "Vortex_PurpleEye",
    refId: "1785427766",
    mode: 0,
    center: [0.01, 0.0],
    zoom: { base: 1, amp: 0.06 },
    drift: [0.005, 0.003],
    twist: 2.4,
    turns: [1, 2, 3],
    freq: [4.0, 1.4],
    streak: 16,
    streakMix: 0.5,
    contrast: [0.05, 0.95],
    tilt: [25, 0.88],
    arms: [2, 0.8],
    glow: [1.8, 0.12],
    colGlow: "#ffcab0",
    rim: [0.6, 30],
    side: [0.45, 135],
    warp: 0.9,
    evolve: 0.6,
    coreR: 0.2,
    outerR: 0.42,
    gain: 1.25,
    colBg: "#141634",
    colGas: "#b07098",
    colHi: "#ffe8f0",
    colAccent: "#5fc0e8",
    eyeR: 0.09,
    ringBright: 1.2,
    darkR: 0,
    stars: { density: 0.0, bright: 0.0, seed: 3 },
    funnel: { camDist: 0, elevDeg: 0, azDeg: 0, fovDeg: 45, target: [0, 0, 0], depth: 0, throat: 1, layerSep: 0, holeR: 0 },
    post: { ...basePost, bloom: 0.55, bloomThreshold: 0.5, bloomScatter: 0.8, vignette: 0.6 },
    quality: vxQuality,
  },
  {
    look: "vortex",
    id: "Vortex_BlueFunnel",
    refId: "2237510408",
    mode: 1,
    center: [0, 0],
    zoom: { base: 1, amp: 0 },
    drift: [4, 1],
    twist: 4.0,
    turns: [1, 1, 1],
    freq: [4.0, 1.4],
    streak: 16,
    streakMix: 0.9,
    contrast: [0.4, 0.75],
    tilt: [0, 1],
    arms: [3, 0.75],
    glow: [0, 0.1],
    colGlow: "#000000",
    rim: [0, 0],
    side: [0.45, 20],
    nearFade: 0.85,
    warp: 0.8,
    evolve: 0.5,
    coreR: 0.2,
    outerR: 4.0,
    gain: 1.6,
    colBg: "#02050c",
    colGas: "#3a9ad0",
    colHi: "#E8F4FF",
    colAccent: "#FFD8A0",
    eyeR: 0,
    ringBright: 0,
    darkR: 0,
    stars: { density: 0.45, bright: 1, seed: 9 },
    funnel: { camDist: 3.6, elevDeg: 54, azDeg: 0, fovDeg: 56, target: [0, -1.0, 0.5], depth: 3.0, throat: 0.45, layerSep: 0.12, holeR: 0.42 },
    post: { ...basePost, bloom: 0.7, bloomThreshold: 0.45, vignette: 0.4 },
    quality: vxQuality,
  },
  {
    look: "vortex",
    id: "Vortex_NebulaSwirl",
    refId: "1405885287",
    mode: 2,
    center: [-0.06, 0],
    zoom: { base: 1, amp: 0.05 },
    drift: [0.004, 0.002],
    twist: 2.0,
    turns: [1, 1, 1],
    freq: [1.8, 2.2],
    streak: 3.5,
    streakMix: 0.1,
    contrast: [0.15, 0.95],
    tilt: [0, 1],
    arms: [2, 0.35],
    glow: [0, 0.1],
    colGlow: "#000000",
    rim: [0, 0],
    side: [0, 0],
    warp: 2.2,
    evolve: 0.5,
    coreR: 0.3,
    outerR: 0.7,
    gain: 1.1,
    colBg: "#0A0A2E",
    colGas: "#5A5AE8",
    colHi: "#e8e0ff",
    colAccent: "#E85AA8",
    eyeR: 0,
    ringBright: 0,
    darkR: 0.07,
    stars: { density: 0.25, bright: 0.8, seed: 17 },
    funnel: { camDist: 0, elevDeg: 0, azDeg: 0, fovDeg: 45, target: [0, 0, 0], depth: 0, throat: 1, layerSep: 0, holeR: 0 },
    post: { ...basePost, bloom: 0.4 },
    quality: vxQuality,
  },
];

export const LOOP_FRAMES = 600;
export const FPS = 30;
