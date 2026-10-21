import React from "react";
import * as THREE from "three";
import { COLORS, COUNTS, FPS, rgb } from "../lib/colors";
import { easeIn, easeOut, keyframes, lerp, remap, smooth } from "../lib/ease";
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
for (let i = 0; i < N; i++) {
  // Final cloud: Gaussian, elongated (x), denser at the centre.
  const g = () => gauss(rng);
  const cloud: [number, number, number] = [g() * 11, g() * 3.6, g() * 6];
  // Early, the crowd is loose: the same people spread out further.
  const spread: [number, number, number] = [cloud[0] * 1.9 + g() * 3, cloud[1] * 2.6 + g() * 2, cloud[2] * 1.6 + g() * 3];
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
    else if (k < 420) at = lerp(3, 9, (k - 40) / 380);
    else at = lerp(9, 17.5, easeIn((k - 420) / (N - 420), 0.8));
    PEOPLE[idx].at = at;
  });
}

// Hubs: people who send a burst of links to others (some far away), at increasing rate.
type L = { a: number; b: number; at: number; dur: number };
const LINKS: L[] = [];
{
  const hubs = Math.round(N * 0.16);
  for (let h = 0; h < hubs; h++) {
    const t = lerp(3, 17.5, Math.pow(h / hubs, 0.55)) + rng() * 0.3;
    // Hub: someone already present.
    let a = Math.floor(rng() * N);
    for (let tries = 0; tries < 20 && PEOPLE[a].at > t; tries++) a = Math.floor(rng() * N);
    if (PEOPLE[a].at > t) continue;
    const k = 6 + Math.floor(rng() * 18);
    for (let j = 0; j < k; j++) {
      let b = Math.floor(rng() * N);
      // Mostly nearby targets, some long links.
      if (rng() < 0.7) {
        let best = b;
        let bd = Infinity;
        for (let s = 0; s < 12; s++) {
          const c = Math.floor(rng() * N);
          const pa = PEOPLE[a].cloud;
          const pc = PEOPLE[c].cloud;
          const d = (pa[0] - pc[0]) ** 2 + (pa[1] - pc[1]) ** 2 + (pa[2] - pc[2]) ** 2;
          if (c !== a && d < bd) {
            bd = d;
            best = c;
          }
        }
        b = best;
      }
      if (b === a) continue;
      LINKS.push({ a, b, at: t + rng() * 0.25, dur: 0.25 + rng() * 0.3 });
    }
  }
}

const makeCreate = (dark: boolean) => (info: StageInfo): SceneRuntime => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, info.width / info.height, 0.1, 400);
  const people = new People(N, (i) => PEOPLE[i].female, {
    front: dark ? COLORS.white : COLORS.red,
    side: dark ? "#A9A9A9" : COLORS.redSide,
  });
  const lines = new Lines(LINKS.length, info, { width: 0.75 });
  const lc = dark ? rgb(COLORS.greyLine) : [0.42, 0.42, 0.42];
  LINKS.forEach((_, i) => lines.setColor(i, lc[0], lc[1], lc[2], dark ? 0.5 : 0.55));
  scene.add(lines.mesh, people.group);
  const pos = new Float32Array(N * 3);
  return {
    scene,
    camera,
    update: (frame) => {
      const t = frame / FPS;
      // Gathering 9-18s, then a very slight drift in the hold.
      const g = smooth(remap(t, 8.5, 18));
      const drift = remap(t, 18, 20) * 0.04;
      const az = THREE.MathUtils.degToRad(keyframes(t, [[0, 0], [9, 4], [18, 28], [20, 29.5]]));
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
      const dist = keyframes(t, [[0, 16], [3, 17], [9, 26], [18, 62], [20, 63]]);
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
