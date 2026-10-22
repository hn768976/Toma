import React from "react";
import * as THREE from "three";
import { COLORS, COUNTS, FPS, rgb } from "../lib/colors";
import { easeOut, keyframes, lerp, remap, smooth } from "../lib/ease";
import { gauss, mulberry32 } from "../lib/random";
import { Lines } from "../lib/three/lines";
import { People } from "../lib/three/people";
import { SceneRuntime, Stage, StageInfo } from "../lib/three/Stage";

// People scattered in depth; hubs fire bursts of links; the camera pulls back and turns
// while the crowd gathers into one dense, elongated cloud (wider than tall).
const N = COUNTS.socialClusterPeople;
const DURATION = 20;

type P = { cloud: [number, number, number]; spread: [number, number, number]; at: number; female: boolean; rot: number };

const rng = mulberry32(2601677);
const PEOPLE: P[] = [];
const CLUSTERS: [number, number, number][] = [[-9, 1, 0], [-1, -1.5, 2], [6, 3.5, -2], [11, -2, 1], [2, 4, 3]];
for (let i = 0; i < N; i++) {
  // Final cloud: Gaussian, elongated (x), denser at the centre.
  const g = () => gauss(rng);
  // Even, organic spread (triangular) with a few local clusters around hubs.
  const tri = () => rng() + rng() - 1;
  let cloud: [number, number, number];
  if (rng() < 0.45) {
    const c = CLUSTERS[Math.floor(rng() * CLUSTERS.length)];
    cloud = [c[0] + g() * 3, c[1] + g() * 1.8, c[2] + g() * 3];
  } else cloud = [g() * 9 + tri() * 4, g() * 4.6, g() * 6];
  // Early, the crowd is loose: the same people spread out further.
  const spread: [number, number, number] = [cloud[0] * 1.35 + g() * 2, cloud[1] * 1.9 + g() * 1.5, cloud[2] * 1.4 + g() * 2];
  PEOPLE.push({ cloud, spread, at: 0, female: rng() < 0.45, rot: (rng() - 0.5) * 0.6 });
}
// Arrival: 0-3s about 40 already scattered (close to the camera first); 3-9s more; 9-18s the rest.
{
  // Order: the first 40 are people near the initial view; then random.
  const camZ = 16;
  const order = PEOPLE.map((p, i) => i);
  const key = order.map((i) => {
    const p = PEOPLE[i];
    const visible = Math.abs(p.spread[0]) < 14 && Math.abs(p.spread[1]) < 7 && p.spread[2] < camZ - 4;
    return (visible ? 0 : 0.5) + rng() * 0.8;
  });
  order.sort((a, b) => key[a] - key[b]);
  order.forEach((idx, k) => {
    let at: number;
    if (k < 40) at = 0;
    else if (k < 200) at = lerp(3, 9, (k - 40) / 160);
    else at = lerp(9, 17.5, Math.pow((k - 200) / (N - 200), 1 / 2.6));
    PEOPLE[idx].at = at;
  });
}

// Hubs: people who send a burst of links to others (some far away), at increasing rate.
type L = { a: number; b: number; at: number; dur: number };
const LINKS: L[] = [];
{
  const hubs = Math.round(N * 0.06);
  for (let h = 0; h < hubs; h++) {
    const t = lerp(3, 17.5, Math.pow(h / hubs, 0.55)) + rng() * 0.3;
    // Hub: someone already present.
    let a = Math.floor(rng() * N);
    for (let tries = 0; tries < 20 && PEOPLE[a].at > t; tries++) a = Math.floor(rng() * N);
    if (PEOPLE[a].at > t) continue;
    // Every link ends at someone already there.
    const present = (c: number) => PEOPLE[c].at <= t;
    const k = 5 + Math.floor(rng() * 10);
    for (let j = 0; j < k; j++) {
      let b = Math.floor(rng() * N);
      for (let tries = 0; tries < 30 && !present(b); tries++) b = Math.floor(rng() * N);
      // Mostly nearby targets; the rest are long links fanning out to outlying people.
      if (rng() < 0.55) {
        let best = b;
        let bd = Infinity;
        for (let s = 0; s < 12; s++) {
          const c = Math.floor(rng() * N);
          const pa = PEOPLE[a].cloud;
          const pc = PEOPLE[c].cloud;
          const d = (pa[0] - pc[0]) ** 2 + (pa[1] - pc[1]) ** 2 + (pa[2] - pc[2]) ** 2;
          if (c !== a && present(c) && d < bd) {
            bd = d;
            best = c;
          }
        }
        b = best;
      }
      if (b === a || !present(b)) continue;
      LINKS.push({ a, b, at: t + rng() * 0.25, dur: 0.25 + rng() * 0.3 });
    }
  }
}

const makeCreate = (dark: boolean) => (info: StageInfo): SceneRuntime => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, info.width / info.height, 0.1, 400);
  const people = new People(N, (i) => PEOPLE[i].female, {
    front: dark ? COLORS.white : COLORS.red,
    side: dark ? COLORS.whiteSide : COLORS.redSide,
  });
  const lines = new Lines(LINKS.length, info, { width: 0.75 });
  const lc = dark ? rgb(COLORS.greyLine) : [0.5, 0.5, 0.5];
  LINKS.forEach((_, i) => lines.setColor(i, lc[0], lc[1], lc[2], dark ? 0.5 : 0.6));
  scene.add(lines.mesh, people.group);
  const pos = new Float32Array(N * 3);
  return {
    scene,
    camera,
    update: (frame) => {
      const t = frame / FPS;
      // Gathering 9-18s, then a very slight drift in the hold.
      const g = smooth(remap(t, 8.5, 18));
      const drift = remap(t, 18, 20) * 0.006;
      const az = THREE.MathUtils.degToRad(keyframes(t, [[0, 0], [9, 4], [18, 28], [20, 28.3]]));
      for (let i = 0; i < N; i++) {
        const p = PEOPLE[i];
        const x = lerp(p.spread[0], p.cloud[0], g) * (1 - drift);
        const y = lerp(p.spread[1], p.cloud[1], g);
        const z = lerp(p.spread[2], p.cloud[2], g) * (1 - drift);
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        if (t < p.at) people.hide(i);
        else people.set(i, x, y - 0.5, z, 1, 1, az + p.rot);
      }
      LINKS.forEach((l, i) => {
        lines.setEnds(i, pos[l.a * 3], pos[l.a * 3 + 1] + 0.15, pos[l.a * 3 + 2], pos[l.b * 3], pos[l.b * 3 + 1] + 0.15, pos[l.b * 3 + 2]);
        // Lines shoot out quickly, ease-out.
        lines.setRange(i, 0, easeOut(remap(t, l.at, l.at + l.dur), 3));
      });
      people.commit();
      lines.commit();
      const dist = keyframes(t, [[0, 16], [3, 18], [9, 30], [14, 46], [18, 56], [20, 56.2]]);
      const elev = THREE.MathUtils.degToRad(keyframes(t, [[0, 2], [18, 12], [20, 12]]));
      camera.position.set(Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
    },
  };
};

const createRed = makeCreate(false);
const createWhite = makeCreate(true);
export const SocialClusterRed: React.FC = () => <Stage create={createRed} background={COLORS.lightBackground} />;
export const SocialClusterWhite: React.FC = () => <Stage create={createWhite} background={COLORS.darkBackground} />;
export const socialClusterDuration = DURATION;
