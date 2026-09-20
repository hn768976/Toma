/**
 * The three looks.
 *
 * Each reference clip is the same beat — an empty socket, a chip descending,
 * a seating impact, an energy wave crossing the board — shot with a very
 * different art direction. Everything that differs between the three versions
 * lives in this file: palette, materials, lighting, camera rig and the
 * timing of the beats. The scene builder in `src/scene` is shared.
 *
 * World scale: 1 unit ~= 1 mm of a real package. The chip is 8 units across,
 * the socket 11, and the board 180 so its edges never enter frame.
 */

export type VersionId = 'v1' | 'v2' | 'v3' | 'v4';

export interface CameraKey {
  /** Seconds into the composition. */
  t: number;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface Beats {
  /**
   * Height the package starts at, in world units. Set above the camera for
   * each version so frame 0 is a clean plate and the chip descends into
   * shot, rather than opening on a slab filling the middle of the frame.
   */
  startY: number;
  /** Second at which the chip starts moving down from its hold position. */
  descendStart: number;
  /** Second at which the chip is fully seated in the socket. */
  seat: number;
  /** Second at which the energy wave has crossed the whole board. */
  waveEnd: number;
  /** Second at which the scene has settled into its sustain state. */
  settle: number;
}

export interface Theme {
  id: VersionId;
  label: string;
  durationInSeconds: number;

  /** Background gradient, bottom colour then top colour. */
  background: [string, string];
  /** Distance fog — keeps the far board from reading as a hard plane. */
  fog: { color: string; near: number; far: number };

  board: {
    color: string;
    roughness: number;
    metalness: number;
    /** Colour of the etched (unlit) copper routing. */
    traceColor: string;
    /** Colour the routing glows once energised. */
    traceGlowColor: string;
    /** How bright the routing sits before the chip seats. */
    idleGlow: number;
    /**
     * How bright the routing sits once the wave has passed. Kept well below
     * the wavefront value: in the references the board settles back to dark
     * copper with live traces, it does not stay floodlit.
     */
    sustainGlow: number;
    /** Peak emissive multiplier at the wavefront. */
    waveGlow: number;
    /** Silkscreen / solder-mask print colour. */
    silkColor: string;
  };

  components: {
    palette: string[];
    roughness: number;
    metalness: number;
    /** Extra clearcoat for the glassy V2 parts. */
    clearcoat: number;
    /**
     * Radius around the socket, in world units, that stays clear of
     * components. The package is 8.4 across and the socket 12.2, so anything
     * much below ~15 puts parts right up against the chip.
     */
    keepOut: number;
    /**
     * Emissive lift so dark boards keep some component definition. Values
     * here are linear light, and the palettes are near-black — anything above
     * ~0.01 swamps the albedo entirely and the parts read as grey plastic.
     */
    emissive: number;
    count: number;
  };

  socket: {
    frameColor: string;
    padColor: string;
    metalness: number;
    roughness: number;
    /** Glow ring around the socket lip once seated. */
    glowColor: string;
  };

  chip: {
    bodyColor: string;
    bodyMetalness: number;
    bodyRoughness: number;
    /** Die gradient — inner then outer. */
    dieColorA: string;
    dieColorB: string;
    /** "AI" lettering colour. */
    labelColor: string;
    /** Peak emissive strength of the die after ignition. */
    dieGlow: number;
    /** V2's glass chip shifts hue across the surface. */
    iridescent: boolean;
    /** How lit the die already is while the chip is still descending. */
    preGlow: number;
    /** Colour of the light shafts under a descending chip (V3). */
    beamColor: string;
    beamStrength: number;
  };

  energy: {
    rayColor: string;
    rayCount: number;
    /** Ground-hugging data streams that race along the routing. */
    streamColor: string;
    streamCount: number;
    ringColor: string;
    flashColor: string;
    flashStrength: number;
    /** Floating motes above the board. */
    dustColor: string;
    dustCount: number;
    /** Halftone dot ring — the V2 signature. */
    halftone: boolean;
  };

