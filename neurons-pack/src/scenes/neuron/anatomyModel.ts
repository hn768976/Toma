// The single, anatomically labelled neuron: soma with nucleus, 7 dendrite
// trees, an axon from the hillock wrapped in myelin segments separated by
// nodes of Ranvier, and branching axon terminals ending in bulbs.
import * as THREE from "three";
import { easeInOut, smoothstep } from "../../lib/math";
import { mulberry32, range } from "../../lib/random";
import { Branch, GeoBuilder, KIND, V3, add, growTree, len, mul, norm, pathToRoot, polyline, sub } from "./geometry";
import { Neuron, addNeuron, branchStartDist, somaRadius } from "./neuron";

export const FPS = 30;
export const FOV = 35;
export const SOMA: V3 = [-3.25, 0.55, 0];

// Timeline (seconds).
export const T = {
  somaIn: [0, 1.6],
  axonGrow: [1.8, 12],
  dendGrow: [4, 10.5],
  termGrow: [12, 15.5],
};

const AXON_CTRL: V3[] = [
  [-3.1, 0.2, 0],
  [-2.85, -0.75, 0.05],
  [-2.35, -1.45, 0.1],
  [-1.5, -1.62, 0.05],
  [-0.4, -1.5, 0],
  [0.45, -1.35, -0.05],
  [1.1, -0.85, -0.05],
  [1.7, -0.45, 0],
  [2.4, -0.4, 0.05],
  [2.95, -0.42, 0.05],
];
const AXON_R = 0.024;
const MYELIN_R = 0.05;
const MYELIN_START = 0.75; // arc length before the first sheath (bare axon)
const MYELIN_LEN = 0.62;
const NODE_GAP = 0.085;

export type AnatomyModel = {
  fibres: THREE.BufferGeometry;
  soma: THREE.BufferGeometry;
  nucleus: THREE.BufferGeometry;
  dendPaths: ReturnType<typeof polyline>[];
  axon: ReturnType<typeof polyline>;
  nodes: V3[];
  bulbs: V3[];
  anchors: {
    cellBody: V3;
    nucleus: V3;
    axon: V3;
    myelin: V3;
    node: V3;
    dendrites: [V3, V3];
    terminals: [V3, V3];
  };
};

