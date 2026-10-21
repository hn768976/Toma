import React from "react";
import * as THREE from "three";
import { COLORS, COUNTS, FPS, rgb } from "../lib/colors";
import { easeIn, keyframes, lerp, remap, smooth } from "../lib/ease";
import { mulberry32 } from "../lib/random";
import { Dots } from "../lib/three/dots";
import { Lines } from "../lib/three/lines";
import { People } from "../lib/three/people";
import { SceneRuntime, Stage, StageInfo } from "../lib/three/Stage";

// One build: a loose 3D field (a tall column) of people and small dots, appearing from
// the centre outwards; each newcomer links to its nearest earlier neighbours.
const PEOPLE = COUNTS.peopleLinkUpPeople;
const DOTS = Math.round(PEOPLE * 0.45);
const RX = 22; // field half-width
const RZ = 14; // field half-depth
const HY = 16; // field half-height

type Node = { x: number; y: number; z: number; person: boolean; at: number; rot: number; female: boolean };
type Link = { from: number; to: number; at: number };

const buildField = (seed: number) => {
  const rng = mulberry32(seed);
  const raw: (Node & { d: number })[] = [];
  const add = (person: boolean) => {
    // Uniform in a cylinder; the arrival key is the normalised distance from the centre.
    // Soft-edged block: density falls off towards the sides.
    const soft = () => (rng() + rng() + rng() * 0.6) / 2.6 * 2 - 1;
    const x = soft() * RX;
    const z = soft() * RZ;
    const y = soft() * HY;
    // Mostly centre-out, but newcomers land all over the view, sparse then dense.
    const d = 0.5 * Math.max(Math.hypot(x / RX, z / RZ), Math.abs(y) / HY) + 0.5 * rng();
    raw.push({ x, y, z, person, at: 0, rot: (rng() - 0.5) * 0.7, female: rng() < 0.4, d });
  };
  for (let i = 0; i < PEOPLE - 1; i++) add(true);
  for (let i = 0; i < DOTS - 3; i++) add(false);
  raw.sort((a, b) => a.d - b.d);
  // The first person stands in the centre with three dots close by.
  const nodes: Node[] = [
    { x: 0, y: -0.4, z: 0, person: true, at: 0, rot: 0.15, female: false },
    { x: -0.55, y: 0.75, z: 0.2, person: false, at: 0, rot: 0, female: false },
    { x: 0.62, y: 0.65, z: -0.3, person: false, at: 0, rot: 0, female: false },
    { x: 0.08, y: 0.95, z: 0.5, person: false, at: 0, rot: 0, female: false },
    ...raw,
  ];
  // Arrival times: 0-2s only the first person; then an ease-in count up to 13s.
  const total = nodes.length;
  for (let i = 4; i < total; i++) {
    const f = (i - 3) / (total - 4);
    // invert f = easeIn(u, 2) -> u = sqrt(f)
    nodes[i].at = 2 + 11 * Math.sqrt(f) * 0.985;
  }
  const links: Link[] = [
    { from: 0, to: 1, at: 0.3 },
    { from: 0, to: 2, at: 0.6 },
    { from: 0, to: 3, at: 0.9 },
  ];
  for (let i = 4; i < total; i++) {
    const n = nodes[i];
    const k = 1 + Math.floor(rng() * 2.6);
    const best: [number, number][] = [];
    for (let j = 0; j < i; j++) {
      const m = nodes[j];
      const d = (m.x - n.x) ** 2 + (m.y - n.y) ** 2 + (m.z - n.z) ** 2;
      if (best.length < k) {
        best.push([d, j]);
        best.sort((a, b) => a[0] - b[0]);
      } else if (d < best[k - 1][0]) {
        best[k - 1] = [d, j];
        best.sort((a, b) => a[0] - b[0]);
      }
    }
    for (const [, j] of best) links.push({ from: i, to: j, at: n.at + 0.05 + rng() * 0.25 });
  }
  return { nodes, links };
};

const FIELDS = [buildField(2608517), buildField(5178062)];
const CUT = 15; // seconds

const createScene = (info: StageInfo): SceneRuntime => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, info.width / info.height, 0.1, 500);
  const groups = FIELDS.map((field, half) => {
    const dark = half === 1;
    const people = new People(field.nodes.length, (i) => field.nodes[i].female, {
      front: dark ? COLORS.white : COLORS.red,
      side: dark ? "#A9A9A9" : COLORS.redSide,
    });
    const lines = new Lines(field.links.length, info, { width: 1.0 });
    const dots = new Dots(field.nodes.length, info, camera, { world: true });
    const lc = dark ? rgb(COLORS.greyLine) : [0.88, 0.55, 0.55];
    field.links.forEach((l, i) => {
      const a = field.nodes[l.from];
      const b = field.nodes[l.to];
      // Lines join at the person's chest / the dot's centre.
      lines.setEnds(i, a.x, a.y + (a.person ? 0.6 : 0), a.z, b.x, b.y + (b.person ? 0.6 : 0), b.z);
      lines.setColor(i, lc[0], lc[1], lc[2], dark ? 0.85 : 0.8);
    });
    const g = new THREE.Group();
    g.add(lines.mesh, people.group, dots.mesh);
    scene.add(g);
    return { field, people, lines, dots, g, dark };
  });

  return {
    scene,
    camera,
    update: (frame) => {
      const t = frame / FPS;
      const half = t < CUT ? 0 : 1;
      const lt = half === 0 ? t : t - CUT;
      groups.forEach((G, h) => {
        G.g.visible = h === half;
      });
      const G = groups[half];
      const camAz = THREE.MathUtils.degToRad(lerp(-10, 12, smooth(lt / 15)));
      G.field.nodes.forEach((n, i) => {
        if (lt < n.at) {
          G.people.hide(i);
          G.dots.hide(i);
          return;
        }
        if (n.person) {
          // Pop in at full size, facing roughly towards the camera.
          G.people.set(i, n.x, n.y, n.z, 1, 1, camAz + n.rot);
          G.dots.hide(i);
        } else {
          G.people.hide(i);
          const c = G.dark ? 0.75 : 0.08;
          G.dots.set(i, n.x, n.y, n.z, 0.11, c, c, c, 1);
        }
      });
      G.field.links.forEach((l, i) => {
        G.lines.setRange(i, 0, smooth(remap(lt, l.at, l.at + 0.3)));
      });
      G.people.commit();
      G.lines.commit();
      // Camera pulls back as the crowd grows; the first half ends with a fast pull-back
      // that shrinks the crowd to a dense column.
      const keys: [number, number][] =
        half === 0
          ? [
              [0, 10.5],
              [2, 11.5],
              [5, 22],
              [9, 40],
              [13, 50],
              [15, 170],
            ]
          : [
              [0, 10.5],
              [2, 11.5],
              [5, 22],
              [9, 40],
              [13, 58],
              [15, 62],
            ];
      const dist = keyframes(lt, keys, half === 0 && lt > 13 ? (x) => easeIn(x, 2) : smooth);
      const elev = THREE.MathUtils.degToRad(9);
      camera.position.set(Math.sin(camAz) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(camAz) * Math.cos(elev) * dist);
      camera.lookAt(0, 0.2, 0);
      camera.updateMatrixWorld();
      G.dots.commit();
    },
  };
};

const background = (frame: number) => (frame / FPS < CUT ? COLORS.lightBackground : COLORS.darkBackground);

export const PeopleLinkUpFlip: React.FC = () => <Stage create={createScene} background={background} />;
