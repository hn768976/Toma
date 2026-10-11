import { Painter } from "./painter";

// Server unit types. Panel coordinates: x 0..1080 left to right, y 0..h
// top to bottom (1 U = 100). Each type paints its faceplate and lists its
// 3D parts: silver fins, latch handles, drive caddies, LEDs and ports.

export const PANEL_W = 1080;
export const U = 100;

export type LedKind = "red" | "orange" | "green";
export type LedMode = "steady" | "blink" | "flicker" | "blip";
export type Led = { x: number; y: number; kind: LedKind; mode: LedMode; size?: number };
export type Fins = { x: number; y: number; w: number; h: number; n: number };
export type Handle = { x: number; y: number; w: number; h: number; vertical?: boolean };
export type Caddy = { x: number; y: number; w: number; h: number; variant: "lff" | "sff" };
export type Port = { x: number; y: number };

export type UnitType = {
  id: string;
  heightU: number;
  paint: (p: Painter) => void;
  fins: Fins[];
  handles: Handle[];
  caddies: Caddy[];
  leds: Led[];
  ports: Port[]; // switch ports that take cables
  spare: Port[]; // the port the red cable goes into
  // A recessed cable pass-through (brush strip) the patch cables come out
  // of: its vertical centre and horizontal extent, in panel units.
  passThrough?: { y: number; x0: number; x1: number };
};

const BLACK = "#1C1E22";
const GUN = "#34373D";
const DARK = "#0B0C0E";

const ears = (p: Painter, h: number) => {
  p.plate(0, 2, 36, h - 4, { color: GUN, rough: 0.42, height: 0.5 });
  p.plate(PANEL_W - 36, 2, 36, h - 4, { color: GUN, rough: 0.42, height: 0.5 });
  const ys = h > 150 ? [24, h - 24] : [22, h - 22];
  for (const y of ys) {
    p.screw(18, y, 6);
    p.screw(PANEL_W - 18, y, 6);
  }
};

// Front-panel controls: power button, ID button and two USB ports.
const controls = (p: Painter, x: number, y: number) => {
  p.circle(x, y, 9, { color: "#5A5E66", rough: 0.3, height: 0.62 });
  p.circle(x, y, 6.5, { color: "#101114", rough: 0.4, height: 0.56 });
  p.rect(x - 0.8, y - 5, 1.6, 4.5, { color: "#8A8E96", height: 0.6 });
  p.circle(x, y + 22, 4.5, { color: "#3A3D44", rough: 0.35, height: 0.6 });
  for (let i = 0; i < 2; i++) {
    p.rect(x + 18, y - 12 + i * 16, 26, 11, { color: "#7A7E86", rough: 0.3, height: 0.56 });
    p.rect(x + 20, y - 10 + i * 16, 22, 7, { color: "#030304", height: 0.08 });
    p.rect(x + 22, y - 9 + i * 16, 18, 2.5, { color: "#2A4A9A", height: 0.2 });
  }
};

// Grime: soft blotches and fine speckle in colour and roughness.
const grime = (p: Painter, seed: number, w: number, h: number) => {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < 900; i++) {
    const x = rnd() * w, y = rnd() * h, r = 0.3 + rnd() * 1.2;
    p.col.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.12)";
    p.col.beginPath();
    p.col.arc(x, y, r, 0, Math.PI * 2);
    p.col.fill();
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * w, y = rnd() * h;
    const g = p.rough.createRadialGradient(x, y, 0, x, y, 30 + rnd() * 60);
    g.addColorStop(0, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    p.rough.fillStyle = g;
    p.rough.fillRect(x - 90, y - 90, 180, 180);
  }
};

const base = (p: Painter, h: number, color = BLACK) => {
  p.rect(0, 0, PANEL_W, h, { color, rough: 0.5, height: 0.5 });
  // Top and bottom chamfer lines.
  p.rect(0, 0, PANEL_W, 1.6, { color: "#3A3D44", rough: 0.35, height: 0.62 });
  p.rect(0, h - 1.6, PANEL_W, 1.6, { color: "#050506", rough: 0.6, height: 0.38 });
};

