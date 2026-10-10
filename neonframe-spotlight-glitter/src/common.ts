import { useRemotionEnvironment } from "remotion";

/** Canonical composition size (4K). Previews are rendered with --scale=1/3. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** 20 s seamless loop: frame LOOP_FRAMES === frame 0. */
export const LOOP_FRAMES = 600;

/**
 * Loop-safe frame: every animated value in this project is a function of
 * this integer only (never of wall-clock time, never of previous frames).
 * Wrapping before use guarantees frame 600 is bit-identical to frame 0.
 */
export const loopFrame = (frame: number): number => frame % LOOP_FRAMES;

/** Seeded PRNG. Always seed at module level, never use Math.random(). */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Pixel ratio for the GL backing store.
 * Remotion's `--scale` sets devicePixelRatio, so a 3840x2160 composition
 * rendered at --scale=1/3 does 1280x720 worth of GPU work. In the Studio
 * we cap it at 0.5 so the preview stays responsive.
 */
export const useBackingScale = (): number => {
  const { isRendering } = useRemotionEnvironment();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return isRendering ? dpr : Math.min(dpr, 0.5);
};

/** GLSL: hash + dither/grain, shared by every look (deterministic, frame-driven). */
export const GLSL_GRAIN = /* glsl */ `
float hash13(vec3 p3) {
  p3 = fract(p3 * .1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
// Final pass: +-1/255 dither plus film grain, from pixel position and loop frame only.
// grain = peak-to-peak amplitude (0.015 == 1.5 %).
vec3 ditherGrain(vec3 c, vec2 fragCoord, float lf, float grain) {
  vec3 q = vec3(fragCoord, lf);
  float g = hash13(q) + hash13(q + vec3(17.7, 3.1, 91.3)) - 1.0;          // triangular, -1..1
  float d = hash13(q + vec3(5.3, 71.9, 13.7)) + hash13(q + vec3(61.1, 9.7, 29.3)) - 1.0;
  return c + vec3(g * grain * 0.5 + d / 255.0);
}
`;
