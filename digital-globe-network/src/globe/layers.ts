import * as THREE from "three";
import landDots from "../data/land-dots.json";
import { DEG, latLonToVec3 } from "./math";
import { mulberry32, range } from "./random";

export type GlobePalette = {
  land: THREE.Color;
  landAlt: THREE.Color;
  coast: THREE.Color;
  ocean: THREE.Color;
  rim: THREE.Color;
  spike: THREE.Color;
  ringWarm: THREE.Color;
  ringCool: THREE.Color;
  arc: THREE.Color;
  red: THREE.Color;
  dust: THREE.Color;
  shell: THREE.Color;
};

export const PALETTE: GlobePalette = {
  land: new THREE.Color("#9cc9ff"),
  landAlt: new THREE.Color("#e6f2ff"),
  coast: new THREE.Color("#ffb07a"),
  ocean: new THREE.Color("#020717"),
  rim: new THREE.Color("#7fb6ff"),
  spike: new THREE.Color("#a8d8ff"),
  ringWarm: new THREE.Color("#ff9a5c"),
  ringCool: new THREE.Color("#e8f1ff"),
  arc: new THREE.Color("#ff7036"),
  red: new THREE.Color("#ff3b2e"),
  dust: new THREE.Color("#7ea8ff"),
  shell: new THREE.Color("#8fb8ff"),
};

export class PointBuilder {
  positions: number[] = [];
  colors: number[] = [];
  sizes: number[] = [];
  alphas: number[] = [];
  anims: number[] = [];
  push(p: THREE.Vector3, c: THREE.Color, size: number, alpha: number, anim: [number, number, number, number] = [0, 0, 0, 0]) {
    this.positions.push(p.x, p.y, p.z);
    this.colors.push(c.r, c.g, c.b);
    this.sizes.push(size);
    this.alphas.push(alpha);
    this.anims.push(...anim);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    g.setAttribute("size", new THREE.Float32BufferAttribute(this.sizes, 1));
    g.setAttribute("alpha", new THREE.Float32BufferAttribute(this.alphas, 1));
    g.setAttribute("anim", new THREE.Float32BufferAttribute(this.anims, 4));
    g.computeBoundingSphere();
    return g;
  }
}

const mix = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, t);

/** Halftone continents: cool blue-white dots with warm, glowing coastlines. */
export const buildLand = (seed: number, P: GlobePalette) => {
  const rnd = mulberry32(seed);
  const b = new PointBuilder();
  const data = landDots as number[];
  for (let i = 0; i < data.length; i += 3) {
    const lon = data[i];
    const lat = data[i + 1];
    const coast = data[i + 2] === 1;
    // Small jitter breaks up the perfect halftone lattice in close-ups.
    const p = latLonToVec3(
      lon + range(rnd, -0.17, 0.17) / Math.max(0.25, Math.cos(lat * DEG)),
      lat + range(rnd, -0.17, 0.17),
      1.002 + range(rnd, 0, 0.004),
    );
    const r = rnd();
    let c: THREE.Color;
    let alpha: number;
    let size: number;
    if (coast && r < 0.55) {
      c = mix(P.coast, P.landAlt, rnd() * 0.35);
      alpha = range(rnd, 0.75, 1.15);
      size = range(rnd, 0.0068, 0.0095);
    } else if (r < 0.06) {
      // scattered warm "city light" specks inland
      c = P.coast;
      alpha = range(rnd, 0.6, 1);
      size = range(rnd, 0.006, 0.009);
    } else {
      c = mix(P.land, P.landAlt, rnd() * 0.6);
      alpha = range(rnd, 0.4, 0.85);
      size = range(rnd, 0.0055, 0.0075);
    }
    b.push(p, c, size, alpha, [range(rnd, 0.6, 2.4), rnd() * 6.283, 0, 0]);
  }
  return b.build();
};

/** Faint ocean grid dots, so the dark sea still reads as a data surface. */
export const buildOceanGrid = (seed: number, P: GlobePalette) => {
  const rnd = mulberry32(seed + 1);
  const b = new PointBuilder();
  const step = 1.6;
  for (let lat = -80; lat <= 80; lat += step) {
    const n = Math.round((360 / step) * Math.cos(lat * DEG));
    for (let i = 0; i < n; i++) {
      const lon = -180 + (i * 360) / n;
      b.push(latLonToVec3(lon, lat, 1.001), P.land, 0.0045, range(rnd, 0.06, 0.16), [range(rnd, 0.5, 1.5), rnd() * 6.283, 0, 0]);
    }
  }
  return b.build();
};

