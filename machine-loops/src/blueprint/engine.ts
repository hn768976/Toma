// Beam steam engine: one model, driven by one crank angle.
//
// Parts are defined once as SVG path data in their own local frame, grouped
// and named per part (the anatomy way: build geometry once, move rigid parts
// by transform, rebuild only parts whose projected shape changes). `pose()`
// solves every joint from the crank angle; `drawList()` returns, per part,
// its strokes and the transform that places it. The same module feeds the
// Remotion canvas, the SVG export and the mechanism audit.
//
// Model units are millimetres-ish, y up. Pure TypeScript, no imports.

export type Weight = "thick" | "mid" | "thin" | "hair";
export type Style = "solid" | "hidden" | "center" | "construct";
export type Stroke = { d: string; w: Weight; s?: Style };
export type Part = { name: string; strokes: Stroke[] };
export type Xf = { x: number; y: number; a: number }; // translate then rotate (rad)
export type Placed = { part: Part; xf: Xf };

const TAU = Math.PI * 2;
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

// --- path helpers ------------------------------------------------------------
const M = (x: number, y: number) => `M${f1(x)} ${f1(y)}`;
const L = (x: number, y: number) => `L${f1(x)} ${f1(y)}`;
export const line = (x1: number, y1: number, x2: number, y2: number) => `${M(x1, y1)}${L(x2, y2)}`;
export const poly = (pts: [number, number][], close = false) =>
  pts.map(([x, y], i) => (i ? L(x, y) : M(x, y))).join("") + (close ? "Z" : "");
export const rect = (x: number, y: number, w: number, h: number) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
export const circle = (cx: number, cy: number, r: number) =>
  `${M(cx + r, cy)}A${f1(r)} ${f1(r)} 0 1 0 ${f1(cx - r)} ${f1(cy)}A${f1(r)} ${f1(r)} 0 1 0 ${f1(cx + r)} ${f1(cy)}Z`;
export const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 48) => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poly(pts);
};
export const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 40) => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return poly(pts, true);
};
// 45-degree hatching inside an axis-aligned rectangle.
export const hatch = (x: number, y: number, w: number, h: number, sp = 26, dir = 1) => {
  let d = "";
  for (let k = -h; k < w; k += sp) {
    // line: (x + k + t, y + t) for dir=1, clipped to the box
    const t0 = Math.max(0, -k);
    const t1 = Math.min(h, w - k);
    if (t1 <= t0) continue;
    if (dir > 0) d += line(x + k + t0, y + t0, x + k + t1, y + t1);
    else d += line(x + w - (k + t0), y + t0, x + w - (k + t1), y + t1);
  }
  return d;
};
const bolts = (cx: number, cy: number, r: number, n: number, br: number, a0 = 0) => {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    d += circle(cx + r * Math.cos(a), cy + r * Math.sin(a), br);
  }
  return d;
};
const boltRow = (x0: number, x1: number, y: number, n: number, r: number) => {
  let d = "";
  for (let i = 0; i < n; i++) d += circle(x0 + ((x1 - x0) * i) / Math.max(1, n - 1), y, r);
  return d;
};
// A flat link between two pins along +x from 0 to len, with bosses.
const link = (len: number, w: number, boss: number, pin: number) => {
  const s: Stroke[] = [
    { d: line(boss * 0.8, w / 2, len - boss * 0.8, w / 2) + line(boss * 0.8, -w / 2, len - boss * 0.8, -w / 2), w: "thick" },
    { d: circle(0, 0, boss) + circle(len, 0, boss), w: "thick" },
    { d: circle(0, 0, pin) + circle(len, 0, pin), w: "thin" },
    { d: line(0, 0, len, 0), w: "hair", s: "center" },
  ];
  return s;
};

// --- geometry ------------------------------------------------------------------
export const G = {
  L: 1000, // beam half-length (pivot to end pins)
  O: { x: 0, y: 0 }, // beam pivot (top of the column)
  C: { x: 1000, y: -1600 }, // crankshaft
  crank: 300,
  conrod: 1600,
  wattC: 500, // coupler A-E (Watt linkage)
  F: { x: -2000, y: -500 }, // radius-rod fixed pivot
  rodX: -1000, // piston rod / cylinder axis
  rodLen: 850, // linkage midpoint to piston top
  pistonH: 120,
  bore: 520,
  cylTop: -760,
  cylBot: -1545,
  ground: -1700,
  flyR: 700,
  ecc: 60, // eccentric throw
  eccLead: (25 * Math.PI) / 180,
  rocker: { x: -461, y: -1480 }, // valve bell crank pivot
  rockArm: 180,
  eccRod: 0, // set below from rest geometry
  valveX: -641,
  valveLink: 200,
  airAt: -420, // beam station for the air pump
  airLink: 650,
  airRod: 470,
  feedAt: 270,
  feedLink: 560,
  feedRod: 260,
  gov: { x: 2200, top: -250, arm: 380, ballR: 105, link: 190, pulley: 100, drivePulley: 200, pulleyY: -1100 },
  govAlpha: (33 * Math.PI) / 180,
  lever: { x: 1960, y: 0 }, // governor bell lever pivot (y set below: level with the sleeve at rest)
  throttle: { x: 1760, y: 900 },
  steamY: 900,
};

// circle-circle intersection; returns both points
const cc = (p0: { x: number; y: number }, r0: number, p1: { x: number; y: number }, r1: number) => {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const d = Math.hypot(dx, dy);
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const xm = p0.x + (a * dx) / d;
  const ym = p0.y + (a * dy) / d;
  return [
    { x: xm + (h * dy) / d, y: ym - (h * dx) / d },
    { x: xm - (h * dy) / d, y: ym + (h * dx) / d },
  ];
};
// point on vertical line x = x0 at distance len below p
const slideBelow = (p: { x: number; y: number }, x0: number, len: number) => ({ x: x0, y: p.y - Math.sqrt(len * len - (x0 - p.x) ** 2) });
const slideAbove = (p: { x: number; y: number }, x0: number, len: number) => ({ x: x0, y: p.y + Math.sqrt(len * len - (x0 - p.x) ** 2) });

G.lever.y = G.gov.top - 2 * G.gov.link * Math.cos(G.govAlpha);

