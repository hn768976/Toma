/**
 * Colours sampled directly out of the reference clips (see README).
 * Board plate lit value measured at rgb(40,53,78) / #28354e; the base
 * colours below are the albedo that reproduces that under this lighting rig.
 */
export const PALETTE = {
  /** Deep slate-blue the whole board is cut from. */
  boardPlate: '#58698c',
  boardPlateAlt: '#56688a',
  /** Scattered blocks read darker than the plates they sit on. */
  block: '#202b3c',
  blockAlt: '#273348',
  /** The handful of white blocks that glow. */
  blockGlow: '#c9d0dc',
  /** Satin white-silver of the processor body. */
  metalLight: '#dfe5f0',
  metalMid: '#9aa6bb',
  metalDark: '#3c4658',
  /** Violet-blue lens at the centre of the processor. */
  core: '#6f8dff',
  coreHot: '#cdd9ff',
  /** Flat milky arcs that orbit the base. */
  arc: '#e8ecf5',
  /** Diagonal light traces. */
  traceRed: '#ff5566',
  traceBlue: '#5ba4ff',
  /** Background / fog. */
  bg: '#2b3850',
  fog: '#47597c',
} as const;

/** Neon word colours, one per version. */
export const NEON = {
  blue: {
    fill: '#bcd9ff',
    glow: '#6fb0ff',
  },
  red: {
    fill: '#ff6f75',
    glow: '#ff4a54',
  },
} as const;

export type NeonKey = keyof typeof NEON;
