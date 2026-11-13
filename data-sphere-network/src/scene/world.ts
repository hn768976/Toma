import type { V3 } from "../engine/math";
import { pickWeighted, randomUnit, rng } from "../engine/random";
import { COLOR_NAMES, ICON_NAMES, type ColorName } from "../engine/sprites";

/** Radius of the opening particle sphere (world units). */
export const SPHERE_R = 10;
/** Position of the glowing core / chip at the end of the dive. */
export const CORE: V3 = [0, 0, 560];

export type Particle = {
  p: V3;
  size: number;
  color: ColorName;
  square: boolean;
  twinkle: number;
};
export type SphereParticle = Particle & { burst: number; drift: V3; inner: boolean };
export type Icon = { p: V3; size: number; name: string; color: ColorName; tile: boolean };
export type Segment = { a: V3; b: V3; color: ColorName; alpha: number; width: number };
export type Polyline = { pts: V3[]; color: ColorName; alpha: number };

export type World = {
  sphere: SphereParticle[];
  field: Particle[];
  icons: Icon[];
  links: Segment[];
  beams: Segment[];
  circuits: Polyline[];
  backdrop: Polyline[];
  lattice: Segment[];
  latticeNodes: Particle[];
  ring: Particle[];
  rays: Array<{ angle: number; r0: number; len: number; width: number; color: ColorName; alpha: number; delay: number }>;
};

const col = (name: ColorName) => name;
const sphereColors: ColorName[] = ["cyan", "ice", "white", "teal", "pink", "salmon", "yellow", "blue"];
const sphereWeights = [46, 10, 4, 14, 9, 7, 3, 7];
const fieldColors: ColorName[] = ["cyan", "blue", "ice", "white", "teal", "pink", "salmon", "yellow"];
const fieldWeights = [34, 22, 14, 8, 10, 6, 4, 2];
const iconColors: ColorName[] = ["cyan", "ice", "teal", "pink", "salmon", "white", "blue"];
const iconWeights = [30, 12, 18, 14, 8, 10, 8];