/** Short radial "data spikes" rising from the surface + outward rays. */
export const buildSpikes = (seed: number, P: GlobePalette) => {
  const rnd = mulberry32(seed + 2);
  const b = new PointBuilder();
  const data = landDots as number[];
  const N = 520;
  for (let s = 0; s < N; s++) {
    const onLand = s < 380;
    let dir: THREE.Vector3;
    if (onLand) {
      const i = Math.floor(rnd() * (data.length / 3)) * 3;
      dir = latLonToVec3(data[i], data[i + 1], 1);
    } else {
      dir = latLonToVec3(range(rnd, -180, 180), Math.asin(range(rnd, -1, 1)) / DEG, 1);
    }
    const len = onLand ? range(rnd, 0.03, 0.14) : range(rnd, 0.08, 0.3);
    const start = onLand ? 1.0 : range(rnd, 1.02, 1.12);
    const steps = Math.ceil(len / 0.0035);
    const c = rnd() < 0.15 ? P.coast : P.spike;
    const speed = range(rnd, 0.6, 1.8);
    const phase = rnd() * 6.283;
    for (let k = 0; k < steps; k++) {
      const u = k / steps;
      b.push(dir.clone().multiplyScalar(start + len * u), c, 0.0042, onLand ? 0.55 : 0.32, [u, speed, phase, 0]);
    }
  }
  return b.build();
};

export type RingSpec = { radius: number; warm: boolean; dashes: number; duty: number; speed: number; alpha: number; size: number };

/** Concentric orbital rings in (roughly) the equatorial plane. */
export const buildRings = (seed: number, P: GlobePalette) => {
  const rnd = mulberry32(seed + 3);
  const specs: RingSpec[] = [
    { radius: 1.16, warm: true, dashes: 1, duty: 1.01, speed: 0, alpha: 0.5, size: 0.0055 },
    { radius: 1.22, warm: false, dashes: 3, duty: 0.8, speed: 0.25, alpha: 0.55, size: 0.005 },
    { radius: 1.29, warm: true, dashes: 2, duty: 0.7, speed: -0.18, alpha: 0.75, size: 0.0065 },
    { radius: 1.36, warm: false, dashes: 1, duty: 1.01, speed: 0, alpha: 0.35, size: 0.0045 },
    { radius: 1.43, warm: true, dashes: 4, duty: 0.55, speed: 0.12, alpha: 0.6, size: 0.006 },
    { radius: 1.52, warm: false, dashes: 2, duty: 0.6, speed: -0.1, alpha: 0.45, size: 0.005 },
    { radius: 1.62, warm: true, dashes: 1, duty: 0.45, speed: 0.08, alpha: 0.5, size: 0.0055 },
    { radius: 1.75, warm: false, dashes: 6, duty: 0.35, speed: 0.06, alpha: 0.3, size: 0.0045 },
  ];
  const b = new PointBuilder();
  for (const s of specs) {
    const circumference = 2 * Math.PI * s.radius;
    const n = Math.ceil(circumference / 0.0022);
    const offset = rnd() * 6.283;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * s.radius, 0, Math.sin(a) * s.radius);
      const c = s.warm ? mix(P.ringWarm, P.ringCool, 0.15) : P.ringCool;
      b.push(p, c, s.size, s.alpha, [a + offset, s.speed, s.dashes, s.duty]);
    }
  }
  return b.build();
};