const rockerRest = { x: G.rocker.x, y: G.rocker.y - G.rockArm };
G.eccRod = Math.hypot(G.C.x + G.ecc * Math.cos(G.eccLead + Math.PI / 2) - rockerRest.x, G.C.y + G.ecc * Math.sin(G.eccLead + Math.PI / 2) - rockerRest.y);

export type Pose = ReturnType<typeof pose>;

// Everything from the crank angle theta (rad) and the frame (for governor hunting).
export const pose = (theta: number, frame: number) => {
  const C = G.C;
  const P = { x: C.x + G.crank * Math.cos(theta), y: C.y + G.crank * Math.sin(theta) };
  const B = cc(G.O, G.L, P, G.conrod).sort((a, b) => b.y - a.y)[0];
  const phi = Math.atan2(B.y, B.x);
  const A = { x: -G.L * Math.cos(phi), y: -G.L * Math.sin(phi) };
  const E = cc(G.F, G.L, A, G.wattC).sort((a, b) => a.y - b.y)[0];
  const Mid = { x: (A.x + E.x) / 2, y: (A.y + E.y) / 2 };
  const pistonTop = Mid.y - G.rodLen;
  // pumps
  const beamPt = (s: number) => ({ x: s * Math.cos(phi), y: s * Math.sin(phi) });
  const Qa = beamPt(G.airAt);
  const Sa = slideBelow(Qa, G.airAt, G.airLink);
  const Qf = beamPt(G.feedAt);
  const Sf = slideBelow(Qf, G.feedAt, G.feedLink);
  // valve gear: eccentric -> rod -> bell crank -> link -> spindle
  const ea = theta + Math.PI / 2 + G.eccLead;
  const Ec = { x: C.x + G.ecc * Math.cos(ea), y: C.y + G.ecc * Math.sin(ea) };
  const R1 = cc(G.rocker, G.rockArm, Ec, G.eccRod).sort((a, b) => a.y - b.y)[0];
  const beta = Math.atan2(R1.y - G.rocker.y, R1.x - G.rocker.x); // ~ -90deg at rest
  const outA = beta - Math.PI / 2; // output arm, 90deg clockwise of input (points left)
  const R2 = { x: G.rocker.x + G.rockArm * Math.cos(outA), y: G.rocker.y + G.rockArm * Math.sin(outA) };
  const Vs = slideAbove(R2, G.valveX, G.valveLink);
  // governor: belt 2:1 from the crankshaft; slight hunting of the balls
  const psi = theta * (G.gov.drivePulley / G.gov.pulley);
  const alpha = G.govAlpha + (1.6 * Math.PI) / 180 * Math.sin((TAU * frame) / 120);
  const T = { x: G.gov.x, y: G.gov.top };
  const sleeveY = T.y - 2 * G.gov.link * Math.cos(alpha);
  const sleeveRest = T.y - 2 * G.gov.link * Math.cos(G.govAlpha);
  // bell lever: arm to the sleeve (240) and to the throttle rod (200)
  const levA = Math.asin(Math.max(-1, Math.min(1, (sleeveY - sleeveRest) / 240)));
  const Lr = { x: G.lever.x - 200 * Math.cos(levA), y: G.lever.y - 200 * Math.sin(levA) };
  // pinion meshing with the 150-tooth rim, sitting in direction 0 from the crankshaft
  const pinion = -(150 / 30) * theta + Math.PI + Math.PI / 30;
  return { pinion, theta, P, B, phi, A, E, Mid, pistonTop, Qa, Sa, Qf, Sf, Ec, R1, beta, R2, Vs, psi, alpha, T, sleeveY, levA, Lr };
};

// --- static parts ------------------------------------------------------------------
const part = (name: string, strokes: Stroke[]): Part => ({ name, strokes });

const foundation = (): Part => {
  const g = G.ground;
  return part("foundation", [
    { d: line(-3200, g, 3600, g), w: "thick" },
    { d: line(-3200, g - 160, 100, g - 160) + line(1900, g - 160, 3600, g - 160), w: "mid" },
    { d: hatch(-3200, g - 160, 3300, 160, 34) + hatch(1900, g - 160, 1700, 160, 34), w: "hair" },
    // flywheel pit
    { d: poly([[100, g], [100, -2520], [1900, -2520], [1900, g]]), w: "mid" },
    { d: hatch(40, -2580, 60, 880, 24) + hatch(1900, -2580, 60, 880, 24) + hatch(40, -2580, 1920, 60, 24), w: "hair" },
    { d: poly([[40, g], [40, -2580], [1960, -2580], [1960, g]]), w: "thin" },
    // plinths
    { d: rect(-1420, g, 840, 100) + rect(-2120, g, 240, 90) + rect(2040, g, 320, 100), w: "mid" },
    { d: hatch(-1420, g, 840, 100, 30, -1) + hatch(2040, g, 320, 100, 30, -1), w: "hair" },
  ]);
};

const column = (): Part => {
  const g = G.ground;
  const s: Stroke[] = [
    { d: rect(-300, g, 600, 90) + rect(-250, g + 90, 500, 60), w: "thick" },
    { d: poly([[-130, g + 150], [-105, -230], [105, -230], [130, g + 150]], true), w: "thick" },
    { d: rect(-230, -230, 460, 50) + rect(-260, -180, 520, 40), w: "thick" },
    { d: rect(-150, -140, 300, 100), w: "thick" },
    { d: circle(0, 0, 70) + circle(0, 0, 30), w: "mid" },
    { d: hatch(-300, g, 600, 90, 28), w: "hair" },
    { d: boltRow(-120, 120, -90, 3, 14) + boltRow(-260, 260, g + 45, 6, 16), w: "thin" },
  ];
  // flutes
  let fl = "";
  for (let i = -3; i <= 3; i++) {
    const t = i / 3.6;
    fl += line(t * 125, g + 170, t * 100, -250);
  }
  s.push({ d: fl, w: "hair" });
  // bracing struts to the plinth
  s.push({ d: line(-260, g + 90, -110, -400) + line(260, g + 90, 110, -400) + line(-230, g + 90, -100, -420) + line(230, g + 90, 100, -420), w: "thin" });
  return part("column", s);
};

