import { TAU } from "../lib/constants";
import { mulberry32 } from "../lib/random";

/**
 * The shared Data Rings structure. Built once at module level from fixed
 * seeds; every camera angle and colourway renders this same data.
 * Radii are in world units with R = 10.
 */
export const R = 10;

// ---------------------------------------------------------------- blocks --
export type BarRing = {
  id: number;
  rIn: number;
  rOut: number;
  segments: number;
  cells: number; // radial subdivisions per segment
  fill: number; // tangential fill (rest is gap)
  /** Rotation, in whole segment periods per loop (sign = direction). */
  shift: number;
  meanHeight: number;
};

export const BAR_RINGS: BarRing[] = [
  { id: 0, rIn: 0.18 * R, rOut: 0.35 * R, segments: 160, cells: 9, fill: 0.55, shift: 6, meanHeight: 0.24 },
  { id: 1, rIn: 0.62 * R, rOut: 0.85 * R, segments: 300, cells: 12, fill: 0.6, shift: -8, meanHeight: 0.2 },
  // Two low, notched HUD bands that add to the ring rhythm (band, gap, line, gap).
  { id: 2, rIn: 0.45 * R, rOut: 0.51 * R, segments: 200, cells: 2, fill: 0.75, shift: 5, meanHeight: 0.05 },
  { id: 3, rIn: 0.92 * R, rOut: 0.98 * R, segments: 240, cells: 2, fill: 0.75, shift: -6, meanHeight: 0.06 },
];

/** Per-segment table: width = max segments, one row per ring. RGBA = base, amp, phase, slope. */
export const SEG_TEX_W = 300;
export const segData = new Float32Array(SEG_TEX_W * BAR_RINGS.length * 4);
{
  const rng = mulberry32(0xda7a0001);
  for (const ring of BAR_RINGS) {
    // Step groups: hold a level over short runs of segments, like a bar
    // chart / skyline, with occasional tall fins and gaps.
    let level = 1;
    let run = 0;
    for (let s = 0; s < ring.segments; s++) {
      if (run <= 0) {
        level = 0.35 + rng() * 1.5;
        run = 2 + Math.floor(rng() * 7);
      }
      run--;
      let base = ring.meanHeight * level * (0.9 + rng() * 0.2);
      const r = rng();
      if (ring.id === 0 && r < 0.06) base = ring.meanHeight * (2.5 + rng() * 2.5); // tall fins
      if (ring.id === 1 && r < 0.14) base = 0.02; // gaps in the outer skyline
      if (ring.id >= 2 && level < 0.75) base = 0.0; // notches in the HUD bands
      const amp = ring.meanHeight * (0.15 + rng() * 0.35);
      const ph = rng() * TAU;
      const slope = (rng() - 0.5) * 1.1;
      segData.set([base, ring.id >= 2 ? amp * 0.3 : amp, ph, ring.id >= 2 ? 0 : slope], (ring.id * SEG_TEX_W + s) * 4);
    }
  }
}

/** Instance attributes for every block: iA = rIn, rOut, angle0, width; iB = ring, seg, cell, cells. */
export const buildBlocks = () => {
  const total = BAR_RINGS.reduce((n, r) => n + r.segments * r.cells, 0);
  const iA = new Float32Array(total * 4);
  const iB = new Float32Array(total * 4);
  let k = 0;
  for (const ring of BAR_RINGS) {
    const dr = (ring.rOut - ring.rIn) / ring.cells;
    for (let s = 0; s < ring.segments; s++) {
      const ang = (s / ring.segments) * TAU;
      for (let c = 0; c < ring.cells; c++) {
        // Cells of a segment touch: together they form one stepped radial blade.
        const rIn = ring.rIn + c * dr;
        const rOut = ring.rIn + (c + 1) * dr;
        const rMid = (rIn + rOut) / 2;
        const width = ((TAU * rMid) / ring.segments) * ring.fill;
        iA.set([rIn, rOut, ang, width], k * 4);
        iB.set([ring.id, s, c, ring.cells], k * 4);
        k++;
      }
    }
  }
  return { iA, iB, count: total };
};

// ---------------------------------------------------------------- points --
/**
 * Point kinds:
 *  0 = flows around its ring (life cycle: fades in, travels, fades out)
 *  1 = flows outward across the disc (life cycle)
 *  2 = fixed (thin bright circles, radial lines), twinkles in whole cycles
 */
export type PointBuffers = {
  a: Float32Array; // r, angle0, y, speed (rad per loop)
  b: Float32Array; // phase offset, world size, brightness, colour index (0..3, 4 = white-ish)
  c: Float32Array; // kind, r1 (outward flow target), twinkle cycles, -
  count: number;
};

