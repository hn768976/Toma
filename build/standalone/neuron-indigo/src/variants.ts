/**
 * The single source of truth for everything variant-specific:
 * palette, node layout, filament parameters, connection mode and
 * filament motion mode. No hex literal and no layout coordinate
 * may live anywhere else in the project.
 */

export type VariantKey = 'blue' | 'green' | 'indigo';
export type ConnectionMode = 'isolated' | 'synaptic';
export type MotionMode = 'drift' | 'retract';

export interface Palette {
  bgDeep: string;
  bgWash: string;
  filament: string;
  filamentPale: string;
  nodeHue: string;
  nodeWhite: string;
  particleCool: string;
  particleWarm: string;
  particleWhite: string;
}

export interface NodeSpec {
  /** Position as a fraction of frame width / height */
  x: number;
  y: number;
  /** Multiplies base halo radius and filament sizes */
  scale: number;
  /** Peak alpha of the halo, 0..1 */
  brightness: number;
  filamentCount: number;
  /** Core pulse period in frames - must divide 375 */
  pulsePeriod: number;
  pulsePhase: number;
}

export interface FilamentParams {
  /** Signed growth direction: 1 grows/extends outward, -1 retracts inward. */
  growthDirection: 1 | -1;
  minLen: number;
  maxLen: number;
  baseWidth: number;
  baseAlpha: number;
  /** Chance a trunk grows a second branch */
  branchProb: number;
  maxDepth: number;
  /** Undulation amplitude in px */
  driftAmp: number;
  /** Fraction of filaments whose tips flash briefly */
  flashFraction: number;
}

export interface ParticleParams {
  count: number;
  warmFraction: number;
  /** Cluster centres for the warm accent family, frame fractions */
  warmClusters: {x: number; y: number}[];
  driftAmp: number;
  /** Px of inward travel toward the node during retraction (0 = closed wandering paths) */
  inwardPull: number;
}

export interface SynapseParams {
  /** Max node distance (fraction of width, y compressed by aspect) to be "nearby" */
  pairDistanceMax: number;
  junctionsPerPair: number;
  pathsPerJunction: number;
  pulsesPerPathMin: number;
  pulsesPerPathMax: number;
  /** Lateral offset of junctions off the inter-node axis, px */
  junctionLateral: number;
}

export interface RetractParams {
  /** Frame at which the filaments finish retracting */
  retractEnd: number;
  /** Frame of peak core brightness */
  peakFrame: number;
  /** Last frame of the bright hold; re-extension runs from here to 375 */
  holdEnd: number;
  /** Residual corona: fraction of full length kept while retracted */
  residual: number;
}

export interface VariantConfig {
  palette: Palette;
  layoutName: 'rightWeighted' | 'networked' | 'singleCentred';
  nodes: NodeSpec[];
  /** Halo radius in px at node scale 1 */
  baseNodeHalo: number;
  filament: FilamentParams;
  /** Global multiplier on filament alpha (v3 compensates density with ~30% less) */
  filamentAlphaScale: number;
  connectionMode: ConnectionMode;
  motionMode: MotionMode;
  particles: ParticleParams;
  /** Background wash centre + radius, frame fractions (radius vs width) */
  wash: {x: number; y: number; radius: number};
  synapse: SynapseParams | null;
  retract: RetractParams | null;
}

export const VARIANT_KEY: VariantKey = 'indigo';

export const VARIANT: VariantConfig = {
  palette: {
    bgDeep: '#0A0625',
    bgWash: '#241A6B',
    filament: '#6F5FE8',
    filamentPale: '#C4BCFF',
    nodeHue: '#9B7FFF',
    nodeWhite: '#F4F0FF',
    particleCool: '#8B7FF5',
    particleWarm: '#F55F9B',
    particleWhite: '#F0EDFF',
  },
  layoutName: 'singleCentred',
  nodes: [
    {
      x: 0.5,
      y: 0.5,
      scale: 1,
      brightness: 1,
      filamentCount: 160,
      pulsePeriod: 375,
      pulsePhase: 0.2,
    },
  ],
  baseNodeHalo: 860,
  filament: {
    growthDirection: -1,
    minLen: 950,
    maxLen: 2150,
    baseWidth: 5,
    baseAlpha: 0.5,
    branchProb: 0.7,
    maxDepth: 2,
    driftAmp: 20,
    flashFraction: 0.1,
  },
  filamentAlphaScale: 0.7,
  connectionMode: 'isolated',
  motionMode: 'retract',
  particles: {
    count: 130,
    warmFraction: 0.3,
    warmClusters: [
      {
        x: 0.28,
        y: 0.32,
      },
      {
        x: 0.74,
        y: 0.26,
      },
      {
        x: 0.66,
        y: 0.76,
      },
    ],
    driftAmp: 20,
    inwardPull: 110,
  },
  wash: {
    x: 0.5,
    y: 0.5,
    radius: 0.52,
  },
  synapse: null,
  retract: {
    retractEnd: 260,
    peakFrame: 280,
    holdEnd: 345,
    residual: 0.13,
  },
};
