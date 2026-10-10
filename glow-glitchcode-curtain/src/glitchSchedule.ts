import { LOOP } from "./constants";
import { mulberry32, range, smoothstep, clamp } from "./rng";

/**
 * The whole glitch "performance" as a seeded list of events, built once at
 * module level. Whether an event is on at a given frame is a pure function of
 * (event, frame % 600, intensity(frame)), and events may wrap around the loop
 * point, so frame 600 == frame 0.
 */

export enum Kind {
  Shift = 0, // band jumps sideways (optional row stutter)
  Smear = 1, // band stretched horizontally from a narrow strip
  Blur = 2, // band drawn as 6-10 offset low-alpha copies
  Black = 3, // black rectangle
  Bright = 4, // bright grey-white rectangle
  Disp = 5, // rectangle copied from a displaced place (macro-block glitch)
  Region = 6, // rectangle whose content is a narrow strip stretched wide (local smear)
}

export type GlitchEvent = {
  id: number;
  kind: Kind;
  start: number;
  len: number; // frames
  /** Gate: the event only shows when this is below the glitch intensity. */
  u: number;
  // Bands (design px at 4K, x as a fraction of width)
  y: number;
  h: number;
  dx: number; // fraction of frame width
  dy: number; // design px, row stutter
  stretch: number; // smear factor 3..10
  sx: number; // smear source position 0..1
  copies: number; // blur copies 6..10
  spread: number; // blur spread, design px
  ch: [number, number, number]; // R, G, B horizontal offsets, design px
  // Rectangles (fractions of frame)
  rx: number;
  ry: number;
  rw: number;
  rh: number;
  alpha: number;
  rdx: number; // Disp source offset, fraction of width
  rdy: number; // Disp source offset, fraction of height
};

const CLEAN_CENTRES = [75, 225, 375, 525]; // a clean moment every 5 s

/**
 * Glitch intensity 0..1 for a frame. Snaps to ~0 just before each clean
 * moment, stays clean for 0.5 s (15 frames), then ramps back up over ~1.8 s.
 */
export const intensityAt = (frame: number): number => {
  const f = ((frame % LOOP) + LOOP) % LOOP;
  let best = 1;
  for (const c of CLEAN_CENTRES) {
    let d = f - c;
    if (d > LOOP / 2) d -= LOOP;
    if (d < -LOOP / 2) d += LOOP;
    let i: number;
    if (d < 0) i = 1 - smoothstep(-13, -7, d); // fast snap (~5 frames)
    else if (d <= 7) i = 0;
    else i = smoothstep(7, 62, d); // slow fall apart
    best = Math.min(best, i);
  }
  return clamp(0.015 + best * 0.985, 0, 1);
};

export const isActive = (e: GlitchEvent, frame: number, intensity: number): boolean => {
  const f = ((frame % LOOP) + LOOP) % LOOP;
  const m = (((f - e.start) % LOOP) + LOOP) % LOOP;
  return m < e.len && e.u < intensity;
};

