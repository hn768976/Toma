/** Half-size of the square skin block in world units. */
export const HALF = 2;

/** Organic undulation: `f` scales the spatial frequency, `amp` the height. */
const wave = (x: number, z: number, p: number, amp: number, f = 1) =>
  amp *
  (0.5 * Math.sin(1.9 * f * x + p) * Math.cos(1.5 * f * z + p * 1.7) +
    0.32 * Math.sin(3.4 * f * x + 2.6 * f * z + p * 2.3) +
    0.18 * Math.cos(5.3 * f * z - 4.1 * f * x + p * 0.7));

/** Interfaces between layers, bottom to top, in the stacked state. */
export const interfaces: ((x: number, z: number) => number)[] = [
  () => -1.05,
  (x, z) => -0.8 + wave(x, z, 0.4, 0.085, 1.25), // muscle / adipose
  (x, z) => -0.5 + wave(x, z, 2.1, 0.15, 1.15), // adipose / dermis (lobed)
  (x, z) => 0.33 + wave(x, z, 4.4, 0.2, 1.55), // dermis / basal (ridged)
  (x, z) => 0.39 + wave(x, z, 4.45, 0.21, 1.55), // basal / squamous
  (x, z) => 0.71 + wave(x, z, 1.2, 0.035), // squamous / corneum
  (x, z) => 0.78 + wave(x, z, 1.25, 0.035), // skin surface
];

export type LayerId =
  | "muscle"
  | "hypodermis"
  | "dermis"
  | "basal"
  | "squamous"
  | "corneum";

export type LayerDef = {
  id: LayerId;
  /** index of bottom interface; top is index + 1 */
  index: number;
  /** vertical travel when fully exploded (the top sheet stays put) */
  offset: number;
  /** mean y of bottom / top in the stacked state */
  y0: number;
  y1: number;
};

export const LAYERS: LayerDef[] = [
  { id: "muscle", index: 0, offset: -1.0, y0: -1.05, y1: -0.8 },
  { id: "hypodermis", index: 1, offset: -0.81, y0: -0.8, y1: -0.5 },
  { id: "dermis", index: 2, offset: -0.62, y0: -0.5, y1: 0.33 },
  { id: "basal", index: 3, offset: -0.41, y0: 0.33, y1: 0.39 },
  { id: "squamous", index: 4, offset: -0.26, y0: 0.39, y1: 0.71 },
  { id: "corneum", index: 5, offset: 0, y0: 0.71, y1: 0.78 },
];

export const layerById = (id: LayerId) => LAYERS.find((l) => l.id === id)!;
