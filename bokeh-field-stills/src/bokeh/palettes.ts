/**
 * The only place in this project where a hex literal is allowed.
 *
 * Every palette is: one near-black `background`, then four element tones
 * ordered dimmest -> brightest. Far elements are tinted toward tone 0,
 * near ones toward tone 3, so the four tones have to span a real
 * luminance range or the field renders as a flat wash.
 */
export const PALETTES = {
  cyan: {
    background: "#01080E",
    tones: ["#14506B", "#2E9FC4", "#5FD4F5", "#D8F8FF"],
  },
  blue: {
    background: "#020818",
    tones: ["#143A78", "#2E6FD4", "#5F9FF5", "#D8E8FF"],
  },
  green: {
    background: "#010F08",
    tones: ["#14603A", "#2EA86B", "#5FE8A0", "#D8FFE8"],
  },
  amber: {
    background: "#0F0802",
    tones: ["#6B4014", "#C4802E", "#F5B85F", "#FFE8C8"],
  },
  violet: {
    background: "#0A0418",
    tones: ["#3A1478", "#6F2EC4", "#A85FF5", "#E8D8FF"],
  },
  magenta: {
    background: "#10020A",
    tones: ["#6B1448", "#C42E80", "#F55FB0", "#FFD8EC"],
  },
} as const;

export type PaletteName = keyof typeof PALETTES;

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];