export const buildPoints = (): PointBuffers => {
  const rng = mulberry32(0xda7a0002);
  const a: number[] = [];
  const b: number[] = [];
  const c: number[] = [];
  const colour = () => {
    const u = rng();
    return u < 0.4 ? 0 : u < 0.7 ? 1 : u < 0.85 ? 2 : 3;
  };
  const push = (
    r: number,
    ang: number,
    y: number,
    speed: number,
    ph: number,
    size: number,
    bright: number,
    col: number,
    kind: number,
    r1 = 0,
    tw = 0,
    lineDir = 1, // 0 = none, 1 = lies on a circle, 2 = lies on a radial line
  ) => {
    a.push(r, ang, y, speed);
    b.push(ph, size, bright, col);
    c.push(kind, r1, tw, lineDir);
  };

  // Dotted ring bands: a few tight lines of dots per band, broken into
  // dashed arcs (runs of dots with gaps), like segmented data rings.
  const band = (radius: number, lines: number, spread: number, speed: number, size: number, bright: number, y = 0.02) => {
    const perLine = Math.round((TAU * radius) / (size * 2.0));
    for (let l = 0; l < lines; l++) {
      const rr = radius + (lines === 1 ? 0 : (l / (lines - 1) - 0.5) * spread);
      const sp = speed * (1 + (rng() - 0.5) * 0.3);
      const lineB = 0.5 + rng() * 0.7;
      let on = true;
      let run = Math.floor(rng() * 30);
      for (let i = 0; i < perLine; i++) {
        if (run-- <= 0) {
          on = !on;
          run = on ? 6 + Math.floor(rng() * 50) : 3 + Math.floor(rng() * 22);
        }
        if (!on) continue;
        const ang = ((i + (rng() - 0.5) * 0.2) / perLine) * TAU;
        push(rr, ang, y, sp, rng(), size * (0.85 + rng() * 0.3), bright * lineB * (0.45 + rng() * 0.75), colour(), 0);
      }
    }
  };
  // Thin bright circles: tightly packed dots (not a solid tube), mostly
  // white-hot with prismatic sparkles of the palette colours.
  const circle = (radius: number, bright: number, y = 0.01) => {
    const size = 0.02;
    const n = Math.round((TAU * radius) / (size * 1.9));
    for (let i = 0; i < n; i++) {
      const white = rng() < 0.35;
      push(radius, (i / n) * TAU, y, 0, rng(), size, bright * (white ? 0.75 : 1.0) * (0.5 + rng() * 0.7), white ? 4 : colour(), 2, 0, 1 + Math.floor(rng() * 3));
    }
  };

  // Central well: thin bright rim and a dotted inner ring.
  circle(0.15 * R, 1.0);
  band(0.135 * R, 3, 0.05, 0.9, 0.02, 1.0);
  band(0.165 * R, 3, 0.05, -0.7, 0.02, 0.9);
  // Inner bar ring edges.
  circle(0.18 * R, 0.8);
  circle(0.35 * R, 1.0);
  // Dotted ring on the disc at 0.4R.
  band(0.4 * R, 2, 0.1, 0.5, 0.04, 1.3);
  // Fine radial lines across the disc (fixed): 1,200 hairlines of tightly
  // packed, dim dots, so they read as lines, not glitter. A few are brighter.
  for (let l = 0; l < 1200; l++) {
    const ang = ((l + rng() * 0.4) / 1200) * TAU;
    const lb = rng() < 0.15 ? 0.16 + rng() * 0.18 : 0.03 + rng() * 0.04;
    const r0 = (0.355 + rng() * 0.03) * R;
    const r1 = (0.56 + rng() * 0.04) * R;
    const n = Math.round((r1 - r0) / 0.0135);
    for (let i = 0; i < n; i++) {
      // Brightness fades along each line, brightest near the well side.
      const f = 1 - (i / n) * 0.6;
      push(r0 + (i / n) * (r1 - r0), ang, 0.006, 0, rng(), 0.014, lb * f, rng() < 0.8 ? 1 : 0, 2, 0, 1 + Math.floor(rng() * 3), 2);
    }
  }
  // Sparse points flowing outward across the disc.
  for (let i = 0; i < 1500; i++) {
    push(0.36 * R, rng() * TAU, 0.03, 0, rng(), 0.03 * (0.7 + rng() * 0.8), 0.3 + rng() * 0.6, colour(), 1, 0.59 * R, 0, 0);
  }
  // Thin bright circle at 0.6R.
  circle(0.6 * R, 1.3);
  // Outer bar ring edges, dotted.
  band(0.62 * R, 3, 0.06, -0.35, 0.025, 0.8);
  band(0.85 * R, 3, 0.06, 0.3, 0.025, 0.8);
  // Dotted rings over the outer skyline and beyond.
  band(0.7 * R, 3, 0.1, 0.4, 0.025, 0.6, 0.45);
  band(0.9 * R, 3, 0.12, -0.3, 0.06, 1.5);
  band(1.02 * R, 3, 0.1, 0.25, 0.065, 1.5);
  circle(1.0 * R, 0.7);
  band(1.14 * R, 3, 0.1, -0.2, 0.07, 1.4);
  // Sparkles scattered over the bar rings.
  for (let i = 0; i < 1200; i++) {
    const inner = rng() < 0.35;
    const r = inner ? (0.18 + rng() * 0.17) * R : (0.62 + rng() * 0.23) * R;
    push(r, rng() * TAU, 0.05 + rng() * (inner ? 0.9 : 0.5), inner ? 0.45 : -0.3, rng(), 0.022, 0.4 + rng() * 0.8, colour(), 0, 0, 0, 0);
  }
  // Bokeh field out to about 2R: dashed dotted arcs that dissolve outward,
  // spaced wider and larger with radius, some lifted above / below the plane.
  for (let k = 0; k < 14; k++) {
    const rr = (1.24 + k * 0.058 + rng() * 0.02) * R;
    const y = (rng() - 0.5) * 0.25 * k * 0.1 * R;
    band(rr, 2, 0.12, (k % 2 === 0 ? 1 : -1) * (0.12 + rng() * 0.1), 0.075 + k * 0.004, 1.3 - k * 0.04, y);
  }

  return {
    a: new Float32Array(a),
    b: new Float32Array(b),
    c: new Float32Array(c),
    count: a.length / 4,
  };
};
