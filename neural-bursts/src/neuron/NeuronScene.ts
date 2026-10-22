import * as THREE from "three";
import { CloudUniforms, makeCloud, PointSpec, tw } from "../lib/cloud";
import { StageFactory } from "../lib/GLStage";
import {
  clamp01,
  gaussian,
  hex,
  Key,
  lerp,
  mulberry32,
  pickWeighted,
  randomUnitVector,
  range,
  RGB,
  Rng,
  track,
} from "../lib/math";
import { makeSegments, SegmentSpec, SegmentUniforms } from "../lib/segments";

// ---------------------------------------------------------------------------
// Neuron: a particle soma with glowing dendrites, floating light orbs and a
// starfield of specks, shot with shallow depth of field and a lens flare.
// ---------------------------------------------------------------------------

const PAL = {
  tubeOuter: hex("#0a2a9a"),
  tube: hex("#1f62f0"),
  tubeCore: hex("#7cc4ff"),
  fuzz: [
    [hex("#8fd0ff"), 4],
    [hex("#3d8dff"), 5],
    [hex("#e6f6ff"), 1],
  ] as [RGB, number][],
  soma: [
    [hex("#6fb8ff"), 5],
    [hex("#2f78ff"), 5],
    [hex("#d8f0ff"), 1.5],
  ] as [RGB, number][],
  somaHalo: hex("#2f7dff"),
  somaCore: hex("#f2fbff"),
  orb: hex("#62b4ff"),
  pulse: hex("#bfe8ff"),
  specks: [
    [hex("#ffffff"), 3],
    [hex("#7fd2ff"), 4],
    [hex("#2f7bff"), 4],
    [hex("#1d4fd8"), 2],
  ] as [RGB, number][],
  background: hex("#01030a"),
  flare: hex("#a6e6ff"),
};

type Branch = { pts: THREE.Vector3[]; radius: number[] };

/** A gently meandering curve that leaves the soma along `dir`. */
const growBranch = (
  rng: Rng,
  start: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  r0: number,
): Branch => {
  const step = 0.07;
  const n = Math.ceil(length / step);
  const pts: THREE.Vector3[] = [start.clone()];
  const radius: number[] = [r0];
  const d = dir.clone().normalize();
  const bendAxis = new THREE.Vector3(...randomUnitVector(rng));
  const axis2 = new THREE.Vector3(...randomUnitVector(rng));
  const freq = range(rng, 0.25, 0.5);
  const freq2 = range(rng, 0.6, 1.0);
  const phase = rng() * 6.28;
  const amp = range(rng, 0.008, 0.018);
  for (let i = 1; i <= n; i++) {
    const s = i / n;
    const x = i * step;
    d.applyAxisAngle(bendAxis, Math.sin(x * freq + phase) * amp)
      .applyAxisAngle(axis2, Math.sin(x * freq2 + phase * 1.7) * amp * 0.6)
      .normalize();
    pts.push(pts[i - 1].clone().addScaledVector(d, step));
    radius.push(r0 * (Math.pow(1 - s, 1.4) * 0.8 + 0.2 * Math.exp(-s * 18) * 2) + 0.03);
  }
  return { pts, radius };
};

const SOMA_TRACK_X: Key[] = [
  { t: 0, v: 0.36 },
  { t: 2.5, v: 0.4 },
  { t: 5, v: 0.47 },
  { t: 7.5, v: 0.52 },
  { t: 10, v: 0.575 },
  { t: 12.5, v: 0.585 },
  { t: 15, v: 0.625 },
  { t: 17.5, v: 0.67 },
  { t: 20, v: 0.7 },
];
const SOMA_TRACK_Y: Key[] = [
  { t: 0, v: 0.28 },
  { t: 2.5, v: 0.3 },
  { t: 5, v: 0.33 },
  { t: 7.5, v: 0.4 },
  { t: 10, v: 0.42 },
  { t: 12.5, v: 0.42 },
  { t: 15, v: 0.44 },
  { t: 17.5, v: 0.5 },
  { t: 20, v: 0.6 },
];

export type NeuronCamera = (t: number) => {
  azimuth: number;
  elevation: number;
  distance: number;
  roll: number;
  /** Where the soma sits on screen, 0..1 from the top-left. */
  screen: [number, number];
  /** Focus distance offset from the soma (negative = nearer). */
  focusOffset: number;
  flare: [number, number];
  flareGain: number;
};

