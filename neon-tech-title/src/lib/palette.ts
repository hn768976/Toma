/**
 * Scene themes.
 *
 * `standard` is the look matched to the reference clips: board plate lit
 * value measured at rgb(40,53,78) / #28354e, with the albedos below chosen to
 * reproduce that under this lighting rig.
 *
 * `dark` is the same scene graded down -- deeper board, denser haze, a softer
 * key -- so the neon word and the lit parts of the processor carry more of the
 * frame. Geometry and motion are identical; only colour and light change.
 */
export type Palette = {
  /** Deep slate-blue the whole board is cut from. */
  boardPlate: string;
  boardPlateAlt: string;
  /** Scattered blocks read darker than the plates they sit on. */
  block: string;
  blockAlt: string;
  /** The handful of pale blocks that catch the light. */
  blockGlow: string;
  /** Satin white-silver of the processor body. */
  metalLight: string;
  metalMid: string;
  metalDark: string;
  /** Violet-blue lens at the centre of the processor. */
  core: string;
  coreHot: string;
  /** Flat milky arcs that orbit the base. */
  arc: string;
  /** Diagonal light traces. */
  traceRed: string;
  traceBlue: string;
};

export type Theme = {
  palette: Palette;
  /** Background and exponential fog share a colour so the horizon has no seam. */
  atmosphere: { colour: string; density: number };
  light: {
    ambient: number;
    hemisphere: number;
    hemiSky: string;
    hemiGround: string;
    key: number;
    keyColour: string;
    fillWarm: number;
    fillCool: number;
  };
  /** Emissive strength of the pale board blocks. */
  blockGlowIntensity: number;
  /** Emissive strength of the light traces. */
  traceIntensity: number;
};

const STANDARD: Theme = {
  palette: {
    boardPlate: '#58698c',
    boardPlateAlt: '#56688a',
    block: '#202b3c',
    blockAlt: '#273348',
    blockGlow: '#c9d0dc',
    metalLight: '#dfe5f0',
    metalMid: '#9aa6bb',
    metalDark: '#3c4658',
    core: '#6f8dff',
    coreHot: '#cdd9ff',
    arc: '#e8ecf5',
    traceRed: '#ff5566',
    traceBlue: '#5ba4ff',
  },
  atmosphere: { colour: '#35485f', density: 0.0138 },
  light: {
    ambient: 0.1,
    hemisphere: 0.45,
    hemiSky: '#a8bcdc',
    hemiGround: '#070a0f',
    key: 4.3,
    keyColour: '#eef3ff',
    fillWarm: 0.3,
    fillCool: 0.2,
  },
  blockGlowIntensity: 0.08,
  traceIntensity: 0.62,
};

const DARK: Theme = {
  palette: {
    boardPlate: '#3a4661',
    boardPlateAlt: '#35405a',
    block: '#151c28',
    blockAlt: '#1a2231',
    blockGlow: '#a7b0c0',
    metalLight: '#c6cddb',
    metalMid: '#7b8597',
    metalDark: '#29313f',
    core: '#6f8dff',
    coreHot: '#c2d0ff',
    arc: '#d3d9e6',
    traceRed: '#ff4757',
    traceBlue: '#4a93ff',
  },
  atmosphere: { colour: '#1b2432', density: 0.0168 },
  light: {
    ambient: 0.07,
    hemisphere: 0.3,
    hemiSky: '#8ba0c0',
    hemiGround: '#04060a',
    key: 3.35,
    keyColour: '#dde6fa',
    fillWarm: 0.22,
    fillCool: 0.14,
  },
  // The traces and lit blocks hold their brightness so they read as the only
  // light sources once the board itself has been taken down.
  blockGlowIntensity: 0.14,
  traceIntensity: 0.78,
};

export const THEMES = { standard: STANDARD, dark: DARK } as const;
export type ThemeKey = keyof typeof THEMES;

/** Neon word colours, one per version. */
export const NEON = {
  blue: { fill: '#bcd9ff', glow: '#6fb0ff' },
  red: { fill: '#ff6f75', glow: '#ff4a54' },
} as const;

export type NeonKey = keyof typeof NEON;
