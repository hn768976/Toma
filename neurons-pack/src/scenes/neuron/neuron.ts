import { makeNoise3 } from "../../lib/noise";
import { Rng, range, unitVec } from "../../lib/random";
import {
  Branch, DendriteOpts, GeoBuilder, KIND, V3, add, dot, growTree, len, mul, norm, rotate, anyPerp, sub,
} from "./geometry";

export type Neuron = {
  id: number;
  center: V3;
  R: number;
  branches: Branch[];
  /** Branch indices of dendrite leaves (signal sources). */
  leaves: number[];
  /** Branch index of the axon trunk. */
  axon: number;
  spikes: { dir: V3; amp: number }[];
};

export type NeuronOpts = {
  id: number;
  center: V3;
  R: number;
  nDend: number;
  dend: DendriteOpts;
  apical?: { dir: V3; lenMul: number };
  axon: { dir: V3; length: number; r0: number; r1: number; wiggle: number; segLen: number; terminals?: DendriteOpts };
  seed: number;
};

const somaNoise = makeNoise3(0x50a);

export const somaRadius = (n: Pick<Neuron, "R" | "spikes" | "id">) => (d: V3) => {
  let r = 0.7;
  for (const s of n.spikes) r += s.amp * Math.pow(Math.max(0, dot(d, s.dir)), 9);
  r += 0.07 * somaNoise(d[0] * 2.2 + n.id, d[1] * 2.2, d[2] * 2.2);
  return n.R * r;
};

export const makeNeuron = (rng: Rng, o: NeuronOpts): Neuron => {
  const branches: Branch[] = [];
  const spikes: { dir: V3; amp: number }[] = [];
  const leaves: number[] = [];
  const axonDir = norm(o.axon.dir);
  // Dendrite root directions: spread over the sphere, away from the axon.
  const dirs: V3[] = [];
  if (o.apical) dirs.push(norm(o.apical.dir));
  for (let tries = 0; dirs.length < o.nDend; tries++) {
    const d = unitVec(rng);
    if (dot(d, axonDir) > 0.35) continue;
    // Keep roots apart; relax the spacing if the sphere is getting full.
    if (dirs.some((e) => dot(e, d) > 0.6 + tries * 0.002)) continue;
    dirs.push(d);
  }
  dirs.forEach((d, i) => {
    const amp = i === 0 && o.apical ? 1.8 : range(rng, 0.9, 1.3);
    spikes.push({ dir: d, amp });
    const start = add(o.center, mul(d, o.R * (0.7 + amp) * 0.8));
    const opts: DendriteOpts = i === 0 && o.apical ? { ...o.dend, rootLen: o.dend.rootLen * o.apical.lenMul } : o.dend;
    const first = branches.length;
    growTree(rng, branches, start, d, opts, KIND.dendrite);
    for (let b = first; b < branches.length; b++) if (branches[b].depth === opts.maxDepth) leaves.push(b);
  });
  // Axon from the hillock.
  spikes.push({ dir: axonDir, amp: 1.6 });
  const a = o.axon;
  const start = add(o.center, mul(axonDir, o.R * 1.9));
  const nSeg = Math.max(4, Math.round(a.length / a.segLen));
  const pts: V3[] = [start];
  const radii = [a.r0 * 1.6];
  let d = axonDir;
  let p = start;
  const side = anyPerp(axonDir);
  const phase = rng() * 6.28;
  for (let i = 1; i <= nSeg; i++) {
    const t = i / nSeg;
    const w = rotate(side, axonDir, phase + t * 3);
    d = norm(add(add(axonDir, mul(w, a.wiggle * Math.sin(t * 7 + phase))), mul(unitVec(rng), a.wiggle * 0.3)));
    p = add(p, mul(d, a.length / nSeg));
    pts.push(p);
    radii.push(a.r0 + (a.r1 - a.r0) * t);
  }
  const axon = branches.length;
  branches.push({ pts, radii, grow: pts.map(() => 0), parent: -1, kind: KIND.axon, depth: 0 });
  if (a.terminals) growTree(rng, branches, p, d, a.terminals, KIND.terminal, axon, 0, a.terminals.rootLen, a.r1);
  return { id: o.id, center: o.center, R: o.R, branches, leaves, axon, spikes };
};

/** Distance along the tree from the soma, per branch start. */
export const branchStartDist = (n: Neuron) => {
  const start: number[] = [];
  n.branches.forEach((b, i) => {
    if (b.parent < 0) start[i] = 0;
    else {
      const p = n.branches[b.parent];
      let l = start[b.parent];
      for (let k = 1; k < p.pts.length; k++) l += len(sub(p.pts[k], p.pts[k - 1]));
      start[i] = l;
    }
  });
  return start;
};

export const sidesFor = (r: number, detail: number) => (r > 0.03 ? 10 : r > 0.012 ? 7 : r > 0.005 ? 5 : 4) + detail;

/** Appends soma + tubes to the builder. */
export const addNeuron = (
  g: GeoBuilder,
  n: Neuron,
  o: { somaDetail: number; sideDetail?: number; somaGrow?: number; skipKinds?: number[]; skipSoma?: boolean },
) => {
  if (!o.skipSoma) g.blob(n.center, somaRadius(n), o.somaDetail, () => [n.id, 0, o.somaGrow ?? 0, KIND.soma]);
  const starts = branchStartDist(n);
  n.branches.forEach((b, bi) => {
    if (o.skipKinds?.includes(b.kind)) return;
    let l = starts[bi];
    const dists = b.pts.map((p, k) => (k === 0 ? l : (l += len(sub(p, b.pts[k - 1])))));
    const sides = sidesFor(b.radii[0], o.sideDetail ?? 0);
    g.tube(b.pts, b.radii, sides, (k) => [n.id, dists[k], b.grow[k], b.kind]);
  });
};
