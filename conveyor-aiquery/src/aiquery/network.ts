import * as THREE from "three";
import { mulberry32, range, type Rng } from "../lib/random";

// Seeded branching tree: root -> level-1 hubs -> level-2 hubs -> leaf cube
// clusters. Strands are cubic Beziers bundled per edge so each edge reads as
// a fan that opens out of the parent and gathers into the child.

export interface Hub {
  pos: THREE.Vector3;
  level: number;
  children: Hub[];
  birth: number; // frame (2A) at which strands toward this hub start
  arrive: number; // frame at which they have reached it
}

export interface Strand {
  p: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
  birth: number;
  dur: number;
  alpha: number;
  pulse: number; // 0 = no bead; else number of whole trips per 600 frames
  width?: number;
  phase: number;
}

export interface Cube {
  pos: THREE.Vector3;
  size: number;
  birth: number;
  bright: number;
  flick: number; // flicker cycles per 600 frames (integer)
  phase: number;
  final?: boolean;
}

export interface Network {
  root: Hub;
  strands: Strand[];
  cubes: Cube[];
  path: THREE.CubicBezierCurve3[]; // the violet route, root -> final cube
  pathTimes: Array<[number, number]>; // draw-on window per segment (2A)
  final: THREE.Vector3;
  hubs: Hub[];
}

// Frame for the answer: r = horizontal direction of the last path segment,
// v = direction from the final camera into the scene (up x r).
export const finalFrame = (from: THREE.Vector3, to: THREE.Vector3) => {
  const r = to.clone().sub(from).setY(0).normalize();
  const v = new THREE.Vector3(0, 1, 0).cross(r).normalize();
  return { r, v };
};

