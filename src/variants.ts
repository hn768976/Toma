/**
 * ONE exported VARIANTS object drives all three compositions.
 *
 * Everything that differs between "violet", "breach" and "chat" lives here:
 * palette, centre label, geometry mode, the band array, beam behaviour,
 * rotation behaviour, assembly timing and finishing. No component hardcodes a
 * hex value or a band radius.
 */

import type {GeometryMode} from './lib/geometry';

export type VariantId = 'violet' | 'breach' | 'chat';

/* ------------------------------------------------------------------ palette */

export interface Palette {
  /** Page ground. */
  bgDeep: string;
  /** Broad soft glow behind the assembly. */
  bgMid: string;
  /** Structural bands. */
  slate: string;
  /** Highlighted bands. */
  bright: string;
  /** The most defined bands — brightest on dark grounds, darkest on light. */
  white: string;
  /** Centre label, upper line. */
  labelA: string;
  /** Centre label, lower line. */
  labelB: string;
  /** Beam / shockwave / sweep. */
  accent: string;
  /** Tick marks. */
  tick: string;
}

/* -------------------------------------------------------------------- bands */

export type BandType = 'disc' | 'ring' | 'dash' | 'ticks' | 'bars' | 'arcs';

export type PaletteKey = keyof Palette;

export interface BandDef {
  id: string;
  /** Fraction of the assembly radius. For "bubbles" this is the bubble scale. */
  radius: number;
  type: BandType;
  /** Stroke weight in 4K pixels. */
  thickness: number;
  /** Dash pattern in path pixels, applied identically to circles and bubbles. */
  dash?: [number, number];
  /** Tick / bar count, distributed by arc length around the outline. */
  count?: number;
  /** Tick / bar length along the outward normal. */
  tickLength?: number;
  /** Extra length variation for bars, distributed from a stable seed. */
  tickVary?: number;
  /** Broken-ring spans as [startDeg, sweepDeg] — degrees map to arc fraction. */
  arcs?: Array<[number, number]>;
  /** Degrees per frame. Sign sets the direction. */
  speed: number;
  color: PaletteKey;
  alpha: number;
  /** Bright glowing dots riding this band's edge, at normalised path positions. */
  dots?: number[];
  /** "breach" only: this band holds, then jumps, instead of turning smoothly. */
  stutter?: boolean;
}

/* ------------------------------------------------------------------- config */

export interface BackdropArc {
  radius: number;
  startDeg: number;
  sweepDeg: number;
  thickness: number;
  alpha: number;
}

export interface LabelConfig {
  upper: string;
  lower: string;
  upperSize: number;
  lowerSize: number;
  /** Glow pulse: ±`glowAmount`, period in frames. */
  glowPeriod: number;
  glowAmount: number;
  upperInFrame: number;
  lowerInFrame: number;
  fadeFrames: number;
  /** Vertical nudge from the frame centre, in pixels. */
  offsetY: number;
  /** "chat" only: three typing dots beneath the label. */
  typingDots?: {
    count: number;
    cycle: number;
    stagger: number;
    rise: number;
    radius: number;
    gap: number;
    offsetY: number;
  };
}

export type BeamConfig =
  | {
      mode: 'linearScan';
      beams: Array<{
        seed: string;
        /** Canvas-space bearing from the centre. 135° = lower left. */
        bearingDeg: number;
        origin: number;
        startFrame: number;
        strikeFrame: number;
        thickness: number;
        alpha: number;
        dash: [number, number];
        flare: number;
      }>;
    }
  | {
      mode: 'radialPulse';
      seed: string;
      firstFrame: number;
      minGap: number;
      maxGap: number;
      /** Frames from emission to full extent. */
      life: number;
      maxRadius: number;
      thickness: number;
      flashFrames: number;
    }
  | {
      mode: 'sweep';
      startFrame: number;
      fadeFrames: number;
      turns: number;
      wedgeDeg: number;
      radius: number;
      alpha: number;
    };

export type RotationMode = 'smooth' | 'erratic' | 'pulse';

export interface AssemblyConfig {
  start: number;
  stagger: number;
  duration: number;
  /** >0 adds overshoot; 0 means a clean, non-overshooting ramp. */
  overshoot: number;
  ease: 'cubic' | 'expo' | 'sine';
}