const make = (): GlitchEvent[] => {
  const r = mulberry32(0x3c6ef372);
  const events: GlitchEvent[] = [];
  const base = (kind: Kind, len: number): GlitchEvent => ({
    id: events.length,
    kind,
    start: Math.floor(r() * LOOP),
    len,
    u: r(),
    y: 0, h: 0, dx: 0, dy: 0, stretch: 1, sx: 0, copies: 8, spread: 0,
    ch: [0, 0, 0], rx: 0, ry: 0, rw: 0, rh: 0, alpha: 1, rdx: 0, rdy: 0,
  });
  const channels = (): [number, number, number] => {
    const c = range(r, 2, 14) * (r() < 0.35 ? 2.4 : 1.4); // design px; wider ghosts on some bands
    const s = r() < 0.5 ? -1 : 1;
    const mode = r();
    if (mode < 0.55) return [-c * s, c * s * 0.6, c * s * 0.7]; // red / cyan
    if (mode < 0.75) return [-c * s, 0, c * s * range(r, 0.5, 1)]; // R / G / B ghosts
    if (mode < 0.9) return [0, 0, c * s]; // yellow / blue
    return [c * s * 0.8, -c * s * 0.8, c * s * 0.8]; // magenta / green
  };
  const bandH = (lo: number, hi: number) => Math.exp(range(r, Math.log(lo), Math.log(hi)));
  const shiftDx = () => {
    const m = 0.002 + 0.08 * Math.pow(r(), 2.4); // many small jumps, a few big
    return (r() < 0.5 ? -1 : 1) * m;
  };

  // Slice shifts, 2-6 frames each, 4-80 px tall.
  for (let i = 0; i < 1500; i++) {
    const e = base(Kind.Shift, 2 + Math.floor(r() * 5));
    e.y = r() * 2160;
    e.h = bandH(4, 80);
    e.dx = shiftDx();
    e.dy = r() < 0.3 ? range(r, -40, 40) : 0;
    e.ch = channels();
    events.push(e);
  }
  // Bursts: a stack of neighbouring bands jumping together.
  for (let b = 0; b < 90; b++) {
    const start = Math.floor(r() * LOOP);
    const len = 2 + Math.floor(r() * 5);
    const u = r();
    let y = r() * 2000;
    const n = 6 + Math.floor(r() * 12);
    const spreadDx = shiftDx();
    for (let j = 0; j < n; j++) {
      const e = base(Kind.Shift, len);
      e.start = start;
      e.u = u;
      e.y = y;
      e.h = bandH(5, 60);
      y += e.h;
      e.dx = spreadDx * range(r, 0.2, 1.2) * (r() < 0.25 ? -1 : 1);
      e.dy = r() < 0.3 ? range(r, -30, 30) : 0;
      e.ch = channels();
      events.push(e);
    }
  }
  // Smear: strip scaled 3-10x wide.
  for (let i = 0; i < 650; i++) {
    const e = base(Kind.Smear, 2 + Math.floor(r() * 5));
    e.y = r() * 2100;
    e.h = r() < 0.4 ? bandH(40, 190) : bandH(8, 150);
    e.stretch = range(r, 3, 10);
    e.sx = r();
    e.dx = r() < 0.4 ? shiftDx() * 0.4 : 0;
    e.ch = channels().map((v) => v * 0.3) as [number, number, number]; // smears stay mostly grey
    events.push(e);
  }
  // Blur: 6-10 offset copies at low alpha.
  for (let i = 0; i < 260; i++) {
    const e = base(Kind.Blur, 2 + Math.floor(r() * 5));
    e.y = r() * 2100;
    e.h = bandH(10, 220);
    e.copies = 6 + Math.floor(r() * 5);
    e.spread = range(r, 18, 110);
    e.dx = r() < 0.4 ? shiftDx() * 0.3 : 0;
    e.ch = channels().map((v) => v * 0.4) as [number, number, number];
    events.push(e);
  }
  // Rectangles, 2-5 frames: black blocks, bright grey-white blocks, and
  // displaced macro-blocks.
  const rect = (e: GlitchEvent, wLo: number, wHi: number, hLo: number, hHi: number) => {
    e.rw = range(r, wLo, wHi);
    e.rh = range(r, hLo, hHi);
    e.rx = r() * (1 - e.rw);
    e.ry = r() * (1 - e.rh);
  };
  for (let i = 0; i < 620; i++) {
    const e = base(Kind.Black, 2 + Math.floor(r() * 4));
    rect(e, 0.03, 0.2, 0.012, 0.09);
    e.alpha = range(r, 0.85, 1);
    events.push(e);
  }
  for (let i = 0; i < 55; i++) {
    const e = base(Kind.Bright, 2 + Math.floor(r() * 4));
    rect(e, 0.03, 0.18, 0.003, 0.014);
    e.alpha = range(r, 0.3, 0.6);
    events.push(e);
  }
  // Local smears: a rectangle filled by stretching a narrow strip. Half of them
  // sit in the left strip of the page, where text turns to white streaks.
  for (let i = 0; i < 520; i++) {
    const e = base(Kind.Region, 2 + Math.floor(r() * 5));
    const left = r() < 0.5;
    e.rw = left ? range(r, 0.12, 0.26) : range(r, 0.15, 0.42);
    e.rh = bandH(14, 120) / 2160;
    e.rx = left ? range(r, 0, 0.04) : r() * (1 - e.rw);
    e.ry = r() * (1 - e.rh);
    e.stretch = range(r, 4, 9);
    e.rdx = range(r, -0.1, 0.1);
    e.alpha = range(r, 0.85, 1);
    events.push(e);
  }
  for (let i = 0; i < 420; i++) {
    const e = base(Kind.Disp, 2 + Math.floor(r() * 5));
    rect(e, 0.04, 0.22, 0.02, 0.1);
    e.rdx = range(r, -0.12, 0.12);
    e.rdy = range(r, -0.08, 0.08);
    e.alpha = range(r, 0.7, 1);
    events.push(e);
  }
  return events;
};

export const GLITCH_EVENTS: GlitchEvent[] = make();
