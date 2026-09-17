export const FPS = 30;
export const DURATION_IN_FRAMES = 300; // 10s
export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;

export type Framing = 'pole' | 'closeup';

/**
 * Motion blur. Remotion has no built-in shutter sampling, so this is done by
 * rendering several sub-frames per output frame and averaging them
 * (scripts/render-motion-blur.mjs). A 180-degree shutter means the samples
 * span half a frame interval.
 */
export const SHUTTER_ANGLE = 0.5; // fraction of a frame the shutter is open
export const SHUTTER_SAMPLES = 3; // sub-frames averaged per output frame

/**
 * Wave parameters per version. Every temporal cycle count (n1, n2, n3,
 * nFlutter, nCurl, nEdge) must stay an INTEGER — that, plus the noise being
 * sampled on a circle in time and the gust using whole-number cycles, is what
 * closes the loop at frame 300. Amplitudes are in flag-heights, so they are
 * independent of each country's aspect ratio.
 */
export type WaveParams = {
  /** Envelope exponent. ~2 = quadratic: the outer third does most of the moving. */
  envPow: number;
  amp1: number; k1: number; n1: number;
  amp2: number; k2: number; n2: number; theta: number;
  /** High-frequency, low-amplitude ripple riding on the broad folds. */
  amp3: number; k3: number; n3: number; theta3: number;
  ampN: number; noiseFreq: [number, number]; noiseRadius: number;
  /** Faster movement weighted toward the free edge. */
  ampFlutter: number; kFlutter: number; nFlutter: number; flutterStart: number;
  /** The last ~10% of the width rolling forward and back. */
  ampCurl: number; kCurl: number; nCurl: number; curlStart: number;
  /** 0 = pure sines, 1 = fully pushed toward the extremes (sharp creases). */
  sharpen: number;
  /** Depth of the slow surge-and-settle. */
  gustDepth: number;
  drapeAmp: number; drapeSigma: number; drapeCycles: number;
  /** Arcs the top edge and sags the bottom edge out of phase with it. */
  edgeAmp: number; kEdge: number; nEdge: number;
  /** Downward sag at the attachment, heaviest at the bottom corner. */
  poleSag: number; poleSagWidth: number;
  /** Gravity, growing toward the free edge. */
  sag: number;
};

export const WAVE: Record<Framing, WaveParams> = {
  // Medium shot: quicker, tighter, more creased.
  pole: {
    envPow: 2.0,
    amp1: 0.095, k1: 1.9, n1: 3,
    amp2: 0.04, k2: 3.0, n2: 5, theta: (30 * Math.PI) / 180,
    amp3: 0.013, k3: 4.8, n3: 8, theta3: (-35 * Math.PI) / 180,
    ampN: 0.038, noiseFreq: [2.4, 0.85], noiseRadius: 0.9,
    ampFlutter: 0.016, kFlutter: 3.6, nFlutter: 9, flutterStart: 0.55,
    ampCurl: 0.014, kCurl: 1.6, nCurl: 4, curlStart: 0.92,
    sharpen: 0.35,
    gustDepth: 0.22,
    drapeAmp: 0.04, drapeSigma: 0.14, drapeCycles: 3,
    edgeAmp: 0.045, kEdge: 1.3, nEdge: 2,
    poleSag: 0.075, poleSagWidth: 0.06,
    sag: 0.045,
  },
  // Close-up: larger folds, slower travel, so it reads as a detail.
  closeup: {
    envPow: 2.0,
    amp1: 0.1, k1: 1.2, n1: 1,
    amp2: 0.045, k2: 2.0, n2: 2, theta: (28 * Math.PI) / 180,
    amp3: 0.014, k3: 3.6, n3: 4, theta3: (-30 * Math.PI) / 180,
    ampN: 0.042, noiseFreq: [1.5, 0.65], noiseRadius: 0.7,
    ampFlutter: 0.012, kFlutter: 2.6, nFlutter: 5, flutterStart: 0.55,
    ampCurl: 0.012, kCurl: 1.3, nCurl: 2, curlStart: 0.92,
    sharpen: 0.32,
    gustDepth: 0.2,
    drapeAmp: 0.035, drapeSigma: 0.18, drapeCycles: 2,
    edgeAmp: 0.04, kEdge: 1.0, nEdge: 1,
    poleSag: 0.06, poleSagWidth: 0.07,
    sag: 0.04,
  },
};

/** Mesh subdivision along the flag's long axis. High enough that the sharpened
 *  fold crests do not facet at 4K. */
export const SEGMENTS: Record<Framing, number> = {
  pole: 480,
  closeup: 560,
};

export const FLAG_WORLD_HEIGHT = 1.0;

/**
 * Spatial frequencies are quoted for a 3:2 flag and scaled by aspect/1.5 at
 * build time, so a fold is the same size in world units on a square Swiss flag
 * as on a 1:2 Canadian one. Without this, narrow flags get proportionally
 * finer folds AND steeper flanks, and a flank steep enough to turn edge-on
 * compresses the texture into an unreadable sliver.
 */
export const REFERENCE_ASPECT = 1.5;

/** The close-up needs a denser texture than the pole shot: at 4K the fabric
 *  fills the frame, so the emblem is sampled near 1:1. */
export const TEXTURE_TIER: Record<Framing, '4k' | '8k'> = {
  pole: '4k',
  closeup: '8k',
};