export interface GlitchConfig {
  seed: string;
  firstFrame: number;
  minGap: number;
  maxGap: number;
  minLen: number;
  maxLen: number;
  minSlices: number;
  maxSlices: number;
  minShift: number;
  maxShift: number;
  channelSplit: number;
  /** The two primaries the label's channels separate toward. */
  channelWarm: string;
  channelCool: string;
  /** Chance an event is immediately followed by a second, close one. */
  clusterChance: number;
}

export interface PostConfig {
  bloom: Array<{blur: number; alpha: number}>;
  /** The label needs a tighter, weaker bloom or the glyphs stop reading. */
  labelBloom: Array<{blur: number; alpha: number}>;
  /** Light-ground alternative to bloom: gentle highlight clipping toward white. */
  highlightLift: number;
  vignette: number;
  vignetteInvert: boolean;
  grain: number;
}

export interface Variant {
  id: VariantId;
  palette: Palette;
  geometry: GeometryMode;
  /** Assembly radius as a fraction of frame height. */
  scale: number;
  bands: BandDef[];
  backdropArcs: BackdropArc[];
  label: LabelConfig;
  beam: BeamConfig;
  rotation: RotationMode;
  /** "chat" only: seeded ±amp scale breathing that replaces rotation. */
  bandPulse?: {amp: number; period: number; phaseStep: number};
  assembly: AssemblyConfig;
  glitch: GlitchConfig | null;
  post: PostConfig;
  particles: {count: number; speed: number; alpha: number; color: PaletteKey};
  cameraDrift: number;
}

/* ------------------------------------------------- v1 / v2 band array (12) */

/**
 * Twelve concentric bands, inner to outer. Directions alternate band to band
 * and the speeds spread widely — inner bands crawl, the outer dash rings run.
 * The counter-rotation IS the motion design.
 */
const DIAL_BANDS: BandDef[] = [
  {
    id: 'core-disc',
    radius: 0.16,
    type: 'disc',
    thickness: 0,
    speed: 0.02,
    color: 'bgDeep',
    alpha: 0.92,
  },
  {
    id: 'ticks-fine',
    radius: 0.235,
    type: 'ticks',
    thickness: 5,
    count: 72,
    tickLength: 22,
    speed: -0.05,
    color: 'tick',
    alpha: 0.85,
  },
  {
    id: 'dash-short',
    radius: 0.3,
    type: 'dash',
    thickness: 13,
    dash: [13, 17],
    speed: 0.09,
    color: 'bright',
    alpha: 0.9,
  },
  {
    id: 'ring-inner',
    radius: 0.375,
    type: 'ring',
    thickness: 8,
    speed: -0.03,
    color: 'bright',
    alpha: 0.95,
    dots: [0.08, 0.63],
  },
  {
    id: 'bars-mid',
    radius: 0.46,
    type: 'bars',
    thickness: 9,
    count: 84,
    tickLength: 30,
    tickVary: 46,
    speed: 0.06,
    color: 'slate',
    alpha: 0.95,
  },
  {
    id: 'arcs-inner',
    radius: 0.55,
    type: 'arcs',
    thickness: 17,
    arcs: [
      [8, 86],
      [128, 74],
      [236, 80],
    ],
    speed: -0.12,
    color: 'white',
    alpha: 0.92,
  },
  {
    id: 'ticks-dense',
    radius: 0.61,
    type: 'ticks',
    thickness: 4,
    count: 132,
    tickLength: 17,
    speed: 0.16,
    color: 'tick',
    alpha: 0.72,
  },
  {
    id: 'dash-long',
    radius: 0.68,
    type: 'dash',
    thickness: 14,
    dash: [48, 27],
    speed: -0.22,
    color: 'slate',
    alpha: 0.95,
    dots: [0.31],
  },
  {
    id: 'ring-mid',
    radius: 0.74,
    type: 'ring',
    thickness: 7,
    speed: 0.05,
    color: 'bright',
    alpha: 0.8,
    dots: [0.44, 0.86],
  },
  {
    id: 'bars-outer',
    radius: 0.83,
    type: 'bars',
    thickness: 16,
    count: 56,
    tickLength: 62,
    tickVary: 20,
    speed: -0.18,
    color: 'slate',
    alpha: 0.95,
  },
  {
    id: 'arcs-outer',
    radius: 0.92,
    type: 'arcs',
    thickness: 11,
    arcs: [
      [24, 146],
      [204, 132],
    ],
    speed: 0.28,
    color: 'white',
    alpha: 0.8,
    dots: [0.18],
  },
  {
    id: 'ring-edge',
    radius: 1.0,
    type: 'ring',
    thickness: 4,
    speed: -0.07,
    color: 'slate',
    alpha: 0.62,
  },
];