const build = (): AnatomyModel => {
  const rng = mulberry32(0xa9a7_0e1);
  // Axon centre line.
  const curve = new THREE.CatmullRomCurve3(AXON_CTRL.map((p) => new THREE.Vector3(...p)), false, "centripetal");
  const axonPts: V3[] = curve.getSpacedPoints(240).map((v) => [v.x, v.y, v.z]);
  const axonLine = polyline(axonPts);
  const axonLen = axonLine.total;
  const axonDir = norm(sub(axonPts[1], axonPts[0]));

  const branches: Branch[] = [];
  const leaves: number[] = [];
  const spikes: { dir: V3; amp: number }[] = [];
  const R = 0.42;
  const dendDirs: V3[] = [
    [-0.25, 1, 0.1],
    [-1, 0.55, -0.1],
    [-1, -0.3, 0.2],
    [-0.55, -0.9, -0.2],
    [0.75, 0.75, 0.15],
    [0.95, -0.15, -0.25],
    [-0.2, 0.4, 0.9],
  ];
  dendDirs.forEach((d0, i) => {
    const d = norm(d0);
    const amp = i === 0 ? 1.1 : range(rng, 0.55, 0.85);
    spikes.push({ dir: d, amp });
    const start = add(SOMA, mul(d, R * (0.7 + amp) * 0.82));
    const first = branches.length;
    growTree(rng, branches, start, d, {
      rootLen: i === 0 ? 0.62 : range(rng, 0.42, 0.55),
      rootRadius: 0.04,
      tipRadius: 0.0035,
      maxDepth: 5,
      segLen: 0.045,
      wiggle: 0.2,
      spread: [0.3, 0.7],
      shrink: [0.72, 0.9],
    }, KIND.dendrite);
    for (let b = first; b < branches.length; b++) if (branches[b].depth === 5) leaves.push(b);
  });
  spikes.push({ dir: axonDir, amp: 1.0 });
  const axonIdx = branches.length;
  branches.push({
    pts: axonPts,
    radii: axonPts.map((_, i) => AXON_R * (1 + 1.2 * Math.exp(-i / 6))),
    grow: [],
    parent: -1,
    kind: KIND.axon,
    depth: 0,
  });
  // Terminals.
  const end = axonPts[axonPts.length - 1];
  const endDir = norm(sub(end, axonPts[axonPts.length - 4]));
  const termFirst = branches.length;
  growTree(rng, branches, end, endDir, {
    rootLen: 0.62,
    rootRadius: AXON_R * 0.9,
    tipRadius: 0.005,
    maxDepth: 4,
    segLen: 0.05,
    wiggle: 0.16,
    spread: [0.3, 0.65],
    shrink: [0.8, 1.02],
    bias: [0.06, 0, 0],
  }, KIND.terminal, axonIdx);
  const termLeaves: number[] = [];
  for (let b = termFirst; b < branches.length; b++) if (branches[b].depth === 4) termLeaves.push(b);

  const neuron: Neuron = { id: 0, center: SOMA, R, branches, leaves, axon: axonIdx, spikes };

  // Growth times per point.
  const starts = branchStartDist(neuron);
  let maxDend = 0;
  let maxTerm = 0;
  const dists = branches.map((b, bi) => {
    let l = starts[bi];
    return b.pts.map((p, k) => (k === 0 ? l : (l += len(sub(p, b.pts[k - 1])))));
  });
  branches.forEach((b, bi) => {
    const m = Math.max(...dists[bi]);
    if (b.kind === KIND.dendrite) maxDend = Math.max(maxDend, m);
    if (b.kind === KIND.terminal) maxTerm = Math.max(maxTerm, m - axonLen);
  });
  branches.forEach((b, bi) => {
    b.grow = dists[bi].map((d) => {
      if (b.kind === KIND.dendrite) return T.dendGrow[0] + (d / maxDend) * (T.dendGrow[1] - T.dendGrow[0]);
      if (b.kind === KIND.axon) return T.axonGrow[0] + (d / axonLen) * (T.axonGrow[1] - T.axonGrow[0]);
      return T.termGrow[0] + ((d - axonLen) / maxTerm) * (T.termGrow[1] - T.termGrow[0]);
    });
  });
  const axonTime = (s: number) => T.axonGrow[0] + (s / axonLen) * (T.axonGrow[1] - T.axonGrow[0]);

  const fibres = new GeoBuilder();
  addNeuron(fibres, neuron, { somaDetail: 0, sideDetail: 4, skipSoma: true });

  // Myelin sheaths with rounded ends; the gaps are the nodes of Ranvier.
  const nodes: V3[] = [];
  let s = MYELIN_START;
  let segIdx = 0;
  let myelinAnchor: V3 = [0, 0, 0];
  while (s + MYELIN_LEN < axonLen - 0.25) {
    const n = 26;
    const pts: V3[] = [];
    const radii: number[] = [];
    const grow: number[] = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const ss = s + t * MYELIN_LEN;
      pts.push(axonLine.at(ss / axonLen));
      radii.push(AXON_R + (MYELIN_R - AXON_R) * Math.pow(Math.sin(Math.PI * t), 0.3));
      grow.push(axonTime(ss) + 0.25);
    }
    fibres.tube(pts, radii, 14, (k) => [0, s, grow[k], KIND.myelin]);
    if (segIdx === 2) myelinAnchor = pts[Math.floor(n * 0.5)];
    s += MYELIN_LEN;
    nodes.push(axonLine.at((s + NODE_GAP / 2) / axonLen));
    s += NODE_GAP;
    segIdx++;
  }
  // Bulbs at the terminal tips.
  const bulbs: V3[] = [];
  for (const b of termLeaves) {
    const br = branches[b];
    const tip = br.pts[br.pts.length - 1];
    bulbs.push(tip);
    const g = br.grow[br.grow.length - 1];
    fibres.blob(tip, () => 0.03, 2, () => [0, axonLen + 1, g, KIND.terminal]);
  }

  // Soma (drawn translucent) and nucleus.
  const somaB = new GeoBuilder();
  somaB.blob(SOMA, somaRadius(neuron), 5, () => [0, 0, 0, KIND.soma]);
  const nucB = new GeoBuilder();
  const NUC: V3 = add(SOMA, [0.03, 0.02, 0.04]);
  nucB.blob(NUC, (d) => 0.15 * (1 + 0.06 * d[0] - 0.05 * d[1]), 3, () => [0, 0, 0, KIND.nucleus]);

  // Leaves for the incoming signal: one each from three different trees.
  const pickLeaves = [leaves[3], leaves[Math.floor(leaves.length * 0.45)], leaves[leaves.length - 5]];
  const dendPaths = pickLeaves.map((b) => polyline(pathToRoot(branches, b).concat([SOMA])));

  // Label anchors.
  const dLeaf = (frac: number) => {
    const br = branches[leaves[Math.floor(leaves.length * frac)]];
    return br.pts[Math.floor(br.pts.length * 0.2)];
  };
  // Dendrite anchors: mid-way along two lower-left trees.
  const dendAnchorA = branches.find((b, i) => b.kind === KIND.dendrite && b.depth === 1 && i > 0 && b.pts[0][0] < SOMA[0] - 0.3 && b.pts[0][1] < SOMA[1] - 0.1);
  const dendAnchorB = branches.find((b) => b.kind === KIND.dendrite && b.depth === 1 && b.pts[0][0] < SOMA[0] - 0.4 && b.pts[0][1] > SOMA[1] - 0.1 && b.pts[0][1] < SOMA[1] + 0.4);
  const mid = (b: Branch | undefined, fallback: V3) => (b ? b.pts[Math.floor(b.pts.length / 2)] : fallback);
  const sortedBulbs = [...bulbs].sort((a, b) => b[1] - a[1]);
  return {
    fibres: fibres.build(),
    soma: somaB.build(),
    nucleus: nucB.build(),
    dendPaths,
    axon: polyline([SOMA, ...axonPts]),
    nodes,
    bulbs,
    anchors: {
      cellBody: add(SOMA, [0.22, 0.28, 0.1]),
      nucleus: NUC,
      axon: axonLine.at(0.45 / axonLen),
      myelin: myelinAnchor,
      node: nodes[3],
      dendrites: [mid(dendAnchorA, dLeaf(0.3)), mid(dendAnchorB, dLeaf(0.2))],
      terminals: [sortedBulbs[0], sortedBulbs[Math.floor(sortedBulbs.length * 0.35)]],
    },
  };
};

