export type RGB = readonly [number, number, number];
export type Vec3 = readonly [number, number, number];
export type Range = readonly [number, number];

export const hex = (h: string): RGB => {
  const v = parseInt(h.replace("#", ""), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

export type StrandStyle = {
  /** particles per world unit along the helix axis, per strand */
  density: number;
  /** gaussian tube jitter (world units) */
  jitter: number;
  colors: readonly RGB[];
  size: Range;
  alpha: Range;
  sparkleChance: number;
  sparkleColor: RGB;
  sparkleSize: Range;
  /** draw strand particles as small hollow ring dots (lens look) */
  ringDots?: boolean;
};

export type RungStyle = {
  /** particles per rung */
  count: number;
  jitter: number;
  colorA: RGB;
  colorB: RGB;
  size: Range;
  alpha: Range;
  /** draw rung particles as small hollow ring dots */
  ringDots?: boolean;
  /** fade rung particles as the rung turns edge-on to camera (avoids additive pile-up) */
  edgeFade?: boolean;
  /** fraction of the rung length left empty at each end (strand overlap) */
  inset: number;
  /** optional glowing core line along the rung */
  bar?: {
    color: RGB;
    alpha: number;
    width: number;
    glowWidth: number;
    glowAlpha: number;
    /** draw the bar as one continuous tube instead of broken segments */
    continuous?: boolean;
  };
  /** optional bright clusters ("hot spots") per rung */
  hot?: { color: RGB; clusters: Range; count: number; spread: number; size: Range; alpha: Range };
};

export type PlexusStyle = {
  nodesPerUnit: number;
  jitter: number;
  rungNodes: number;
  rungJitter: number;
  k: number;
  maxDist: number;
  color: RGB;
  alpha: number;
  width: number;
  facetChance: number;
  facetAlpha: number;
  facetColor: RGB;
  nodeColor: RGB;
  nodeSize: Range;
  nodeAlpha: number;
  stray?: { count: number; maxDist: number; color: RGB; alpha: number; width: number };
  /** soft glow sprites along strands and rungs */
  haze?: { perUnit: number; perRung: number; jitter: number; size: Range; alpha: number; color: RGB };
};

export type HelixStyle = {
  radius: number;
  pitch: number;
  yMin: number;
  yMax: number;
  rungsPerTurn: number;
  /** angular offset between the two strands (PI = symmetric) */
  strandOffset: number;
  strand: StrandStyle;
  rung: RungStyle;
  plexus: PlexusStyle;
};

export type FieldStyle = {
  nodes: number;
  /** keep the volume around the helix axis (x=z=0) empty */
  clearRadius?: number;
  box: { x: Range; y: Range; z: Range };
  k: number;
  maxDist: number;
  lineColor: RGB;
  lineAlpha: number;
  lineWidth: number;
  nodeKind: 0 | 2;
  nodeColor: RGB;
  nodeSize: Range;
  nodeAlpha: number;
  facetChance: number;
  facetAlpha: number;
  dust: number;
  dustBox: { x: Range; y: Range; z: Range };
  dustColors: readonly RGB[];
  dustSize: Range;
  dustAlpha: Range;
};

export type Blob = {
  from: Vec3;
  to: Vec3;
  /** seconds */
  t0: number;
  t1: number;
  color: RGB;
  size: number;
  alpha: number;
};

export type Rig = {
  camPos: Vec3;
  target: Vec3;
  fov: number;
  roll: number;
  helixPos: Vec3;
  /** spin around the helix's own axis (radians) */
  helixSpin: number;
  /** tilt of the helix axis: [aroundX, aroundZ] radians */
  helixTilt: readonly [number, number];
  focus: number;
  /** glow intensity multiplier (default 1) */
  glow?: number;
};

export type Background = {
  dark: RGB;
  mid: RGB;
  light: RGB;
  center: readonly [number, number];
  radius: readonly [number, number];
  vignette: number;
};

export type Glow = {
  color: RGB;
  intensity: number;
  size: number;
  spacing: number;
  /** offset from the helix axis in helix-local x/z */
  offset: readonly [number, number];
  /** helix-local y range covered by glow sprites (default: whole helix) */
  yRange?: readonly [number, number];
};

export type Preset = {
  name: string;
  seed: number;
  bg: Background;
  helix: HelixStyle;
  field: FieldStyle;
  glow?: Glow;
  blobs?: readonly Blob[];
  dof: {
    aperture: number;
    /** background field gets a stronger lens blur (bigger bokeh rings) */
    fieldApertureScale: number;
    maxCoc: number;
    ringAmount: number;
    refDepth: number;
  };
  gain: { points: number; lines: number; facets: number };
  twinkle: number;
  /** optional distance fog for particles/lines */
  fog?: { start: number; density: number };
  rig: (t: number, duration: number) => Rig;
};
