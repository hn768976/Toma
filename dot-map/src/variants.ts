/**
 * The single source of truth for every variant of the dotted world map.
 *
 * Every colour in the piece lives in a palette here, and every motion
 * parameter lives beside it. Components read this object and nothing else —
 * there are no colour literals or tuned constants anywhere in the render
 * path, so a new variant is a new key in VARIANTS and nothing more.
 */

export type VariantName = 'navy' | 'green' | 'amber';

/**
 * How the map moves. Components branch on this, so the ambient behaviour is
 * one mode among three rather than a baseline the others patch.
 */
export type MotionMode = 'ambient' | 'sweep' | 'hotspot';

export type Palette = {
  /** Deep base colour of the frame — never black. */
  deep: string;
  /** Colour of the broad radial wash behind the map's centre. */
  wash: string;
  /** The faint full-frame grid that sits under everything. */
  oceanDot: string;
  /** Base colour of a land dot. */
  landDot: string;
  /** The scattering of brighter land dots. */
  landBright: string;
  /** Coastal emphasis — dots with few land neighbours. */
  landCoastal: string;
  /** Colour a dot is pushed towards when excited (flash, sweep, hotspot). */
  hot: string;
  /** Connecting arcs between active regions. */
  link: string;
  /** The scan readout. */
  readout: string;
  /** Vignette and gradient falloff. */
  shadow: string;
  /** Grain. */
  grain: string;
};

/** A hotspot region, given as a centre on the globe and an angular radius. */
export type Region = {
  id: string;
  lon: number;
  lat: number;
  /** Great-circle radius in degrees. */
  radiusDeg: number;
};

export type AmbientConfig = {
  /** Per-dot sine amplitude as a fraction of the dot's base brightness. */
  amplitude: number;
  /** Bright flashes per second, scattered across the field. */
  flashesPerSecond: number;
  /** How long one flash lasts, in frames. */
  flashFrames: number;
  /** Peak additive strength of a flash. */
  flashStrength: number;
};

export type SweepConfig = {
  /** Passes over the loop. Must divide durationInFrames. */
  passes: number;
  /** Frames a dot takes to decay back to base after the line crosses it. */
  decayFrames: number;
  /** Peak additive strength given to a dot as the line crosses it. */
  strength: number;
  /** Half-height of the solid core of the line, in px. */
  coreHalfHeight: number;
  /** Half-height of the soft glow above and below the line, in px. */
  glowHalfHeight: number;
  /** Peak alpha of that glow. */
  glowAlpha: number;
  /** Draw the percentage readout. */
  readout: boolean;
  /** Readout type size in px at 4K. */
  readoutSize: number;
  /** Readout alpha. */
  readoutAlpha: number;
  /** Distance of the readout from the right and bottom edges, in px. */
  readoutMargin: number;
};

export type HotspotConfig = {
  regions: Region[];
  /** Times the full 8-region sequence runs over the loop. */
  cycles: number;
  /** Frames the activation wavefront takes to travel centre → rim. */
  waveFrames: number;
  /** Frames a single dot takes to reach full brightness once reached. */
  attackFrames: number;
  /** Frames a dot holds at full brightness. */
  holdFrames: number;
  /** Frames a dot takes to decay back to base. */
  decayFrames: number;
  /** Peak additive strength of an activated dot. */
  strength: number;
  arcs: {
    /** Bow height as a fraction of endpoint distance — long hops arc higher. */
    bowRatio: number;
    minBow: number;
    maxBow: number;
    /** Arc stroke width in px. */
    width: number;
    alpha: number;
    /** Frames for the travelling dot to cross an arc. Must divide the loop. */
    travellerFrames: number;
    travellerRadius: number;
  };
};

export type BackgroundConfig = {
  /** Alpha of the faint full-frame grid. */
  oceanDotAlpha: number;
  /** Radius of the radial wash as a fraction of the frame width. */
  washRadius: number;
  washAlpha: number;
  /** How far the vertical gradient darkens towards the bottom, 0..1. */
  gradientDepth: number;
};

export type FinishConfig = {
  /** Brightness above which a dot contributes to the bloom. */
  bloomThreshold: number;
  /** Blur radius applied in the downscaled bloom buffer, in px. */
  bloomBlur: number;
  bloomAlpha: number;
  /** Peak vignette darkness at the corners, 0..1. */
  vignette: number;
  grainAlpha: number;
};

export type VariantConfig = {
  palette: Palette;
  motion: MotionMode;
  ambient: AmbientConfig;
  /** Amplitude in px of the closed drift path the whole map travels. */
  drift: {amplitude: number};
  sweep: SweepConfig;
  hotspot: HotspotConfig;
  background: BackgroundConfig;
  finish: FinishConfig;
};

/**
 * Eight regions, in an order that hops around the globe rather than marching
 * along it, so overlapping activations read as activity moving rather than as
 * a queue.
 */
const REGIONS: Region[] = [
  // Centres sit a little inland of the places they name: a centre out over
  // water spends most of its radius on ocean and barely lights anything.
  {id: 'western-europe', lon: 4, lat: 48.5, radiusDeg: 11},
  {id: 'east-asia', lon: 116, lat: 33, radiusDeg: 12},
  {id: 'north-america-east', lon: -78, lat: 40, radiusDeg: 11},
  {id: 'south-asia', lon: 78, lat: 21, radiusDeg: 12},
  {id: 'the-gulf', lon: 49, lat: 26.5, radiusDeg: 9},
  {id: 'west-africa', lon: 2, lat: 10, radiusDeg: 11},
  {id: 'south-america-east', lon: -48, lat: -21, radiusDeg: 11},
  {id: 'australia-southeast', lon: 146, lat: -32, radiusDeg: 10},
];