/** Same array, with five bands flagged to stutter. Nothing else changes. */
const withStutter = (bands: BandDef[], ids: string[]): BandDef[] =>
  bands.map((b) => (ids.includes(b.id) ? {...b, stutter: true} : b));

/* ---------------------------------------------------- v3 band array (six) */

/**
 * Six bands, ~40% lighter strokes, generous spacing. The array shape is
 * identical — only the values and the geometry mode change.
 */
const BUBBLE_BANDS: BandDef[] = [
  {
    id: 'bubble-core',
    radius: 0.24,
    type: 'disc',
    thickness: 0,
    speed: 0,
    color: 'bright',
    alpha: 0.22,
  },
  {
    id: 'bubble-solid-inner',
    radius: 0.44,
    type: 'ring',
    thickness: 6,
    speed: 0,
    color: 'white',
    alpha: 0.9,
  },
  {
    id: 'bubble-dash',
    radius: 0.64,
    type: 'dash',
    thickness: 5,
    dash: [58, 38],
    speed: 0,
    color: 'bright',
    alpha: 0.85,
  },
  {
    id: 'bubble-solid-outer',
    radius: 0.82,
    type: 'ring',
    thickness: 5,
    speed: 0,
    color: 'white',
    alpha: 0.55,
  },
  {
    id: 'bubble-broken',
    radius: 0.92,
    type: 'arcs',
    thickness: 5,
    arcs: [[42, 288]],
    speed: 0,
    color: 'slate',
    alpha: 0.8,
  },
  {
    id: 'bubble-edge',
    radius: 1.0,
    type: 'ring',
    thickness: 3,
    speed: 0,
    color: 'slate',
    alpha: 0.35,
  },
];

const DIAL_BACKDROP: BackdropArc[] = [
  {radius: 1.28, startDeg: 196, sweepDeg: 118, thickness: 34, alpha: 0.1},
  {radius: 1.46, startDeg: 42, sweepDeg: 96, thickness: 22, alpha: 0.08},
  {radius: 1.72, startDeg: 250, sweepDeg: 150, thickness: 46, alpha: 0.06},
  {radius: 1.95, startDeg: 96, sweepDeg: 84, thickness: 18, alpha: 0.05},
];

const BUBBLE_BACKDROP: BackdropArc[] = [
  {radius: 1.32, startDeg: 200, sweepDeg: 110, thickness: 18, alpha: 0.16},
  {radius: 1.62, startDeg: 34, sweepDeg: 92, thickness: 14, alpha: 0.12},
];

const DARK_POST: PostConfig = {
  bloom: [
    {blur: 16, alpha: 0.4},
    {blur: 52, alpha: 0.3},
  ],
  labelBloom: [
    {blur: 14, alpha: 0.3},
    {blur: 44, alpha: 0.22},
  ],
  highlightLift: 0,
  vignette: 0.2,
  vignetteInvert: false,
  grain: 0.04,
};

/* ----------------------------------------------------------------- VARIANTS */

