// Choreography. Every path, docking order and timing below is generated once
// at module load from seeded mulberry32 streams; each pose is then a pure
// function of (block index, frame). No state is carried between frames.
import type { Story } from "../versions";
import { BLOCK, WALLET, makeSlots, type Slot } from "./layout";
import {
  bezier,
  clamp01,
  easeInOutCubic,
  boxesIntersect,
  cubesIntersect,
  easeInOutSine,
  easeInQuad,
  easeOutCubic,
  lerp,
  mulberry32,
  remap,
  smooth,
  v3add,
  type V3,
} from "./math";

export type BlockPose = {
  visible: boolean;
  pos: V3;
  rot: V3;
  scale?: number;
  edge: number; // edge brightness multiplier
  docked: boolean;
};

type FlightBlock = {
  kind: "chain" | "swirl";
  slot: Slot;
  s: number; // position along the docked L (0 = bottom-left, 12 = top-right)
  dock: number; // frame it seats in the slot
  start: number; // frame it leaves the swirl (or appears, for chains)
  dur: number;
  p0: V3;
  p1: V3;
  p2: V3;
  rot0: V3;
  orbit?: { r: number; y: number; w: number; phi: number; psi: number };
};

const TAU = Math.PI * 2;
const CENTER: V3 = [0, 0.1, 0];
const ZERO: V3 = [0, 0, 0];

const slotS = (slot: Slot) => (slot.edge === "top" ? 6 + slot.along : 6 - slot.along);

const find = (slots: Slot[], edge: Slot["edge"], along: number, layer: number) =>
  slots.find((s) => s.edge === edge && s.along === along && s.layer === layer)!;

function orbitPos(b: FlightBlock, f: number): V3 {
  const o = b.orbit!;
  const a = o.phi + o.w * f;
  return [CENTER[0] + o.r * Math.cos(a), o.y + 0.06 * Math.sin(0.07 * f + o.psi), CENTER[2] + o.r * Math.sin(a)];
}
function orbitVel(b: FlightBlock, f: number): V3 {
  const o = b.orbit!;
  const a = o.phi + o.w * f;
  return [-o.r * o.w * Math.sin(a), 0.06 * 0.07 * Math.cos(0.07 * f + o.psi), o.r * o.w * Math.cos(a)];
}

const scale3 = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];

// Tumble is gone by 70% of the flight, so a block slides past its docked
// neighbours square-on.
const settle = (t: number) => 1 - easeInOutCubic(t / 0.7);

// Pose while free (before docking). Pure function of the block's parameters.
const flightPose = (b: FlightBlock, f: number): { visible: boolean; pos: V3; rot: V3 } => {
  if (b.kind === "chain") {
    if (f < b.start) return { visible: false, pos: b.p0, rot: b.rot0 };
    const t = (f - b.start) / b.dur;
    // Launched off-screen, so only the arrival needs easing.
    return { visible: true, pos: bezier(b.p0, b.p1, b.p2, b.slot.pos, easeOutCubic(t)), rot: scale3(b.rot0, settle(t)) };
  }
  const spin = (ff: number): V3 => [b.rot0[0] + 0.011 * ff, b.rot0[1] + 0.014 * ff, b.rot0[2]];
  if (f < b.start) return { visible: true, pos: orbitPos(b, f), rot: spin(f) };
  const t = (f - b.start) / b.dur;
  return { visible: true, pos: bezier(b.p0, b.p1, b.p2, b.slot.pos, easeOutCubic(t)), rot: scale3(spin(b.start), settle(t)) };
};

const dockBounce = (b: FlightBlock, f: number): V3 => {
  const t = f - b.dock;
  if (t <= 0 || t >= 8) return b.slot.pos;
  // Slots are only 15 mm apart, so the push is tiny; dockSquash() adds the rest.
  const k = -0.01 * Math.sin((Math.PI * t) / 8) * Math.exp(-t / 5);
  const n = b.slot.normal;
  return [b.slot.pos[0] + n[0] * k, b.slot.pos[1] + n[1] * k, b.slot.pos[2] + n[2] * k];
};

// Docking bounce: a quick squash that settles in ~8 frames.
const dockSquash = (b: FlightBlock, f: number) => {
  const t = f - b.dock;
  return t <= 0 || t >= 8 ? 1 : 1 - 0.07 * Math.sin((Math.PI * t) / 8) * Math.exp(-t / 5);
};

const rawPose = (b: FlightBlock, f: number) =>
  f >= b.dock ? { visible: true, pos: dockBounce(b, f), rot: ZERO, docked: true } : { ...flightPose(b, f), docked: false };