// 1U server: dark pull block, LED column, two silver fin stacks and two
// perforated panels (the most common unit in the references).
const S1: UnitType = {
  id: "s1",
  heightU: 1,
  paint: (p) => {
    base(p, 100);
    ears(p, 100);
    p.plate(44, 10, 104, 80, { color: DARK, rough: 0.55, height: 0.38 });
    p.rrect(66, 26, 60, 48, 4, { color: "#1C1D21", rough: 0.4, height: 0.52 });
    p.slotGrid(72, 32, 48, 36, 4, 3, 0.55);
    // LED bezels.
    p.circle(166, 30, 6, { color: "#050506", height: 0.3 });
    p.circle(166, 70, 6, { color: "#050506", height: 0.3 });
    // Fin bays (fins are 3D).
    p.rect(182, 6, 80, 88, { color: "#060607", rough: 0.8, height: 0.2 });
    p.rect(568, 6, 80, 88, { color: "#060607", rough: 0.8, height: 0.2 });
    // Perforated panels.
    p.plate(272, 10, 288, 80, { color: "#222428", rough: 0.45, height: 0.52 });
    p.slotGrid(284, 22, 264, 56, 14, 4, 0.6, true);
    p.plate(656, 10, 280, 80, { color: "#222428", rough: 0.45, height: 0.52 });
    p.slotGrid(668, 20, 256, 60, 9, 3, 0.66);
    p.circle(950, 30, 6, { color: "#050506", height: 0.3 });
    p.circle(950, 70, 6, { color: "#050506", height: 0.3 });
    p.plate(966, 14, 72, 72, { color: DARK, rough: 0.5, height: 0.4 });
    p.brushed(11);
    grime(p, 111, PANEL_W, 100);
  },
  fins: [
    { x: 186, y: 9, w: 72, h: 82, n: 9 },
    { x: 572, y: 9, w: 72, h: 82, n: 9 },
  ],
  handles: [{ x: 974, y: 24, w: 56, h: 52 }],
  caddies: [],
  leds: [
    { x: 166, y: 30, kind: "red", mode: "blink" },
    { x: 166, y: 70, kind: "orange", mode: "steady" },
    { x: 950, y: 30, kind: "red", mode: "blip" },
    { x: 950, y: 70, kind: "orange", mode: "steady" },
  ],
  ports: [],
  spare: [],
};

// 1U server with eight small drive bays and a vent.
const S3: UnitType = {
  id: "s3",
  heightU: 1,
  paint: (p) => {
    base(p, 100, "#17181B");
    ears(p, 100);
    p.rect(44, 6, 664, 88, { color: "#050506", rough: 0.85, height: 0.2 });
    p.plate(716, 10, 220, 80, { color: "#1A1B1F", rough: 0.45, height: 0.52 });
    p.slotGrid(726, 18, 200, 64, 10, 3, 0.62);
    p.circle(952, 34, 5, { color: "#050506", height: 0.3 });
    p.circle(952, 66, 5, { color: "#050506", height: 0.3 });
    p.plate(970, 12, 66, 76, { color: GUN, rough: 0.4, height: 0.5 });
    controls(p, 984, 40);
    p.brushed(13);
    grime(p, 113, PANEL_W, 100);
  },
  fins: [],
  handles: [],
  caddies: Array.from({ length: 8 }, (_, i) => ({ x: 48 + i * 83, y: 8, w: 80, h: 84, variant: "sff" as const })),
  leds: [
    { x: 952, y: 34, kind: "red", mode: "blink" },
    { x: 952, y: 66, kind: "orange", mode: "steady" },
    ...Array.from({ length: 8 }, (_, i) => ({
      x: 48 + i * 83 + 68,
      y: 78,
      kind: (i % 3 === 1 ? "orange" : i % 3 === 2 ? "green" : "red") as LedKind,
      mode: (i % 2 ? "flicker" : "blink") as LedMode,
      size: 0.7,
    })),
  ],
  ports: [],
  spare: [],
};

// 2U storage: twelve 3.5" caddies.
const S2: UnitType = {
  id: "s2",
  heightU: 2,
  paint: (p) => {
    base(p, 200, "#111214");
    ears(p, 200);
    p.rect(42, 6, 996, 188, { color: "#040405", rough: 0.9, height: 0.15 });
    p.brushed(17);
    grime(p, 117, PANEL_W, 200);
  },
  fins: [],
  handles: [
    { x: 6, y: 50, w: 24, h: 100, vertical: true },
    { x: PANEL_W - 30, y: 50, w: 24, h: 100, vertical: true },
  ],
  caddies: Array.from({ length: 12 }, (_, i) => ({ x: 46 + i * 83, y: 9, w: 80, h: 182, variant: "lff" as const })),
  leds: Array.from({ length: 12 }, (_, i) => ({
    x: 46 + i * 83 + 40,
    y: 172,
    kind: (i % 2 === 0 ? "green" : i % 3 === 0 ? "orange" : "red") as LedKind,
    mode: (i % 3 === 0 ? "flicker" : i % 3 === 1 ? "blink" : "steady") as LedMode,
    size: 0.8,
  })),
  ports: [],
  spare: [],
};

