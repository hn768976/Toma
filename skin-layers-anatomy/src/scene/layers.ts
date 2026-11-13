/** Half-size of the square skin block in world units. */
export const HALF = 2;

const wave = (x: number, z: number, p: number, amp: number) =>
  amp *
  (0.55 * Math.sin(1.9 * x + p) * Math.cos(1.5 * z + p * 1.7) +
    0.3 * Math.sin(3.4 * x + 2.6 * z + p * 2.3) +
    0.15 * Math.cos(5.3 * z - 4.1 * x + p * 0.7));

/** Interfaces between layers, bottom to top, in the stacked state. */
export const interfaces: ((x: number, z: number) => number)[] = [
  () => -1.05,
  (x, z) => -0.82 + wave(x, z, 0.4, 0.06),
  (x, z) => -0.58 + wave(x, z, 2.1, 0.1),
  (x, z) => 0.3 + wave(x, z, 4.4, 0.14),
  (x, z) => 0.37 + wave(x, z, 4.5, 0.15),
  (x, z) => 0.68 + wave(x, z, 1.2, 0.04),
  (x, z) => 0.78 + wave(x, z, 3.3, 0.022),
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
  { id: "muscle", index: 0, offset: -1.0, y0: -1.05, y1: -0.82 },
  { id: "hypodermis", index: 1, offset: -0.81, y0: -0.82, y1: -0.58 },
  { id: "dermis", index: 2, offset: -0.62, y0: -0.58, y1: 0.3 },
  { id: "basal", index: 3, offset: -0.41, y0: 0.3, y1: 0.37 },
  { id: "squamous", index: 4, offset: -0.26, y0: 0.37, y1: 0.68 },
  { id: "corneum", index: 5, offset: 0, y0: 0.68, y1: 0.78 },
];

export const layerById = (id: LayerId) => LAYERS.find((l) => l.id === id)!;