// --- Collision-free placement ---------------------------------------------
// Blocks are placed one at a time in docking order. Each candidate path is
// checked frame by frame (exact cube-vs-cube separating-axis test) against
// every block already placed; the first candidate that never touches one is
// kept. This is a one-off, seeded search at module load, not a simulation.
const SEARCH_FRAMES = 300;
type Track = { dock: number; vis: Uint8Array; pos: V3[]; rot: V3[] };

const trackOf = (b: FlightBlock): Track => {
  const t: Track = { dock: b.dock, vis: new Uint8Array(SEARCH_FRAMES), pos: [], rot: [] };
  for (let f = 0; f < SEARCH_FRAMES; f++) {
    const p = rawPose(b, f);
    t.vis[f] = p.visible ? 1 : 0;
    t.pos.push(p.pos);
    t.rot.push(p.rot);
  }
  return t;
};

// The wallet body (and strap) as a box blocks must not fly through.
const BODY_HALF: V3 = [WALLET.w / 2 + 0.07, WALLET.h / 2, WALLET.d / 2];
const BLOCK_HALF: V3 = [BLOCK.size / 2, BLOCK.size / 2, BLOCK.size / 2];

const hits = (c: FlightBlock, placed: Track[], cap: number) => {
  let n = 0;
  for (let f = 0; f < SEARCH_FRAMES; f++) {
    const p = rawPose(c, f);
    if (!p.visible) continue;
    if (!p.docked && boxesIntersect(p.pos, p.rot, BLOCK_HALF, [0.035, 0, 0], ZERO, BODY_HALF)) {
      n++;
      if (n >= cap) return n;
    }
    for (const t of placed) {
      if (!t.vis[f] || (p.docked && f >= t.dock)) continue;
      if (cubesIntersect(p.pos, p.rot, t.pos[f], t.rot[f], BLOCK.size, 0.005)) {
        n++;
        if (n >= cap) return n;
      }
    }
  }
  return n;
};

// Blocks that could not be placed cleanly (empty when the search succeeded).
export const SEARCH_REPORT: string[] = [];

const place = (name: string, count: number, make: (i: number, attempt: number) => FlightBlock) => {
  const placed: Track[] = [];
  const out: FlightBlock[] = [];
  for (let i = 0; i < count; i++) {
    let best: FlightBlock | null = null;
    let bestHits = Infinity;
    for (let attempt = 0; attempt < 900 && bestHits > 0; attempt++) {
      const c = make(i, attempt);
      const h = hits(c, placed, bestHits);
      if (h < bestHits) {
        best = c;
        bestHits = h;
      }
    }
    if (bestHits > 0) SEARCH_REPORT.push(`${name} block ${i}: touches on ${bestHits} frame(s)`);
    out.push(best!);
    placed.push(trackOf(best!));
  }
  return out;
};

