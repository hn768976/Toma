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

export const VARIANT_KEY: VariantKey = 'green';

export const VARIANT: VariantConfig = {
  palette: {
    bgDeep: '#01120A',
    bgWash: '#084227',
    filament: '#3FB86A',
    filamentPale: '#A8F0C4',
    nodeHue: '#3FFF8F',
    nodeWhite: '#F0FFF4',
    particleCool: '#5FF5A8',
    particleWarm: '#F5C43F',
    particleWhite: '#E8FFF0',
  },
  layoutName: 'networked',
  nodes: [
    {
      x: 0.4,
      y: 0.3,
      scale: 0.62,
      brightness: 0.74,
      filamentCount: 36,
      pulsePeriod: 125,
      pulsePhase: 0.05,
    },
    {
      x: 0.64,
      y: 0.22,
      scale: 1.05,
      brightness: 0.96,
      filamentCount: 48,
      pulsePeriod: 375,
      pulsePhase: 0.32,
    },
    {
      x: 0.855,
      y: 0.45,
      scale: 0.6,
      brightness: 0.72,
      filamentCount: 34,
      pulsePeriod: 75,
      pulsePhase: 0.58,
    },
    {
      x: 0.52,
      y: 0.63,
      scale: 1.12,
      brightness: 1,
      filamentCount: 50,
      pulsePeriod: 125,
      pulsePhase: 0.8,
    },
    {
      x: 0.745,
      y: 0.79,
      scale: 0.58,
      brightness: 0.7,
      filamentCount: 34,
      pulsePeriod: 375,
      pulsePhase: 0.44,
    },
  ],
  baseNodeHalo: 360,
  filament: {
    growthDirection: 1,
    minLen: 230,
    maxLen: 560,
    baseWidth: 5.2,
    baseAlpha: 0.48,
    branchProb: 0.75,
    maxDepth: 2,
    driftAmp: 22,
    flashFraction: 0.16,
  },
  filamentAlphaScale: 1,
  connectionMode: 'synaptic',
  motionMode: 'drift',
  particles: {
    count: 160,
    warmFraction: 0.3,
    warmClusters: [
      {
        x: 0.34,
        y: 0.55,
      },
      {
        x: 0.62,
        y: 0.4,
      },
      {
        x: 0.8,
        y: 0.68,
      },
    ],
    driftAmp: 50,
    inwardPull: 0,
  },
  wash: {
    x: 0.62,
    y: 0.5,
    radius: 0.6,
  },
  synapse: {
    pairDistanceMax: 0.27,
    junctionsPerPair: 2,
    pathsPerJunction: 2,
    pulsesPerPathMin: 2,
    pulsesPerPathMax: 4,
    junctionLateral: 130,
  },
  retract: null,
};
