import * as THREE from "three";
import { Look } from "../lib/LookCanvas";
import { Post } from "../lib/post";
import { buildRibbonGeometry, ribbonMaterial, RibbonLine } from "../lib/ribbon";
import { Dots } from "../lib/points";
import { currentLoopField, flat, PathSampler, resample, traceLine, V3 } from "../lib/fieldlines";
import { mulberry32 } from "../lib/rng";
import { loopPhase, TAU } from "../lib/loop";

/**
 * Magnetic dipole = a small current loop (radius CORE_A) at the origin, moment
 * up. Field lines are seeded on rings inside the loop, in the equatorial
 * plane, and integrated (RK4) until they come back through the core.
 */
const CORE_A = 0.25;
const AZIMUTHS = 24;
/** target outer equatorial radius of the three families (outer = torus outline) */
const TARGET_R = [1.0, 0.74, 0.5];
const field = currentLoopField(CORE_A);

const traceLoop = (rho: number) => {
  let crossed = false;
  const pts = traceLine(field, [rho, 0, 0], {
    dir: 1,
    step: (p) => Math.min(0.01, Math.max(0.0015, 0.05 * Math.abs(Math.hypot(p[0], p[2]) - CORE_A) + 0.002)),
    stop: (p) => {
      // closed once it climbs back through the equator inside the core
      if (p[1] < -0.005) crossed = true;
      return (crossed && p[1] >= 0 && Math.hypot(p[0], p[2]) < CORE_A) || Math.hypot(...p) > 3;
    },
    maxSteps: 20000,
  });
  // snap the end exactly onto the start so the loop closes
  pts[pts.length - 1] = [rho, 0, 0];
  return pts;
};

const outerRadius = (pts: V3[]) => pts.reduce((m, p) => Math.max(m, Math.hypot(p[0], p[2])), 0);

