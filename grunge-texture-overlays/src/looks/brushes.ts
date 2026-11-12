import * as brush from "p5.brush/standalone";

/**
 * Custom p5.brush brushes. Registered at module load, before the engine applies its resolution
 * scale (scaleBrushes), so they scale with the frame like the built-in ones.
 * Weight 1 = 1 px at scale 1, i.e. (frame height / 360) px once scaled.
 */
brush.add("inkBristle", {
  type: "default",
  weight: 1,
  scatter: 0.06,
  sharpness: 0.45,
  grain: 1.6,
  opacity: 140,
  spacing: 0.05,
  pressure: { curve: [0.15, 0.2], min_max: [1, 0.85] },
});
brush.add("charStick", {
  type: "default",
  weight: 1,
  scatter: 0.25,
  sharpness: 0.35,
  grain: 3.5,
  opacity: 150,
  spacing: 0.04,
  pressure: { curve: [0.2, 0.3], min_max: [1.05, 0.9] },
});

/** set() weight for a custom brush of width `px` (custom brushes: weight 1 = H/360 px). */
export const customWeight = (H: number, px: number) => px / (H / 360);
