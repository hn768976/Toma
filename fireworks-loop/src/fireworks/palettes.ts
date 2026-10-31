export type RGB = readonly [number, number, number];

/** A shell colour: hot (just after the break), main body, and burned-out end. */
export type ShellColor = { hot: RGB; main: RGB; end: RGB };

export type ShellColorName = "orange" | "gold" | "red" | "pink" | "amber";

export type PaletteName = "classic" | "arctic";

/**
 * classic — the warm orange / gold / red / pink look of the reference.
 * arctic  — Version 2 alternative palette: icy cyan, silver-blue, violet,
 *           emerald and orchid. Same shells, same choreography, new colours.
 */
export const PALETTES: Record<PaletteName, Record<ShellColorName, ShellColor>> = {
  classic: {
    orange: { hot: [255, 140, 52], main: [255, 92, 24], end: [186, 38, 12] },
    gold: { hot: [255, 190, 96], main: [255, 146, 40], end: [204, 84, 20] },
    red: { hot: [255, 140, 92], main: [236, 58, 30], end: [150, 22, 14] },
    pink: { hot: [255, 168, 184], main: [255, 78, 108], end: [184, 30, 70] },
    amber: { hot: [255, 160, 70], main: [255, 122, 36], end: [184, 56, 16] },
  },
  arctic: {
    orange: { hot: [150, 224, 255], main: [52, 182, 255], end: [24, 78, 210] },
    gold: { hot: [226, 238, 255], main: [196, 222, 255], end: [92, 120, 230] },
    red: { hot: [196, 160, 255], main: [150, 88, 255], end: [86, 36, 196] },
    pink: { hot: [150, 255, 214], main: [56, 240, 176], end: [16, 136, 120] },
    amber: { hot: [240, 170, 255], main: [222, 104, 255], end: [120, 40, 200] },
  },
};