const radiusColumn = (): Part => {
  const { x, y } = G.F;
  return part("radiusColumn", [
    { d: rect(x - 100, G.ground + 90, 200, 50), w: "thick" },
    { d: poly([[x - 55, G.ground + 140], [x - 40, y - 80], [x + 40, y - 80], [x + 55, G.ground + 140]], true), w: "thick" },
    { d: rect(x - 70, y - 80, 140, 60) + circle(x, y, 55) + circle(x, y, 24), w: "mid" },
    { d: line(x - 20, G.ground + 160, x - 15, y - 100) + line(x + 20, G.ground + 160, x + 15, y - 100), w: "hair" },
    // tie to the column head
    { d: line(x + 40, y - 40, -260, -170) + line(x + 40, y - 70, -230, -200), w: "thin" },
    { d: boltRow(x - 70, x + 70, y - 50, 3, 10), w: "thin" },
  ]);
};

const cylinder = (): Part => {
  const x0 = G.rodX - G.bore / 2;
  const x1 = G.rodX + G.bore / 2;
  const wall = 44;
  const top = G.cylTop;
  const bot = G.cylBot;
  return part("cylinder", [
    // walls in section
    { d: rect(x0 - wall, bot, wall, top - bot) + rect(x1, bot, wall, top - bot), w: "thick" },
    { d: hatch(x0 - wall, bot, wall, top - bot, 22) + hatch(x1, bot, wall, top - bot, 22), w: "hair" },
    // steam jacket outline
    { d: rect(x0 - wall - 40, bot + 40, G.bore + 2 * wall + 80, top - bot - 80), w: "thin" },
    // covers
    { d: rect(x0 - wall - 70, top, G.bore + 2 * wall + 140, 50) + rect(x0 - wall - 70, bot - 50, G.bore + 2 * wall + 140, 50), w: "thick" },
    { d: hatch(x0 - wall - 70, top, G.bore + 2 * wall + 140, 50, 22, -1) + hatch(x0 - wall - 70, bot - 50, G.bore + 2 * wall + 140, 50, 22, -1), w: "hair" },
    { d: boltRow(x0 - wall - 40, x1 + wall + 40, top + 25, 9, 12) + boltRow(x0 - wall - 40, x1 + wall + 40, bot - 25, 9, 12), w: "thin" },
    // stuffing box and gland
    { d: rect(G.rodX - 80, top + 50, 160, 60) + rect(G.rodX - 110, top + 110, 220, 20) + rect(G.rodX - 50, top + 130, 100, 20), w: "mid" },
    { d: line(G.rodX - 30, top + 50, G.rodX - 30, top + 150) + line(G.rodX + 30, top + 50, G.rodX + 30, top + 150), w: "thin", s: "hidden" },
    // stand
    { d: poly([[x0 - 90, bot - 50], [x0 - 140, G.ground + 100], [x1 + 140, G.ground + 100], [x1 + 90, bot - 50]]), w: "mid" },
    { d: line(x0 - 60, bot - 50, x0 + 60, G.ground + 100) + line(x1 + 60, bot - 50, x1 - 60, G.ground + 100), w: "thin" },
    // ports (hidden)
    { d: poly([[x1, top - 60], [x1 + 80, top - 60]]) + poly([[x1, bot + 60], [x1 + 80, bot + 60]]), w: "thin", s: "hidden" },
  ]);
};

const valveChest = (): Part => {
  const x = G.rodX + G.bore / 2 + 44;
  return part("valveChest", [
    { d: rect(x, -1520, 110, 640), w: "thick" },
    { d: rect(x + 18, -1500, 74, 600), w: "thin" },
    { d: hatch(x, -1520, 18, 640, 18) + hatch(x + 92, -1520, 18, 640, 18), w: "hair" },
    { d: rect(x - 10, -880, 130, 40) + rect(x - 10, -1560, 130, 40), w: "mid" },
    { d: boltRow(x + 10, x + 100, -860, 3, 9) + boltRow(x + 10, x + 100, -1540, 3, 9), w: "thin" },
    // steam inlet up to the main pipe
    { d: line(x + 10, -840, x + 10, G.steamY - 40) + line(x + 60, -840, x + 60, G.steamY - 40), w: "mid" },
    { d: rect(x + 10, -380, 90, 30) + rect(x + 10, 300, 90, 30), w: "thin" },
  ]);
};

const steamPipe = (): Part => {
  const y = G.steamY;
  const x0 = G.rodX + G.bore / 2 + 44 + 10;
  return part("steamPipe", [
    { d: poly([[3600, y + 40], [x0 + 50, y + 40], [x0 + 50, y - 40]]) + poly([[3600, y - 40], [x0 + 110, y - 40]]), w: "mid" },
    { d: poly([[x0 - 20, y - 40], [x0 - 20, y + 90], [3600, y + 90]]), w: "thin" },
    { d: rect(G.throttle.x - 90, y - 90, 180, 180) + circle(G.throttle.x, y, 60) + circle(G.throttle.x, y, 22), w: "thick" },
    { d: rect(G.throttle.x - 40, y - 150, 80, 60), w: "mid" },
    { d: rect(900, y - 60, 30, 120) + rect(-200, y - 60, 30, 120) + rect(2600, y - 60, 30, 120), w: "mid" },
    { d: boltRow(905, 925, y + 75, 2, 8) + boltRow(-195, -175, y + 75, 2, 8), w: "thin" },
  ]);
};

const pumpBarrel = (name: string, x: number, w: number, y0: number, y1: number, guideTop: number): Part => {
  const t = 26;
  return part(name, [
    { d: rect(x - w / 2 - t, y0, t, y1 - y0) + rect(x + w / 2, y0, t, y1 - y0), w: "thick" },
    { d: hatch(x - w / 2 - t, y0, t, y1 - y0, 18) + hatch(x + w / 2, y0, t, y1 - y0, 18), w: "hair" },
    { d: rect(x - w / 2 - 50, y1, w + 100, 34) + rect(x - w / 2 - 50, y0 - 34, w + 100, 34), w: "mid" },
    { d: boltRow(x - w / 2 - 30, x + w / 2 + 30, y1 + 17, 4, 8), w: "thin" },
    // crosshead guides
    { d: rect(x - w / 2 + 6, y1 + 34, 18, guideTop - y1 - 34) + rect(x + w / 2 - 24, y1 + 34, 18, guideTop - y1 - 34), w: "thin" },
    { d: rect(x - w / 2 - 10, guideTop, w + 20, 30), w: "mid" },
    { d: line(x, y0 - 120, x, guideTop + 120), w: "hair", s: "center" },
  ]);
};

