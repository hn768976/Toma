// Declarative placement of every HUD element, in 1920x1080 design units.
//
// The two layouts are deliberately different arrangements of the same
// vocabulary: "centered" mirrors the reference (emblem in the middle,
// instrumentation hugging both edges), "offset" pushes the emblem left
// and consolidates the dashboard into a right-hand column over a
// full-width ticker strip.

import { LayoutName } from "./theme";

export type HudItem =
  | {
      kind: "panel";
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      lines: number;
      delay: number;
      title?: string;
    }
  | {
      kind: "matrix";
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      cols: number;
      rows: number;
      delay: number;
    }
  | {
      kind: "bars";
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      count: number;
      delay: number;
    }
  | {
      kind: "line";
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      delay: number;
    }
  | {
      kind: "hex";
      id: string;
      x: number;
      y: number;
      r: number;
      filled: boolean;
      delay: number;
    }
  | {
      kind: "gauge";
      id: string;
      x: number;
      y: number;
      r: number;
      delay: number;
    }
  | {
      kind: "hatch";
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      delay: number;
    }
  | {
      kind: "ticker";
      id: string;
      x: number;
      y: number;
      size: number;
      length: number;
      delay: number;
    }
  | {
      kind: "chips";
      id: string;
      x: number;
      y: number;
      r: number;
      count: number;
      delay: number;
    }
  | {
      kind: "bracket";
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      delay: number;
    };

