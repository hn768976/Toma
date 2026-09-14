// Render order for the series. Kept beside the render script so it can
// be read without pulling TypeScript through a loader.
//
// Each version ships as two clips: the colour pass, and its matte as a
// standalone file of the same length, keyed to it frame for frame.
export const VERSION_IDS = [
  "Bacteria01ElectricCyan",
  "Bacteria02VioletCluster",
  "Bacteria03PaleBlueSoftFocus",
  "Bacteria04SaturatedCobalt",
  "Bacteria05IndigoDrift",
  "Bacteria06MagentaBloom",
  "Bacteria07GoldenField",
  "Bacteria08LavenderProbiotic",
  "Bacteria09BrightfieldGrey",
  "Bacteria10CrimsonSalmonella",
  "Bacteria11SteelTeal",
];

// Colour first, so the eleven picture clips land before the keys.
export const PRESET_IDS = [
  ...VERSION_IDS,
  ...VERSION_IDS.map((id) => `${id}Matte`),
];
