// Composition geometry. The piece is authored at 4K; every size below is a
// fraction of the frame width so the same source renders identically at
// 1920x1080 (--scale=0.5) and 3840x2160 (--scale=1).
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 360; // 12s at 30fps, seamless loop

export const TAU = Math.PI * 2;

// --- Ribs -----------------------------------------------------------------
// 64 divides 3840, 1920, 960 and 480, so a rib boundary always lands on a
// whole pixel at preview *and* at 4K. That is what keeps the pattern from
// beating against the pixel grid (moire) when the frame is downscaled.
export const RIB_COUNT = 64;

// Fraction of one rib pitch that is the dark gap between two rib faces.
// The reference reads as separate glass ribs, not as a continuous ripple,
// and this gap is what does that.
export const RIB_GAP = 0.16;

// Where inside its own lit face a rib carries its highlight (0 = left edge,
// 1 = right edge). Past centre, so the shading ramps up slowly and falls off
// sharply - the asymmetry is what reads as a convex surface.
export const HIGHLIGHT_POSITION = 0.6;
export const LENS_POWER = 1.2;

// Thin near-black line exactly on the rib boundary.
export const EDGE_FRACTION = 0.05; // of one rib pitch
export const EDGE_FLOOR = 0; // brightness left exactly on the boundary

// Thin bright specular line at the highlight position.
export const SPEC_FRACTION = 0.028; // core half-width, of one rib pitch
export const SPEC_HALO_SCALE = 5; // soft flare around the core
export const SPEC_HALO_WEIGHT = 0.3;
export const SPEC_GAIN = 0.5; // specular folded into the multiply pass
export const HOT_GAIN = 0.5; // extra additive pass for the hottest cores

// --- Light layer ----------------------------------------------------------
// The blooms are drawn small and scaled up: bilinear upscaling from 480px
// wide is itself a very wide, very cheap blur, and it cannot band.
export const LIGHT_LAYER_WIDTH = 480;
export const LIGHT_LAYER_HEIGHT = 270;
export const LIGHT_BLUR_FRACTION = 0.02; // of the light layer width
export const AMBIENT_LIGHT = 0.014; // light that survives in the rib troughs

// --- Finishing ------------------------------------------------------------
export const WASH_EDGE = 0.58; // vertical depth wash at the very top/bottom
export const BLOOM_DOWNSCALE = 4;
export const BLOOM_BLUR = 4; // px, at the downscaled size
export const BLOOM_STRENGTH = 0.1;

export const GRAIN_TILE_SIZE = 512;
export const GRAIN_TILE_COUNT = 6; // divides 360, so the grain loops too
export const GRAIN_AMPLITUDE = 8; // 0..8 of 255 -> ~1.5% mean-centred grain