/** Orange great-circle data arcs that draw themselves across the globe. */
export const buildArcs = (seed: number, P: GlobePalette) => {
  const rnd = mulberry32(seed + 4);
  const b = new PointBuilder();
  const data = landDots as number[];
  const pickLand = () => {
    const i = Math.floor(rnd() * (data.length / 3)) * 3;
    return latLonToVec3(data[i], data[i + 1], 1);
  };
  const ARCS = 26;
  for (let a = 0; a < ARCS; a++) {
    const p0 = pickLand();
    let p1 = pickLand();
    let guard = 0;
    while (p0.angleTo(p1) < 0.5 && guard++ < 20) p1 = pickLand();
    const ang = p0.angleTo(p1);
    const height = 0.08 + ang * 0.12;
    const n = Math.ceil((ang * 1.15) / 0.0025);
    const start = range(rnd, -2, 26);
    const duration = range(rnd, 2.2, 4.2);
    const tail = range(rnd, 0.35, 0.7);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const p = new THREE.Vector3().copy(p0).lerp(p1, u).normalize();
      // slerp-ish: normalise the lerp then lift by a sine bump
      p.multiplyScalar(1.004 + height * Math.sin(Math.PI * u));
      b.push(p, P.arc, 0.0065, 0.95, [u, start, duration, tail]);
    }
  }
  // Big sweeping orbital swooshes (long arcs off the surface)
  for (let s = 0; s < 5; s++) {
    const tiltX = range(rnd, -0.6, 0.6);
    const tiltZ = range(rnd, -0.5, 0.5);
    const r = range(rnd, 1.08, 1.32);
    const span = range(rnd, 2.2, 3.6);
    const a0 = rnd() * 6.283;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, rnd() * 6.283, tiltZ));
    const n = Math.ceil((span * r) / 0.0025);
    const start = range(rnd, 0, 24);
    const duration = range(rnd, 3.5, 5.5);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const a = a0 + span * u;
      const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r).applyQuaternion(q);
      b.push(p, mix(P.arc, P.ringWarm, 0.4), 0.0075, 0.85, [u, start, duration, 0.6]);
    }
  }
  return b.build();
};

/** Tiny red-orange data particles hovering close to the surface. */
export const buildRedSparks = (seed: number, P: GlobePalette) => {
  const rnd = mulberry32(seed + 5);
  const b = new PointBuilder();
  for (let i = 0; i < 420; i++) {
    const dir = latLonToVec3(range(rnd, -180, 180), Math.asin(range(rnd, -1, 1)) / DEG, 1);
    b.push(dir.multiplyScalar(range(rnd, 1.01, 1.25)), rnd() < 0.7 ? P.red : P.coast, range(rnd, 0.008, 0.014), range(rnd, 0.5, 1), [range(rnd, 1, 3), rnd() * 6.283, 0, 0]);
  }
  return b.build();
};

/** Big transparent dotted shell (lat/lon lines) that shows up as rim arcs. */
export const buildShell = (seed: number, P: GlobePalette) => {
  const rnd = mulberry32(seed + 6);
  const b = new PointBuilder();
  const R = 1.95;
  for (let lat = -80; lat <= 80; lat += 4) {
    const n = Math.round(1400 * Math.cos(lat * DEG));
    for (let i = 0; i < n; i++) {
      const lon = (i / n) * 360;
      b.push(latLonToVec3(lon, lat, R), P.shell, 0.0055, range(rnd, 0.12, 0.3), [range(rnd, 0.5, 1.5), rnd() * 6.283, 0, 0]);
    }
  }
  return b.build();
};

/** Floating dust and plexus-style triangle fragments around the globe. */
export const buildSpace = (seed: number, P: GlobePalette) => {
  const rnd = mulberry32(seed + 7);
  const dust = new PointBuilder();
  for (let i = 0; i < 6000; i++) {
    const dir = latLonToVec3(range(rnd, -180, 180), Math.asin(range(rnd, -1, 1)) / DEG, 1);
    const r = 1.15 + Math.pow(rnd(), 1.6) * 9;
    const c = rnd() < 0.12 ? P.coast : mix(P.dust, P.ringCool, rnd() * 0.5);
    dust.push(dir.multiplyScalar(r), c, range(rnd, 0.004, 0.011), range(rnd, 0.25, 0.8), [range(rnd, 0.5, 2.5), rnd() * 6.283, 0, 0]);
  }
  // Plexus triangles
  const tri = new PointBuilder();
  for (let t = 0; t < 150; t++) {
    const dir = latLonToVec3(range(rnd, -180, 180), Math.asin(range(rnd, -0.8, 0.8)) / DEG, 1);
    const center = dir.multiplyScalar(range(rnd, 2.0, 6.5));
    const sz = range(rnd, 0.08, 0.32);
    const verts = [0, 1, 2].map(() =>
      center.clone().add(new THREE.Vector3(range(rnd, -1, 1), range(rnd, -1, 1), range(rnd, -1, 1)).multiplyScalar(sz)),
    );
    for (let e = 0; e < 3; e++) {
      const a = verts[e];
      const bb = verts[(e + 1) % 3];
      const n = Math.ceil(a.distanceTo(bb) / 0.006);
      for (let i = 0; i <= n; i++) {
        tri.push(a.clone().lerp(bb, i / n), P.dust, 0.004, 0.3, [range(rnd, 0.3, 1.0), rnd() * 6.283, 0, 0]);
      }
    }
    for (const v of verts) tri.push(v, P.ringCool, 0.011, 0.7, [1, rnd() * 6.283, 0, 0]);
  }
  // Long radial light streaks (warp-like rays streaming off the globe)
  const rays = new PointBuilder();
  for (let s = 0; s < 260; s++) {
    const dir = latLonToVec3(range(rnd, -180, 180), Math.asin(range(rnd, -1, 1)) / DEG, 1);
    const r0 = range(rnd, 1.15, 3.2);
    const len = range(rnd, 0.12, 0.6);
    const n = Math.ceil(len / 0.006);
    const c = rnd() < 0.2 ? P.coast : P.spike;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      rays.push(dir.clone().multiplyScalar(r0 + len * u), c, 0.0045, 0.28 * Math.sin(Math.PI * u), [1.2, rnd() * 6.283, 0, 0]);
    }
  }
  return { dust: dust.build(), triangles: tri.build(), rays: rays.build() };
};