// Version 1: slow drift that carries the soma from upper-left to lower-right
// while the view rolls gently around it — matching the reference.
export const referenceCamera: NeuronCamera = (t) => {
  const s = t / 20;
  return {
    azimuth: lerp(-0.18, 0.32, s),
    elevation: lerp(0.22, -0.3, s) + 0.03 * Math.sin(t * 0.6),
    distance: 5.4 - 0.25 * Math.sin(s * Math.PI),
    roll: lerp(0.05, -0.42, s) + 0.02 * Math.sin(t * 0.45),
    screen: [track(SOMA_TRACK_X, t), track(SOMA_TRACK_Y, t)],
    focusOffset: 0,
    flare: [0.985, 0.45],
    flareGain: 1,
  };
};

const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

// Version 2: a sweeping low-angle orbit with a dolly-in and a rack focus
// from the foreground dendrite to the soma.
export const orbitCamera: NeuronCamera = (t) => {
  const s = t / 20;
  const e = smooth(s);
  return {
    azimuth: lerp(-1.55, 1.2, e),
    elevation: lerp(-0.62, 0.35, smooth(s * 1.1)),
    distance: lerp(7.2, 3.6, e),
    roll: lerp(0.32, -0.12, e),
    screen: [lerp(0.42, 0.52, e), lerp(0.56, 0.48, e)],
    focusOffset: -2.6 * (1 - smooth((t - 1.5) / 3.5)),
    flare: [lerp(-0.02, 1.0, e), lerp(0.62, 0.42, e)],
    flareGain: 0.6,
  };
};