const pedestal = (): Part => {
  const { x, y } = G.C;
  return part("crankPedestal", [
    { d: rect(x - 170, y - 120, 340, 240) + rect(x - 210, y - 160, 420, 40), w: "thick" },
    { d: circle(x, y, 95), w: "mid" },
    { d: rect(x - 120, y + 120, 240, 50), w: "mid" },
    { d: boltRow(x - 180, x + 180, y - 140, 4, 12) + boltRow(x - 90, x + 90, y + 145, 2, 12), w: "thin" },
    { d: poly([[x - 210, y - 160], [x - 260, G.ground - 600], [x + 260, G.ground - 600], [x + 210, y - 160]]), w: "mid" },
    { d: hatch(x - 250, G.ground - 600, 500, 80, 24), w: "hair" },
  ]);
};

const governorStand = (): Part => {
  const { x, pulleyY } = G.gov;
  return part("governorStand", [
    { d: rect(x - 140, G.ground + 100, 280, 60), w: "thick" },
    { d: poly([[x - 110, G.ground + 160], [x - 60, pulleyY - 120], [x + 60, pulleyY - 120], [x + 110, G.ground + 160]], true), w: "thick" },
    { d: rect(x - 130, pulleyY - 120, 260, 70) + rect(x - 90, pulleyY + 60, 180, 120), w: "mid" },
    { d: line(x - 30, G.ground + 180, x - 20, pulleyY - 140) + line(x + 30, G.ground + 180, x + 20, pulleyY - 140), w: "hair" },
    { d: boltRow(x - 110, x + 110, G.ground + 130, 4, 12), w: "thin" },
    // spindle and its top bearing bracket
    { d: line(x - 18, pulleyY + 180, x - 18, G.gov.top + 40) + line(x + 18, pulleyY + 180, x + 18, G.gov.top + 40), w: "mid" },
    { d: rect(x - 50, G.gov.top - 10, 100, 60) + circle(x, G.gov.top, 26), w: "mid" },
    { d: poly([[x + 50, G.gov.top + 20], [x + 260, G.gov.top + 20], [x + 260, pulleyY - 50]]), w: "thin" },
    { d: line(x, pulleyY - 200, x, G.gov.top + 200), w: "hair", s: "center" },
    // bevel box (static casing)
    { d: rect(x - 110, pulleyY + 180, 220, 40), w: "mid" },
  ]);
};

const belt = (): Part => {
  const c1 = G.C;
  const c2 = { x: G.gov.x, y: G.gov.pulleyY };
  const r1 = G.gov.drivePulley;
  const r2 = G.gov.pulley;
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx);
  const p = Math.acos((r1 - r2) / d);
  const t = (c: { x: number; y: number }, r: number, a: number) => [c.x + r * Math.cos(a), c.y + r * Math.sin(a)] as const;
  const [a1x, a1y] = t(c1, r1, base + p);
  const [a2x, a2y] = t(c2, r2, base + p);
  const [b1x, b1y] = t(c1, r1, base - p);
  const [b2x, b2y] = t(c2, r2, base - p);
  return part("belt", [{ d: line(a1x, a1y, a2x, a2y) + line(b1x, b1y, b2x, b2y), w: "mid" }]);
};

const construction = (): Part => {
  const C = G.C;
  return part("construction", [
    // centre lines
    {
      d:
        line(0, -2700, 0, 1300) + line(-2600, 0, 2800, 0) + line(C.x, -2700, C.x, 1300) + line(-2600, C.y, 3000, C.y) +
        line(G.rodX, -1800, G.rodX, 700) + line(G.F.x, -1800, G.F.x, 200) + line(-2600, G.F.y, -500, G.F.y),
      w: "hair",
      s: "center",
    },
    // arcs: beam end paths, radius-rod path, crank circle, flywheel construction
    {
      d:
        arc(0, 0, G.L, -0.42, 0.42) + arc(0, 0, G.L, Math.PI - 0.42, Math.PI + 0.42) + arc(G.F.x, G.F.y, G.L, -0.45, 0.45) +
        circle(C.x, C.y, G.crank) + circle(C.x, C.y, G.flyR + 90) + arc(0, 0, 1550, -0.9, 0.3) + arc(C.x, C.y, G.conrod, 1.25, 1.9) +
        arc(0, 0, 2300, 2.6, 3.6) + circle(G.C.x, G.C.y, G.ecc),
      w: "hair",
      s: "construct",
    },
    // long construction lines across the drawing
    {
      d:
        line(-3000, -2300, 3200, 1200) + line(-3000, 900, 3000, -2600) + line(-2400, 1300, 600, -2700) + line(2900, 1300, 300, -2700) +
        line(-3000, -1000, 3400, -400) + line(-1300, 1300, -1300, -2700) + line(-3000, 640, 3400, 640) + line(1500, 1300, 2600, -2700),
      w: "hair",
      s: "construct",
    },
    // governor cone construction
    {
      d:
        line(G.gov.x, G.gov.top, G.gov.x - 600, G.gov.top - 900) + line(G.gov.x, G.gov.top, G.gov.x + 600, G.gov.top - 900) +
        ellipse(G.gov.x, G.gov.top - G.gov.arm * Math.cos(G.govAlpha), G.gov.arm * Math.sin(G.govAlpha), 40),
      w: "hair",
      s: "construct",
    },
  ]);
};

// --- moving parts (rigid, local frames) ----------------------------------------------
const beamPart = (): Part => {
  const Lb = 1090;
  const half = (x: number) => 70 + 200 * (1 - (x / Lb) ** 2);
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  const inT: [number, number][] = [];
  const inB: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const x = -Lb + (2 * Lb * i) / 40;
    top.push([x, half(x)]);
    bot.push([x, -half(x)]);
    const xi = x * 0.9;
    inT.push([xi, half(xi) - 45]);
    inB.push([xi, -(half(xi) - 45)]);
  }
  let holes = "";
  for (const s of [-1, 1]) for (const c of [250, 520, 760]) holes += ellipse(s * c, 0, c === 760 ? 70 : 95, half(c) - 110);
  let rivets = "";
  for (let i = 0; i <= 26; i++) {
    const x = -Lb * 0.88 + (Lb * 1.76 * i) / 26;
    rivets += circle(x, half(x) - 22, 7) + circle(x, -(half(x) - 22), 7);
  }
  return part("beam", [
    { d: poly(top) + poly(bot) + line(-Lb, half(-Lb), -Lb, -half(-Lb)) + line(Lb, half(Lb), Lb, -half(Lb)), w: "thick" },
    { d: poly(inT) + poly(inB), w: "thin" },
    { d: holes, w: "thin" },
    { d: rivets, w: "hair" },
    { d: circle(0, 0, 110) + circle(0, 0, 45) + circle(-G.L, 0, 60) + circle(G.L, 0, 60) + circle(G.airAt, 0, 40) + circle(G.feedAt, 0, 40), w: "mid" },
    { d: circle(-G.L, 0, 22) + circle(G.L, 0, 22) + circle(G.airAt, 0, 16) + circle(G.feedAt, 0, 16), w: "thin" },
    { d: line(-Lb - 60, 0, Lb + 60, 0), w: "hair", s: "center" },
  ]);
};

