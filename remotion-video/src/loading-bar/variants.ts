import type { Waypoint } from "./lib/curve";

/**
 * The single source of truth for everything that differs between the
 * three clips. Nothing else in the piece may contain a hex literal or a
 * word string: the construction is deliberately identical across
 * variants, and the only axes of difference are palette, word and fill
 * rhythm.
 */
export type VariantName = "upload" | "download" | "process";

export type Palette = {
  backdropDeep: string;
  backdropMottle: string;
  barOutline: string;
  barCore: string;
  fill: string;
  fillBright: string;
  word: string;
  wordCore: string;
  spark: string;
};

export type Variant = {
  word: string;
  /**
   * Cap height as a fraction of frame height. Tuned per word so all
   * three occupy roughly the same width: "DOWNLOADING" is eleven
   * characters against "UPLOADING"'s nine, so it is set smaller.
   */
  capHeightRatio: number;
  palette: Palette;
  curve: Waypoint[];
  /**
   * How strongly each curve segment eases in and out: 1 is a full
   * ease-in-out (pronounced stalls), 0 is straight linear.
   */
  ease: number;
  /** Transfer bars usually show no number; a processing bar does. */
  showPercent: boolean;
};

export const VARIANTS: Record<VariantName, Variant> = {
  upload: {
    word: "UPLOADING",
    capHeightRatio: 0.13,
    palette: {
      backdropDeep: "#050F2E",
      backdropMottle: "#0F2450",
      barOutline: "#7FD4FF",
      barCore: "#FFFFFF",
      fill: "#2EA8F5",
      fillBright: "#A8E4FF",
      word: "#4FC4FF",
      wordCore: "#E8F8FF",
      spark: "#C8E8FF",
    },
    // "steady": climbs in even steps, with a slow crawl, a second
    // plateau and the classic near-the-end stall at 94%.
    curve: [
      { frame: 30, progress: 0 },
      { frame: 90, progress: 0.22 },
      { frame: 130, progress: 0.28 },
      { frame: 190, progress: 0.58 },
      { frame: 240, progress: 0.64 },
      { frame: 300, progress: 0.91 },
      { frame: 330, progress: 0.94 },
      { frame: 350, progress: 1 },
    ],
    ease: 1,
    showPercent: false,
  },
  download: {
    word: "DOWNLOADING",
    // ~12% shorter than "upload" so eleven characters occupy roughly
    // the width nine do.
    capHeightRatio: 0.1144,
    palette: {
      backdropDeep: "#02180E",
      backdropMottle: "#06381E",
      barOutline: "#7FFFB0",
      barCore: "#FFFFFF",
      fill: "#2ED45F",
      fillBright: "#A8FFC4",
      word: "#4FE87A",
      wordCore: "#E8FFF0",
      spark: "#C8FFD8",
    },
    // "burst": lurches forward twice, separated by long stalls. Same
    // construction as "steady", entirely different rhythm.
    curve: [
      { frame: 30, progress: 0 },
      { frame: 60, progress: 0.48 },
      { frame: 100, progress: 0.52 },
      { frame: 180, progress: 0.56 },
      { frame: 220, progress: 0.83 },
      { frame: 260, progress: 0.86 },
      { frame: 330, progress: 0.99 },
      { frame: 345, progress: 1 },
    ],
    ease: 1,
    showPercent: false,
  },
  process: {
    word: "PROCESSING",
    capHeightRatio: 0.1222,
    palette: {
      backdropDeep: "#1A0E02",
      backdropMottle: "#3D2408",
      barOutline: "#FFD48F",
      barCore: "#FFFFFF",
      fill: "#F5A02E",
      fillBright: "#FFE0B8",
      word: "#FFB84F",
      wordCore: "#FFF4E0",
      spark: "#FFE8C8",
    },
    // "grind": slow and relentless, near-linear with only slight
    // easing. Correct here specifically — processing is steady work,
    // not a transfer stalling on a network.
    curve: [
      { frame: 30, progress: 0 },
      { frame: 120, progress: 0.3 },
      { frame: 210, progress: 0.6 },
      { frame: 300, progress: 0.9 },
      { frame: 355, progress: 1 },
    ],
    // Barely eased: over 90-frame segments a full ease-in-out reads as
    // a pulse, and "processing" should grind, not breathe.
    ease: 0.22,
    showPercent: true,
  },
};