export const createNeuronStage =
  (cameraPath: NeuronCamera, seed: number): StageFactory =>
  (ctx) => {
    const { width, height, px } = ctx;
    const rng = mulberry32(seed);
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    scene.add(root);
    const FOV = 42;
    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.05, 300);
    const projScale = height / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));

    const clouds: CloudUniforms[] = [];
    const addCloud = (c: ReturnType<typeof makeCloud>) => {
      c.u.uProjScale.value = projScale;
      c.u.uMaxCoc.value = 34;
      clouds.push(c.u);
      root.add(c.object);
      return c;
    };
    const segs: SegmentUniforms[] = [];
    const addSegs = (s: ReturnType<typeof makeSegments>) => {
      s.u.uProjScale.value = projScale;
      s.u.uWorld.value = 1;
      segs.push(s.u);
      root.add(s.object);
      return s.u;
    };

    // --- Dendrites ------------------------------------------------------
    const branches: Branch[] = [];
    const ROOTS = 7;
    for (let i = 0; i < ROOTS; i++) {
      const ang = (i / ROOTS) * Math.PI * 2 + range(rng, -0.4, 0.4);
      const dir = new THREE.Vector3(
        Math.cos(ang),
        Math.sin(ang) * 0.8,
        range(rng, -1.3, 1.3),
      ).normalize();
      const start = dir.clone().multiplyScalar(0.35);
      const b = growBranch(rng, start, dir, range(rng, 8, 15), range(rng, 0.09, 0.14));
      branches.push(b);
      // One or two side branches per dendrite.
      const kids = rng() < 0.6 ? 2 : 1;
      for (let k = 0; k < kids; k++) {
        const at = Math.floor(b.pts.length * range(rng, 0.18, 0.5));
        const along = b.pts[at + 1].clone().sub(b.pts[at]).normalize();
        const side = new THREE.Vector3(...randomUnitVector(rng)).cross(along).normalize();
        const cdir = along.clone().multiplyScalar(0.7).addScaledVector(side, 0.7).normalize();
        branches.push(growBranch(rng, b.pts[at], cdir, range(rng, 3, 6), b.radius[at] * 0.6));
      }
    }

    const outer: SegmentSpec[] = [];
    const body: SegmentSpec[] = [];
    const cores: SegmentSpec[] = [];
    const fuzz: PointSpec[] = [];
    for (const b of branches) {
      for (let i = 0; i < b.pts.length - 1; i++) {
        const a = b.pts[i].toArray() as [number, number, number];
        const c = b.pts[i + 1].toArray() as [number, number, number];
        const ra = b.radius[i];
        const rb = b.radius[i + 1];
        outer.push({ a, b: c, width: [ra * 2.4, rb * 2.4], color: PAL.tubeOuter, alpha: [0.12, 0.12] });
        body.push({ a, b: c, width: [ra, rb], color: PAL.tube, alpha: [0.26, 0.26] });
        cores.push({ a, b: c, width: [ra * 0.3, rb * 0.3], color: PAL.tubeCore, alpha: [0.1, 0.1] });
        // Particle fuzz hugging the dendrite surface.
        const count = Math.round(14 * (ra / 0.1) + 3);
        for (let k = 0; k < count; k++) {
          const f = rng();
          const p = b.pts[i].clone().lerp(b.pts[i + 1], f);
          const r = ra * Math.abs(gaussian(rng)) * 0.9;
          const o = randomUnitVector(rng);
          fuzz.push({
            pos: [p.x + o[0] * r, p.y + o[1] * r, p.z + o[2] * r],
            color: pickWeighted(rng, PAL.fuzz),
            size: range(rng, 1.4, 3),
            seed: tw(rng, range(rng, 0.45, 1)),
          });
        }
      }
    }
    addSegs(makeSegments(outer, ctx));
    addSegs(makeSegments(body, ctx));
    addSegs(makeSegments(cores, ctx));
    const fuzzCloud = addCloud(makeCloud(fuzz, px, { twinkle: 0.5, maxSize: 70 }));

    // --- Soma --------------------------------------------------------------
    const somaPts: PointSpec[] = [];
    const lump = (v: [number, number, number]) =>
      1 + 0.16 * Math.sin(v[0] * 3.1 + 1.3) * Math.cos(v[1] * 2.7) + 0.1 * Math.sin(v[2] * 4.3 + v[0] * 2);
    for (let i = 0; i < 12000; i++) {
      const d = randomUnitVector(rng);
      const shell = rng() < 0.7;
      const r = (shell ? range(rng, 0.55, 0.75) : Math.pow(rng(), 0.6) * 0.62) * lump(d);
      somaPts.push({
        pos: [d[0] * r, d[1] * r * 0.92, d[2] * r],
        color: pickWeighted(rng, PAL.soma),
        size: range(rng, 2.4, 4.4),
        seed: tw(rng, range(rng, 0.45, 1)),
      });
    }
    for (let i = 0; i < 40; i++) {
      const d = randomUnitVector(rng);
      const r = range(rng, 0.4, 0.8);
      somaPts.push({
        pos: [d[0] * r, d[1] * r, d[2] * r],
        color: PAL.somaCore,
        size: range(rng, 5, 9),
        seed: tw(rng, 1),
      });
    }
    const soma = addCloud(makeCloud(somaPts, px, { twinkle: 0.55, maxSize: 70 }));
    const somaGlow = addCloud(
      makeCloud(
        [
          { pos: [0, 0, 0], color: PAL.somaHalo, size: 5, seed: [0, 0, 1, 0.4] },
          { pos: [0, 0, 0], color: PAL.somaHalo, size: 2.4, seed: [0, 0, 1, 0.9] },
          { pos: [0, 0, 0], color: PAL.somaCore, size: 0.55, seed: [0, 0, 1, 1] },
          { pos: [0, 0, 0], color: PAL.somaCore, size: 0.2, seed: [0, 0, 1, 1.5] },
        ],
        px,
        { world: true, maxSize: 520 },
      ),
    );

    // --- Floating light orbs --------------------------------------------
    const orbs = addCloud(
      makeCloud(
        Array.from({ length: 70 }, () => {
          const d = randomUnitVector(rng);
          const r = range(rng, 1.0, 5.5);
          return {
            pos: [d[0] * r, d[1] * r * 0.8, d[2] * r * 0.6],
            color: PAL.orb,
            size: range(rng, 34, 64),
            seed: tw(rng, range(rng, 0.55, 1)),
          };
        }),
        px,
        { twinkle: 0.35, maxSize: 110 },
      ),
    );

    // --- Specks and bokeh --------------------------------------------------
    const specks: PointSpec[] = [];
    for (let i = 0; i < 8500; i++) {
      const d = randomUnitVector(rng);
      const r = range(rng, 2.2, 30);
      specks.push({
        pos: [d[0] * r, d[1] * r * 0.7, d[2] * r],
        color: pickWeighted(rng, PAL.specks),
        size: range(rng, 1.1, 2.5) * (rng() < 0.08 ? 1.8 : 1),
        seed: tw(rng, range(rng, 0.3, 1)),
      });
    }
    const speckCloud = addCloud(makeCloud(specks, px, { twinkle: 0.5, maxSize: 80 }));

    // --- Signal pulses travelling into the soma -----------------------------
    const PULSES_PER = 2;
    const pulseInfo = branches.flatMap((b, bi) =>
      Array.from({ length: PULSES_PER }, () => ({ b: bi, off: rng(), speed: range(rng, 0.05, 0.11) })),
    );
    const pulseCloud = makeCloud(
      pulseInfo.map(() => ({
        pos: [0, 0, 0] as [number, number, number],
        color: PAL.pulse,
        size: range(rng, 7, 11),
        seed: tw(rng, 1),
      })),
      px,
      { maxSize: 80 },
    );
    addCloud(pulseCloud);
    const pulsePos = pulseCloud.object.geometry.getAttribute("position") as THREE.BufferAttribute;
    const pulseSeed = pulseCloud.object.geometry.getAttribute("aSeed") as THREE.BufferAttribute;

    const tmpSoma = new THREE.Vector3();
    const update = (t: number) => {
      const cam = cameraPath(t);
      // Orbit around the soma.
      const ce = Math.cos(cam.elevation);
      camera.position.set(
        Math.sin(cam.azimuth) * ce * cam.distance,
        Math.sin(cam.elevation) * cam.distance,
        Math.cos(cam.azimuth) * ce * cam.distance,
      );
      camera.up.set(Math.sin(cam.roll), Math.cos(cam.roll), 0);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      // Lens shift so the soma lands on its keyframed screen position.
      const ndcX = cam.screen[0] * 2 - 1;
      const ndcY = 1 - cam.screen[1] * 2;
      camera.projectionMatrix.elements[8] = -ndcX;
      camera.projectionMatrix.elements[9] = -ndcY;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

      root.rotation.set(0, t * 0.012, 0);
      root.updateMatrixWorld();
      const focus = camera.position.distanceTo(tmpSoma.set(0, 0, 0)) + cam.focusOffset;

      for (const u of clouds) {
        u.uTime.value = t;
        u.uFocus.value = focus;
        u.uAperture.value = 4.5;
      }
      for (const u of segs) {
        u.uFocus.value = focus;
        u.uAperture.value = 4.5;
      }
      speckCloud.u.uDrift.value = 0.35;
      orbs.u.uDrift.value = 0.25;
      // Orbs stay mostly sharp so they read as glowing points of light.
      orbs.u.uAperture.value = 1.2;
      orbs.u.uOpacity.value = 2.2;
      fuzzCloud.u.uDrift.value = 0.015;

      // Soma breathing: bright around 2.5 s and 15 s like the reference.
      const beat = 0.78 + 0.42 * Math.max(0, Math.cos(((t - 2.5) / 12.5) * Math.PI * 2));
      somaGlow.u.uOpacity.value = beat;
      soma.u.uOpacity.value = 1.6 + 0.5 * beat;
      soma.u.uScale.value = 1 + 0.025 * Math.sin(t * 1.3);

      // Pulses flowing toward the soma.
      pulseInfo.forEach((p, i) => {
        const b = branches[p.b];
        const s = 1 - ((p.off + t * p.speed) % 1);
        const idx = s * (b.pts.length - 1);
        const i0 = Math.floor(idx);
        const i1 = Math.min(i0 + 1, b.pts.length - 1);
        const v = b.pts[i0].clone().lerp(b.pts[i1], idx - i0);
        pulsePos.setXYZ(i, v.x, v.y, v.z);
        // Fade in/out at the ends of the journey.
        pulseSeed.setW(i, Math.sin(Math.PI * clamp01(s)) * 0.9);
      });
      pulsePos.needsUpdate = true;
      pulseSeed.needsUpdate = true;

      return {
        scene,
        camera,
        post: {
          bloom: 1.5,
          exposure: 1.2,
          vignette: 0.45,
          background: PAL.background,
          bgGlowColor: PAL.flare,
          bgGlowPos: [cam.flare[0], cam.flare[1]] as [number, number],
          bgGlow: (0.75 + 0.08 * Math.sin(t * 0.9)) * cam.flareGain,
          streak: 0.06,
          streakY: cam.flare[1],
          fade: 1,
        },
      };
    };

    return {
      update,
      dispose: () => {
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
          (m.material as THREE.Material | undefined)?.dispose();
        });
      },
    };
  };