const pistonRodPart = (): Part => {
  // local origin = linkage midpoint pin; rod hangs down to the piston
  const r = G.rodLen;
  const ph = G.pistonH;
  return part("pistonRod", [
    { d: rect(-70, -60, 140, 100) + circle(0, 0, 30), w: "mid" },
    { d: line(-24, -60, -24, -r) + line(24, -60, 24, -r), w: "thick" },
    // piston inside the cylinder: hidden
    { d: rect(-G.bore / 2 + 4, -r - ph, G.bore - 8, ph) + line(-G.bore / 2 + 4, -r - 30, G.bore / 2 - 4, -r - 30) + line(-G.bore / 2 + 4, -r - 60, G.bore / 2 - 4, -r - 60), w: "thin", s: "hidden" },
  ]);
};

const conrodPart = (): Part => {
  const len = G.conrod;
  const pts: [number, number][] = [];
  const ptsB: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const x = 110 + ((len - 220) * i) / 24;
    const w = 34 + 26 * Math.sin((Math.PI * i) / 24);
    pts.push([x, w]);
    ptsB.push([x, -w]);
  }
  return part("conrod", [
    { d: poly(pts) + poly(ptsB), w: "thick" },
    { d: rect(-80, -90, 190, 180) + rect(len - 110, -100, 200, 200), w: "thick" },
    { d: circle(0, 0, 40) + circle(len, 0, 55), w: "mid" },
    { d: boltRow(-40, 60, 70, 2, 10) + boltRow(-40, 60, -70, 2, 10) + boltRow(len - 60, len + 50, 80, 2, 11) + boltRow(len - 60, len + 50, -80, 2, 11), w: "thin" },
    { d: line(0, 0, len, 0), w: "hair", s: "center" },
  ]);
};

const crankPart = (): Part =>
  part("crank", [
    { d: poly([[0, 150], [G.crank, 85], [G.crank, -85], [0, -150]]) + circle(0, 0, 170) + circle(G.crank, 0, 95), w: "thick" },
    { d: circle(0, 0, 70) + circle(G.crank, 0, 40), w: "mid" },
    { d: circle(0, 0, G.gov.drivePulley), w: "thin", s: "hidden" },
    { d: line(0, 0, G.crank, 0), w: "hair", s: "center" },
  ]);

const flywheelPart = (): Part => {
  const R = G.flyR;
  const s: Stroke[] = [
    { d: circle(0, 0, R) + circle(0, 0, R - 70), w: "thick" },
    { d: circle(0, 0, R - 95) + circle(0, 0, R - 35), w: "thin" },
    { d: circle(0, 0, 220) + circle(0, 0, 160), w: "thick" },
  ];
  let spokes = "";
  let joints = "";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const nx = -sn;
    const ny = c;
    const w0 = 48;
    const w1 = 28;
    spokes += line(c * 220 + nx * w0, sn * 220 + ny * w0, c * (R - 95) + nx * w1, sn * (R - 95) + ny * w1);
    spokes += line(c * 220 - nx * w0, sn * 220 - ny * w0, c * (R - 95) - nx * w1, sn * (R - 95) - ny * w1);
    const ja = a + TAU / 16;
    joints += line(Math.cos(ja) * (R - 95), Math.sin(ja) * (R - 95), Math.cos(ja) * R, Math.sin(ja) * R);
    joints += circle(Math.cos(ja + 0.04) * (R - 50), Math.sin(ja + 0.04) * (R - 50), 9) + circle(Math.cos(ja - 0.04) * (R - 50), Math.sin(ja - 0.04) * (R - 50), 9);
  }
  s.push({ d: spokes, w: "mid" }, { d: joints, w: "thin" }, { d: bolts(0, 0, 190, 8, 10), w: "thin" });
  return part("flywheel", s);
};

const eccentricPart = (): Part =>
  part("eccentric", [
    // centred on the eccentric centre; sheave and strap
    { d: circle(0, 0, 150) + circle(0, 0, 180), w: "mid" },
    { d: boltRow(-190, -190, 0, 1, 12) + circle(190, 0, 12), w: "thin" },
  ]);

const pulley2Part = (): Part => {
  const r = G.gov.pulley;
  let sp = "";
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    sp += line(Math.cos(a) * 30, Math.sin(a) * 30, Math.cos(a) * (r - 18), Math.sin(a) * (r - 18));
  }
  return part("governorPulley", [
    { d: circle(0, 0, r) + circle(0, 0, r - 18) + circle(0, 0, 30), w: "mid" },
    { d: sp, w: "thin" },
  ]);
};

const rockerPart = (): Part =>
  part("valveRocker", [
    // input arm along +x (rotated to beta), output arm along -y (beta - 90deg)
    { d: line(0, 18, G.rockArm, 12) + line(0, -18, G.rockArm, -12) + line(18, 0, 12, -G.rockArm) + line(-18, 0, -12, -G.rockArm), w: "mid" },
    { d: circle(0, 0, 40) + circle(G.rockArm, 0, 22) + circle(0, -G.rockArm, 22), w: "mid" },
    { d: circle(0, 0, 14), w: "thin" },
  ]);

const valveSpindlePart = (): Part =>
  part("valveSpindle", [
    { d: line(-12, 0, -12, 520) + line(12, 0, 12, 520), w: "mid" },
    { d: rect(-36, 120, 72, 180), w: "thin", s: "hidden" },
    { d: rect(-28, -20, 56, 40), w: "mid" },
  ]);