// --- Story 1: blocks fly in from the upper right in linked chains --------
const buildBlocksStory = () => {
  const rng = mulberry32(0x5eed01);
  const slots = makeSlots(2);
  const order: Slot[] = [];
  for (let c = 6; c >= 0; c--) for (const l of [1, 0]) order.push(find(slots, "top", c, l));
  for (let r = 1; r <= 6; r++) for (const l of [1, 0]) order.push(find(slots, "left", r, l));

  // Groups of 3-5 that share a launch point, a swing and a flight time.
  const groupOf: { g: number; j: number }[] = [];
  const groups: { size: number; dur: number; S: V3; swing: number; members: number[] }[] = [];
  for (let i = 0; i < order.length; ) {
    const size = Math.min(order.length - i, 3 + Math.floor(rng() * 3));
    const g = { size, dur: 46 + Math.floor(rng() * 8), S: [6.4 + rng() * 0.8, 4.0 + rng() * 0.8, -2.2 + rng() * 1.4] as V3, swing: rng(), members: [] as number[] };
    for (let j = 0; j < size; j++, i++) {
      groupOf.push({ g: groups.length, j });
      g.members.push(i);
    }
    groups.push(g);
  }

  const blocks = place("blocks", order.length, (i, attempt) => {
    const slot = order[i];
    const { g, j } = groupOf[i];
    const G = groups[g];
    const jit = 0.15 + Math.min(attempt, 40) * 0.025;
    const J = (): V3 => [(rng() - 0.5) * jit, (rng() - 0.5) * jit, (rng() - 0.5) * jit];
    const dock = 70 + i * 5;
    const dur = G.dur + (attempt > 0 ? Math.round((rng() - 0.5) * Math.min(attempt, 24)) : 0);
    const lean = Math.min(1.5, attempt / 40);
    const A = (): V3 => [(rng() - 0.5) * 0.9 * lean, (rng() - 0.5) * 0.9 * lean, (rng() - 0.5) * 0.4 * lean];
    // Members launch from points strung out behind the leader, so the chain
    // is already spaced out when it enters the frame.
    const p0 = v3add([G.S[0] + j * 0.55, G.S[1] + j * 0.4, G.S[2] - j * 0.2], J());
    let p1: V3;
    let p2: V3;
    if (slot.edge === "top" && slot.along > 0) {
      p1 = v3add([p0[0] - 2.2, p0[1] - 0.6 - G.swing * 0.5, p0[2] + 2.0], J());
      p2 = v3add(v3add(slot.pos, [-0.3, 1.5, -0.25]), A());
    } else if (slot.edge === "top") {
      p1 = v3add([p0[0] - 2.6, p0[1] - 0.4, p0[2] + 2.2], J());
      p2 = v3add(v3add(slot.pos, [-1.1, 1.1, -0.25]), A());
    } else {
      p1 = v3add([-1.7 - G.swing * 0.4, 2.5, -1.5], J());
      p2 = v3add(v3add(slot.pos, [-1.6, -0.3, -0.25]), A());
    }
    return {
      kind: "chain",
      slot,
      s: slotS(slot),
      dock,
      start: dock - dur,
      dur,
      p0,
      p1,
      p2,
      rot0: [(rng() - 0.5) * 1.6, (rng() - 0.5) * 1.6, (rng() - 0.5) * 1.6],
    } satisfies FlightBlock;
  });
  const links: [number, number][] = [];
  for (const G of groups) for (let j = 0; j + 1 < G.members.length; j++) links.push([G.members[j], G.members[j + 1]]);
  return { blocks, links };
};

// --- Story 2/3: a swirling linked cloud that streams in and docks ----------
const buildSecureStory = () => {
  const rng = mulberry32(0x5eed02);
  const slots = makeSlots(3);
  const order: Slot[] = [];
  const pushPos = (edge: Slot["edge"], along: number) => {
    for (const l of [2, 1, 0]) order.push(find(slots, edge, along, l));
  };
  pushPos("top", 0);
  for (let k = 1; k <= 6; k++) {
    pushPos("left", k);
    pushPos("top", k);
  }
  // One shared swirl speed: the cloud turns as a whole while it waits.
  const W = 0.017;
  const blocks = place("secure", order.length, (i, attempt) => {
    const slot = order[i];
    const dock = 46 + i * 1.9;
    const dur = 30 + rng() * 8;
    const start = dock - dur;
    const left = slot.edge === "left";
    const thetaDep = left ? ((100 + rng() * 70) * Math.PI) / 180 : ((30 + rng() * 120) * Math.PI) / 180;
    const r = 2.0 + rng() * 0.75;
    const y = left ? slot.pos[1] - 0.15 + (rng() - 0.5) * 1.2 : 1.6 + rng() * 0.8;
    const orbit = { r, y, w: W, phi: thetaDep - W * start, psi: rng() * TAU };
    const spread = Math.min(1, attempt / 30) * 0.4;
    const J = (): V3 => [(rng() - 0.5) * spread, (rng() - 0.5) * spread, (rng() - 0.5) * spread];
    const p2 = v3add(
      left ? v3add(slot.pos, [-1.3, -0.25, -0.2]) : v3add(slot.pos, slot.along === 0 ? [-0.9, 0.9, -0.2] : [0.25, 1.3, -0.2]),
      J(),
    );
    const b: FlightBlock = {
      kind: "swirl",
      slot,
      s: slotS(slot),
      dock,
      start,
      dur,
      p0: ZERO,
      p1: ZERO,
      p2,
      rot0: [(rng() - 0.5) * 2.4, (rng() - 0.5) * 2.4, (rng() - 0.5) * 2.4],
      orbit,
    };
    // Departure point and tangent come from the orbit. easeOutCubic starts at
    // slope 3 and a cubic Bezier at 3(p1-p0), so p1 = p0 + v*T/9 keeps the
    // block's speed through the hand-off.
    const p = orbitPos(b, start);
    const v = orbitVel(b, start);
    b.p0 = p;
    b.p1 = v3add(p, scale3(v, dur / 9));
    return b;
  });
  // Link each block to its nearest neighbours in the opening cloud.
  const links: [number, number][] = [];
  const seen = new Set<string>();
  blocks.forEach((b, i) => {
    const pi = orbitPos(b, 0);
    const near = blocks
      .map((o, j) => {
        const pj = orbitPos(o, 0);
        return { j, d: Math.hypot(pi[0] - pj[0], pi[1] - pj[1], pi[2] - pj[2]) };
      })
      .filter((x) => x.j !== i && x.d < 1.5)
      .sort((a, c) => a.d - c.d)
      .slice(0, 2);
    for (const { j } of near) {
      const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
      if (!seen.has(key)) {
        seen.add(key);
        links.push([Math.min(i, j), Math.max(i, j)]);
      }
    }
  });
  return { blocks, links };
};

