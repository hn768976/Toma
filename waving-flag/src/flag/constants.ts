export const FPS = 30;
export const DURATION_IN_FRAMES = 300; // 10s
export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;

export type Framing = 'pole' | 'closeup';

/**
 * Wave parameters per version. uN1/uN2 and drapeCycles must stay INTEGER
 * temporal cycle counts — that is what makes frame 300 identical to frame 0.
 * Amplitudes are expressed in flag-heights so they are ratio independent.
 */
export type WaveParams = {
  envPow: number;
  amp1: number;
  k1: number;
  n1: number;
  amp2: number;
  k2: number;
  n2: number;
  theta: number;
  amp3: number;
  noiseFreq: [number, number];
  noiseRadius: number;
  drapeAmp: number;
  drapeSigma: number;
  drapeCycles: number;
  sag: number;
};

export const WAVE: Record<Framing, WaveParams> = {
  // Medium shot: quicker, tighter folds.
  pole: {
    envPow: 1.35,
    amp1: 0.165,
    k1: 1.7,
    n1: 3,
    amp2: 0.075,
    k2: 2.6,
    n2: 5,
    theta: (22 * Math.PI) / 180,
    amp3: 0.09,
    noiseFreq: [2.2, 1.5],
    noiseRadius: 0.9,
    drapeAmp: 0.055,
    drapeSigma: 0.16,
    drapeCycles: 2,
    sag: 0.05,
  },
  // Close-up: larger folds, slower travel, so it reads as a detail.
  closeup: {
    envPow: 0.9,
    amp1: 0.21,
    k1: 1.0,
    n1: 1,
    amp2: 0.105,
    k2: 1.7,
    n2: 2,
    theta: (25 * Math.PI) / 180,
    amp3: 0.12,
    noiseFreq: [1.3, 1.0],
    noiseRadius: 0.7,
    drapeAmp: 0.03,
    drapeSigma: 0.2,
    drapeCycles: 1,
    sag: 0.04,
  },
};

/** Mesh subdivision along the flag's long axis. High enough that fold crests
 *  do not facet at 4K. */
export const SEGMENTS: Record<Framing, number> = {
  pole: 420,
  closeup: 540,
};

export const FLAG_WORLD_HEIGHT = 1.0;