const pumpRodPart = (name: string, len: number, w: number): Part =>
  part(name, [
    { d: rect(-50, -30, 100, 60) + circle(0, 0, 18), w: "mid" },
    { d: line(-14, -30, -14, -len) + line(14, -30, 14, -len), w: "mid" },
    { d: rect(-w / 2 + 3, -len - 60, w - 6, 60), w: "thin", s: "hidden" },
  ]);

const leverPart = (): Part =>
  part("governorLever", [
    { d: line(-200, 10, 240, 10) + line(-200, -10, 240, -10), w: "mid" },
    { d: circle(0, 0, 30) + circle(-200, 0, 18) + circle(240, 0, 18), w: "mid" },
  ]);

const throttleRodPart = (): Part => part("throttleRod", [{ d: line(-9, 0, -9, G.steamY - 150 - G.lever.y) + line(9, 0, 9, G.steamY - 150 - G.lever.y), w: "thin" }]);


// --- extra structure for density (all real parts of an engine house) ---------
const entablature = (): Part => {
  const y0 = 1150;
  const y1 = 1330;
  const x0 = -2700;
  const x1 = 2900;
  let zig = "";
  for (let x = x0; x < x1; x += 180) zig += line(x, y0 + 20, x + 90, y1 - 20) + line(x + 90, y1 - 20, x + 180, y0 + 20);
  let stan = "";
  for (let x = x0 + 60; x < x1; x += 260) stan += line(x, y1, x, y1 + 220) + circle(x, y1 + 220, 10);
  return part("entablature", [
    { d: rect(x0, y0, x1 - x0, y1 - y0) + rect(x0, y0 + 20, x1 - x0, y1 - y0 - 40), w: "thick" },
    { d: zig, w: "thin" },
    { d: boltRow(x0 + 40, x1 - 40, y0 + 10, 60, 6) + boltRow(x0 + 40, x1 - 40, y1 - 10, 60, 6), w: "hair" },
    // gallery railing on top
    { d: stan + line(x0, y1 + 220, x1, y1 + 220) + line(x0, y1 + 120, x1, y1 + 120), w: "thin" },
    // hangers down to the radius column (the beam pivot stands on its own column)
    { d: line(G.F.x - 40, y0, G.F.x - 40, G.F.y + 60) + line(G.F.x + 40, y0, G.F.x + 40, G.F.y + 60), w: "mid" },
    { d: hatch(-200, 1150 - 120, 400, 120, 24), w: "hair" },
    { d: rect(-260, y0 - 140, 520, 140), w: "mid" },
    { d: line(G.gov.x + 260, G.gov.top + 20, G.gov.x + 260, y0) + line(2600, y0, 2600, G.ground + 100) + line(2660, y0, 2660, G.ground + 100), w: "thin" },
  ]);
};

const ladder = (): Part => {
  const x = -1640;
  let rungs = "";
  for (let y = G.ground + 60; y < 1150; y += 110) rungs += line(x - 70, y, x + 70, y);
  return part("ladder", [
    { d: line(x - 70, G.ground, x - 70, 1500) + line(x + 70, G.ground, x + 70, 1500), w: "mid" },
    { d: rungs, w: "thin" },
    { d: line(x - 70, 1500, x - 160, 1560) + line(x + 70, 1500, x + 160, 1560), w: "thin" },
  ]);
};

const condenser = (): Part => {
  const x0 = -1500;
  const x1 = -260;
  const y0 = -2350;
  const y1 = G.ground - 160;
  let tubes = "";
  for (let y = y0 + 80; y < y1 - 40; y += 55) tubes += line(x0 + 80, y, x1 - 80, y);
  return part("condenser", [
    { d: rect(x0, y0, x1 - x0, y1 - y0), w: "thick" },
    { d: rect(x0 + 40, y0 + 40, x1 - x0 - 80, y1 - y0 - 80), w: "thin" },
    { d: hatch(x0, y0, 40, y1 - y0, 20) + hatch(x1 - 40, y0, 40, y1 - y0, 20) + hatch(x0, y0, x1 - x0, 40, 20), w: "hair" },
    { d: tubes, w: "hair", s: "hidden" },
    // exhaust from the cylinder bottom and the air-pump suction
    { d: line(G.rodX - 40, G.cylBot - 50, G.rodX - 40, y1) + line(G.rodX + 40, G.cylBot - 50, G.rodX + 40, y1) + line(G.airAt - 40, -1384, G.airAt - 40, y1) + line(G.airAt + 40, -1384, G.airAt + 40, y1), w: "mid" },
    { d: circle(x0 + 160, y0 + 200, 60) + circle(x1 - 160, y0 + 200, 60) + bolts(x0 + 160, y0 + 200, 45, 6, 6) + bolts(x1 - 160, y0 + 200, 45, 6, 6), w: "thin" },
  ]);
};

const safetyValve = (): Part => {
  const x = 1250;
  const y = G.steamY + 90;
  let coil = "";
  for (let i = 0; i < 9; i++) coil += line(x - 40, y + 60 + i * 26, x + 40, y + 73 + i * 26);
  return part("safetyValve", [
    { d: rect(x - 70, y, 140, 60) + rect(x - 50, y + 300, 100, 40) + line(x - 45, y + 60, x - 45, y + 300) + line(x + 45, y + 60, x + 45, y + 300), w: "mid" },
    { d: coil, w: "thin" },
    { d: line(x, y + 340, x + 420, y + 380) + circle(x + 420, y + 380, 30) + circle(x + 300, y + 368, 14), w: "thin" },
    // pressure gauge on a siphon
    { d: circle(x + 640, y + 200, 110) + circle(x + 640, y + 200, 92) + line(x + 640, y + 90, x + 640, y - 40) + arc(x + 640, y + 30, 40, Math.PI, TAU), w: "mid" },
    { d: (() => { let t = ""; for (let i = 0; i <= 12; i++) { const a = Math.PI * 1.25 - (i / 12) * Math.PI * 1.5; t += line(x + 640 + Math.cos(a) * 80, y + 200 + Math.sin(a) * 80, x + 640 + Math.cos(a) * 92, y + 200 + Math.sin(a) * 92); } return t; })(), w: "hair" },
  ]);
};

