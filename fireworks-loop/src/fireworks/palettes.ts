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
    orange: { hot: [255, 120, 44], main: [255, 78, 18], end: [180, 34, 10] },
    gold: { hot: [255, 160, 70], main: [255, 118, 30], end: [196, 66, 14] },
    red: { hot: [255, 110, 70], main: [232, 48, 24], end: [146, 18, 12] },
    pink: { hot: [255, 140, 160], main: [255, 66, 96], end: [180, 26, 64] },
    amber: { hot: [255, 136, 56], main: [255, 98, 24], end: [180, 46, 12] },
  },
  arctic: {
    orange: { hot: [150, 224, 255], main: [52, 182, 255], end: [24, 78, 210] },
    gold: { hot: [226, 238, 255], main: [196, 222, 255], end: [92, 120, 230] },
    red: { hot: [196, 160, 255], main: [150, 88, 255], end: [86, 36, 196] },
    pink: { hot: [150, 255, 214], main: [56, 240, 176], end: [16, 136, 120] },
    amber: { hot: [240, 170, 255], main: [222, 104, 255], end: [120, 40, 200] },
  },
};
