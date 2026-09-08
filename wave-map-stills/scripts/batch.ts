import type {PaletteName} from "../src/lib/palettes.ts";

/**
 * Each composition gets its own palette PAIR, so the set of 24 does not read as
 * twelve blues and twelve greens.
 */
export const BATCH: {
  composition: string;
  palettes: [PaletteName, PaletteName];
}[] = [
  {composition: "c01", palettes: ["blue", "amber"]},
  {composition: "c02", palettes: ["cyan", "violet"]},
  {composition: "c03", palettes: ["green", "slate"]},
  {composition: "c04", palettes: ["amber", "blue"]},
  {composition: "c05", palettes: ["violet", "cyan"]},
  {composition: "c06", palettes: ["slate", "green"]},
  {composition: "c07", palettes: ["violet", "green"]},
  {composition: "c08", palettes: ["blue", "slate"]},
  {composition: "c09", palettes: ["amber", "cyan"]},
  {composition: "c10", palettes: ["slate", "violet"]},
  {composition: "c11", palettes: ["green", "blue"]},
  {composition: "c12", palettes: ["cyan", "amber"]},
];

export type Job = {
  composition: string;
  palette: PaletteName;
  /** Derived from the composition and palette: reproducible, and unique per still. */
  seed: string;
  name: string;
};

export const jobs = (): Job[] =>
  BATCH.flatMap((entry) =>
    entry.palettes.map((palette) => ({
      composition: entry.composition,
      palette,
      seed: `${entry.composition}-${palette}`,
      name: `wavemap-${entry.composition}-${palette}.png`,
    })),
  );
