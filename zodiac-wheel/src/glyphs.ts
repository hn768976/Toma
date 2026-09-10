/**
 * The twelve zodiac glyphs as hand-authored SVG paths, drawn as strokes on a
 * 0..100 box centred on (50,50). Deliberately not font characters: the wheel
 * must render identically wherever the project is built, and the stroke
 * weight has to sit in the same family as the rest of the line work.
 */

export type Glyph = {
  name: string;
  /** Sub-paths, all stroked (never filled). */
  d: string[];
  /** Stroke weight in glyph units, tuned per glyph for even colour. */
  weight?: number;
};

export const GLYPHS: Glyph[] = [
  {
    name: "aries",
    d: [
      "M 50 90 L 50 45",
      "M 50 47 C 50 20 33 9 22 20 C 12 30 17 51 32 60",
      "M 50 47 C 50 20 67 9 78 20 C 88 30 83 51 68 60",
    ],
  },
  {
    name: "taurus",
    d: [
      "M 50 44 m -24 24 a 24 24 0 1 0 48 0 a 24 24 0 1 0 -48 0",
      "M 15 18 C 15 48 85 48 85 18",
    ],
  },
  {
    name: "gemini",
    d: [
      "M 26 15 L 26 85",
      "M 74 15 L 74 85",
      "M 12 20 C 32 8 68 8 88 20",
      "M 12 80 C 32 92 68 92 88 80",
    ],
  },
  {
    name: "cancer",
    d: [
      "M 74 34 m -12 0 a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0",
      "M 62 34 C 56 16 34 10 15 24",
      "M 26 66 m -12 0 a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0",
      "M 38 66 C 44 84 66 90 85 76",
    ],
  },
  {
    name: "leo",
    d: [
      "M 33 70 m -16 0 a 16 16 0 1 0 32 0 a 16 16 0 1 0 -32 0",
      "M 49 70 C 51 46 41 27 55 21 C 70 15 84 30 77 47 C 72 59 82 65 88 58",
    ],
  },
  {
    name: "virgo",
    d: [
      "M 15 76 L 15 33 C 15 23 29 23 29 33 L 29 76",
      "M 29 33 C 29 23 43 23 43 33 L 43 76",
      "M 43 33 C 43 23 57 23 57 33 L 57 63 C 57 78 69 83 78 72",
      "M 59 57 C 74 51 87 62 82 75 C 78 86 65 87 56 78",
    ],
  },
  {
    name: "libra",
    d: [
      "M 11 81 L 89 81",
      "M 11 61 L 31 61",
      "M 69 61 L 89 61",
      "M 31 61 A 19 19 0 0 1 69 61",
    ],
  },
  {
    name: "scorpio",
    d: [
      "M 13 76 L 13 33 C 13 23 27 23 27 33 L 27 76",
      "M 27 33 C 27 23 41 23 41 33 L 41 76",
      "M 41 33 C 41 23 55 23 55 33 L 55 72 L 84 44",
      "M 84 44 L 68 46",
      "M 84 44 L 82 61",
    ],
  },
  {
    name: "sagittarius",
    d: ["M 18 82 L 80 20", "M 80 20 L 80 43", "M 80 20 L 57 20", "M 31 48 L 53 70"],
  },
  {
    name: "capricorn",
    d: [
      "M 13 31 C 24 69 35 73 43 42 C 49 20 63 22 65 44 L 67 65",
      "M 67 65 C 79 51 93 61 85 74 C 79 84 64 81 60 70",
    ],
  },
  {
    name: "aquarius",
    d: [
      "M 9 44 L 25 31 L 41 44 L 57 31 L 73 44 L 91 30",
      "M 9 70 L 25 57 L 41 70 L 57 57 L 73 70 L 91 56",
    ],
  },
  {
    name: "pisces",
    d: [
      "M 27 13 C 8 33 8 67 27 87",
      "M 73 13 C 92 33 92 67 73 87",
      "M 11 50 L 89 50",
    ],
  },
];