// Toothed rim on the flywheel (150 teeth) drives a 30-tooth pinion (5:1).
export const RIM_TEETH = 150;
export const PINION_TEETH = 30;
const rimPitch = G.flyR + 30;
export const PINION = { x: 0, y: 0, r: (rimPitch * PINION_TEETH) / RIM_TEETH };
PINION.x = G.C.x + rimPitch + PINION.r;
PINION.y = G.C.y;
const teethRing = (r: number, n: number, depth: number) => {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const a0 = a - (0.22 * TAU) / n;
    const a1 = a + (0.22 * TAU) / n;
    d += poly([[Math.cos(a0 - 0.08 * TAU / n) * (r - depth / 2), Math.sin(a0 - 0.08 * TAU / n) * (r - depth / 2)], [Math.cos(a0) * (r + depth / 2), Math.sin(a0) * (r + depth / 2)], [Math.cos(a1) * (r + depth / 2), Math.sin(a1) * (r + depth / 2)], [Math.cos(a1 + 0.08 * TAU / n) * (r - depth / 2), Math.sin(a1 + 0.08 * TAU / n) * (r - depth / 2)]]);
  }
  return d;
};
const rimTeethPart = (): Part => part("flywheelTeeth", [{ d: teethRing(rimPitch, RIM_TEETH, 22) + circle(0, 0, rimPitch - 11), w: "thin" }]);
const pinionPart = (): Part => {
  let sp = "";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    sp += line(Math.cos(a) * 40, Math.sin(a) * 40, Math.cos(a) * (PINION.r - 30), Math.sin(a) * (PINION.r - 30));
  }
  return part("pinion", [
    { d: teethRing(PINION.r, PINION_TEETH, 22) + circle(0, 0, PINION.r - 11) + circle(0, 0, PINION.r - 30), w: "thin" },
    { d: circle(0, 0, 40) + circle(0, 0, 16), w: "mid" },
    { d: sp, w: "thin" },
  ]);
};
const pinionPedestal = (): Part =>
  part("pinionPedestal", [
    { d: rect(PINION.x - 90, PINION.y - 70, 180, 140) + poly([[PINION.x - 90, PINION.y - 70], [PINION.x - 130, G.ground - 160], [PINION.x + 130, G.ground - 160], [PINION.x + 90, PINION.y - 70]]), w: "mid" },
    { d: line(PINION.x, PINION.y, 3600, PINION.y) + line(PINION.x, PINION.y + 30, 3600, PINION.y + 30) + line(PINION.x, PINION.y - 30, 3600, PINION.y - 30), w: "thin" },
    { d: rect(2900, PINION.y - 110, 140, 220) + rect(3200, PINION.y - 90, 80, 180), w: "mid" },
  ]);

// Air vessels and a steam receiver: wireframe spheres on their pipes.
const globe = (cx: number, cy: number, R: number) => {
  let d = circle(cx, cy, R);
  for (let i = 1; i < 6; i++) d += ellipse(cx, cy, R * Math.cos((i * Math.PI) / 12), R, 36);
  for (const t of [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]) {
    const w = Math.sqrt(1 - t * t) * R;
    d += ellipse(cx, cy + t * R, w, w * 0.18, 36);
  }
  return d;
};
const vessels = (): Part =>
  part("airVessels", [
    { d: circle(-2420, -950, 190) + circle(2760, -380, 160) + circle(300, G.steamY + 260, 170), w: "mid" },
    { d: globe(-2420, -950, 190) + globe(2760, -380, 160) + globe(300, G.steamY + 260, 170), w: "hair" },
    { d: rect(-2470, -1180, 100, 50) + line(-2420, -1180, -2420, G.ground) + rect(2710, -580, 100, 50) + line(2760, -580, 2760, G.ground + 100) + rect(250, G.steamY + 60, 100, 40), w: "thin" },
    { d: poly([[-2420, -760], [-2420, -600], [G.airAt - 120, -600], [G.airAt - 120, -950]]) + poly([[2760, -220], [2760, -120], [G.feedAt + 90, -120], [G.feedAt + 90, -720]]), w: "thin" },
  ]);
const rack = (): Part => {
  let t = "";
  for (let x = -2600; x < 2800; x += 36) t += poly([[x, 1330], [x + 8, 1372], [x + 22, 1372], [x + 30, 1330]]);
  return part("rack", [{ d: t, w: "hair" }, { d: line(-2600, 1372, 2800, 1372) + line(-2600, 1400, 2800, 1400), w: "thin" }]);
};

// Build once.
export const PARTS = {
  airVessels: vessels(),
  rack: rack(),
  entablature: entablature(),
  ladder: ladder(),
  condenser: condenser(),
  safetyValve: safetyValve(),
  flywheelTeeth: rimTeethPart(),
  pinion: pinionPart(),
  pinionPedestal: pinionPedestal(),
  construction: construction(),
  foundation: foundation(),
  column: column(),
  radiusColumn: radiusColumn(),
  cylinder: cylinder(),
  valveChest: valveChest(),
  steamPipe: steamPipe(),
  airPump: pumpBarrel("airPump", G.airAt, 170, -1350, -950, -480),
  feedPump: pumpBarrel("feedPump", G.feedAt, 110, -1020, -720, -400),
  crankPedestal: pedestal(),
  governorStand: governorStand(),
  belt: belt(),
  beam: beamPart(),
  wattCoupler: part("wattCoupler", link(G.wattC, 60, 48, 20)),
  radiusRod: part("radiusRod", link(G.L, 50, 44, 18)),
  pistonRod: pistonRodPart(),
  conrod: conrodPart(),
  crank: crankPart(),
  flywheel: flywheelPart(),
  eccentric: eccentricPart(),
  eccentricRod: part("eccentricRod", link(G.eccRod, 30, 30, 12)),
  valveRocker: rockerPart(),
  valveLink: part("valveLink", link(G.valveLink, 22, 22, 9)),
  valveSpindle: valveSpindlePart(),
  airPumpLink: part("airPumpLink", link(G.airLink, 34, 34, 14)),
  airPumpRod: pumpRodPart("airPumpRod", G.airRod, 170),
  feedPumpLink: part("feedPumpLink", link(G.feedLink, 30, 30, 12)),
  feedPumpRod: pumpRodPart("feedPumpRod", G.feedRod, 110),
  governorPulley: pulley2Part(),
  governorLever: leverPart(),
  throttleRod: throttleRodPart(),
};

const linkXf = (p: { x: number; y: number }, q: { x: number; y: number }): Xf => ({ x: p.x, y: p.y, a: Math.atan2(q.y - p.y, q.x - p.x) });

