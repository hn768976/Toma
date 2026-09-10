// The twelve zodiac glyphs, hand-authored as SVG path data rather than
// taken from a font -- a font would give us clean, evenly weighted
// outlines, and this wheel wants strokes that can be roughed up like
// chalk. Each path is drawn inside a 100x100 box and stroked (never
// filled), so the same data scales to any wheel size.

export type ZodiacSign = {
  name: string;
  // Stroked subpaths, all in the shared 0..100 box.
  paths: string[];
};

export const ZODIAC_SIGNS: ZodiacSign[] = [
  {
    name: "ARIES",
    paths: [
      "M 50 56 C 50 34 42 22 31 22 C 20 22 15 34 20 45",
      "M 50 56 C 50 34 58 22 69 22 C 80 22 85 34 80 45",
      "M 50 50 L 50 86",
    ],
  },
  {
    name: "TAURUS",
    paths: [
      "M 28 70 A 22 22 0 1 0 72 70 A 22 22 0 1 0 28 70",
      "M 20 22 C 20 44 33 52 50 52 C 67 52 80 44 80 22",
    ],
  },
  {
    name: "GEMINI",
    paths: [
      "M 18 22 C 38 12 62 12 82 22",
      "M 18 78 C 38 88 62 88 82 78",
      "M 34 17 L 34 83",
      "M 66 17 L 66 83",
    ],
  },
  {
    name: "CANCER",
    paths: [
      "M 21 62 A 11 11 0 1 0 43 62 A 11 11 0 1 0 21 62",
      "M 23 52 C 33 31 58 25 84 32",
      "M 57 38 A 11 11 0 1 0 79 38 A 11 11 0 1 0 57 38",
      "M 77 48 C 67 69 42 75 16 68",
    ],
  },
  {
    name: "LEO",
    paths: [
      "M 15 68 A 15 15 0 1 0 45 68 A 15 15 0 1 0 15 68",
      "M 43 60 C 50 40 42 20 57 17 C 72 14 79 30 74 47 C 70 60 78 71 89 70",
    ],
  },
  {
    name: "VIRGO",
    paths: [
      "M 15 80 L 15 38 C 15 27 31 27 31 38 L 31 76",
      "M 31 38 C 31 27 47 27 47 38 L 47 68",
      "M 47 68 C 47 84 66 87 75 74 C 84 61 69 51 59 61 C 50 70 61 84 84 79",
    ],
  },
  {
    name: "LIBRA",
    paths: [
      "M 14 78 L 86 78",
      "M 14 56 L 31 56 C 31 34 69 34 69 56 L 86 56",
    ],
  },
  {
    name: "SCORPIO",
    paths: [
      "M 14 80 L 14 40 C 14 29 30 29 30 40 L 30 80",
      "M 30 40 C 30 29 46 29 46 40 L 46 80",
      "M 46 40 C 46 29 62 29 62 40 L 62 74 L 88 54",
      "M 88 54 L 75 52",
      "M 88 54 L 85 67",
    ],
  },
  {
    name: "SAGITTARIUS",
    paths: [
      "M 14 86 L 84 16",
      "M 61 16 L 84 16 L 84 39",
      "M 31 43 L 55 67",
    ],
  },
  {
    name: "CAPRICORN",
    paths: [
      "M 13 33 C 17 56 24 73 34 79 L 41 33 C 47 56 55 68 67 68 C 81 68 87 53 77 45 C 67 37 56 46 58 58 C 60 73 75 79 89 70",
    ],
  },
  {
    name: "AQUARIUS",
    paths: [
      "M 13 43 L 27 31 L 41 43 L 55 31 L 69 43 L 83 31",
      "M 13 65 L 27 53 L 41 65 L 55 53 L 69 65 L 83 53",
    ],
  },
  {
    name: "PISCES",
    paths: [
      "M 27 16 C 11 32 11 68 27 84",
      "M 73 16 C 89 32 89 68 73 84",
      "M 16 50 L 84 50",
    ],
  },
];
