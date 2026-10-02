/**
 * Everything you'd want to tweak for a look lives in its LookConfig
 * (src/looks/classic.ts, energy.ts, wisp.ts). Colours are sRGB hex strings.
 * All "laps"/"cycles" values are whole numbers per 20-second loop — the
 * project throws an error if one isn't, because it would break the loop.
 */
export type OrbitGroupConfig = {
  /** How many orbits in this group. */
  count: number;
  /**
   * Electron laps per 20 s loop, one entry per orbit (cycled if shorter than
   * `count`). Whole numbers; negative = the electron runs the other way.
   * Bigger = faster: 5 laps = one lap every 4 s.
   */
  laps: number[];
  /** Semi-major axis range, in atom units (outermost orbit ≈ 1). */
  radius: [number, number];
  /** Minor/major axis ratio range of each ellipse (1 = circle). */
  flatness: [number, number];
  /** "classic" = evenly fanned atom-symbol tilts; "random" = any direction. */
  tilt: "classic" | "random";
};

export type LookConfig = {
  id: string;
  seed: number;
  /** Atom diameter as a fraction of frame height (0.33–0.5). */
  atomHeightFraction: number;
  fov: number;
  background: "navy-nebula" | "black" | "teal-nebula";
  colors: {
    orbit: string;
    electronCore: string;
    electronHalo: string;
    nucleus: string;
    nucleusGlow: string;
    /** background palette (unused on the black look) */
    bgCenter: string;
    bgEdge: string;
    nebulaA: string;
    nebulaB: string;
    nebulaWarm: string;
    smoke: string;
    smoke2: string;
  };
  orbitGroups: OrbitGroupConfig[];
  /** Strands per orbit (1 = clean line, 3–4 = wispy ribbon). */
  strands: number;
  /** How far strands wander from the ideal ellipse, in atom units. */
  wispAmount: number;
  /** Trail length as a fraction of the orbit (0.25 = quarter). */
  trail: number;
  /** Trail line half-width as a fraction of frame height. */
  trailWidth: number;
  /** Faint full-ellipse line: half-width (fraction of frame height) and brightness. */
  baseWidth: number;
  baseIntensity: number;
  trailIntensity: number;
  electron: {
    /** Billboard size in atom units. */
    size: number;
    coreIntensity: number;
    haloIntensity: number;
    /** Strength of the cross-shaped star flare (0 = none). */
    star: number;
  };
  nucleus: "cluster" | "energy-core" | "teal-sphere";
  motion: {
    /** Whole turns of the atom per loop around `spinAxis`. */
    spinTurns: number;
    spinAxis: [number, number, number];
    /** Closed sway path: [amplitude rad, whole cycles per loop] about x and y. */
    swayX: [number, number];
    swayY: [number, number];
    /** Camera drift: amplitude in atom units, whole cycles per loop. */
    cameraDrift: [number, number];
    cameraDriftCycles: [number, number];
    /** Background drift speed (whole cycles of a small closed circle). */
    bgDriftCycles: number;
  };
  bloom: {
    threshold: number;
    smoothing: number;
    intensity: number;
    radius: number;
    /** mip levels: fewer = tighter glow that dies off sooner */
    levels: number;
  };
  /** Depth of field (look 3). bokehScale is at 1080p and scales with resolution. */
  dof: null | { focusOffset: number; focusRange: number; bokehScale: number };
  toneMapping: "agx" | "aces";
  /** Film grain amplitude in output (sRGB) units; 0.02 = 2 %. */
  grain: number;
  /** true = keep pure-black pixels exactly 0,0,0 (overlay look). */
  blackSafe: boolean;
  /** Smoke cloud (look 2): breathing cycles per loop. */
  smoke: null | { size: number; intensity: number; breathCycles: number };
  bokeh: null | { count: number };
  stars: { count: number; brightness: number };
};