let cache: AnatomyModel | null = null;
export const anatomyModel = () => (cache ??= build());

/** Camera and model pose at time t (seconds): pure, shared with labels. */
export const anatomyPose = (t: number) => {
  const pull = easeInOut(smoothstep(4, 12, t));
  const target = new THREE.Vector3().lerpVectors(new THREE.Vector3(SOMA[0], SOMA[1], 0), new THREE.Vector3(0.45, 0.42, 0), pull);
  const dist = 3.0 + (11.0 - 3.0) * pull;
  const orbit = 0.35 * (1 - pull) + 0.02;
  const pos = new THREE.Vector3(target.x + Math.sin(orbit) * dist, target.y + 0.15 * (1 - pull), Math.cos(orbit) * dist);
  // The cell turns slowly while alone, settling before the pull-back ends.
  const turn = 0.9 * (1 - easeInOut(smoothstep(0, 11, t)));
  return { target, pos, turn };
};

export const makeCamera = (t: number) => {
  const { target, pos } = anatomyPose(t);
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 100);
  cam.position.copy(pos);
  cam.lookAt(target);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
};

/** Model matrix (turn about the soma's vertical axis). */
export const modelMatrix = (t: number) => {
  const { turn } = anatomyPose(t);
  const m = new THREE.Matrix4().makeTranslation(SOMA[0], SOMA[1], SOMA[2]);
  m.multiply(new THREE.Matrix4().makeRotationY(turn));
  m.multiply(new THREE.Matrix4().makeTranslation(-SOMA[0], -SOMA[1], -SOMA[2]));
  return m;
};