const BLOCKS_STORY = buildBlocksStory();
const SECURE_STORY = buildSecureStory();

// Loose blocks for the hold loop: a rigid formation on one elliptical orbit
// that stays behind the wallet's face plane, so none ever sweeps past the
// camera or crosses the screen. One full cycle per loop.
const LOOSE = (() => {
  const rng = mulberry32(0x5eed03);
  return Array.from({ length: 6 }, (_, i) => ({
    phi: (i / 6) * TAU + rng() * 0.3,
    y: (i % 3) * 0.9 - 0.7 + rng() * 0.3,
    bob: rng() * TAU,
    rot0: [rng() * TAU, rng() * TAU, rng() * TAU] as V3,
  }));
})();

export const storyData = (story: Story) => (story === "blocks" ? BLOCKS_STORY : SECURE_STORY);
export const blockCount = (story: Story) => storyData(story).blocks.length;
export const looseCount = (story: Story) => (story === "hold" ? LOOSE.length : 0);
export const links = (story: Story) => (story === "hold" ? [] : storyData(story).links);

// Light pulse running along the docked L (s from 0 to 12).
const pulseAt = (story: Story, s: number, f: number, loop: number) => {
  let c: number;
  if (story === "hold") {
    c = lerp(-4, 16, (f % (loop / 2)) / (loop / 2));
  } else if (story === "blocks") {
    c = lerp(-4, 16, remap(f, 222, 272));
  } else {
    c = lerp(-4, 16, remap(f, 232, 282));
  }
  const x = (s - c) / 1.6;
  return Math.exp(-x * x);
};

export const blockPose = (story: Story, i: number, f: number, loop: number): BlockPose => {
  const b = storyData(story).blocks[i];
  const pulse = pulseAt(story, b.s, f, loop);
  if (story === "hold") return { visible: true, pos: b.slot.pos, rot: ZERO, edge: 0.9 + pulse * 2.2, docked: true };
  const p = rawPose(b, f);
  if (!p.docked) return { ...p, edge: 0.9 };
  const t = f - b.dock;
  const flash = t < 30 ? Math.exp(-t / 4) : 0;
  return { ...p, scale: dockSquash(b, f), edge: 0.9 + flash * 3.5 + pulse * 2.2 };
};

// Flight progress used for link fading: 0 while free, 1 once docked.
const travel = (story: Story, i: number, f: number) => {
  const b = storyData(story).blocks[i];
  return clamp01((f - b.start) / b.dur);
};

export const linkAlpha = (story: Story, a: number, b: number, f: number, dist: number) => {
  if (story === "hold") return 0;
  const near = 1 - smooth(remap(dist, 1.25, 1.9));
  if (story === "blocks") {
    const da = storyData(story).blocks[a];
    const db = storyData(story).blocks[b];
    if (f < da.start || f < db.start) return 0;
    const fa = (x: number) => smooth(remap(x, 0, 0.1)) * (1 - smooth(remap(x, 0.55, 0.85)));
    return 0.85 * Math.min(fa(travel(story, a, f)), fa(travel(story, b, f))) * near;
  }
  const fa = (x: number) => 1 - smooth(remap(x, 0, 0.35));
  return 0.7 * Math.min(fa(travel(story, a, f)), fa(travel(story, b, f))) * near;
};

export const loosePose = (i: number, f: number, loop: number): BlockPose => {
  const l = LOOSE[i];
  const a = l.phi + TAU * (f / loop);
  return {
    visible: true,
    pos: [3.4 * Math.cos(a), l.y + 0.15 * Math.sin(TAU * 2 * (f / loop) + l.bob), -2.5 + 1.0 * Math.sin(a)],
    rot: [l.rot0[0] + TAU * (f / loop), l.rot0[1] + TAU * 2 * (f / loop), l.rot0[2]],
    edge: 0.85,
    docked: false,
  };
};

// Balance rows: count up as blocks dock; tick around the final value in the loop.
export const docked = (story: Story, f: number) => {
  const blocks = storyData(story).blocks;
  if (story === "hold") return blocks.length;
  let k = 0;
  for (const b of blocks) k += smooth(remap(f, b.dock, b.dock + 8));
  return k;
};

