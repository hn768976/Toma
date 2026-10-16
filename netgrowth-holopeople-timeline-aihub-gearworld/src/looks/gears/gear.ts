// Involute spur-gear outlines + exact meshing phases.
export type GearStyle = "spokes" | "fine" | "holes" | "solid" | "button";

const PRESSURE = (20 * Math.PI) / 180;
const inv = (a: number) => Math.tan(a) - a;

export type GearShape = { N: number; m: number; rp: number; ra: number; rd: number; path: Path2D };

export const gearShape = (N: number, m: number, style: GearStyle, seed: number): GearShape => {
  const rp = (m * N) / 2;
  const ra = rp + m;
  const rd = rp - 1.25 * m;
  const rb = rp * Math.cos(PRESSURE);
  const halfPitch = Math.PI / (2 * N) + inv(PRESSURE);
  const halfAt = (r: number) => halfPitch - inv(Math.acos(Math.min(1, rb / r)));
  const path = new Path2D();
  const rStart = Math.max(rb, rd);
  const SAMPLES = 5;
  for (let k = 0; k < N; k++) {
    const c = (k * 2 * Math.PI) / N;
    const a0 = c - Math.PI / N; // middle of the gap before this tooth
    if (k === 0) path.moveTo(rd * Math.cos(a0), rd * Math.sin(a0));
    // root arc up to the left flank
    const left0 = c - halfAt(rStart);
    path.arc(0, 0, rd, a0, left0);
    // left flank (involute), rising
    for (let i = 0; i <= SAMPLES; i++) {
      const r = rStart + ((ra - rStart) * i) / SAMPLES;
      const a = c - halfAt(r);
      path.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    // tip
    path.arc(0, 0, ra, c - halfAt(ra), c + halfAt(ra));
    // right flank, falling
    for (let i = SAMPLES; i >= 0; i--) {
      const r = rStart + ((ra - rStart) * i) / SAMPLES;
      const a = c + halfAt(r);
      path.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    path.arc(0, 0, rd, c + halfAt(rStart), c + Math.PI / N);
  }
  path.closePath();

  // cut-outs (filled with evenodd)
  const rin = rd - Math.max(3, m * 1.6);
  if (style === "spokes" || style === "fine") {
    const spokes = style === "fine" ? 16 : 5 + (seed % 4);
    const hub = Math.max(rp * (style === "fine" ? 0.2 : 0.28), 5);
    const w = style === "fine" ? Math.max(1.2, rp * 0.022) : Math.max(2.5, rp * 0.09);
    for (let s = 0; s < spokes; s++) {
      const a0 = (s / spokes) * Math.PI * 2;
      const a1 = ((s + 1) / spokes) * Math.PI * 2;
      const da0 = Math.asin(Math.min(0.9, w / rin));
      const dh0 = Math.asin(Math.min(0.9, w / hub));
      path.moveTo(hub * Math.cos(a0 + dh0), hub * Math.sin(a0 + dh0));
      path.arc(0, 0, rin, a0 + da0, a1 - da0);
      path.arc(0, 0, hub, a1 - dh0, a0 + dh0, true);
      path.closePath();
    }
    path.moveTo(hub * 0.45, 0);
    path.arc(0, 0, hub * 0.45, 0, Math.PI * 2);
  } else if (style === "button") {
    // round "button" face: two dots and a slot
    for (const sx of [-1, 1]) {
      const x = sx * rin * 0.32;
      const y = -rin * 0.2;
      path.moveTo(x + rin * 0.13, y);
      path.arc(x, y, rin * 0.13, 0, Math.PI * 2);
    }
    const sw = rin * 0.7;
    const sh = rin * 0.16;
    path.roundRect(-sw / 2, rin * 0.22, sw, sh, sh / 2);
  } else if (style === "holes") {
    const n = 3 + (seed % 3);
    const rr = rin * 0.32;
    for (let s = 0; s < n; s++) {
      const a = (s / n) * Math.PI * 2;
      const x = Math.cos(a) * rin * 0.55;
      const y = Math.sin(a) * rin * 0.55;
      path.moveTo(x + rr, y);
      path.arc(x, y, rr, 0, Math.PI * 2);
    }
    path.moveTo(rin * 0.15, 0);
    path.arc(0, 0, rin * 0.15, 0, Math.PI * 2);
  } else {
    path.moveTo(rin, 0);
    path.arc(0, 0, rin, 0, Math.PI * 2);
    path.moveTo(rin * 0.78, 0);
    path.arc(0, 0, rin * 0.78, 0, Math.PI * 2);
    path.moveTo(rin * 0.22, 0);
    path.arc(0, 0, rin * 0.22, 0, Math.PI * 2);
  }
  return { N, m, rp, ra, rd, path };
};

export type PlacedGear = {
  x: number;
  y: number;
  shape: GearShape;
  dir: 1 | -1;
  phase: number; // angle at t = 0
  style: GearStyle;
};

// Build a train: every gear in it shares one module, so meshes are exact.
// spec: [parentIndex, angleDeg, N, style]; the root is placed at (x0, y0).
export const buildTrain = (
  x0: number,
  y0: number,
  rootN: number,
  m: number,
  spec: [number, number, number, GearStyle][],
  rootStyle: GearStyle,
  rootPhase = 0,
): PlacedGear[] => {
  const gears: PlacedGear[] = [{ x: x0, y: y0, shape: gearShape(rootN, m, rootStyle, rootN), dir: 1, phase: rootPhase, style: rootStyle }];
  for (const [p, deg, N, style] of spec) {
    const A = gears[p];
    const phi = (deg * Math.PI) / 180;
    const d = (m * (A.shape.N + N)) / 2;
    const x = A.x + Math.cos(phi) * d;
    const y = A.y + Math.sin(phi) * d;
    // u_A + u_B must be 1/2 (tooth meets gap) at the contact point
    const uA = ((phi - A.phase) * A.shape.N) / (2 * Math.PI);
    const phase = phi + Math.PI - ((0.5 - uA) * 2 * Math.PI) / N;
    gears.push({ x, y, shape: gearShape(N, m, style, N + p), dir: (A.dir * -1) as 1 | -1, phase, style });
  }
  return gears;
};

// Same as buildTrain but each child is aimed at a target point; its exact
// position is then forced onto the mesh circle of its parent.
export const buildTrainToward = (
  root: { x: number; y: number; N: number; style: GearStyle; phase?: number },
  m: number,
  spec: { parent: number; x: number; y: number; N: number; style: GearStyle }[],
): PlacedGear[] => {
  const pts: { x: number; y: number }[] = [{ x: root.x, y: root.y }];
  const rows: [number, number, number, GearStyle][] = [];
  for (const g of spec) {
    const P = pts[g.parent];
    const deg = (Math.atan2(g.y - P.y, g.x - P.x) * 180) / Math.PI;
    const parentN = g.parent === 0 ? root.N : spec[g.parent - 1].N;
    const d = (m * (parentN + g.N)) / 2;
    pts.push({ x: P.x + Math.cos((deg * Math.PI) / 180) * d, y: P.y + Math.sin((deg * Math.PI) / 180) * d });
    rows.push([g.parent, deg, g.N, g.style]);
  }
  return buildTrain(root.x, root.y, root.N, m, rows, root.style, root.phase ?? 0);
};

// Angle of a gear at loop position t (0..1); `teeth` = teeth advanced per loop
// (an integer, so the loop is exact; equal along the train so meshes hold).
export const gearAngle = (g: PlacedGear, t: number, teeth: number) => g.phase + (g.dir * 2 * Math.PI * teeth * t) / g.shape.N;