const CENTERED: HudItem[] = [
  // --- left edge ---------------------------------------------------------
  { kind: "hex", id: "l-hex1", x: 34, y: 52, r: 30, filled: false, delay: 150 },
  {
    kind: "hex",
    id: "l-hex2",
    x: 148,
    y: 156,
    r: 25,
    filled: true,
    delay: 210,
  },
  {
    kind: "hex",
    id: "l-hex3",
    x: 268,
    y: 74,
    r: 21,
    filled: false,
    delay: 260,
  },
  {
    kind: "hex",
    id: "l-hex4",
    x: 296,
    y: 330,
    r: 27,
    filled: false,
    delay: 300,
  },
  { kind: "chips", id: "l-chips", x: 118, y: 92, r: 22, count: 3, delay: 120 },
  { kind: "hatch", id: "l-hatch1", x: 18, y: 128, w: 118, h: 54, delay: 170 },
  { kind: "hatch", id: "l-hatch2", x: 30, y: 214, w: 92, h: 40, delay: 230 },
  {
    kind: "panel",
    id: "l-p1",
    x: 166,
    y: 122,
    w: 132,
    h: 74,
    lines: 4,
    delay: 95,
  },
  {
    kind: "panel",
    id: "l-p2",
    x: 8,
    y: 286,
    w: 184,
    h: 128,
    lines: 7,
    delay: 60,
  },
  {
    kind: "panel",
    id: "l-p3",
    x: 206,
    y: 246,
    w: 118,
    h: 96,
    lines: 5,
    delay: 190,
  },
  {
    kind: "ticker",
    id: "l-t1",
    x: 66,
    y: 452,
    size: 15,
    length: 18,
    delay: 140,
  },
  {
    kind: "ticker",
    id: "l-t2",
    x: 20,
    y: 492,
    size: 15,
    length: 22,
    delay: 240,
  },
  {
    kind: "panel",
    id: "l-p4",
    x: 12,
    y: 520,
    w: 208,
    h: 118,
    lines: 6,
    delay: 280,
  },
  { kind: "gauge", id: "l-gauge", x: 74, y: 790, r: 54, delay: 110 },
  { kind: "bracket", id: "l-br", x: 176, y: 738, w: 150, h: 52, delay: 320 },
  {
    kind: "panel",
    id: "l-p5",
    x: 168,
    y: 812,
    w: 172,
    h: 34,
    lines: 1,
    delay: 360,
  },
  {
    kind: "ticker",
    id: "l-t3",
    x: 20,
    y: 912,
    size: 17,
    length: 16,
    delay: 200,
  },
  {
    kind: "ticker",
    id: "l-t4",
    x: 84,
    y: 962,
    size: 17,
    length: 20,
    delay: 330,
  },
  {
    kind: "hex",
    id: "l-hex5",
    x: 272,
    y: 902,
    r: 23,
    filled: false,
    delay: 380,
  },

  // --- right edge --------------------------------------------------------
  {
    kind: "hex",
    id: "r-hex1",
    x: 1616,
    y: 58,
    r: 30,
    filled: false,
    delay: 130,
  },
  {
    kind: "hex",
    id: "r-hex2",
    x: 1668,
    y: 122,
    r: 30,
    filled: true,
    delay: 175,
  },
  {
    kind: "hex",
    id: "r-hex3",
    x: 1560,
    y: 138,
    r: 24,
    filled: false,
    delay: 215,
  },
  { kind: "hatch", id: "r-hatch1", x: 1732, y: 22, w: 126, h: 58, delay: 155 },
  { kind: "hatch", id: "r-hatch2", x: 1490, y: 34, w: 88, h: 44, delay: 245 },
  {
    kind: "matrix",
    id: "r-matrix",
    x: 1512,
    y: 236,
    w: 368,
    h: 168,
    cols: 4,
    rows: 6,
    delay: 70,
  },
  {
    kind: "bars",
    id: "r-bars",
    x: 1512,
    y: 526,
    w: 368,
    h: 96,
    count: 22,
    delay: 105,
  },
  { kind: "line", id: "r-line", x: 1512, y: 652, w: 368, h: 104, delay: 165 },
  {
    kind: "ticker",
    id: "r-t1",
    x: 1512,
    y: 460,
    size: 20,
    length: 12,
    delay: 225,
  },
  {
    kind: "ticker",
    id: "r-t2",
    x: 1512,
    y: 806,
    size: 21,
    length: 12,
    delay: 290,
  },
  {
    kind: "ticker",
    id: "r-t3",
    x: 1512,
    y: 874,
    size: 22,
    length: 16,
    delay: 345,
  },
  { kind: "gauge", id: "r-gauge", x: 1892, y: 618, r: 58, delay: 250 },
  {
    kind: "panel",
    id: "r-p1",
    x: 1512,
    y: 152,
    w: 176,
    h: 60,
    lines: 3,
    delay: 200,
  },
  {
    kind: "hex",
    id: "r-hex4",
    x: 1832,
    y: 934,
    r: 26,
    filled: false,
    delay: 370,
  },

  // --- floating accents across the field ---------------------------------
  {
    kind: "hex",
    id: "c-hex1",
    x: 470,
    y: 118,
    r: 27,
    filled: false,
    delay: 260,
  },
  {
    kind: "hex",
    id: "c-hex2",
    x: 706,
    y: 58,
    r: 21,
    filled: false,
    delay: 300,
  },
  {
    kind: "hex",
    id: "c-hex3",
    x: 1286,
    y: 82,
    r: 25,
    filled: false,
    delay: 285,
  },
  {
    kind: "hex",
    id: "c-hex4",
    x: 522,
    y: 956,
    r: 28,
    filled: false,
    delay: 340,
  },
  {
    kind: "hex",
    id: "c-hex5",
    x: 1310,
    y: 964,
    r: 26,
    filled: false,
    delay: 355,
  },
  {
    kind: "hex",
    id: "c-hex6",
    x: 1418,
    y: 372,
    r: 20,
    filled: true,
    delay: 395,
  },
  {
    kind: "hex",
    id: "c-hex7",
    x: 486,
    y: 640,
    r: 20,
    filled: true,
    delay: 400,
  },
];