// 2U power-supply block: large vents and a handle.
const P2: UnitType = {
  id: "p2",
  heightU: 2,
  paint: (p) => {
    base(p, 200, "#16171A");
    ears(p, 200);
    p.plate(46, 14, 470, 172, { color: "#25272B", rough: 0.42, height: 0.52 });
    p.holes(56, 22, 450, 156, 11, 3.6);
    p.plate(590, 14, 380, 172, { color: "#25272B", rough: 0.42, height: 0.52 });
    p.slotGrid(602, 26, 356, 148, 6, 9, 0.7);
    p.circle(1000, 60, 6, { color: "#050506", height: 0.3 });
    p.circle(1000, 100, 6, { color: "#050506", height: 0.3 });
    p.circle(1000, 140, 6, { color: "#050506", height: 0.3 });
    controls(p, 990, 150);
    p.brushed(19);
    grime(p, 119, PANEL_W, 200);
  },
  fins: [],
  handles: [{ x: 530, y: 30, w: 46, h: 140, vertical: true }],
  caddies: [],
  leds: [
    { x: 1000, y: 60, kind: "green", mode: "steady" },
    { x: 1000, y: 100, kind: "orange", mode: "blip" },
    { x: 1000, y: 140, kind: "red", mode: "blink" },
  ],
  ports: [],
  spare: [],
};

// 1U network switch: a dense LED matrix, two rows of RJ45-style ports with
// link LEDs, and uplink slots on the right.
const portXs = Array.from({ length: 24 }, (_, i) => 236 + (i % 12) * 50 + Math.floor((i % 12) / 6) * 26);
// 2U network switch. Top U: a brush-strip cable pass-through, the gap the
// patch cables come out of. Bottom U: a dense LED matrix, two rows of
// RJ45-style ports with link LEDs, and uplink slots on the right.
const BRUSH = { y0: 26, y1: 74, x0: 48, x1: 1032 };
const W1: UnitType = {
  id: "w1",
  heightU: 2,
  paint: (p) => {
    base(p, 200, "#1B1C20");
    ears(p, 200);
    // Brush-strip pass-through: a dark recessed slot with bristles closing
    // in from the top and bottom edges.
    p.plate(BRUSH.x0 - 6, BRUSH.y0 - 8, BRUSH.x1 - BRUSH.x0 + 12, BRUSH.y1 - BRUSH.y0 + 16, { color: "#2A2C31", rough: 0.4, height: 0.55 });
    p.rect(BRUSH.x0, BRUSH.y0, BRUSH.x1 - BRUSH.x0, BRUSH.y1 - BRUSH.y0, { color: "#020203", rough: 0.95, height: 0.0 });
    let a = 99;
    const rnd = () => {
      a = (a * 1103515245 + 12345) & 0x7fffffff;
      return a / 0x7fffffff;
    };
    const mid = (BRUSH.y0 + BRUSH.y1) / 2;
    for (let x = BRUSH.x0 + 1; x < BRUSH.x1 - 1; x += 1.6 + rnd() * 1.4) {
      const g = 30 + Math.floor(rnd() * 24);
      const col = `rgb(${g},${g + 1},${g + 4})`;
      const reachT = mid - BRUSH.y0 - 2 - rnd() * 6;
      const reachB = BRUSH.y1 - mid - 2 - rnd() * 6;
      p.rect(x, BRUSH.y0, 0.7, reachT, { color: col, rough: 0.85, height: 0.25 });
      p.rect(x, BRUSH.y1 - reachB, 0.7, reachB, { color: col, rough: 0.85, height: 0.25 });
    }
    for (const sx of [24, PANEL_W - 24]) p.screw(sx, 50, 5);
    // Port half.
    p.plate(50, 112, 150, 76, { color: "#121316", rough: 0.5, height: 0.48 });
    for (let i = 0; i < 24; i++) {
      const x = portXs[i];
      const y = i < 12 ? 122 : 158;
      // Port: dark opening with a metal lip and a latch notch.
      p.rect(x - 2, y - 2, 40, 32, { color: "#7A7E86", rough: 0.3, height: 0.56 });
      p.rect(x, y, 36, 28, { color: "#030304", rough: 0.9, height: 0.05 });
      p.rect(x + 12, y + 22, 12, 6, { color: "#030304", height: 0.02 });
    }
    // Uplink slots and a console port.
    for (let i = 0; i < 2; i++) {
      p.rect(880 + i * 52, 130, 44, 36, { color: "#5A5E66", rough: 0.35, height: 0.58 });
      p.rect(884 + i * 52, 134, 36, 28, { color: "#040405", rough: 0.9, height: 0.05 });
    }
    p.rect(992, 130, 40, 32, { color: "#9A9EA6", rough: 0.3, height: 0.6 });
    p.rect(995, 133, 34, 26, { color: "#030304", height: 0.05 });
    p.brushed(23);
    grime(p, 123, PANEL_W, 200);
  },
  fins: [],
  handles: [],
  caddies: [],
  leds: [
    // Activity matrix: 4 x 6, green and red.
    ...Array.from({ length: 24 }, (_, i) => ({
      x: 66 + (i % 6) * 22,
      y: 126 + Math.floor(i / 6) * 16,
      kind: ((i * 7) % 5 < 2 ? "red" : "green") as LedKind,
      mode: (i % 4 === 0 ? "steady" : "flicker") as LedMode,
      size: 0.55,
    })),
    // Link/activity LEDs next to each port.
    ...portXs.filter((_, i) => i % 3 !== 2).map((x, i) => ({
      x: x + 30,
      y: x % 2 ? 116 : 192,
      kind: (i % 4 === 1 ? "orange" : "green") as LedKind,
      mode: (i % 2 ? "flicker" : "blink") as LedMode,
      size: 0.4,
    })),
  ],
  ports: portXs.slice(0, 12).map((x) => ({ x: x + 18, y: 136 })).concat(portXs.slice(12, 18).map((x) => ({ x: x + 18, y: 172 }))),
  spare: [{ x: 1012, y: 146 }],
  passThrough: { y: (BRUSH.y0 + BRUSH.y1) / 2, x0: BRUSH.x0 + 10, x1: BRUSH.x1 - 10 },
};