// Governor: parts whose projected shape changes as it spins (rebuilt per frame).
export const governorStrokes = (ps: Pose): Stroke[] => {
  const { gov } = G;
  const T = ps.T;
  const sa = Math.sin(ps.alpha);
  const ca = Math.cos(ps.alpha);
  const out: Stroke[] = [];
  const balls: { x: number; y: number; z: number; ang: number }[] = [];
  let arms = "";
  let links = "";
  for (const k of [0, Math.PI]) {
    const ang = ps.psi + k;
    const rx = Math.cos(ang);
    const z = Math.sin(ang);
    const bx = T.x + gov.arm * sa * rx;
    const by = T.y - gov.arm * ca;
    balls.push({ x: bx, y: by, z, ang });
    arms += line(T.x, T.y, bx, by);
    const mx = T.x + gov.link * sa * rx;
    const my = T.y - gov.link * ca;
    links += line(mx, my, T.x + 14 * rx, ps.sleeveY);
  }
  out.push({ d: arms, w: "mid" }, { d: links, w: "thin" });
  out.push({ d: rect(T.x - 34, ps.sleeveY - 30, 68, 60) + line(T.x - 50, ps.sleeveY - 40, T.x + 50, ps.sleeveY - 40), w: "mid" });
  // wireframe balls: outline, rotating meridians, latitudes
  for (const b of balls) {
    const R = gov.ballR;
    let mer = "";
    for (let i = 0; i < 6; i++) {
      const a = b.ang * 1.0 + (i * Math.PI) / 6;
      const rx = Math.abs(Math.cos(a)) * R;
      if (rx > 2) mer += ellipse(b.x, b.y, rx, R, 32);
      else mer += line(b.x, b.y - R, b.x, b.y + R);
    }
    let lat = "";
    for (const t of [-0.66, -0.33, 0, 0.33, 0.66]) {
      const yy = b.y + t * R;
      const w = Math.sqrt(1 - t * t) * R;
      lat += line(b.x - w, yy, b.x + w, yy);
    }
    out.push({ d: circle(b.x, b.y, R), w: "mid", s: b.z < -0.2 ? "solid" : "solid" }, { d: mer + lat, w: "hair" });
  }
  // bevel gears at the foot of the spindle: teeth lines move as it turns
  let teeth = "";
  const by = gov.pulleyY + 180;
  for (let i = 0; i < 16; i++) {
    const a = ps.psi + (i / 16) * TAU;
    if (Math.sin(a) < 0) continue;
    const c = Math.cos(a);
    teeth += line(G.gov.x + c * 90, by + 40, G.gov.x + c * 60, by + 80);
  }
  out.push({ d: poly([[gov.x - 95, by + 40], [gov.x - 60, by + 80], [gov.x + 60, by + 80], [gov.x + 95, by + 40]], true), w: "mid" }, { d: teeth, w: "hair" });
  return out;
};

// Everything placed for one crank angle.
export const drawList = (ps: Pose): Placed[] => {
  const P = PARTS;
  const id: Xf = { x: 0, y: 0, a: 0 };
  return [
    { part: P.construction, xf: id },
    { part: P.foundation, xf: id },
    { part: P.entablature, xf: id },
    { part: P.ladder, xf: id },
    { part: P.airVessels, xf: id },
    { part: P.rack, xf: id },
    { part: P.condenser, xf: id },
    { part: P.safetyValve, xf: id },
    { part: P.pinionPedestal, xf: id },
    { part: P.column, xf: id },
    { part: P.radiusColumn, xf: id },
    { part: P.cylinder, xf: id },
    { part: P.valveChest, xf: id },
    { part: P.steamPipe, xf: id },
    { part: P.airPump, xf: id },
    { part: P.feedPump, xf: id },
    { part: P.crankPedestal, xf: id },
    { part: P.governorStand, xf: id },
    { part: P.belt, xf: id },
    { part: P.flywheel, xf: { x: G.C.x, y: G.C.y, a: ps.theta } },
    { part: P.flywheelTeeth, xf: { x: G.C.x, y: G.C.y, a: ps.theta } },
    { part: P.pinion, xf: { x: PINION.x, y: PINION.y, a: ps.pinion } },
    { part: P.crank, xf: { x: G.C.x, y: G.C.y, a: ps.theta } },
    { part: P.eccentric, xf: { x: ps.Ec.x, y: ps.Ec.y, a: ps.theta } },
    { part: P.eccentricRod, xf: linkXf(ps.Ec, ps.R1) },
    { part: P.valveRocker, xf: { x: G.rocker.x, y: G.rocker.y, a: ps.beta } },
    { part: P.valveLink, xf: linkXf(ps.R2, ps.Vs) },
    { part: P.valveSpindle, xf: { x: ps.Vs.x, y: ps.Vs.y, a: 0 } },
    { part: P.beam, xf: { x: 0, y: 0, a: ps.phi } },
    { part: P.conrod, xf: linkXf(ps.B, ps.P) },
    { part: P.wattCoupler, xf: linkXf(ps.A, ps.E) },
    { part: P.radiusRod, xf: linkXf(G.F, ps.E) },
    { part: P.pistonRod, xf: { x: G.rodX, y: ps.Mid.y, a: 0 } },
    { part: P.airPumpLink, xf: linkXf(ps.Qa, ps.Sa) },
    { part: P.airPumpRod, xf: { x: ps.Sa.x, y: ps.Sa.y, a: 0 } },
    { part: P.feedPumpLink, xf: linkXf(ps.Qf, ps.Sf) },
    { part: P.feedPumpRod, xf: { x: ps.Sf.x, y: ps.Sf.y, a: 0 } },
    { part: P.governorPulley, xf: { x: G.gov.x, y: G.gov.pulleyY, a: ps.psi } },
    { part: P.governorLever, xf: { x: G.lever.x, y: G.lever.y, a: ps.levA } },
    { part: P.throttleRod, xf: { x: ps.Lr.x, y: ps.Lr.y, a: 0 } },
    { part: { name: "governor", strokes: governorStrokes(ps) }, xf: id },
  ];
};

// Crank angle for a frame: 10 revolutions in 600 frames, clockwise on screen.
export const ENGINE_LOOP = 600;
export const crankAngle = (frame: number) => -TAU * 10 * ((((frame % ENGINE_LOOP) + ENGINE_LOOP) % ENGINE_LOOP) / ENGINE_LOOP);