export const balances = (story: Story, rows: { start: number; step: number }[], f: number, loop: number) => {
  const k = docked(story, f);
  if (story !== "hold") return rows.map((r) => r.start + Math.round(r.step * k));
  const q = Math.floor(f / 15) * 15;
  const w1 = Math.round(6 * Math.sin((TAU * q) / loop) + 3 * Math.sin((3 * TAU * q) / loop + 1));
  const w2 = Math.round(14 * Math.sin((TAU * q) / loop + 2) + 5 * Math.sin((2 * TAU * q) / loop));
  return [rows[0].start + rows[0].step * k + w1, rows[1].start + rows[1].step * k + w2];
};

// --- Security layers ------------------------------------------------------
export const PANEL = { w: 0.5, h: 0.5, x0: -0.1, dx: 0.26, y: -0.2, dz0: 0.2, ddz: 0.24 };

export const panelState = (story: Story, k: number, f: number, loop: number) => {
  const shimmer = 1 + 0.18 * Math.sin((TAU * 4 * f) / loop + k * 2.1);
  if (story === "hold") return { depth: PANEL.dz0 + k * PANEL.ddz, opacity: 1, shimmer, scroll: f / loop };
  if (story === "blocks") return { depth: 0.001, opacity: 0, shimmer, scroll: 0 };
  const t = remap(f, 120 + k * 14, 148 + k * 14);
  return {
    depth: Math.max(0.001, (PANEL.dz0 + k * PANEL.ddz) * easeOutCubic(t)),
    opacity: smooth(remap(t, 0, 0.35)),
    shimmer: f > 180 ? shimmer : 1,
    scroll: f / loop,
  };
};

export const LOCK = { x: 0.62, y: -0.36, z: WALLET.d / 2 + 0.95, bodyW: 0.92, bodyH: 0.74, bodyD: 0.3, open: 0.3 };

export const lockState = (story: Story, f: number, loop: number) => {
  if (story === "blocks") return { visible: false, drop: 0, shackle: 0, flash: 0, glow: 0 };
  if (story === "hold") {
    return { visible: true, drop: 0, shackle: 0, flash: 0, glow: 0.5 - 0.5 * Math.cos((TAU * 4 * f) / loop) };
  }
  if (f < 180) return { visible: false, drop: 2.4, shackle: LOCK.open, flash: 0, glow: 0 };
  const d = easeOutCubic(remap(f, 180, 199));
  const land = f > 199 && f < 207 ? -0.04 * Math.sin((Math.PI * (f - 199)) / 8) : 0;
  const shut = easeInQuad(remap(f, 204, 211));
  const t = f - 211;
  const jolt = t > 0 && t < 6 ? -0.025 * Math.sin((Math.PI * t) / 6) : 0;
  return {
    visible: true,
    drop: 2.4 * (1 - d) + land + jolt,
    shackle: LOCK.open * (1 - shut),
    flash: t >= 0 && t < 40 ? Math.exp(-t / 5) : 0,
    glow: f > 225 ? 0.5 - 0.5 * Math.cos((TAU * (f - 225)) / 75) : 0,
  };
};

// --- Camera ---------------------------------------------------------------
export type CameraPose = { az: number; el: number; dist: number; target: V3 };
const DEG = Math.PI / 180;

export const cameraPose = (story: Story, f: number, loop: number): CameraPose => {
  if (story === "blocks") {
    const push = easeInOutSine(f / 220);
    const hold = easeInOutSine(remap(f, 205, 300));
    return {
      az: (-26 + 3 * push) * DEG,
      el: 10 * DEG,
      dist: 9.8 - 0.8 * push - 0.75 * hold,
      target: [0, 0.18, 0],
    };
  }
  if (story === "hold") {
    const a = (TAU * f) / loop;
    return { az: (-17 + 10 * Math.sin(a)) * DEG, el: (13 + 2 * Math.sin(a + 1)) * DEG, dist: 6.3, target: [0.08, 0.08, 0.35] };
  }
  const back = easeInOutCubic(remap(f, 112, 185));
  const drift = easeInOutSine(remap(f, 185, 300));
  return {
    az: (lerp(-34, -15, back) + 2 * easeInOutSine(f / 120)) * DEG,
    el: lerp(10, 13, back) * DEG,
    dist: lerp(6.8, 6.1, back) - 0.2 * drift,
    target: [lerp(-0.2, 0.08, back), lerp(0.25, 0.08, back), lerp(0, 0.35, back)],
  };
};
