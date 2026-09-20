/**
 * Master delivery spec.
 *
 * Compositions are authored natively at 4K (3840x2160). The 1080p deliverable is
 * produced from the SAME composition with `--scale=0.5`, so there is exactly one
 * source of truth for layout and motion.
 */
export const FPS = 30;

/** Native authoring resolution. */
export const WIDTH_4K = 3840;
export const HEIGHT_4K = 2160;

/** Reference durations, converted to whole frames at 30fps. */
export const DURATION = {
  slab: 360, // 12.00s  (ref A - istock 2199961880, 12.000s)
  cylinder: 360, // 12.00s  (ref B - istock 2199961442, 12.000s)
  wideDisc: 1200, // 40.00s  (ref C - istock 1138641437, 40.040s)
  glassBeam: 600, // 20.00s  (ref D - istock 1487257611, 20.033s)
  ringed: 600, // 20.00s  (ref E - istock 1487260677, 20.033s)
} as const;
