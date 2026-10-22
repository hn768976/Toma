export type Rgb = [number, number, number];

export type BlobPalette = {
  // Backdrop for the first and second half of the video.
  backgroundA: Rgb;
  backgroundB: Rgb;
  // Fresnel rim colour, sampled along a cosine gradient by viewing angle
  // when iridescence > 0; a flat rimBase colour otherwise.
  rimBase: Rgb;
  rimShift: Rgb;
  iridescence: number;
  // Faint light caught inside the blob (internal folds / back surface).
  interior: Rgb;
};

const hex = (h: string): Rgb => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// Monochrome glass over black, then over green screen (sampled from the
// reference: #30FF09).
export const REFERENCE_PALETTE: BlobPalette = {
  backgroundA: hex("#000000"),
  backgroundB: hex("#30FF09"),
  rimBase: hex("#FFFFFF"),
  rimShift: [0, 0, 0],
  iridescence: 0,
  interior: hex("#FFFFFF"),
};

// Soap-film iridescence (cyan -> violet -> rose) over deep midnight, then
// over a blue chroma-key backdrop.
export const IRIDESCENT_PALETTE: BlobPalette = {
  backgroundA: hex("#05071A"),
  backgroundB: hex("#0047BB"),
  rimBase: hex("#B8F4FF"),
  rimShift: [0.0, 0.33, 0.67],
  iridescence: 1,
  interior: hex("#9FB8FF"),
};
