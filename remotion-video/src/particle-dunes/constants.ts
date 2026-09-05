import { FIELD_PERIOD } from "./field";

// Composition is authored at 4K so it can be rendered at full size later; the
// deliverable preview is the same composition at --scale=0.5.
export const FPS = 30;
export const DURATION_IN_FRAMES = 450; // 15s
export const BASE_WIDTH = 3840;
export const BASE_HEIGHT = 2160;

// --- Camera ---------------------------------------------------------------
// Low, close, and tipped down just enough that the dune field runs off the top
// of frame. The camera never orbits or rises: over the loop it travels exactly
// one FIELD_PERIOD forward, which is the shortest travel that still closes the
// loop, and therefore the slowest possible drift for this field.
export const FOV_Y = 42;
// A fine sweep of the field (300x300 over the tile, 30 phases) puts the
// highest crest at 0.741 and the fuzz adds FUZZ_HEIGHT on top, so the camera
// clears the terrain everywhere in the loop without ever having to rise.
export const CAMERA_HEIGHT = 0.88;
export const CAMERA_PITCH_DEG = -21.5;
export const CAMERA_NEAR = 0.04;
export const CAMERA_FAR = 40;

// --- Extent of the particle band ------------------------------------------
// Ground distance ahead of the camera. The band is exactly one FIELD_PERIOD
// deep so a particle that falls off the near edge can be pushed back a whole
// period and land on identical terrain.
export const G_NEAR = 0.08;
export const G_FAR = G_NEAR + FIELD_PERIOD;

/**
 * Widest |x| / ground-distance ratio of any ray through the frame. Not simply
 * tan(fovX/2): the pitched-down corner rays reach the ground sooner than they
 * spread sideways, so they need proportionally more width than the centre.
 */
export const CORNER_SLOPE = (() => {
  const sx = Math.tan((FOV_Y * Math.PI) / 360) * (BASE_WIDTH / BASE_HEIGHT);
  const sy = Math.tan((FOV_Y * Math.PI) / 360);
  const p = (CAMERA_PITCH_DEG * Math.PI) / 180;
  // Bottom corner ray (camera space (sx, -sy, -1)) rotated by the pitch. Along
  // it, x grows as sx*t and ground distance as |dz|*t, so the ratio is theirs.
  const dz = -sy * Math.sin(p) - Math.cos(p);
  return sx / Math.abs(dz);
})();

/** Half-width of the sampled strip. Wide enough for the frame corners. */
export const HALF_WIDTH = G_FAR * CORNER_SLOPE * 1.04;

// --- Particles ------------------------------------------------------------
export const PARTICLE_COUNT = 2_000_000;

/** Subdivisions of the mesh that MeshSurfaceSampler scatters particles over. */
export const SAMPLER_SEGMENTS_X = 240;
export const SAMPLER_SEGMENTS_Z = 170;

/** Height of the fuzzy skin of particles standing above the surface. */
export const FUZZ_HEIGHT = 0.072;
/** >1 packs particles toward the surface, leaving a soft thinning top. */
export const FUZZ_EXPONENT = 2.1;

/** Particle diameter in 4K pixels at REF_DEPTH, falling off with distance. */
export const GRAIN_PX_4K = 3.6;
export const REF_DEPTH = 4.0;
/** Sink the occluder surface slightly so no particle z-fights with it. */
export const OCCLUDER_SINK = 0.018;

/**
 * How brightly the occluder shell is shaded, relative to the particle layer.
 *
 * Particle density is uniform in world space, so the near field covers almost
 * no world area and ends up with only a few hundred grains spread across the
 * bottom of frame -- which, once the depth of field opens them into wide
 * discs, reads as floating confetti rather than a dune. Shading the shell
 * gives the dunes a body for the grain to sit on, the way the reference does.
 * Held well below the particle layer so the grain stays the subject.
 */
export const BASE_STRENGTH = 0.075;

// --- Depth of field -------------------------------------------------------
// Thin-lens circle of confusion: coc = COC_K * |1/d - 1/focus|, in 4K pixels.
// Strong enough that the nearest crest dissolves into soft grain and the far
// dunes soften again, with a sharp band in between.
export const FOCUS_DISTANCE = 5.0;
export const COC_K = 190;
export const COC_MAX_PX_4K = 150;

// --- Falloff --------------------------------------------------------------
/** The far field falls into darkness well before the geometry runs out, so
 *  there is never a visible horizon or a hard edge to the field. */
export const FOG_START = 6.2;
export const FOG_END = 11.0;
/** Fade across the wrap seams so no particle pops in or out. */
export const WRAP_FADE = 0.28;

// --- Light and shading ----------------------------------------------------
export const LIGHT_DIR: readonly [number, number, number] = [-0.66, 0.62, 0.42];
export const AMBIENT = 0.36;
export const DIFFUSE = 0.85;
export const LIGHT_EXPONENT = 1.15; // steepens the terminator; darkens lee slopes
export const RIM_STRENGTH = 0.1;
/**
 * Seen edge-on, a view ray passes through a long stretch of the particle skin
 * and additive blending sums every grain it crosses, so crest silhouettes pile
 * up into blown-out wires. Weighting each grain by how squarely its surface
 * faces the camera cancels that 1/cos falloff and makes the field read as a lit
 * surface again. Held below 1 so the crests keep some of their glow.
 */
export const GRAZE_COMPENSATION = 1.0;
export const OVERDRIVE = 0.22; // how hard the brightest crests clip
export const EXPOSURE = 4.6;

// --- Shimmer --------------------------------------------------------------
export const SHIMMER_FRACTION = 0.14;
export const SHIMMER_AMOUNT = 0.55;
/** Must be a whole number of cycles per loop. */
export const SHIMMER_CYCLES = 6;

// --- Bloom ----------------------------------------------------------------
// Restrained: enough to give the lit crests a halo, not enough to melt the
// grain into a smooth surface. Applied as a backdrop filter whose brightness
// and contrast act as a soft bright-pass before the blur, so only the crests
// bloom and the troughs stay clean. Radii are in composition (4K) pixels, so
// the effect scales with --scale automatically.
export const BLOOM_BLUR_PX_4K = 30;
export const BLOOM_BRIGHTNESS = 1.75;
export const BLOOM_CONTRAST = 2.9;
export const BLOOM_OPACITY = 0.3;

// --- Grain ----------------------------------------------------------------
export const GRAIN_AMOUNT = 0.021;

export type DunePalette = {
  readonly background: readonly [number, number, number];
  readonly shadow: readonly [number, number, number];
  readonly mid: readonly [number, number, number];
  readonly lit: readonly [number, number, number];
};

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

export const PALETTES = {
  cyan: {
    background: rgb("#020a0e"),
    shadow: rgb("#0a4a5a"),
    mid: rgb("#22b8d0"),
    lit: rgb("#a8f0ff"),
  },
  sand: {
    background: rgb("#0a0602"),
    shadow: rgb("#5a3a10"),
    mid: rgb("#d09a3a"),
    lit: rgb("#ffe0a0"),
  },
} satisfies Record<string, DunePalette>;

export type PaletteName = keyof typeof PALETTES;