/** Padlock / marker icons scattered over land. */
export const buildIcons = (seed: number) => {
  const rnd = mulberry32(seed + 8);
  const data = landDots as number[];
  const pos: number[] = [];
  const size: number[] = [];
  const icon: number[] = [];
  const phase: number[] = [];
  for (let i = 0; i < 170; i++) {
    const j = Math.floor(rnd() * (data.length / 3)) * 3;
    const p = latLonToVec3(data[j], data[j + 1], 1.012);
    pos.push(p.x, p.y, p.z);
    size.push(range(rnd, 0.028, 0.05));
    icon.push(rnd() < 0.75 ? 0 : 1);
    phase.push(rnd() * 0.85);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("size", new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute("icon", new THREE.Float32BufferAttribute(icon, 1));
  g.setAttribute("phase", new THREE.Float32BufferAttribute(phase, 1));
  return g;
};

/** Draws the icon atlas (padlock-in-ring, map marker) into a canvas texture. */
export const buildIconAtlas = () => {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S * 2;
  c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S * 2, S);
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // --- padlock in a circle ---
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.arc(S / 2, S * 0.43, S * 0.11, Math.PI, 0);
  ctx.lineTo(S / 2 + S * 0.11, S * 0.5);
  ctx.moveTo(S / 2 - S * 0.11, S * 0.43);
  ctx.lineTo(S / 2 - S * 0.11, S * 0.5);
  ctx.stroke();
  ctx.fillRect(S / 2 - S * 0.17, S * 0.48, S * 0.34, S * 0.25);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(S / 2, S * 0.585, S * 0.035, 0, Math.PI * 2);
  ctx.fill();
  // --- marker: hexagon ring with a dot ---
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 11;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = S * 1.5 + Math.cos(a) * S * 0.34;
    const y = S / 2 + Math.sin(a) * S * 0.34;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(S * 1.5, S / 2, S * 0.1, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

/** Glittering haze hovering just above the continents (teal + ember). */
export const buildHaze = (seed: number, P: GlobePalette) => {
  const rnd = mulberry32(seed + 9);
  const b = new PointBuilder();
  const data = landDots as number[];
  const teal = new THREE.Color("#7fe0ff");
  for (let i = 0; i < 7000; i++) {
    const j = Math.floor(rnd() * (data.length / 3)) * 3;
    const lon = data[j] + range(rnd, -1.5, 1.5);
    const lat = data[j + 1] + range(rnd, -1.5, 1.5);
    const h = 1.006 + Math.pow(rnd(), 2.2) * 0.07;
    const k = rnd();
    const c = k < 0.45 ? P.coast : k < 0.75 ? teal : P.landAlt;
    b.push(latLonToVec3(lon, lat, h), c, range(rnd, 0.0035, 0.007), range(rnd, 0.25, 0.75), [range(rnd, 1, 3.5), rnd() * 6.283, 0, 0]);
  }
  return b.build();
};