/** Seed radius whose loop reaches `target` at the equator (bisection; larger rho = smaller loop). */
const seedFor = (target: number) => {
  let lo = 0.02, hi = CORE_A * 0.95;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (outerRadius(traceLoop(mid)) > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
};

let cached: V3[][] | null = null;
const familyLoops = () => (cached ??= TARGET_R.map((r) => resample(traceLoop(seedFor(r)), 0.006)));

export interface TorusParams { top: string; bottom: string; bg: string }

export const createTorus = (p: TorusParams) => (gl: THREE.WebGLRenderer, w: number, h: number): Look => {
  const res = new THREE.Vector2(w, h);
  const pxScale = h / 2160;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(p.bg);
  const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  const elev = (5 * Math.PI) / 180, dist = 3.05;
  cam.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
  cam.lookAt(0, -0.07, 0);
  cam.updateMatrixWorld();

  const top = new THREE.Color(p.top), bottom = new THREE.Color(p.bottom);
  const fam = familyLoops();
  const group = new THREE.Group();
  scene.add(group);

  const rnd = mulberry32(2190);
  const lines: { pts: V3[]; sampler: PathSampler; fam: number }[] = [];
  const ribbons: RibbonLine[] = [];
  const c = new THREE.Color();
  fam.forEach((base, f) => {
    for (let k = 0; k < AZIMUTHS; k++) {
      const phi = (TAU * k) / AZIMUTHS; // all three families share the 24 meridian planes
      const cs = Math.cos(phi), sn = Math.sin(phi);
      const pts = base.map(([x, y, z]) => [x * cs + z * sn, y, -x * sn + z * cs] as V3);
      const col = new Float32Array(pts.length * 3);
      pts.forEach((q, i) => {
        const yN = q[1] / 0.38;
        c.copy(bottom).lerp(top, THREE.MathUtils.smoothstep(yN, -0.05, 0.05));
        // white-hot glint where the loop crosses the equator on the outside
        const rho = Math.hypot(q[0], q[2]);
        const glint = Math.exp(-((q[1] / 0.01) ** 2));
        c.lerp(new THREE.Color(1, 0.85, 0.6), glint * 0.85).multiplyScalar(1 + glint * 2.0);
        // inner families are fainter; and dim where all loops crowd the core
        // (the equator glint, including the streak through the core, is not dimmed)
        c.multiplyScalar(THREE.MathUtils.lerp([1, 0.5, 0.3][f] * (0.12 + 0.88 * THREE.MathUtils.smoothstep(rho, 0.04, 0.3)), 1, glint));
        col.set([c.r, c.g, c.b], i * 3);
      });
      ribbons.push({ p: flat(pts), color: col, param: rnd() });
      lines.push({ pts, sampler: new PathSampler(pts), fam: f });
    }
  });
  const geo = buildRibbonGeometry(ribbons);
  const fade: [number, number, number] = [dist - 0.6, dist + 0.5, 0.3];
  const glow = new THREE.Mesh(geo, ribbonMaterial({ width4k: 20, pxScale, res, mode: "glow", additive: true, intensity: 0.035, depthFade: fade }));
  const core = new THREE.Mesh(geo, ribbonMaterial({ width4k: 12, pxScale, res, mode: "solid", additive: true, intensity: 0.9, depthFade: fade }));
  [glow, core].forEach((m, i) => { m.frustumCulled = false; m.renderOrder = i; group.add(m); });

  // equator dots: where every loop crosses the equator (outer and inner side)
  const eq: V3[] = [];
  lines.forEach((l) => {
    let best = 0, bestR = 0;
    l.pts.forEach((q, i) => { const r = Math.hypot(q[0], q[2]); if (r > bestR) { bestR = r; best = i; } });
    eq.push(l.pts[best]);
  });
  const eqDots = new Dots({ count: eq.length, pxScale, mode: 0, additive: true });
  eq.forEach((q, i) => {
    eqDots.pos.set(q, i * 3);
    eqDots.rgba.set([2.6, 1.2, 0.55, 1], i * 4);
    eqDots.size[i] = 18;
  });
  eqDots.update();
  eqDots.points.renderOrder = 3;
  group.add(eqDots.points);

  // beads travelling along the loops: whole trips per loop
  const N_BEADS = 150;
  const beads = new Dots({ count: N_BEADS, pxScale, mode: 0, additive: true });
  const bead = Array.from({ length: N_BEADS }, () => ({
    line: Math.floor(rnd() * lines.length), trips: 1 + Math.floor(rnd() * 2), phase: rnd(), size: 6 + rnd() * 4,
  }));
  beads.points.renderOrder = 4;
  group.add(beads.points);

  const post = new Post(gl, w, h, {
    bloom: { strength: 0.3, threshold: 0.7, knee: 0.3, levels: 5, radius: 0.6 },
    grain: 0.015, shoulder: 0.75,
    vignette: { amount: 0.0, start: 0.6, end: 1.4 },
  });

  const tmp: V3 = [0, 0, 0];
  return {
    render(frame) {
      const t = loopPhase(frame);
      // 360/24 * 4 = 60 degrees per loop: the 24-fold symmetry makes it seamless
      // + half a step so loops are not exactly edge-on at the loop start
      group.rotation.y = ((TAU / AZIMUTHS) * 4) * t + TAU / AZIMUTHS / 2;
      bead.forEach((b, i) => {
        const l = lines[b.line];
        const u = (t * b.trips + b.phase) % 1;
        l.sampler.at(u * l.sampler.length, tmp);
        beads.pos.set(tmp, i * 3);
        const yN = tmp[1] / 0.38;
        c.copy(bottom).lerp(top, THREE.MathUtils.smoothstep(yN, -0.05, 0.05)).lerp(new THREE.Color(1, 1, 1), 0.2);
        beads.rgba.set([c.r * 0.8, c.g * 0.8, c.b * 0.8, 0.35], i * 4);
        beads.size[i] = b.size;
      });
      beads.update();
      group.updateMatrixWorld();
      post.render(scene, cam, frame);
    },
    dispose() {
      post.dispose();
      geo.dispose();
      beads.dispose();
      eqDots.dispose();
    },
  };
};
