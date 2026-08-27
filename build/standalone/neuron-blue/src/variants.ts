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

export const VARIANT_KEY: VariantKey = 'blue';

export const VARIANT: VariantConfig = {
  palette: {
    bgDeep: '#030A1F',
    bgWash: '#0C2352',
    filament: '#4FA8E0',
    filamentPale: '#A8D8F5',
    nodeHue: '#3FD4FF',
    nodeWhite: '#F0FBFF',
    particleCool: '#5FC4F5',
    particleWarm: '#F5923F',
    particleWhite: '#E8F4FF',
  },
  layoutName: 'rightWeighted',
  nodes: [
    {
      x: 0.745,
      y: 0.285,
      scale: 1,
      brightness: 0.88,
      filamentCount: 54,
      pulsePeriod: 375,
      pulsePhase: 0.12,
    },
    {
      x: 0.595,
      y: 0.6,
      scale: 1.18,
      brightness: 1,
      filamentCount: 68,
      pulsePeriod: 125,
      pulsePhase: 0.47,
    },
    {
      x: 0.445,
      y: 0.815,
      scale: 0.55,
      brightness: 0.72,
      filamentCount: 42,
      pulsePeriod: 75,
      pulsePhase: 0.71,
    },
  ],
  baseNodeHalo: 400,
  filament: {
    growthDirection: 1,
    minLen: 260,
    maxLen: 640,
    baseWidth: 5.6,
    baseAlpha: 0.5,
    branchProb: 0.8,
    maxDepth: 2,
    driftAmp: 25,
    flashFraction: 0.2,
  },
  filamentAlphaScale: 1,
  connectionMode: 'isolated',
  motionMode: 'drift',
  particles: {
    count: 150,
    warmFraction: 0.3,
    warmClusters: [
      {
        x: 0.3,
        y: 0.42,
      },
      {
        x: 0.56,
        y: 0.24,
      },
      {
        x: 0.7,
        y: 0.76,
      },
    ],
    driftAmp: 55,
    inwardPull: 0,
  },
  wash: {
    x: 0.62,
    y: 0.52,
    radius: 0.55,
  },
  synapse: null,
  retract: null,
};
