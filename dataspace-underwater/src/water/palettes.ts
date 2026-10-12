// ─────────────────────────────────────────────────────────────────────────────
// Water colourways — ONE DATA ROW PER VERSION.
// To add a colourway, add a row here. Root.tsx registers an UnderwaterBubbles-<Key>
// and an UnderwaterRays-<Key> composition for every row automatically.
// ─────────────────────────────────────────────────────────────────────────────

export type WaterPalette = {
  /** Bottom / corners. */
  deep: string;
  /** Middle water. */
  mid: string;
  /** Lit water under the sun. */
  top: string;
  /** God-ray colour. */
  rays: string;
  /** Ray brightness multiplier (Turquoise is brighter). */
  rayGain: number;
  /** Sun patch / Snell's window colour (usually near-white). */
  sun: string;
  /** Bubble rim tint. */
  bubble: string;
};

export const WATER_PALETTES = {
  DeepBlue: {
    deep: "#04122E",
    mid: "#0A3A6A",
    top: "#4AA8C8",
    rays: "#C8F0FF",
    rayGain: 1.0,
    sun: "#E8FAFF",
    bubble: "#E4F4FF",
  },
  Turquoise: {
    deep: "#063A4A",
    mid: "#0A8A9A",
    top: "#8AF0E8",
    rays: "#F8FFF0",
    rayGain: 1.3,
    sun: "#FCFFF4",
    bubble: "#F0FFFA",
  },
} satisfies Record<string, WaterPalette>;

export type WaterPaletteKey = keyof typeof WATER_PALETTES;

export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
