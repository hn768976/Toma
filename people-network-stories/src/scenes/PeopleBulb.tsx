import React from "react";
import * as THREE from "three";
import { COLORS, COUNTS, FPS, rgb } from "../lib/colors";
import { clamp01, keyframes, lerp, remap, smooth } from "../lib/ease";
import { mulberry32, shuffle } from "../lib/random";
import { Dots } from "../lib/three/dots";
import { Lines } from "../lib/three/lines";
import { People } from "../lib/three/people";
import { GlowOptions, SceneRuntime, Stage, StageInfo } from "../lib/three/Stage";

const DURATION = 24;

// ----- Bulb surface: globe + neck (no metal base), as a surface of revolution ----------
// Profile points (radius, y) from the top down.
const profile: [number, number][] = (() => {
  const pts: [number, number][] = [];
  for (let a = 6; a <= 128; a += 1) {
    const th = (a * Math.PI) / 180;
    pts.push([Math.sin(th), Math.cos(th)]);
  }
  // Neck: a smooth taper (cubic Bezier) into a straight cylinder.
  const p0 = pts[pts.length - 1];
  const t0: [number, number] = [-Math.cos((38 * Math.PI) / 180), -Math.sin((38 * Math.PI) / 180)];
  const p3: [number, number] = [0.43, -1.45];
  const p1: [number, number] = [p0[0] + t0[0] * 0.25, p0[1] + t0[1] * 0.25];
  const p2: [number, number] = [0.43, -1.15];
  for (let i = 1; i <= 40; i++) {
    const u = i / 40;
    const v = 1 - u;
    pts.push([
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ]);
  }
  for (let i = 1; i <= 20; i++) pts.push([0.43, -1.45 - (0.55 * i) / 20]);
  return pts;
})();