const perp = (dir: THREE.Vector3, rng: Rng, mag: number) => {
  const a = new THREE.Vector3(0, 1, 0);
  if (Math.abs(dir.y) > 0.9) a.set(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(dir, a).normalize();
  const v = new THREE.Vector3().crossVectors(dir, u).normalize();
  // uniform in a disc, biased toward the rim for a fuller fan
  const r = Math.sqrt(rng()) * mag, th = rng() * Math.PI * 2;
  // flattened: fans open mostly in one plane (u is the depth axis here)
  return u.multiplyScalar(Math.cos(th) * r * 0.4).add(v.multiplyScalar(Math.sin(th) * r));
};

const fanStrand = (rng: Rng, from: THREE.Vector3, to: THREE.Vector3, spread: number, startJ: number, endJ: number, birth: number, dur: number): Strand => {
  const p0 = from.clone().add(new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(startJ));
  const p3 = to.clone().add(new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(endJ));
  const d = p3.clone().sub(p0);
  const len = d.length();
  d.normalize();
  const s = perp(d, rng, len * spread);
  const p1 = p0.clone().addScaledVector(d, len * range(rng, 0.25, 0.4)).addScaledVector(s, range(rng, 0.8, 1.1));
  const p2 = p3.clone().addScaledVector(d, -len * range(rng, 0.25, 0.4)).addScaledVector(s, range(rng, 0.35, 0.6));
  return {
    p: [p0, p1, p2, p3],
    birth,
    dur,
    alpha: range(rng, 0.25, 0.5),
    pulse: rng() < 0.03 ? 1 + Math.floor(rng() * 3) : 0,
    phase: rng(),
  };
};

export const buildNetwork = (seed: number): Network => {
  const rng = mulberry32(seed);
  const strands: Strand[] = [];
  const cubes: Cube[] = [];
  const root: Hub = { pos: new THREE.Vector3(0, 0, 0), level: 0, children: [], birth: 120, arrive: 120 };
  const hubs: Hub[] = [root];
  const nL1 = 4;
  // level 1: spread vertically like the reference (fans opening up/down)
  for (let i = 0; i < nL1; i++) {
    const y = -4.2 + (8.4 * (i + 0.5)) / nL1 + range(rng, -0.5, 0.5);
    const h: Hub = { pos: new THREE.Vector3(range(rng, 9, 11), y, range(rng, -2.5, 2.5)), level: 1, children: [], birth: 120, arrive: 172 };
    root.children.push(h);
    hubs.push(h);
  }
  // the violet route goes through the hub nearest the axis
  const vi1 = root.children.reduce((b, h, i) => (Math.abs(h.pos.y) < Math.abs(root.children[b].pos.y) ? i : b), 0);
  root.children.forEach((h1, i1) => {
    const n2 = 3;
    for (let j = 0; j < n2; j++) {
      const off = new THREE.Vector3(range(rng, 7, 9), -2.4 + (4.8 * (j + 0.5)) / n2 + range(rng, -0.4, 0.4), range(rng, -2.4, 2.4));
      const t0 = 175 + i1 * 12 + j * 6;
      const h2: Hub = { pos: h1.pos.clone().add(off), level: 2, children: [], birth: t0, arrive: t0 + 50 };
      h1.children.push(h2);
      hubs.push(h2);
    }
  });
  const v1 = root.children[vi1];
  const vi2 = 1;
  const v2 = v1.children[vi2];
  let final = new THREE.Vector3();
  // leaves: cube clusters
  for (const h1 of root.children) {
    for (const h2 of h1.children) {
      const nl = 4;
      for (let k = 0; k < nl; k++) {
        const isFinal = h2 === v2 && k === 1;
        const c = h2.pos.clone().add(new THREE.Vector3(range(rng, 4.5, 6), -1.8 + (3.6 * (k + 0.5)) / nl + range(rng, -0.3, 0.3), range(rng, -1.6, 1.6)));
        const leaf: Hub = { pos: c, level: 3, children: [], birth: h2.arrive - 5, arrive: h2.arrive + 45 };
        h2.children.push(leaf);
        hubs.push(leaf);
        // cluster: a small jittered lattice of cubes; the final leaf gets a
        // bigger lattice with the answer cube in the middle
        const cells: THREE.Vector3[] = [];
        if (isFinal) {
          final = c.clone();
          // columns/layers facing the final camera, which looks across the
          // last path segment (r = its horizontal direction)
          const { r, v } = finalFrame(h2.pos, c);
          const up = new THREE.Vector3(0, 1, 0);
          for (let gx = -2; gx <= 2; gx++) for (let gy = -3; gy <= 3; gy++) for (let gz = -1; gz <= 1; gz++) {
            if (gx === 0 && gy === 0 && gz === 0) continue;
            if (gx === 0 && gz === 0 && Math.abs(gy) === 1) continue; // keep the answer clear
            if (rng() < 0.6) continue;
            cells.push(r.clone().multiplyScalar(gx * 0.6).addScaledVector(up, gy * 0.42).addScaledVector(v, gz * 0.9).add(new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.05)));
          }
        } else {
          for (let gx = 0; gx < 2; gx++) for (let gy = -2; gy <= 2; gy++) {
            if (rng() < 0.3) continue;
            cells.push(new THREE.Vector3(gx * 0.2, gy * 0.17, range(rng, -0.1, 0.1)));
          }
        }
        for (const cell of cells) {
          cubes.push({ pos: c.clone().add(cell), size: isFinal ? range(rng, 0.13, 0.18) : range(rng, 0.07, 0.1), birth: leaf.arrive - 10 + rng() * 12, bright: range(rng, 0.5, 1.0), flick: 1 + Math.floor(rng() * 3), phase: rng() });
        }
        if (isFinal) {
          cubes.push({ pos: c.clone(), size: 0.24, birth: 300, bright: 1.6, flick: 1, phase: 0, final: true });
          // a smaller companion tucked against the answer cube
          cubes.push({ pos: c.clone().add(new THREE.Vector3(0.17, -0.12, 0.1)), size: 0.13, birth: 318, bright: 1.2, flick: 1, phase: 0.3 });
          // a few curved links between lattice cubes (network-graph look)
          for (let s = 0; s < 18; s++) {
            const a = c.clone().add(cells[Math.floor(rng() * cells.length)]);
            const b = c.clone().add(cells[Math.floor(rng() * cells.length)]);
            if (a.distanceTo(b) < 0.4) continue;
            const st = fanStrand(rng, a, b, 0.35, 0, 0, 315 + rng() * 25, range(rng, 25, 40));
            st.alpha = range(rng, 0.7, 1.0);
            st.pulse = 0;
            strands.push(st);
          }
          // a soft bundle of fibres sweeping in from the right, behind the
          // focus plane (wide, defocused, roughly parallel)
          const { r: rr, v: vv } = finalFrame(h2.pos, c);
          for (let s = 0; s < 70; s++) {
            const a0 = c.clone().addScaledVector(rr, range(rng, 7, 9)).addScaledVector(vv, range(rng, 4.0, 6.5)).add(new THREE.Vector3(0, range(rng, -3, 3), 0));
            const a1 = c.clone().addScaledVector(rr, range(rng, 1.8, 2.6)).addScaledVector(vv, range(rng, 3.0, 4.5)).add(new THREE.Vector3(0, range(rng, -0.6, 0.6), 0));
            const st = fanStrand(rng, a0, a1, 0.08, 0.2, 0.5, 300 + rng() * 30, range(rng, 40, 55));
            st.pulse = 0;
            st.width = range(rng, 2.5, 4.5);
            strands.push(st);
          }
        }
        // leaf strands: each ends on one of the cluster's cubes
        const ns = isFinal ? 12 : 10;
        for (let s = 0; s < ns; s++) {
          const target = cells.length ? c.clone().add(cells[Math.floor(rng() * cells.length)]) : c.clone();
          strands.push(fanStrand(rng, h2.pos, target, 0.12, 0.08, 0.02, leaf.birth + rng() * 15, range(rng, 35, 50)));
        }
      }
    }
  }
  // hub columns: a vertical stack of small cubes beside each level-1 hub
  for (const h1 of root.children) {
    for (let k = 0; k < 8; k++) {
      cubes.push({ pos: h1.pos.clone().add(new THREE.Vector3(0.35, -0.6 + k * 0.17, 0.0)), size: 0.07, birth: h1.arrive - 4 + k, bright: 0.8, flick: 2, phase: rng() });
    }
  }
  // root fan: 1200 strands split over the level-1 hubs
  const perL1 = 300;
  for (const h1 of root.children) {
    for (let s = 0; s < perL1; s++) {
      strands.push(fanStrand(rng, root.pos, h1.pos, 0.3, 0.05, 0.3, 120 + rng() * 22, range(rng, 40, 55)));
    }
  }
  // level-2 fans: 3 sub-fans of ~110 strands per level-1 hub
  for (const h1 of root.children) {
    for (const h2 of h1.children) {
      for (let s = 0; s < 110; s++) {
        strands.push(fanStrand(rng, h1.pos, h2.pos, 0.36, 0.04, 0.7, h2.birth + rng() * 18, range(rng, 40, 55)));
      }
    }
  }
  // violet route: root -> v1 -> v2 -> final, as three smooth segments
  const seg = (a: THREE.Vector3, b: THREE.Vector3, bend: THREE.Vector3) => {
    const d = b.clone().sub(a);
    return new THREE.CubicBezierCurve3(a.clone(), a.clone().addScaledVector(d, 0.35).add(bend), b.clone().addScaledVector(d, -0.35).add(bend.clone().multiplyScalar(0.4)), b.clone());
  };
  const path = [
    seg(root.pos, v1.pos, new THREE.Vector3(0, 0.6, 0.4)),
    seg(v1.pos, v2.pos, new THREE.Vector3(0, -0.5, 0.3)),
    seg(v2.pos, final, new THREE.Vector3(0, -0.6, 0)),
  ];
  const pathTimes: Array<[number, number]> = [[182, 236], [236, 292], [292, 345]];
  return { root, strands, cubes, path, pathTimes, final, hubs };
};