  lighting: {
    ambient: string;
    ambientIntensity: number;
    keyColor: string;
    keyIntensity: number;
    keyPosition: [number, number, number];
    rimColor: string;
    rimIntensity: number;
    rimPosition: [number, number, number];
    fillColor: string;
    fillIntensity: number;
    /** Hemisphere sky colour — carries the bright V2 studio. */
    skyColor: string;
    groundColor: string;
    hemiIntensity: number;
  };

  post: {
    exposure: number;
    bloomStrength: number;
    bloomRadius: number;
    bloomThreshold: number;
    vignette: number;
    grain: number;
    chromatic: number;
    /**
     * Depth of field. The focal distance tracks the package at runtime;
     * `dofFocusRange` is how far from it a subject may be before it is fully
     * defocused, `dofSigma` the blur radius and `dofStrength` how much of the
     * blurred copy is mixed back in at full defocus.
     */
    dofFocusRange: number;
    dofSigma: number;
    dofStrength: number;
    /** Lift/gamma/gain style grade applied after bloom. */
    liftColor: string;
    lift: number;
    saturation: number;
    contrast: number;
  };

  camera: CameraKey[];
  /** Amplitude, in world units, of the deterministic handheld drift. */
  cameraDrift: number;
  beats: Beats;
  /** Seed for every procedural layout decision in the scene. */
  seed: number;
}

/* ------------------------------------------------------------------ *
 * V1 — dark navy board, high angle, dense cyan data streams.
 * ------------------------------------------------------------------ */
const v1: Theme = {
  id: 'v1',
  label: 'Dark Circuit',
  durationInSeconds: 9.6,

  background: ['#02050b', '#0a1a30'],
  fog: { color: '#040a16', near: 40, far: 150 },

  board: {
    color: '#0a1728',
    roughness: 0.62,
    metalness: 0.15,
    traceColor: '#143350',
    traceGlowColor: '#3fb4c8',
    idleGlow: 0.08,
    sustainGlow: 0.3,
    waveGlow: 2.4,
    silkColor: '#20415f',
  },

  components: {
    palette: ['#0a1526', '#101f33', '#0c1a2b', '#16283f', '#091220'],
    roughness: 0.55,
    metalness: 0.35,
    clearcoat: 0.1,
    keepOut: 30,
    emissive: 0.008,
    // Bare board: no surface-mount shapes at all, just routing and the package.
    count: 0,
  },

  socket: {
    frameColor: '#26374d',
    padColor: '#c9b184',
    metalness: 0.42,
    roughness: 0.45,
    glowColor: '#5fd8e6',
  },

  chip: {
    bodyColor: '#1b3570',
    bodyMetalness: 0.4,
    bodyRoughness: 0.42,
    dieColorA: '#79e8f2',
    dieColorB: '#17607a',
    labelColor: '#eafdff',
    dieGlow: 1.05,
    iridescent: false,
    preGlow: 0.16,
    beamColor: '#61d4e2',
    beamStrength: 0.16,
  },

  energy: {
    rayColor: '#55c6d8',
    rayCount: 150,
    streamColor: '#6ad2e2',
    streamCount: 320,
    ringColor: '#7ce3ef',
    flashColor: '#dffaff',
    flashStrength: 0.9,
    dustColor: '#6fd6e4',
    dustCount: 420,
    halftone: false,
  },

  lighting: {
    ambient: '#16304d',
    ambientIntensity: 0.55,
    keyColor: '#9ecbff',
    keyIntensity: 2.2,
    keyPosition: [22, 34, 20],
    rimColor: '#3fc2d4',
    rimIntensity: 2.6,
    rimPosition: [-26, 12, -22],
    fillColor: '#1b3b63',
    fillIntensity: 0.9,
    skyColor: '#2a4a70',
    groundColor: '#040810',
    hemiIntensity: 0.45,
  },

  post: {
    exposure: 1.05,
    bloomStrength: 0.55,
    bloomRadius: 0.62,
    bloomThreshold: 0.86,
    vignette: 0.5,
    grain: 0.02,
    chromatic: 0.0016,
    dofFocusRange: 26,
    dofSigma: 5,
    dofStrength: 0.85,
    liftColor: '#0a1c33',
    lift: 0.035,
    saturation: 1.12,
    contrast: 1.06,
  },

  camera: [
    { t: 0.0, position: [16, 38, 40], target: [0, 1.2, 0], fov: 25 },
    { t: 1.2, position: [13, 35, 39], target: [0, 1.6, 0], fov: 25 },
    { t: 3.2, position: [3, 37, 44], target: [0, 1.2, 0], fov: 26 },
    { t: 6.4, position: [-10, 39, 45], target: [0, 1.0, 0], fov: 27 },
    { t: 9.6, position: [-20, 42, 45], target: [0, 0.8, 0], fov: 28 },
  ],
  cameraDrift: 0.28,
  beats: { startY: 50, descendStart: 0.0, seat: 1.35, waveEnd: 4.3, settle: 5.4 },
  seed: 20240117,
};

/* ------------------------------------------------------------------ *
 * V2 — bright white studio board, pastel glass parts, iridescent chip.
 * ------------------------------------------------------------------ */
const v2: Theme = {
  id: 'v2',
  label: 'Glass White',
  durationInSeconds: 8.04,

  background: ['#dfe9f2', '#ffffff'],
  fog: { color: '#eef4fa', near: 60, far: 260 },

  board: {
    color: '#dfe6ee',
    roughness: 0.45,
    metalness: 0.08,
    traceColor: '#9db0c4',
    traceGlowColor: '#79b4ec',
    idleGlow: 0.05,
    sustainGlow: 0.3,
    waveGlow: 1.3,
    silkColor: '#bcc9d6',
  },

  components: {
    palette: ['#9fded0', '#b6c4ef', '#cbd9e9', '#9ed3e8', '#d5c8ea', '#e6ebf2', '#7fc9c0', '#a9b8e8'],
    roughness: 0.16,
    metalness: 0.12,
    clearcoat: 0.9,
    keepOut: 9.5,
    emissive: 0.02,
    count: 560,
  },

  socket: {
    frameColor: '#c2ccd6',
    padColor: '#dde4ea',
    metalness: 0.3,
    roughness: 0.38,
    glowColor: '#a9c8f0',
  },

  chip: {
    bodyColor: '#e9eef4',
    bodyMetalness: 0.22,
    bodyRoughness: 0.3,
    dieColorA: '#7d8eec',
    dieColorB: '#dd8fc8',
    labelColor: '#ffffff',
    dieGlow: 0.7,
    iridescent: true,
    preGlow: 0.3,
    beamColor: '#b9cdf0',
    beamStrength: 0.1,
  },

  energy: {
    rayColor: '#a9c6ef',
    rayCount: 90,
    streamColor: '#9dbce8',
    streamCount: 190,
    ringColor: '#8fb4e8',
    flashColor: '#ffffff',
    flashStrength: 0.5,
    dustColor: '#c4d6ee',
    dustCount: 260,
    halftone: true,
  },

  lighting: {
    ambient: '#eef4fa',
    ambientIntensity: 0.5,
    keyColor: '#ffffff',
    keyIntensity: 2.1,
    keyPosition: [18, 40, 26],
    rimColor: '#c8dcf4',
    rimIntensity: 0.9,
    rimPosition: [-24, 18, -18],
    fillColor: '#e2ecf6',
    fillIntensity: 0.5,
    skyColor: '#ffffff',
    groundColor: '#c3d0de',
    hemiIntensity: 0.55,
  },

  post: {
    exposure: 0.92,
    bloomStrength: 0.24,
    bloomRadius: 0.78,
    bloomThreshold: 0.95,
    vignette: 0.2,
    grain: 0.01,
    chromatic: 0.0008,
    dofFocusRange: 30,
    dofSigma: 5,
    dofStrength: 0.9,
    liftColor: '#eef4fb',
    lift: 0.05,
    saturation: 1.02,
    contrast: 0.95,
  },

  camera: [
    { t: 0.0, position: [11, 19, 48], target: [-1, 0.6, 0], fov: 27 },
    { t: 2.8, position: [8, 18, 45], target: [0, 1.0, 0], fov: 26 },
    { t: 5.0, position: [1, 19, 44], target: [0, 0.9, 0], fov: 26.5 },
    { t: 8.04, position: [-9, 20, 43], target: [0, 0.8, 0], fov: 27.5 },
  ],
  cameraDrift: 0.2,
  beats: { startY: 30, descendStart: 0.5, seat: 2.8, waveEnd: 4.9, settle: 5.6 },
  seed: 77120458,
};

/* ------------------------------------------------------------------ *
 * V3 — near-black board, bright silver socket, cyan beams and a hard flash.
 * ------------------------------------------------------------------ */
const v3: Theme = {
  id: 'v3',
  label: 'Black Board',
  durationInSeconds: 8.04,

  background: ['#000000', '#05070c'],
  fog: { color: '#02040a', near: 34, far: 130 },

  board: {
    color: '#080a0f',
    roughness: 0.72,
    metalness: 0.2,
    traceColor: '#101820',
    traceGlowColor: '#79c8ff',
    idleGlow: 0.04,
    sustainGlow: 0.34,
    waveGlow: 2.8,
    silkColor: '#1b242f',
  },

  components: {
    palette: ['#0b0d12', '#12161d', '#080a0e', '#171c25', '#0e1219'],
    roughness: 0.68,
    metalness: 0.28,
    clearcoat: 0.06,
    keepOut: 9.5,
    emissive: 0.005,
    count: 660,
  },

  socket: {
    frameColor: '#cdd2da',
    padColor: '#e4e8ee',
    metalness: 0.45,
    roughness: 0.34,
    glowColor: '#8fd4ff',
  },

  chip: {
    bodyColor: '#0f131b',
    bodyMetalness: 0.4,
    bodyRoughness: 0.42,
    dieColorA: '#a8ecff',
    dieColorB: '#1f7fd0',
    labelColor: '#f2fcff',
    dieGlow: 1.15,
    iridescent: false,
    preGlow: 0.32,
    beamColor: '#6fc8ff',
    beamStrength: 0.42,
  },

  energy: {
    rayColor: '#9fddff',
    rayCount: 170,
    streamColor: '#d6f2ff',
    streamCount: 300,
    ringColor: '#cfefff',
    flashColor: '#ffffff',
    flashStrength: 1.25,
    dustColor: '#8fcfff',
    dustCount: 380,
    halftone: false,
  },

  lighting: {
    ambient: '#0c1724',
    ambientIntensity: 0.4,
    keyColor: '#cfe4ff',
    keyIntensity: 2.0,
    keyPosition: [16, 36, 24],
    rimColor: '#3f9fff',
    rimIntensity: 2.2,
    rimPosition: [-28, 10, -20],
    fillColor: '#101f33',
    fillIntensity: 0.55,
    skyColor: '#16283d',
    groundColor: '#000000',
    hemiIntensity: 0.3,
  },

  post: {
    exposure: 1.0,
    bloomStrength: 0.7,
    bloomRadius: 0.7,
    bloomThreshold: 0.78,
    vignette: 0.62,
    grain: 0.022,
    chromatic: 0.002,
    dofFocusRange: 22,
    dofSigma: 6,
    dofStrength: 0.9,
    liftColor: '#04101f',
    lift: 0.02,
    saturation: 1.1,
    contrast: 1.1,
  },

  camera: [
    { t: 0.0, position: [5, 30, 56], target: [0, 0.6, 0], fov: 25 },
    { t: 3.0, position: [3, 26, 49], target: [0, 1.1, 0], fov: 24.5 },
    { t: 5.2, position: [-3, 25, 46], target: [0, 1.0, 0], fov: 25 },
    { t: 8.04, position: [-10, 24, 44], target: [0, 0.9, 0], fov: 26 },
  ],
  cameraDrift: 0.24,
  beats: { startY: 46, descendStart: 0.6, seat: 3.0, waveEnd: 5.1, settle: 5.9 },
  seed: 31889204,
};

/* ------------------------------------------------------------------ *
 * V4 — V1's shot, inverted to a light palette.
 *
 * Same camera rig, same beats, same 9.6s running time and the same cleared
 * board around the package; only the colour and lighting differ. On a light
 * board the energy has to get *darker* to read, so the cyan here is
 * saturated rather than luminous, and the additive streaks are pulled well
 * down — additive light on a near-white surface only ever moves toward
 * white, so the work is done by the emissive routing instead.
 * ------------------------------------------------------------------ */
const v4: Theme = {
  id: 'v4',
  label: 'Light Circuit',
  durationInSeconds: 9.6,

  background: ['#bccddd', '#f4f8fc'],
  fog: { color: '#e6eef7', near: 62, far: 260 },

  board: {
    color: '#d7e0ea',
    roughness: 0.5,
    metalness: 0.12,
    traceColor: '#93a8bf',
    traceGlowColor: '#1fa8bd',
    idleGlow: 0.06,
    sustainGlow: 0.62,
    waveGlow: 1.7,
    silkColor: '#bcc9d8',
  },

  components: {
    palette: ['#e7edf4', '#d3dde9', '#eff4f9', '#c6d3e1', '#dce5ef'],
    roughness: 0.34,
    metalness: 0.18,
    clearcoat: 0.35,
    keepOut: 30,
    emissive: 0.015,
    // Bare board, as V1.
    count: 0,
  },

  socket: {
    frameColor: '#b4c1d0',
    padColor: '#e9eef4',
    metalness: 0.32,
    roughness: 0.38,
    glowColor: '#3fbcd0',
  },

  chip: {
    bodyColor: '#56709c',
    bodyMetalness: 0.32,
    bodyRoughness: 0.4,
    dieColorA: '#33c3d6',
    dieColorB: '#186e86',
    labelColor: '#ffffff',
    dieGlow: 1.1,
    iridescent: false,
    preGlow: 0.14,
    beamColor: '#54c6d8',
    beamStrength: 0.14,
  },

  energy: {
    rayColor: '#43c2d4',
    rayCount: 150,
    streamColor: '#4fc9db',
    streamCount: 320,
    ringColor: '#3fbcd0',
    flashColor: '#ffffff',
    flashStrength: 0.6,
    dustColor: '#6fcfdd',
    dustCount: 420,
    halftone: false,
  },

  lighting: {
    ambient: '#eaf1f8',
    ambientIntensity: 0.55,
    keyColor: '#ffffff',
    keyIntensity: 2.3,
    keyPosition: [22, 40, 22],
    rimColor: '#bfe3ea',
    rimIntensity: 0.9,
    rimPosition: [-26, 16, -22],
    fillColor: '#dfe9f4',
    fillIntensity: 0.55,
    skyColor: '#ffffff',
    groundColor: '#bcc9d8',
    hemiIntensity: 0.6,
  },

  post: {
    exposure: 0.94,
    bloomStrength: 0.26,
    bloomRadius: 0.68,
    bloomThreshold: 0.92,
    vignette: 0.24,
    grain: 0.01,
    chromatic: 0.001,
    dofFocusRange: 30,
    dofSigma: 5,
    dofStrength: 0.85,
    liftColor: '#e9f1f9',
    lift: 0.04,
    saturation: 1.06,
    contrast: 0.98,
  },

  camera: [
    { t: 0.0, position: [16, 38, 40], target: [0, 1.2, 0], fov: 25 },
    { t: 1.2, position: [13, 35, 39], target: [0, 1.6, 0], fov: 25 },
    { t: 3.2, position: [3, 37, 44], target: [0, 1.2, 0], fov: 26 },
    { t: 6.4, position: [-10, 39, 45], target: [0, 1.0, 0], fov: 27 },
    { t: 9.6, position: [-20, 42, 45], target: [0, 0.8, 0], fov: 28 },
  ],
  cameraDrift: 0.28,
  beats: { startY: 50, descendStart: 0.0, seat: 1.35, waveEnd: 4.3, settle: 5.4 },
  seed: 20240117,
};

export const THEMES: Record<VersionId, Theme> = { v1, v2, v3, v4 };
export const VERSION_IDS: VersionId[] = ['v1', 'v2', 'v3', 'v4'];