export const VARIANTS: Record<VariantId, Variant> = {
  /* ---------------------------------------------- v1: dense rings, scan beam */
  violet: {
    id: 'violet',
    geometry: 'rings',
    scale: 0.31,
    palette: {
      bgDeep: '#0A0620',
      bgMid: '#1A1450',
      slate: '#3A3F6B',
      bright: '#8FA8E8',
      white: '#E8ECFF',
      labelA: '#B84FF5',
      labelB: '#F55AC4',
      accent: '#3FD8F5',
      tick: '#6A7AB8',
    },
    bands: DIAL_BANDS,
    backdropArcs: DIAL_BACKDROP,
    label: {
      upper: 'Agentic',
      lower: 'AI',
      upperSize: 84,
      lowerSize: 152,
      glowPeriod: 58,
      glowAmount: 0.1,
      upperInFrame: 110,
      lowerInFrame: 126,
      fadeFrames: 24,
      offsetY: 0,
    },
    beam: {
      mode: 'linearScan',
      beams: [
        {
          seed: 'violet-beam-lower-left',
          bearingDeg: 133,
          origin: 2050,
          startFrame: 150,
          strikeFrame: 200,
          thickness: 9,
          alpha: 1,
          dash: [36, 26],
          flare: 1,
        },
        {
          seed: 'violet-beam-upper-right',
          bearingDeg: -44,
          origin: 1320,
          startFrame: 258,
          strikeFrame: 302,
          thickness: 5,
          alpha: 0.55,
          dash: [22, 21],
          flare: 0.5,
        },
      ],
    },
    rotation: 'smooth',
    assembly: {start: 30, stagger: 6, duration: 14, overshoot: 1.5, ease: 'cubic'},
    glitch: null,
    post: DARK_POST,
    particles: {count: 210, speed: 0.34, alpha: 0.34, color: 'bright'},
    cameraDrift: 10,
  },

  /* ------------------------------ v2: red alert, radial pulse, erratic rings */
  breach: {
    id: 'breach',
    geometry: 'rings',
    scale: 0.31,
    palette: {
      bgDeep: '#180404',
      bgMid: '#4A0E12',
      slate: '#6B2A2E',
      bright: '#E8705F',
      white: '#FFE8E4',
      labelA: '#FF2D3F',
      labelB: '#FF7A28',
      accent: '#FF9440',
      tick: '#C4837A',
    },
    bands: withStutter(DIAL_BANDS, [
      'dash-short',
      'arcs-inner',
      'ticks-dense',
      'dash-long',
      'arcs-outer',
    ]),
    backdropArcs: DIAL_BACKDROP,
    label: {
      upper: 'AI',
      lower: 'Breach',
      upperSize: 84,
      lowerSize: 134,
      glowPeriod: 58,
      glowAmount: 0.1,
      upperInFrame: 110,
      lowerInFrame: 126,
      fadeFrames: 24,
      offsetY: 0,
    },
    beam: {
      mode: 'radialPulse',
      seed: 'breach-alarm',
      firstFrame: 78,
      minGap: 35,
      maxGap: 60,
      life: 175,
      maxRadius: 2500,
      thickness: 11,
      flashFrames: 2,
    },
    rotation: 'erratic',
    assembly: {start: 20, stagger: 4, duration: 6, overshoot: 0, ease: 'expo'},
    glitch: {
      seed: 'breach-glitch',
      firstFrame: 44,
      minGap: 50,
      maxGap: 90,
      minLen: 2,
      maxLen: 4,
      minSlices: 3,
      maxSlices: 5,
      minShift: 30,
      maxShift: 140,
      channelSplit: 18,
      channelWarm: '#FF0000',
      channelCool: '#00FFFF',
      clusterChance: 0.45,
    },
    post: {...DARK_POST, vignette: 0.22, grain: 0.045},
    particles: {count: 210, speed: 0.34, alpha: 0.32, color: 'bright'},
    cameraDrift: 10,
  },

  /* ------------------------ v3: mint on white, speech bubbles, radar sweep */
  chat: {
    id: 'chat',
    geometry: 'bubbles',
    scale: 0.31,
    palette: {
      bgDeep: '#F7FAF9',
      bgMid: '#DCEFE8',
      slate: '#A8BFB8',
      bright: '#4FBF9F',
      white: '#1F7A66',
      labelA: '#147A63',
      labelB: '#2ED4A8',
      accent: '#4FE8C0',
      tick: '#8AA8A0',
    },
    bands: BUBBLE_BANDS,
    backdropArcs: BUBBLE_BACKDROP,
    label: {
      upper: 'AI',
      lower: 'Chatbot',
      // ~20% less cap height than v1 — "Chatbot" is a long word.
      upperSize: 67,
      lowerSize: 121,
      glowPeriod: 70,
      glowAmount: 0.1,
      upperInFrame: 110,
      lowerInFrame: 126,
      fadeFrames: 24,
      // Bubbles hang lower than they rise; sit the block on their optical centre.
      offsetY: -68,
      typingDots: {
        count: 3,
        cycle: 45,
        stagger: 8,
        rise: 20,
        radius: 15,
        gap: 62,
        offsetY: 86,
      },
    },
    beam: {
      mode: 'sweep',
      startFrame: 130,
      fadeFrames: 40,
      turns: 2,
      wedgeDeg: 64,
      radius: 1.5,
      alpha: 0.5,
    },
    rotation: 'pulse',
    bandPulse: {amp: 0.02, period: 98, phaseStep: -0.55},
    assembly: {start: 30, stagger: 15, duration: 35, overshoot: 0, ease: 'sine'},
    glitch: null,
    post: {
      // No bloom on a light ground; a gentle overexposure lift instead.
      bloom: [],
      labelBloom: [],
      highlightLift: 0.26,
      vignette: 0.12,
      vignetteInvert: true,
      grain: 0.03,
    },
    particles: {count: 170, speed: 0.28, alpha: 0.3, color: 'slate'},
    cameraDrift: 10,
  },
};