const OFFSET: HudItem[] = [
  // --- right-hand dashboard column ---------------------------------------
  {
    kind: "panel",
    id: "o-head",
    x: 1052,
    y: 72,
    w: 828,
    h: 58,
    lines: 1,
    delay: 50,
  },
  {
    kind: "matrix",
    id: "o-matrix",
    x: 1052,
    y: 160,
    w: 504,
    h: 232,
    cols: 5,
    rows: 8,
    delay: 75,
  },
  {
    kind: "bars",
    id: "o-bars",
    x: 1580,
    y: 160,
    w: 300,
    h: 232,
    count: 16,
    delay: 110,
  },
  { kind: "line", id: "o-line", x: 1052, y: 418, w: 828, h: 186, delay: 145 },
  {
    kind: "panel",
    id: "o-s1",
    x: 1052,
    y: 630,
    w: 262,
    h: 128,
    lines: 5,
    delay: 190,
  },
  {
    kind: "panel",
    id: "o-s2",
    x: 1335,
    y: 630,
    w: 262,
    h: 128,
    lines: 5,
    delay: 225,
  },
  {
    kind: "panel",
    id: "o-s3",
    x: 1618,
    y: 630,
    w: 262,
    h: 128,
    lines: 5,
    delay: 260,
  },
  {
    kind: "ticker",
    id: "o-t1",
    x: 1052,
    y: 800,
    size: 24,
    length: 14,
    delay: 300,
  },
  {
    kind: "ticker",
    id: "o-t2",
    x: 1478,
    y: 800,
    size: 24,
    length: 12,
    delay: 330,
  },
  { kind: "gauge", id: "o-gauge", x: 1812, y: 872, r: 62, delay: 210 },
  { kind: "bracket", id: "o-br1", x: 1052, y: 836, w: 690, h: 76, delay: 360 },

  // --- bottom ticker strip -----------------------------------------------
  { kind: "bracket", id: "o-strip", x: 40, y: 976, w: 1840, h: 66, delay: 240 },
  {
    kind: "ticker",
    id: "o-t3",
    x: 64,
    y: 1022,
    size: 21,
    length: 26,
    delay: 270,
  },
  {
    kind: "ticker",
    id: "o-t4",
    x: 520,
    y: 1022,
    size: 21,
    length: 22,
    delay: 295,
  },
  {
    kind: "ticker",
    id: "o-t5",
    x: 920,
    y: 1022,
    size: 21,
    length: 24,
    delay: 320,
  },

  // --- left instrument rail ----------------------------------------------
  { kind: "gauge", id: "o-g2", x: 86, y: 188, r: 48, delay: 130 },
  { kind: "hatch", id: "o-hatch1", x: 40, y: 292, w: 76, h: 152, delay: 170 },
  {
    kind: "panel",
    id: "o-p1",
    x: 24,
    y: 470,
    w: 118,
    h: 150,
    lines: 8,
    delay: 100,
  },
  { kind: "gauge", id: "o-g3", x: 86, y: 786, r: 44, delay: 205 },
  {
    kind: "ticker",
    id: "o-t6",
    x: 28,
    y: 892,
    size: 15,
    length: 12,
    delay: 340,
  },

  // --- hexagon cluster and accents ---------------------------------------
  {
    kind: "hex",
    id: "o-hex1",
    x: 232,
    y: 68,
    r: 30,
    filled: false,
    delay: 155,
  },
  {
    kind: "hex",
    id: "o-hex2",
    x: 296,
    y: 130,
    r: 30,
    filled: true,
    delay: 195,
  },
  {
    kind: "hex",
    id: "o-hex3",
    x: 168,
    y: 132,
    r: 24,
    filled: false,
    delay: 235,
  },
  {
    kind: "hex",
    id: "o-hex4",
    x: 402,
    y: 74,
    r: 20,
    filled: false,
    delay: 285,
  },
  {
    kind: "hex",
    id: "o-hex5",
    x: 936,
    y: 262,
    r: 26,
    filled: false,
    delay: 310,
  },
  {
    kind: "hex",
    id: "o-hex6",
    x: 964,
    y: 838,
    r: 28,
    filled: false,
    delay: 350,
  },
  {
    kind: "hex",
    id: "o-hex7",
    x: 208,
    y: 906,
    r: 22,
    filled: true,
    delay: 375,
  },
  { kind: "chips", id: "o-chips", x: 1086, y: 101, r: 18, count: 4, delay: 90 },
];

export const getHudItems = (layout: LayoutName): HudItem[] =>
  layout === "centered" ? CENTERED : OFFSET;