// 1U blank / honeycomb vent.
const B1: UnitType = {
  id: "b1",
  heightU: 1,
  paint: (p) => {
    base(p, 100, "#222428");
    ears(p, 100);
    p.plate(46, 10, 988, 80, { color: "#25272B", rough: 0.42, height: 0.52 });
    p.holes(54, 16, 972, 68, 9, 3);
    p.brushed(29);
    grime(p, 129, PANEL_W, 100);
  },
  fins: [],
  handles: [
    { x: 6, y: 20, w: 24, h: 60, vertical: true },
    { x: PANEL_W - 30, y: 20, w: 24, h: 60, vertical: true },
  ],
  caddies: [],
  leds: [
    { x: 1014, y: 30, kind: "red", mode: "steady" },
    { x: 1014, y: 70, kind: "orange", mode: "blink" },
  ],
  ports: [],
  spare: [],
};

export const UNIT_TYPES: Record<string, UnitType> = { s1: S1, s3: S3, s2: S2, p2: P2, w1: W1, b1: B1 };

// Caddy fronts (painted once, used on instanced caddies).
export const paintLff = (p: Painter) => {
  p.rect(0, 0, 80, 182, { color: GUN, rough: 0.4, height: 0.5 });
  p.plate(3, 3, 74, 176, { color: "#1A1B1F", rough: 0.45, height: 0.5 });
  // Silver latch at the top.
  p.plate(8, 8, 64, 26, { color: "#9EA2AA", rough: 0.3, height: 0.66 });
  p.rect(16, 16, 48, 4, { color: "#2A2C30", height: 0.45 });
  // Vertical slotted vent.
  p.slotGrid(12, 44, 56, 112, 4, 10, 0.58);
  p.circle(40, 165, 4.5, { color: "#050506", height: 0.3 });
};

export const paintSff = (p: Painter) => {
  p.rect(0, 0, 80, 84, { color: GUN, rough: 0.4, height: 0.5 });
  p.plate(3, 3, 74, 78, { color: "#1C1D21", rough: 0.45, height: 0.5 });
  // Slotted handle: silver slats.
  p.slats(10, 12, 46, 56, 6, { color: "#7E828A", rough: 0.4, height: 0.72 });
  p.rect(62, 12, 10, 52, { color: "#0A0A0C", rough: 0.6, height: 0.35 });
  // Release latch and the activity/fault windows.
  p.plate(10, 70, 46, 9, { color: "#8A8E96", rough: 0.3, height: 0.66 });
  p.rect(60, 70, 5, 6, { color: "#050506", height: 0.3 });
  p.rect(68, 70, 5, 6, { color: "#050506", height: 0.3 });
};