/**
 * Sweep settings for a variant that does not sweep. The engine is generic over
 * the motion mode, so every variant carries every section; this one is inert.
 */
const INERT_SWEEP: SweepConfig = {
  passes: 3,
  decayFrames: 25,
  strength: 0,
  coreHalfHeight: 0,
  glowHalfHeight: 0,
  glowAlpha: 0,
  readout: false,
  readoutSize: 34,
  readoutAlpha: 0,
  readoutMargin: 120,
};

/** Hotspot settings for a variant that has no hotspots — likewise inert. */
const INERT_HOTSPOT: HotspotConfig = {
  regions: REGIONS,
  cycles: 2,
  waveFrames: 20,
  attackFrames: 6,
  holdFrames: 30,
  decayFrames: 25,
  strength: 0,
  arcs: {
    bowRatio: 0,
    minBow: 0,
    maxBow: 0,
    width: 0,
    alpha: 0,
    travellerFrames: 50,
    travellerRadius: 0,
  },
};

export const VARIANTS: Record<VariantName, VariantConfig> = {
  /* ── v1 · ambient shimmer ────────────────────────────────────────────── */
  navy: {
    palette: {
      deep: '#050C24',
      wash: '#0E1C44',
      oceanDot: '#101E42',
      landDot: '#8FA8D4',
      landBright: '#D8E4F5',
      landCoastal: '#F0F6FF',
      hot: '#EAF2FF',
      link: '#F0F6FF',
      readout: '#8FA8D4',
      shadow: '#000208',
      grain: '#FFFFFF',
    },
    motion: 'ambient',
    ambient: {
      amplitude: 0.15,
      flashesPerSecond: 8,
      flashFrames: 4,
      flashStrength: 0.55,
    },
    drift: {amplitude: 12},
    sweep: INERT_SWEEP,
    hotspot: INERT_HOTSPOT,
    background: {
      oceanDotAlpha: 0.5,
      washRadius: 0.62,
      washAlpha: 0.5,
      gradientDepth: 0.55,
    },
    finish: {
      bloomThreshold: 0.7,
      bloomBlur: 3,
      bloomAlpha: 0.42,
      vignette: 0.2,
      grainAlpha: 0.03,
    },
  },

  /* ── v2 · scanning sweep ─────────────────────────────────────────────── */
  green: {
    palette: {
      deep: '#010F06',
      wash: '#06301A',
      oceanDot: '#0A2814',
      landDot: '#3FA85F',
      landBright: '#7FE89F',
      landCoastal: '#C4FFD8',
      hot: '#E8FFEE',
      link: '#C4FFD8',
      readout: '#7FE89F',
      shadow: '#000200',
      grain: '#FFFFFF',
    },
    motion: 'sweep',
    ambient: {
      // Cut from v1's ±15% so the sweep is unambiguously the dominant motion.
      amplitude: 0.06,
      // No unexplained flashes: every brightening must read as the sweep.
      flashesPerSecond: 0,
      flashFrames: 4,
      flashStrength: 0,
    },
    drift: {amplitude: 12},
    sweep: {
      passes: 3,
      decayFrames: 25,
      strength: 0.95,
      coreHalfHeight: 1.6,
      glowHalfHeight: 34,
      glowAlpha: 0.3,
      readout: true,
      readoutSize: 44,
      readoutAlpha: 0.5,
      readoutMargin: 120,
    },
    hotspot: INERT_HOTSPOT,
    background: {
      oceanDotAlpha: 0.5,
      washRadius: 0.62,
      washAlpha: 0.5,
      gradientDepth: 0.55,
    },
    finish: {
      bloomThreshold: 0.7,
      bloomBlur: 3,
      bloomAlpha: 0.42,
      vignette: 0.2,
      grainAlpha: 0.03,
    },
  },

  /* ── v3 · regional hotspots ──────────────────────────────────────────── */
  amber: {
    palette: {
      deep: '#140A02',
      wash: '#3A2008',
      oceanDot: '#2A1808',
      landDot: '#C48A3F',
      landBright: '#F5C47F',
      landCoastal: '#FFE8C0',
      hot: '#FFF4E0',
      link: '#F5A03F',
      readout: '#C48A3F',
      shadow: '#050100',
      grain: '#FFFFFF',
    },
    motion: 'hotspot',
    ambient: {
      // Back to v1's amplitude: this version has ambient life *and* direction.
      amplitude: 0.15,
      flashesPerSecond: 8,
      flashFrames: 4,
      flashStrength: 0.55,
    },
    // Activity already moves across the surface; a drifting map would compete.
    drift: {amplitude: 5},
    sweep: INERT_SWEEP,
    hotspot: {
      regions: REGIONS,
      cycles: 2,
      waveFrames: 20,
      attackFrames: 6,
      // wave + hold + decay is 80 frames against a 37.5 frame stagger, so two
      // regions are always lit and a third is often fading in or out.
      holdFrames: 32,
      decayFrames: 28,
      strength: 0.9,
      arcs: {
        bowRatio: 0.17,
        minBow: 40,
        maxBow: 320,
        width: 3.4,
        alpha: 0.7,
        travellerFrames: 50,
        travellerRadius: 6,
      },
    },
    background: {
      oceanDotAlpha: 0.5,
      washRadius: 0.62,
      washAlpha: 0.5,
      gradientDepth: 0.55,
    },
    finish: {
      bloomThreshold: 0.7,
      bloomBlur: 3,
      bloomAlpha: 0.42,
      vignette: 0.2,
      grainAlpha: 0.03,
    },
  },
};