// Samples the profile at uniform arc length.
const sampleProfile = (n: number) => {
  const cum = [0];
  for (let i = 1; i < profile.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  const out: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const s = ((k + 0.5) / n) * total;
    let i = 1;
    while (cum[i] < s) i++;
    const u = (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
    out.push([lerp(profile[i - 1][0], profile[i][0], u), lerp(profile[i - 1][1], profile[i][1], u)]);
  }
  return { rows: out, spacing: total / n };
};

const MERIDIANS = 62;
const ROWS = Math.round(COUNTS.peopleBulbPeople / MERIDIANS);
const { rows: ROW_PTS, spacing: ROW_SPACING } = sampleProfile(ROWS);
const SLOTS = MERIDIANS * ROWS;

type Slot = { x: number; y: number; z: number; nx: number; nz: number; rot: number; at: number };
const rng = mulberry32(2606192);
const SLOT_LIST: Slot[] = [];
for (let r = 0; r < ROWS; r++) {
  const [rad, y] = ROW_PTS[r];
  for (let m = 0; m < MERIDIANS; m++) {
    const a = ((m + (r % 2) * 0) / MERIDIANS) * Math.PI * 2;
    const nx = Math.sin(a);
    const nz = Math.cos(a);
    SLOT_LIST.push({ x: nx * rad, y, z: nz * rad, nx, nz, rot: a, at: 1e9 });
  }
}
// Arrival: 0-8s a few on the wall the camera looks at; 8-14s more; 14-20s all.
{
  const order = SLOT_LIST.map((_, i) => i);
  // Soft bias towards the wall the camera looks at first; the very first person is in the
  // centre of that view.
  const key = order.map((i) => {
    const s = SLOT_LIST[i];
    const d = Math.hypot(s.x, s.y - 0.05, s.z + 1);
    return Math.min(1, d / 1.4) * 0.6 + rng() * 0.5;
  });
  let first = 0;
  SLOT_LIST.forEach((s, i) => {
    const b = SLOT_LIST[first];
    if (Math.hypot(s.x, s.y + 0.03, s.z + 1) < Math.hypot(b.x, b.y + 0.03, b.z + 1)) first = i;
  });
  key[first] = -1;
  shuffle(rng, order);
  order.sort((a, b) => key[a] - key[b]);
  const count = (t: number) => {
    if (t < 0.7) return 0;
    if (t < 8) return Math.round(1 + 15 * Math.pow(remap(t, 0.7, 8), 1.5));
    if (t < 14) return Math.round(16 + 600 * Math.pow(remap(t, 8, 14), 1.6));
    return Math.round(616 + (SLOTS - 616) * smooth(remap(t, 14, 19.5)));
  };
  let k = 0;
  for (let f = 0; f <= DURATION * FPS && k < SLOTS; f++) {
    const n = Math.min(SLOTS, count(f / FPS));
    while (k < n) SLOT_LIST[order[k++]].at = f / FPS;
  }
}

// ----- Curved light streaks drifting through the inside --------------------------------
type Streak = { t0: number; life: number; axis: THREE.Vector3; r: number; c: THREE.Vector3; a0: number; speed: number; len: number; b: number };
const streakRate = (t: number) => (t < 1.5 ? 0 : t < 8 ? 0.7 : t < 14 ? lerp(0.7, 14, remap(t, 8, 14)) : t < 20.5 ? 14 : 0);
const STREAKS: Streak[] = [];
{
  const r2 = mulberry32(61921);
  let acc = 0.5;
  const dt = 1 / 120;
  for (let t = 0; t < DURATION; t += dt) {
    acc += streakRate(t) * dt;
    while (acc >= 1) {
      acc -= 1;
      const axis = new THREE.Vector3(r2() - 0.5, r2() - 0.5, r2() - 0.5).normalize();
      STREAKS.push({
        t0: t,
        life: 1.6 + r2() * 1.6,
        axis,
        r: 0.45 + r2() * 0.5,
        c: new THREE.Vector3((r2() - 0.5) * 0.3, -0.15 + (r2() - 0.5) * 0.5, (r2() - 0.5) * 0.3),
        a0: r2() * Math.PI * 2,
        speed: (1.3 + r2() * 1.4) * (r2() < 0.5 ? -1 : 1),
        len: 0.6 + r2() * 0.9,
        b: 0.45 + r2() * 0.4,
      });
    }
  }
}
const SEGS = 14;
const MAX_STREAKS = 140;

const glow: GlowOptions = { near: 0.7, far: 0.35 };

const createScene = (info: StageInfo): SceneRuntime => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, info.width / info.height, 0.01, 100);
  const bulb = new THREE.Group();
  scene.add(bulb);
  const personH = ROW_SPACING * 0.72;
  const people = new People(SLOTS, () => false, { front: COLORS.white, side: "#B0B0B0" });
  const dots = new Dots(SLOTS, info, camera, {});
  const lines = new Lines(MAX_STREAKS * SEGS, info, { width: 2.6, additive: true, depthTest: false });
  const inner = new Dots(5, info, camera, { world: true, soft: true, additive: true, depthTest: false });
  bulb.add(dots.mesh, people.group, lines.mesh, inner.mesh);
  const w = rgb(COLORS.white);
  const v = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const camLocal = new THREE.Vector3();

  return {
    scene,
    camera,
    update: (frame) => {
      const t = frame / FPS;
      // Camera: inside looking at the back wall, then pulling back through the surface.
      const camZ = keyframes(t, [[0, 0.32], [8, 0.42], [14, 4.9], [24, 5.2]]);
      const lookY = keyframes(t, [[0, 0.05], [8, 0.0], [14, -0.42], [24, -0.42]]);
      camera.position.set(0, lookY + 0.02, camZ);
      camera.lookAt(0, lookY, camZ - 1);
      camera.updateMatrixWorld();
      // The bulb turns slowly once revealed.
      const spin = THREE.MathUtils.degToRad(keyframes(t, [[0, 0], [8, 2], [24, 40]], (x) => x));
      bulb.rotation.y = spin;
      bulb.updateMatrixWorld();
      camLocal.copy(camera.position).applyMatrix4(new THREE.Matrix4().copy(bulb.matrixWorld).invert());
      const outside = smooth(remap(t, 10, 13));
      const light = smooth(remap(t, 20, 22));
      for (let i = 0; i < SLOTS; i++) {
        const s = SLOT_LIST[i];
        // Far side of the bulb (seen through it) is dimmer once we are outside.
        const dx = camLocal.x - s.x;
        const dz = camLocal.z - s.z;
        const facing = (s.nx * dx + s.nz * dz) / Math.max(1e-6, Math.hypot(dx, dz));
        const vis = lerp(1, lerp(0.22, 1, smooth(remap(facing, -0.3, 0.35))), outside);
        const age = t - s.at;
        if (age < 0) {
          people.hide(i);
          dots.set(i, s.x, s.y + personH * 0.45, s.z, 2.1, w[0], w[1], w[2], 0.55 * vis);
          continue;
        }
        dots.hide(i);
        // A short brighten as each person appears, then brighter again when the bulb lights.
        const pop = 1 + 0.6 * Math.max(0, 1 - age / 0.4);
        people.set(i, s.x, s.y, s.z, personH, vis * pop * lerp(0.92, 1.25, light), s.rot);
      }
      // Streaks.
      let n = 0;
      const fade = 1 - smooth(remap(t, 20.5, 22.5));
      for (const st of STREAKS) {
        if (n >= MAX_STREAKS) break;
        const a = t - st.t0;
        if (a < 0 || a > st.life) continue;
        const env = Math.sin(Math.PI * clamp01(a / st.life)) * st.b * fade;
        const head = st.a0 + st.speed * a;
        q.setFromAxisAngle(st.axis, 0);
        const base = new THREE.Vector3(1, 0, 0).cross(st.axis);
        if (base.lengthSq() < 1e-3) base.set(0, 1, 0).cross(st.axis);
        base.normalize();
        const other = new THREE.Vector3().crossVectors(st.axis, base);
        for (let k = 0; k < SEGS; k++) {
          const i = n * SEGS + k;
          const u0 = head - Math.sign(st.speed) * st.len * (k / SEGS);
          const u1 = head - Math.sign(st.speed) * st.len * ((k + 1) / SEGS);
          const p0 = v.copy(base).multiplyScalar(Math.cos(u0) * st.r).addScaledVector(other, Math.sin(u0) * st.r).add(st.c);
          const x0 = p0.x, y0 = p0.y, z0 = p0.z;
          const p1 = v.copy(base).multiplyScalar(Math.cos(u1) * st.r).addScaledVector(other, Math.sin(u1) * st.r).add(st.c);
          lines.setEnds(i, x0, y0, z0, p1.x, p1.y, p1.z);
          lines.setRange(i, 0, 1);
          // Bright head, fading tail.
          const fall = 1 - k / SEGS;
          lines.setColor(i, 1, 1, 1, env * fall * fall);
        }
        n++;
      }
      lines.setDrawCount(n * SEGS);
      // Inner glow when the bulb lights up.
      const glowA = light * 0.22;
      inner.set(0, 0, 0.05, 0, 2.2, 0.95, 0.97, 1, glowA);
      inner.set(1, 0, -0.35, 0, 1.6, 0.95, 0.97, 1, glowA * 0.8);
      inner.set(2, 0, -0.9, 0, 0.9, 0.95, 0.97, 1, glowA * 0.6);
      inner.set(3, 0, 0.35, 0, 1.4, 1, 1, 1, glowA * 0.7);
      inner.set(4, 0, -1.4, 0, 0.7, 1, 1, 1, glowA * 0.5);
      people.commit();
      dots.commit();
      lines.commit();
      inner.commit();
    },
  };
};

export const PeopleBulbWhite: React.FC = () => <Stage create={createScene} background={COLORS.darkBackground} glow={glow} />;
