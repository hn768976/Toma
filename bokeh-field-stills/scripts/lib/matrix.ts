/**
 * The batch: 6 palettes x 3 densities x 2 focus bands = 36 stills.
 *
 * Each output's seed is derived from its own parameters, so every image in
 * the set is different, and any single one can be re-rendered later from its
 * filename alone.
 */
export const PALETTES = ["cyan", "blue", "green", "amber", "violet", "magenta"] as const;
export const DENSITIES = ["sparse", "medium", "dense"] as const;
export const FOCUS_BANDS = [0.35, 0.65] as const;

export type Variant = {
  name: string;
  file: string;
  props: {
    seed: string;
    palette: (typeof PALETTES)[number];
    density: (typeof DENSITIES)[number];
    focusBand: number;
    orientation: "landscape";
  };
};

/** 0.35 -> "35". Keeps filenames short and sortable. */
export const focusTag = (focusBand: number) => String(Math.round(focusBand * 100)).padStart(2, "0");

export const buildMatrix = (): Variant[] => {
  const variants: Variant[] = [];
  for (const palette of PALETTES) {
    for (const density of DENSITIES) {
      for (const focusBand of FOCUS_BANDS) {
        const name = `bokeh-${palette}-${density}-f${focusTag(focusBand)}`;
        variants.push({
          name,
          file: `${name}.png`,
          // The seed is the variant's own identity: reproducible, and unique
          // per output so no two images in the set share a layout.
          props: { seed: name, palette, density, focusBand, orientation: "landscape" },
        });
      }
    }
  }
  return variants;
};
