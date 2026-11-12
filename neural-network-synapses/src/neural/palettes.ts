export type Palette = {
  name: string;
  /** CSS colour behind the canvas (also the fog colour, in sRGB). */
  css: string;
  /** Linear-light colours. */
  fog: [number, number, number];
  body: [number, number, number];
  rim: [number, number, number];
  spec: [number, number, number];
  signal: [number, number, number];
  signalCore: [number, number, number];
  tint: [number, number, number];
  lift: [number, number, number];
  saturation: number;
};

/** Version 1 – matches the reference: silver glass neurons, cyan impulses. */
export const REFERENCE_PALETTE: Palette = {
  name: "Silver / Cyan (reference)",
  css: "#05080e",
  fog: [0.0003, 0.0006, 0.0014],
  body: [0.07, 0.084, 0.108],
  rim: [0.62, 0.69, 0.78],
  spec: [0.92, 0.96, 1.0],
  signal: [0.02, 0.5, 1.0],
  signalCore: [0.35, 0.85, 1.0],
  tint: [0.97, 1.0, 1.05],
  lift: [0.0, 0.0002, 0.0006],
  saturation: 1.0,
};

/** Version 2 – alternative palette: rose-gold glass, amber/orange impulses. */
export const EMBER_PALETTE: Palette = {
  name: "Rose-gold / Amber",
  css: "#0d0509",
  fog: [0.0014, 0.0004, 0.0008],
  body: [0.085, 0.045, 0.062],
  rim: [0.74, 0.46, 0.44],
  spec: [1.0, 0.9, 0.8],
  signal: [1.0, 0.36, 0.035],
  signalCore: [1.0, 0.86, 0.5],
  tint: [1.06, 0.98, 0.95],
  lift: [0.0006, 0.0, 0.0003],
  saturation: 1.05,
};
