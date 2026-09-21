// The shape of one look. Everything that differs between the ten lives here;
// the rig in ../VirusField.tsx reads these values and nothing else.
//
// Adding an eleventh look means adding one row to ./looks.ts. No code change.

/**
 * Spike shapes. Each builds a stalk geometry and a cap geometry, both oriented
 * along +Y with the stalk base at the origin, sized as fractions of core radius.
 */
export type SpikeArchetype =
  /** Thin cylinder with a small spherical knob. Delicate, hair-like at distance. */
  | "stalk-knob"
  /**
   * Narrow stalk swelling into a rounded, bulbous dome wider than its base.
   * The shape most of the references actually use, and the one a plain
   * ball-on-a-stick reads wrong against.
   */
  | "club"
  /** Thin stalk with a large teardrop cap; the cap carries the read. */
  | "stalk-teardrop"
  /** Short stub topped with overlapping spheres — a broccoli-floret knot. */
  | "cluster"
  /** Short stalk with a wide rounded cap, flattened on top. A soft button. */
  | "mushroom"
  /** Stalk flaring into an outward-opening cone with a dished tip. */
  | "trumpet"
  /** A short wide cone straight off the surface, no stalk. */
  | "stub-cone";

export type BackgroundKind =
  /** Brighter centre falling off to the edges. */
  | "radial"
  /** Two-tone top-to-bottom ramp. */
  | "vertical"
  /** Flat fill, no gradient. */
  | "flat";

export type Rgb = string;

export interface Colorway {
  /** Core base tint. Multiplied by the per-vertex mottle. */
  core: Rgb;
  /** Spike stalk colour. */
  stalk: Rgb;
  /** Spike cap colour. */
  cap: Rgb;
  /** Relative frequency of this colourway in the field. */
  weight?: number;
}

export interface LookSpec {
  /** Composition id suffix and output filename stem. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Seeds every per-particle draw. Changing it reshuffles the field. */
  seed: number;

  // ---- Background -------------------------------------------------------
  background: {
    kind: BackgroundKind;
    /** Centre colour for `radial`, top colour for `vertical`, fill for `flat`. */
    inner: Rgb;
    /** Edge colour for `radial`, bottom colour for `vertical`. Ignored by `flat`. */
    outer: Rgb;
    /** Optional mid stop for `vertical`, sampled at `midStop`. */
    mid?: Rgb;
    midStop?: number;
    /** Gradient centre in UV space, for `radial`. */
    centre?: [number, number];
    /** How quickly the radial gradient falls off. Higher is tighter. */
    falloff?: number;
    /** Ordered-dither amplitude, in 1/255 units. Fights 8-bit banding. */
    dither?: number;
  };

  /** Soft sun bloom drawn into the background, e.g. look 2. */
  flare?: {
    /** Position in UV space. */
    at: [number, number];
    radius: number;
    intensity: number;
    colour: Rgb;
    /** Width of the faint horizontal streak, 0 to omit it. */
    streak: number;
  };

  /** Small drifting dust points. */
  specks?: {
    count: number;
    colour: Rgb;
    sizeRange: [number, number];
    opacity: number;
    /** Restricts specks to a vertical band of the frame, e.g. look 10. */
    yBand?: [number, number];
  };

  /** Large out-of-focus discs behind all geometry, e.g. look 8. */
  bokeh?: {
    count: number;
    colours: Rgb[];
    sizeRange: [number, number];
    opacity: number;
  };

  // ---- Particles --------------------------------------------------------
  particles: {
    count: number;
    /** Core radius range, in world units. */
    radiusRange: [number, number];
    /** Near and far z bounds of the field. The camera sits at +cameraZ. */
    depthRange: [number, number];
    /** Spread multiplier against the frustum at each particle's depth. */
    spread: number;
    /** Spikes per particle. */
    spikeCount: [number, number];
    /**
     * Radius multiplier applied to the hero particle, against radiusRange[1].
     * The references are built around one dominant subject with the rest
     * receding; without this the field reads as evenly-sized confetti.
     */
    heroScale: number;
    /** Where the hero sits, as a fraction of the frustum at its depth. */
    heroAt: [number, number];
    /** Depth the hero is moved to. The focus plane follows it. */
    heroDepth: number;
  };

  /** The particle the focus plane sits on. Index into the built field. */
  heroIndex: number;

  // ---- Surfaces ---------------------------------------------------------
  core: {
    /** Icosphere subdivision. 4 is smooth at 4K; 5 for hero-heavy looks. */
    detail: number;
    /** Surface displacement, as a fraction of radius. */
    displace: number;
    /** Spatial frequency of the displacement. */
    displaceFreq: number;
    /** Frequency of the colour mottling. Low marbles, high speckles. */
    mottleFreq: number;
    /** Multiplier applied at the dark end of the mottle ramp. */
    mottleDark: number;
    /** Multiplier applied at the light end. */
    mottleLight: number;
    /** Ramp sharpness. 1 is linear; higher pushes to the extremes. */
    mottleContrast: number;
    roughness: number;
    metalness: number;
  };

  spike: {
    archetype: SpikeArchetype;
    /** Uniform scale on the whole spike, against the archetype's base size. */
    scale: number;
    /** Extra scale on the stalk only. Near 0 makes a stub. */
    stalkScale: number;
    /** Extra scale on the cap only. */
    capScale: number;
    roughness: number;
    metalness: number;
  };

  /** Colourways drawn per particle. One entry means a single-colour field. */
  colorways: Colorway[];

  /** Occasional accent colour sprinkled over individual spike caps. */
  capAccent?: {
    colour: Rgb;
    /** Fraction of caps that take the accent, 0..1. */
    fraction: number;
  };

  /** Soft additive halo around each core, e.g. look 9. */
  rimGlow?: {
    colour: Rgb;
    /** Halo radius as a multiple of core radius. */
    size: number;
    intensity: number;
  };

  // ---- Lighting ---------------------------------------------------------
  lighting: {
    ambient: number;
    keyColour: Rgb;
    keyIntensity: number;
    keyPosition: [number, number, number];
    fillColour: Rgb;
    fillIntensity: number;
    fillPosition: [number, number, number];
    rimColour: Rgb;
    rimIntensity: number;
    rimPosition: [number, number, number];
  };

  // ---- Post -------------------------------------------------------------
  post: {
    /** Distance from camera to the focus plane, in world units. */
    focusDistance: number;
    /** Depth of the in-focus band, in world units. */
    focusRange: number;
    /** Blur strength. Look 3 and 6 are extreme; look 1 is gentle. */
    bokehScale: number;
    bloomIntensity: number;
    bloomThreshold: number;
    /** Film grain, as a fraction. 0.015-0.025 per the banding budget. */
    grain: number;
  };

  /** Frames to harvest stills at. Three per look. */
  stillFrames: [number, number, number];
}
