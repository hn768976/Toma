import * as THREE from 'three';
import {COIN_R, COIN_T, Metal} from './coinAssets';
import {mulberry32, Rng} from '../lib/random';

// A coin's rest pose plus the frame it lands. The drop and settle around the
// landing frame are applied in CoinScene (eased, not physics).
export type CoinSpec = {
  pos: THREE.Vector3; // rest position of the coin centre
  quat: THREE.Quaternion; // rest orientation
  metal: Metal;
  land: number; // frame the coin touches down
  wobbleAxis: THREE.Vector3; // horizontal axis for the settle wobble
  stack: number; // stack index (-1 for loose coins)
  level: number; // 0 = bottom of the stack
};

export type StackDef = {x: number; z: number; count: number; metal: Metal; start: number; end: number};
export type LooseDef = {x: number; z: number; y?: number; tiltX: number; tiltZ: number; metal: Metal; land: number};

const tmpE = new THREE.Euler();

// Builds coins for stacks: coins land evenly between start and end (eased so
// growth starts gently), each slightly offset and rotated (hand-made look).
export const stackCoins = (stacks: StackDef[], loose: LooseDef[], seed: number): CoinSpec[] => {
  const rng = mulberry32(seed);
  const out: CoinSpec[] = [];
  stacks.forEach((s, si) => {
    let lean = 0;
    for (let k = 0; k < s.count; k++) {
      const u = s.count === 1 ? 0 : k / (s.count - 1);
      const land = Math.round(s.start + (s.end - s.start) * (0.5 - 0.5 * Math.cos(Math.PI * u)) * 0.6 + (s.end - s.start) * u * 0.4);
      lean += (rng() - 0.5) * 0.0015;
      const pos = new THREE.Vector3(s.x + (rng() - 0.5) * 0.035 + lean * k, COIN_T * (k + 0.5) + 0.002 * k, s.z + (rng() - 0.5) * 0.035);
      const quat = new THREE.Quaternion().setFromEuler(tmpE.set((rng() - 0.5) * 0.012, rng() * Math.PI * 2, (rng() - 0.5) * 0.012));
      out.push({pos, quat, metal: s.metal, land, wobbleAxis: randomAxis(rng), stack: si, level: k});
    }
  });
  for (const l of loose) {
    const quat = new THREE.Quaternion().setFromEuler(tmpE.set(l.tiltX, rng() * Math.PI * 2, l.tiltZ, 'YXZ'));
    // lift so the lowest point of the tilted coin touches y (default table)
    const tilt = Math.max(Math.abs(l.tiltX), Math.abs(l.tiltZ));
    const y = (l.y ?? 0) + Math.sin(tilt) * COIN_R + Math.cos(tilt) * COIN_T * 0.5;
    out.push({pos: new THREE.Vector3(l.x, y, l.z), quat, metal: l.metal, land: l.land, wobbleAxis: randomAxis(rng), stack: -1, level: 0});
  }
  return out;
};

const randomAxis = (rng: Rng) => {
  const a = rng() * Math.PI * 2;
  return new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
};

// Staircase: n stacks on a line receding from near-right to far-left, each
// taller than the one behind it.
export const stairsLayout = (seed: number): CoinSpec[] => {
  const counts = [1, 2, 6, 10, 14, 18, 23, 28];
  const near = new THREE.Vector2(4.6, 3.2);
  const far = new THREE.Vector2(-12.5, -24);
  const stacks: StackDef[] = counts.map((count, i) => {
    const t = i / (counts.length - 1);
    const p = far.clone().lerp(near, Math.pow(t, 0.9));
    return {x: p.x, z: p.y, count, metal: 'gold', start: 30 + (counts.length - 1 - i) * 4, end: 300 + i * 4};
  });
  return stackCoins(stacks, [], seed);
};

// Pile: a few stacks first, then more stacks and loose coins, building into a
// dense pyramid-like cluster.
export const pileLayout = (seed: number, mixed: boolean): CoinSpec[] => {
  const rng = mulberry32(seed ^ 0x51);
  const D = COIN_R * 2;
  const metalAt = (x: number, z: number): Metal => {
    if (!mixed) return 'gold';
    // gold/copper on the left, silver on the right, mixed at the seam
    // mostly gold on the left and silver on the right, but mixed through the heap
    const v = x + (rng() - 0.5) * 5 - z * 0.1;
    if (v < -2.2) return rng() < 0.35 ? 'copper' : 'gold';
    if (v > 1.4) return rng() < 0.8 ? 'silver' : 'gold';
    const r = rng();
    return r < 0.45 ? 'gold' : r < 0.85 ? 'silver' : 'copper';
  };
  // [x, z, count, phase] phase 0 = first wave
  // one tight, overlapping, off-centre heap with a dominant tall stack
  const plan: [number, number, number, number][] = [
    [-D * 0.35, -1.0, 22, 0],
    [D * 0.62, -0.5, 16, 0],
    [-D * 1.05, 0.4, 12, 0],
    [D * 0.15, D * 0.8, 9, 1],
    [D * 1.35, -1.6, 15, 1],
    [-D * 0.85, -D * 1.25, 18, 1],
    [D * 0.95, D * 0.55, 6, 2],
    [-D * 1.6, D * 0.85, 5, 2],
    [D * 1.75, D * 0.2, 4, 2],
  ];
  const waves = [
    [30, 200],
    [90, 280],
    [150, 320],
  ];
  const stacks: StackDef[] = plan.map(([x, z, count, w]) => {
    const jitter = (rng() - 0.5) * 20;
    return {x: x + (rng() - 0.5) * 0.25, z: z + (rng() - 0.5) * 0.25, count, metal: metalAt(x, z), start: waves[w][0] + jitter, end: waves[w][1] + jitter * 0.5};
  });
  const loose: LooseDef[] = [];
  const looseSpots: [number, number, number, number][] = [
    [-D * 1.55, D * 1.35, 0.0, 0.0],
    [D * 1.45, D * 1.2, 0.0, 0.0],
    [-D * 0.15, D * 1.6, 0.0, 0.0],
  ];
  looseSpots.forEach(([x, z, tx, tz], i) => {
    loose.push({x, z, tiltX: tx, tiltZ: tz, metal: metalAt(x, z), land: 170 + i * 16 + Math.round(rng() * 10)});
  });
  // a small second layer of flat coins on top of some loose ones
  loose.push({x: D * 1.45 + 0.2, z: D * 1.2 - 0.1, y: COIN_T, tiltX: 0, tiltZ: 0, metal: metalAt(D * 2.0, 0), land: 300});
  return stackCoins(stacks, loose, seed);
};

// Silver stacks for 3E: a few tall stacks, large in frame.
export const silverLayout = (seed: number): CoinSpec[] => {
  const stacks: StackDef[] = [
    {x: -0.6, z: -3.5, count: 24, metal: 'silver', start: 30, end: 320},
    {x: 2.7, z: -0.8, count: 15, metal: 'silver', start: 60, end: 300},
    {x: -3.9, z: 1.5, count: 7, metal: 'silver', start: 90, end: 260},
    {x: 0.9, z: 2.6, count: 5, metal: 'silver', start: 110, end: 250},
    {x: 5.4, z: -5.0, count: 11, metal: 'silver', start: 70, end: 290},
  ];
  return stackCoins(stacks, [], seed);
};
