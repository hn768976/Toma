// Two colour grades for the same motion.
//
// `blue` is the reference grade: a cyan/blue bundle with a white-hot core and
// a minority of magenta-violet strands. `violet` inverts those roles — violet
// carries the bundle and cyan drops back to being the accent.

export type StreakPalette = {
  /** Radial background, centre colour first. */
  backdrop: [string, string];
  /** Big soft bloom that sits behind the ribbon. */
  bloom: string;
  /** Strands at the very centre of the bundle — these read as white-hot. */
  core: string[];
  /** Just off centre. */
  inner: string[];
  /** The body of the bundle. */
  mid: string[];
  /** Strands at the edge of the bundle, darkest and thinnest. */
  outer: string[];
  /** Minority hue, sprinkled across the whole bundle. */
  accent: string[];
  /** Share of strands that get an accent colour instead of their band colour. */
  accentChance: number;
};

export const PALETTES = {
  blue: {
    backdrop: ["#030718", "#010208"],
    bloom: "#1633c8",
    core: ["#FFFFFF", "#EAF4FF", "#CFE6FF"],
    inner: ["#8FD8FF", "#5EC6FF", "#43B4FF", "#E6F2FF"],
    mid: ["#2E8CFF", "#2A63FF", "#3D7BFF", "#1F4BF5"],
    outer: ["#1B34D6", "#2A22C8", "#1226A8", "#3A1FE0"],
    accent: ["#C64BFF", "#FF3DC8", "#8B3BFF", "#FF66E0"],
    accentChance: 0.16,
  },
  violet: {
    backdrop: ["#0b031b", "#040109"],
    bloom: "#6a18d8",
    core: ["#FFFFFF", "#F6EAFF", "#E7D2FF"],
    inner: ["#E0A8FF", "#CE84FF", "#B75FFF", "#F3E4FF"],
    mid: ["#9B3CFF", "#8A24F5", "#A855FF", "#7A1BE8"],
    outer: ["#5A14C8", "#4310A8", "#6B1FD6", "#3A0F9E"],
    accent: ["#35D6FF", "#5BE9FF", "#2AA8FF", "#8FF2FF"],
    accentChance: 0.16,
  },
} satisfies Record<string, StreakPalette>;

export type PaletteName = keyof typeof PALETTES;
