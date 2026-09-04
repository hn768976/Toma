/**
 * Line-art glyphs for the orbiting icon nodes.
 *
 * These are drawn by hand with Canvas2D path calls rather than imported from an
 * icon library: a stock clip can't carry the attribution or licence terms that
 * icon sets require, so everything on screen has to be original artwork.
 *
 * Each glyph draws inside a 0..1 box; the caller sets up the transform, stroke
 * colour and line width.
 */
export type GlyphName =
  | "database"
  | "shield"
  | "document"
  | "user"
  | "cloud"
  | "chart"
  | "gear"
  | "lock"
  | "chip"
  | "network"
  | "key"
  | "graph";

export const GLYPH_NAMES: readonly GlyphName[] = [
  "database",
  "shield",
  "document",
  "user",
  "cloud",
  "chart",
  "gear",
  "lock",
  "chip",
  "network",
  "key",
  "graph",
];

type Ctx = CanvasRenderingContext2D;

const ellipse = (c: Ctx, x: number, y: number, rx: number, ry: number) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.stroke();
};

const line = (c: Ctx, pts: number[][]) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
  c.stroke();
};

const drawers: Record<GlyphName, (c: Ctx) => void> = {
  database: (c) => {
    ellipse(c, 0.5, 0.24, 0.28, 0.11);
    line(c, [
      [0.22, 0.24],
      [0.22, 0.76],
    ]);
    line(c, [
      [0.78, 0.24],
      [0.78, 0.76],
    ]);
    c.beginPath();
    c.ellipse(0.5, 0.76, 0.28, 0.11, 0, 0, Math.PI);
    c.stroke();
    c.beginPath();
    c.ellipse(0.5, 0.5, 0.28, 0.11, 0, 0, Math.PI);
    c.stroke();
  },
  shield: (c) => {
    c.beginPath();
    c.moveTo(0.5, 0.14);
    c.lineTo(0.82, 0.28);
    c.lineTo(0.82, 0.53);
    c.quadraticCurveTo(0.82, 0.76, 0.5, 0.88);
    c.quadraticCurveTo(0.18, 0.76, 0.18, 0.53);
    c.lineTo(0.18, 0.28);
    c.closePath();
    c.stroke();
    line(c, [
      [0.36, 0.5],
      [0.46, 0.61],
      [0.66, 0.39],
    ]);
  },
  document: (c) => {
    c.beginPath();
    c.moveTo(0.26, 0.12);
    c.lineTo(0.6, 0.12);
    c.lineTo(0.76, 0.29);
    c.lineTo(0.76, 0.88);
    c.lineTo(0.26, 0.88);
    c.closePath();
    c.stroke();
    line(c, [
      [0.6, 0.12],
      [0.6, 0.29],
      [0.76, 0.29],
    ]);
    for (let i = 0; i < 3; i++) {
      const y = 0.46 + i * 0.14;
      line(c, [
        [0.37, y],
        [0.65, y],
      ]);
    }
  },
  user: (c) => {
    ellipse(c, 0.5, 0.33, 0.17, 0.17);
    c.beginPath();
    c.arc(0.5, 0.92, 0.31, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
  },
  cloud: (c) => {
    c.beginPath();
    c.moveTo(0.28, 0.68);
    c.arc(0.36, 0.55, 0.15, Math.PI * 0.55, Math.PI * 1.5);
    c.arc(0.56, 0.42, 0.19, Math.PI * 1.15, Math.PI * 1.9);
    c.arc(0.72, 0.57, 0.13, Math.PI * 1.6, Math.PI * 0.42);
    c.closePath();
    c.stroke();
  },
  chart: (c) => {
    line(c, [
      [0.2, 0.16],
      [0.2, 0.82],
      [0.84, 0.82],
    ]);
    const bars = [0.34, 0.6, 0.44];
    bars.forEach((h, i) => {
      const x = 0.34 + i * 0.18;
      line(c, [
        [x, 0.82],
        [x, 0.82 - h],
      ]);
    });
  },
  gear: (c) => {
    const teeth = 8;
    c.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 0.4 : 0.29;
      const x = 0.5 + Math.cos(a) * r;
      const y = 0.5 + Math.sin(a) * r;
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.closePath();
    c.stroke();
    ellipse(c, 0.5, 0.5, 0.13, 0.13);
  },
  lock: (c) => {
    c.beginPath();
    c.roundRect(0.24, 0.46, 0.52, 0.42, 0.07);
    c.stroke();
    c.beginPath();
    c.arc(0.5, 0.44, 0.17, Math.PI, 0);
    c.stroke();
    line(c, [
      [0.5, 0.61],
      [0.5, 0.73],
    ]);
  },
  chip: (c) => {
    c.beginPath();
    c.roundRect(0.28, 0.28, 0.44, 0.44, 0.06);
    c.stroke();
    c.beginPath();
    c.rect(0.41, 0.41, 0.18, 0.18);
    c.stroke();
    for (let i = 0; i < 3; i++) {
      const p = 0.36 + i * 0.14;
      line(c, [
        [p, 0.28],
        [p, 0.14],
      ]);
      line(c, [
        [p, 0.72],
        [p, 0.86],
      ]);
      line(c, [
        [0.28, p],
        [0.14, p],
      ]);
      line(c, [
        [0.72, p],
        [0.86, p],
      ]);
    }
  },
  network: (c) => {
    const sats: number[][] = [
      [0.5, 0.16],
      [0.83, 0.7],
      [0.17, 0.7],
    ];
    sats.forEach(([x, y]) => {
      line(c, [
        [0.5, 0.5],
        [x, y],
      ]);
    });
    ellipse(c, 0.5, 0.5, 0.12, 0.12);
    sats.forEach(([x, y]) => ellipse(c, x, y, 0.1, 0.1));
  },
  key: (c) => {
    ellipse(c, 0.32, 0.42, 0.16, 0.16);
    line(c, [
      [0.43, 0.53],
      [0.82, 0.86],
    ]);
    line(c, [
      [0.66, 0.72],
      [0.55, 0.84],
    ]);
    line(c, [
      [0.74, 0.79],
      [0.64, 0.9],
    ]);
  },
  graph: (c) => {
    const pts = [
      [0.18, 0.72],
      [0.38, 0.44],
      [0.6, 0.6],
      [0.84, 0.24],
    ];
    line(c, pts);
    pts.forEach(([x, y]) => {
      c.beginPath();
      c.arc(x, y, 0.055, 0, Math.PI * 2);
      c.stroke();
    });
  },
};

/** Draw `name` into the unit box at the ctx's current transform. */
export const drawGlyph = (ctx: Ctx, name: GlyphName) => drawers[name](ctx);