export const buildWorld = (seed = 7): World => {
  const rand = rng(seed);
  const pick = (names: ColorName[], w: number[]) => names[pickWeighted(rand(), w)];

  // -- opening sphere: dense shell + sparse interior
  const sphere: SphereParticle[] = [];
  for (let i = 0; i < 9000; i++) {
    const d = randomUnit(rand);
    const shell = rand() < 0.8;
    const r = SPHERE_R * (shell ? 0.9 + 0.1 * Math.sqrt(rand()) : Math.cbrt(rand()) * 0.9);
    sphere.push({
      p: [d[0] * r, d[1] * r, d[2] * r],
      size: 0.05 + Math.pow(rand(), 2.0) * 0.26,
      color: pick(sphereColors, sphereWeights),
      square: rand() < 0.75,
      twinkle: rand() * Math.PI * 2,
      burst: 0.6 + Math.pow(rand(), 0.8) * 5.5,
      drift: randomUnit(rand),
      inner: !shell,
    });
  }

  // -- network field: volume of data particles ahead of the camera
  const field: Particle[] = [];
  for (let i = 0; i < 7500; i++) {
    const z = -12 + Math.pow(rand(), 0.85) * 610;
    const spread = 18 + Math.max(0, z) * 0.22;
    field.push({
      p: [(rand() * 2 - 1) * spread * 1.6, (rand() * 2 - 1) * spread, z],
      size: 0.07 + Math.pow(rand(), 2.2) * 0.32,
      color: pick(fieldColors, fieldWeights),
      square: rand() < 0.7,
      twinkle: rand() * Math.PI * 2,
    });
  }

  // -- social / app icons floating in the network
  const icons: Icon[] = [];
  for (let i = 0; i < 5000; i++) {
    const z = 8 + Math.pow(rand(), 0.9) * 545;
    const spread = 10 + z * 0.19;
    icons.push({
      p: [(rand() * 2 - 1) * spread * 1.6, (rand() * 2 - 1) * spread, z],
      size: 0.42 + Math.pow(rand(), 1.7) * 1.2,
      name: ICON_NAMES[Math.floor(rand() * ICON_NAMES.length)],
      color: pick(iconColors, iconWeights),
      tile: rand() < 0.35,
    });
  }

  // -- plexus links between nearby nodes
  const hubs = field.filter((_, i) => i % 3 === 0).map((f) => f.p);
  const links: Segment[] = [];
  for (let i = 0; i < hubs.length; i++) {
    let best = -1;
    let bestD = Infinity;
    let second = -1;
    let secondD = Infinity;
    const a = hubs[i];
    for (let j = 0; j < hubs.length; j++) {
      if (j === i) continue;
      const b = hubs[j];
      const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
      if (d < bestD) {
        second = best;
        secondD = bestD;
        best = j;
        bestD = d;
      } else if (d < secondD) {
        second = j;
        secondD = d;
      }
    }
    const maxD = 26 * 26;
    if (best >= 0 && bestD < maxD && rand() < 0.6)
      links.push({ a, b: hubs[best], color: col("ice"), alpha: 0.2 + rand() * 0.3, width: 0.035 });
    if (second >= 0 && secondD < maxD && rand() < 0.25)
      links.push({ a, b: hubs[second], color: col("cyan"), alpha: 0.2 + rand() * 0.3, width: 0.03 });
  }

  // -- long bright data beams that sweep across the frame
  const beams: Segment[] = [];
  for (let i = 0; i < 34; i++) {
    const z = 20 + rand() * 500;
    const spread = 14 + z * 0.22;
    const a: V3 = [(rand() * 2 - 1) * spread * 1.6, (rand() * 2 - 1) * spread, z];
    const dir = randomUnit(rand);
    const L = 30 + rand() * 120;
    beams.push({
      a,
      b: [a[0] + dir[0] * L, a[1] + dir[1] * L, a[2] + dir[2] * L * 0.6],
      color: rand() < 0.6 ? "ice" : "blue",
      alpha: 0.35 + rand() * 0.5,
      width: 0.05 + rand() * 0.06,
    });
  }

  // -- white "circuit trace" polylines (axis aligned, in planes facing camera)
  const circuits: Polyline[] = [];
  for (let i = 0; i < 160; i++) {
    const z = -5 + rand() * 600;
    const spread = 14 + Math.max(0, z) * 0.22;
    let x = (rand() * 2 - 1) * spread * 1.6;
    let y = (rand() * 2 - 1) * spread;
    const pts: V3[] = [[x, y, z]];
    const n = 2 + Math.floor(rand() * 4);
    let horiz = rand() < 0.5;
    for (let k = 0; k < n; k++) {
      const L = (1.5 + rand() * 6) * (rand() < 0.5 ? -1 : 1);
      if (horiz) x += L;
      else y += L;
      horiz = !horiz;
      pts.push([x, y, z]);
    }
    circuits.push({ pts, color: rand() < 0.7 ? "white" : "ice", alpha: 0.5 + rand() * 0.5 });
  }

  // -- dim blue circuit-board backdrop seen behind the opening sphere
  const backdrop: Polyline[] = [];
  for (let i = 0; i < 260; i++) {
    const z = 45 + rand() * 60;
    let x = (rand() * 2 - 1) * 70;
    let y = (rand() * 2 - 1) * 40;
    const pts: V3[] = [[x, y, z]];
    let horiz = rand() < 0.6;
    const n = 2 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      const L = (2 + rand() * 9) * (rand() < 0.5 ? -1 : 1);
      if (horiz) x += L;
      else y += L;
      horiz = !horiz;
      pts.push([x, y, z]);
    }
    backdrop.push({ pts, color: rand() < 0.7 ? "blue" : "cyan", alpha: 0.35 + rand() * 0.45 });
  }

  // -- lattice "data-center" corridor around the core
  const lattice: Segment[] = [];
  const latticeNodes: Particle[] = [];
  const zs = [295, 330, 365, 400, 435, 470, 505, 535, 558];
  const xs = [-120, -90, -60, -30, 30, 60, 90, 120];
  const ys = [-66, -48, -30, -14, 14, 30, 48, 66];
  const dash = (a: V3, b: V3, color: ColorName, baseAlpha: number, width: number) => {
    // break each beam into dashes with random brightness (glitchy tech look)
    const pieces = 3 + Math.floor(rand() * 6);
    for (let k = 0; k < pieces; k++) {
      if (rand() < 0.3) continue;
      const t0 = k / pieces;
      const t1 = t0 + (1 / pieces) * (0.4 + rand() * 0.6);
      const lerpP = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const bright = rand() < 0.18;
      lattice.push({
        a: lerpP(t0),
        b: lerpP(t1),
        color: bright ? "white" : color,
        alpha: bright ? 0.9 : baseAlpha * (0.5 + rand() * 0.5),
        width: bright ? width * 1.6 : width,
      });
    }
  };
  for (const z of zs) {
    for (const x of xs) dash([x, -66, z], [x, 66, z], "blue", 1.0, 0.22);
    for (const y of ys) dash([-120, y, z], [120, y, z], "blue", 1.0, 0.22);
    for (const x of xs)
      for (const y of ys)
        if (rand() < 0.6)
          latticeNodes.push({ p: [x, y, z], size: 0.45 + rand() * 0.4, color: rand() < 0.5 ? "white" : "cyan", square: true, twinkle: rand() * 6.28 });
  }
  for (const x of xs)
    for (const y of ys)
      if (Math.abs(x) > 40 || Math.abs(y) > 24 || rand() < 0.3) dash([x, y, zs[0]], [x, y, zs[zs.length - 1]], "blue", 0.9, 0.2);

  // -- ring of dots framing the core
  const ring: Particle[] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2 + (rand() - 0.5) * 0.02;
    const r = 42 + (rand() - 0.5) * 1.6;
    ring.push({
      p: [Math.cos(a) * r, Math.sin(a) * r, CORE[2] - 25],
      size: 0.75 + rand() * 0.45,
      color: rand() < 0.6 ? "yellow" : rand() < 0.75 ? "salmon" : "white",
      square: true,
      twinkle: rand() * 6.28,
    });
  }

  // -- light-speed rays emitted from the core during the final dive
  const rays = [];
  for (let i = 0; i < 420; i++) {
    rays.push({
      angle: rand() * Math.PI * 2,
      r0: 0.02 + rand() * 0.1,
      len: 0.25 + Math.pow(rand(), 0.6) * 1.1,
      width: 0.6 + rand() * 2.4,
      color: (rand() < 0.45 ? "white" : rand() < 0.6 ? "cyan" : "blue") as ColorName,
      alpha: 0.25 + rand() * 0.6,
      delay: rand() * 0.5,
    });
  }

  return { sphere, field, icons, links, beams, circuits, backdrop, lattice, latticeNodes, ring, rays };
};

export const COLORS_USED = COLOR_NAMES;
