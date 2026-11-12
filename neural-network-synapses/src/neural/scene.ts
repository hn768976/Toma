import * as THREE from "three";
import { SceneFactory } from "../engine/ThreeStage";
import { PostFX, PostParams } from "../engine/postfx";
import { buildCameraTrack, FOV, placeInView, Pose } from "./camera";
import { makeSignalMaterial, makeSomaMaterial, makeTubeMaterial } from "./materials";
import { buildNeuron, buildSweeper, Neuron } from "./network";
import { Palette } from "./palettes";
import { makeRng, randomUnit, range } from "./rng";

export type NeuralProps = { palette: Palette };

const NEAR = 0.25;
const FAR = 150;
const FOG_DENSITY = 0.028;
const FOCUS = 11.5;
const APERTURE = 0.5;
const MAX_COC = 0.075;

/**
 * Hero cell bodies. Each one is positioned so that it sits at the given
 * screen position/distance at time `t` (seconds); because the camera travels
 * backwards it first appears huge and blurred beside the lens and then
 * recedes into focus, as in the reference (0s, 2.4-4.5s, 5s, 8.9-10.5s, 11.3s-end).
 */
const HEROES = [
  { t: 0.3, x: 0.02, y: 0.12, d: 12, flashes: [] as number[][] },
  { t: 2.5, x: -0.22, y: -0.06, d: 9.5, flashes: [[3.15, 0.6, 0.4]] },
  { t: 5.0, x: 0.42, y: -0.36, d: 9, flashes: [] as number[][] },
  { t: 9.15, x: 0.5, y: 0.3, d: 7.5, flashes: [[8.75, 0.6, 0.25]] },
  { t: 11.67, x: -0.5, y: -0.2, d: 10, flashes: [[12.2, 0.5, 0.2]] },
];

/**
 * Foreground sweeps: thick processes right beside the lens. Each is placed at
 * the given screen position / distance at time `t`; as the camera drifts back
 * it slides into frame hugely out of focus and then recedes (reference: the
 * blurred diagonal at 0 s and the big sweeps near 8.5 s and 10.9 s).
 */
const SWEEPERS = [
  { t: 0.3, x: 0.9, y: -0.85, d: 6.5, roll: -0.6, radius: 0.24, length: 15 },
  { t: 8.5, x: -0.4, y: -0.5, d: 4.6, roll: 0.3, radius: 0.34, length: 18 },
  { t: 8.8, x: 0.2, y: 0.8, d: 6, roll: -0.15, radius: 0.24, length: 16 },
  { t: 10.95, x: -0.75, y: 0.1, d: 4.2, roll: 1.15, radius: 0.34, length: 16 },
];

function flashAt(t: number, flashes: number[][]) {
  let v = 0;
  for (const [t0, decay, amp] of flashes) {
    const dt = t - t0;
    if (dt > 0) v += amp * Math.min(1, dt / 0.12) * Math.exp(-Math.max(0, dt - 0.12) / decay);
  }
  return v;
}

type Signal = {
  neuron: number;
  path: number;
  u0: number;
  speed: number;
  period: number;
  phase: number;
  duty: number;
  size: number;
  gain: number;
  cPeriod: number;
  cPhase: number;
};

export const neuralScene: SceneFactory<NeuralProps> = ({
  renderer,
  width,
  height,
  pixelWidth,
  pixelHeight,
  durationInFrames,
  fps,
  props,
}) => {
  const { palette } = props;
  const aspect = width / height;
  const track: Pose[] = buildCameraTrack(durationInFrames + 1, fps);
  const poseAt = (t: number) => track[Math.min(track.length - 1, Math.max(0, Math.round(t * fps)))];

  // ---------------------------------------------------------------- network
  const rng = makeRng(20240611);
  const centers: { c: THREE.Vector3; hero: number }[] = [];
  HEROES.forEach((h, i) => {
    const c = placeInView(poseAt(h.t), h.x, h.y, h.d, aspect);
    // A cell body must never brush the lens: keep its closest approach to the
    // camera path wide enough that it drifts in softly instead of snapping in.
    const MIN_PASS = 4.2;
    let best = Infinity;
    let nearest = track[0].pos;
    for (const pose of track) {
      const d2 = pose.pos.distanceToSquared(c);
      if (d2 < best) {
        best = d2;
        nearest = pose.pos;
      }
    }
    const pass = Math.sqrt(best);
    if (pass < MIN_PASS) {
      const out = c.clone().sub(nearest);
      out.z = 0;
      if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
      c.addScaledVector(out.normalize(), MIN_PASS - pass);
    }
    centers.push({ c, hero: i });
  });
  const zMin = -105;
  const zMax = track[track.length - 1].pos.z + 6;
  const pathDistance = (p: THREE.Vector3) => {
    let best = Infinity;
    for (let i = 0; i < track.length; i += 3) {
      best = Math.min(best, track[i].pos.distanceToSquared(p));
    }
    return Math.sqrt(best);
  };
  // Dendrites bend away from the lens so the camera never flies through one;
  // they still pass close enough to sweep by as large out-of-focus shapes.
  const KEEP_OUT = 3.4;
  const LEAD_IN = 14; // also keep the view in front of the first frame clear
  const lead = new THREE.Vector3();
  const away = new THREE.Vector3();
  const steer = (p: THREE.Vector3, dir: THREE.Vector3) => {
    if (p.z < -LEAD_IN || p.z > zMax + KEEP_OUT) return;
    let best = KEEP_OUT * KEEP_OUT;
    let hit = -1;
    if (p.z < track[0].pos.z) {
      lead.set(track[0].pos.x, track[0].pos.y, p.z);
      const d2 = lead.distanceToSquared(p);
      if (d2 < best) {
        best = d2;
        hit = 0;
      }
    }
    for (let i = 0; i < track.length; i += 2) {
      const dz = track[i].pos.z - p.z;
      if (dz < -KEEP_OUT) continue;
      if (dz > KEEP_OUT) break;
      const d2 = track[i].pos.distanceToSquared(p);
      if (d2 < best) {
        best = d2;
        hit = i;
      }
    }
    if (hit < 0) return;
    const d = Math.sqrt(best);
    away.subVectors(p, track[hit].pos);
    away.z = 0;
    if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
    away.normalize();
    dir.addScaledVector(away, (1 - d / KEEP_OUT) * 0.6 + 0.04).normalize();
  };
  const SPACING = 14;
  const target = Math.round(((zMax - zMin) * 96 * 60) / (SPACING * SPACING * SPACING * 1.25));
  let guard = 0;
  while (centers.length < target && guard++ < 60000) {
    const p = new THREE.Vector3(range(rng, -48, 48), range(rng, -30, 30), range(rng, zMin, zMax));
    if (pathDistance(p) < 6.5) continue;
    let ok = true;
    for (const o of centers) {
      if (o.c.distanceToSquared(p) < SPACING * SPACING) {
        ok = false;
        break;
      }
    }
    if (ok) centers.push({ c: p, hero: -1 });
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(...palette.fog);
  const tubeMat = makeTubeMaterial(palette);
  tubeMat.uniforms.uFogDensity.value = FOG_DENSITY;
  const somaMats = {
    back: makeSomaMaterial(palette, "back"),
    inner: makeSomaMaterial(palette, "inner"),
    front: makeSomaMaterial(palette, "front"),
  };
  Object.values(somaMats).forEach((m) => (m.uniforms.uFogDensity.value = FOG_DENSITY));

  const neurons: Neuron[] = [];
  const heroMats: { hero: number; mats: THREE.ShaderMaterial[] }[] = [];
  const disposables: { dispose: () => void }[] = [tubeMat, ...Object.values(somaMats)];
  centers.forEach(({ c, hero }, i) => {
    const lateral = pathDistance(c);
    const level = hero >= 0 || lateral < 13 ? 0 : lateral < 30 ? 1 : 2;
    const radius = hero >= 0 ? 1 : range(rng, 0.75, 1.1);
    const n = buildNeuron(1000 + i * 7919, c, radius, level, hero >= 0, steer);
    neurons.push(n);
    disposables.push(n.geometry, n.somaGeometry);
    const tubes = new THREE.Mesh(n.geometry, tubeMat);
    tubes.position.copy(c);
    scene.add(tubes);
    let mats = somaMats;
    if (hero >= 0) {
      mats = {
        back: makeSomaMaterial(palette, "back"),
        inner: makeSomaMaterial(palette, "inner"),
        front: makeSomaMaterial(palette, "front"),
      };
      Object.values(mats).forEach((m) => (m.uniforms.uFogDensity.value = FOG_DENSITY));
      heroMats.push({ hero, mats: Object.values(mats) });
      disposables.push(...Object.values(mats));
    }
    (["back", "inner", "front"] as const).forEach((layer, k) => {
      const m = new THREE.Mesh(n.somaGeometry, mats[layer]);
      m.position.copy(c);
      if (layer === "inner") m.scale.setScalar(0.56);
      m.renderOrder = 10 + k;
      scene.add(m);
    });
  });

  const rollQ = new THREE.Quaternion();
  // A sweep must slide in from the frame edge, never materialise in front of
  // the lens: while any part of it would first show up closer than ENTRY_MIN,
  // it is moved further off-axis / away.
  const ENTRY_MIN = 4.2;
  const thV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const probe = new THREE.Vector3();
  const invQ = new THREE.Quaternion();
  SWEEPERS.forEach((sw, i) => {
    const pose = poseAt(sw.t);
    const g = buildSweeper(9100 + i * 131, sw.length, sw.radius);
    disposables.push(g);
    const m = new THREE.Mesh(g, tubeMat);
    rollQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), sw.roll);
    m.quaternion.copy(pose.quat).multiply(rollQ);
    let k = 1;
    for (let tries = 0; tries < 24; tries++) {
      m.position.copy(placeInView(pose, sw.x * k, sw.y * k, sw.d * (1 + (k - 1) * 0.5), aspect));
      let closest = Infinity;
      for (const tp of track) {
        invQ.copy(tp.quat).invert();
        for (let j = 0; j <= 40; j++) {
          probe.set((j / 40 - 0.5) * sw.length, 0, 0).applyQuaternion(m.quaternion).add(m.position);
          probe.sub(tp.pos).applyQuaternion(invQ);
          const depth = -probe.z;
          if (depth < 0.05 || depth > closest) continue;
          const pad = (sw.radius * 1.6) / depth;
          if (
            Math.abs(probe.x) / (depth * thV * aspect) < 1 + pad &&
            Math.abs(probe.y) / (depth * thV) < 1 + pad
          ) {
            closest = depth;
          }
        }
      }
      if (closest >= ENTRY_MIN) break;
      k *= 1.1;
    }
    scene.add(m);
  });

  // ---------------------------------------------------------------- impulses
  const signals: Signal[] = [];
  const srng = makeRng(77123);
  // Impulses favour the thick dendrites close to the cell body, so they read
  // as clusters around each neuron rather than an even scatter.
  const pickPath = (n: Neuron) => {
    for (let tries = 0; tries < 6; tries++) {
      const i = Math.floor(srng() * n.paths.length);
      if (n.paths[i].depth <= 1 || srng() < 0.15) return i;
    }
    return 0;
  };
  // Impulses come in tight clusters sitting on a short stretch of dendrite,
  // each cluster pulsing on its own slow rhythm (as in the reference).
  neurons.forEach((n, ni) => {
    const lateral = pathDistance(n.center);
    if (lateral > 36) return;
    const clusters = n.hero ? 9 : lateral < 16 ? 6 : 3;
    for (let c = 0; c < clusters; c++) {
      const path = pickPath(n);
      const uc = range(srng, 0.06, 0.62);
      const cPeriod = range(srng, 2.6, 5.5);
      const cPhase = srng();
      const members = Math.round(range(srng, 6, 13));
      for (let k = 0; k < members; k++) {
        signals.push({
          neuron: ni,
          path,
          u0: Math.min(0.97, Math.max(0.02, uc + (srng() - 0.5) * 0.13)),
          speed: range(srng, 0.4, 1.3),
          period: range(srng, 1.2, 3),
          phase: srng(),
          duty: range(srng, 0.5, 0.9),
          size: range(srng, 0.05, 0.1),
          gain: range(srng, 2.2, 4.4),
          cPeriod,
          cPhase,
        });
      }
    }
  });
  // Sparks dancing on the membrane of a firing hero cell.
  const SPARKS = 90;
  const sparks: { hero: number; dir: THREE.Vector3; phase: number; rate: number; size: number }[] = [];
  HEROES.forEach((_, hi) => {
    for (let k = 0; k < SPARKS; k++) {
      sparks.push({
        hero: hi,
        dir: randomUnit(srng, new THREE.Vector3()) as THREE.Vector3,
        phase: srng() * 10,
        rate: range(srng, 5, 13),
        size: range(srng, 0.05, 0.1),
      });
    }
  });
  const total = signals.length + sparks.length;
  const iPos = new Float32Array(total * 3);
  const iData = new Float32Array(total * 2);
  const quad = new THREE.PlaneGeometry(1, 1);
  const sigGeo = new THREE.InstancedBufferGeometry();
  sigGeo.index = quad.index;
  sigGeo.setAttribute("position", quad.getAttribute("position"));
  const posAttr = new THREE.InstancedBufferAttribute(iPos, 3);
  const dataAttr = new THREE.InstancedBufferAttribute(iData, 2);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  dataAttr.setUsage(THREE.DynamicDrawUsage);
  sigGeo.setAttribute("iPos", posAttr);
  sigGeo.setAttribute("iData", dataAttr);
  sigGeo.instanceCount = total;

  const post = new PostFX(renderer, pixelWidth, pixelHeight, { dof: true, samples: 4 });
  const sigMat = makeSignalMaterial(palette, post.depthTexture);
  const sigMesh = new THREE.Mesh(sigGeo, sigMat);
  sigMesh.frustumCulled = false;
  const overlay = new THREE.Scene();
  overlay.add(sigMesh);
  disposables.push(quad, sigGeo, sigMat);

  const camera = new THREE.PerspectiveCamera(FOV, aspect, NEAR, FAR);
  const proj = 1 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const su = sigMat.uniforms;
  su.uNear.value = NEAR;
  su.uFar.value = FAR;
  su.uFocus.value = FOCUS;
  su.uAperture.value = APERTURE;
  su.uMaxCoc.value = MAX_COC;
  su.uProj.value = proj;
  su.uAspect.value = aspect;
  su.uFogDensity.value = FOG_DENSITY;

  const params: PostParams = {
    focus: FOCUS,
    aperture: APERTURE,
    maxCoc: MAX_COC,
    farScale: 0.85,
    bloomStrength: 1.2,
    bloomThreshold: 1.0,
    exposure: 2.2,
    tint: new THREE.Vector3(...palette.tint),
    lift: new THREE.Vector3(...palette.lift),
    vignette: 0.55,
    grain: 0.012,
    saturation: palette.saturation,
    contrast: 1.12,
    fade: 1,
    seed: 0,
  };

  const updateSignals = (t: number) => {
    let o = 0;
    for (const s of signals) {
      const n = neurons[s.neuron];
      const path = n.paths[s.path];
      // Each impulse creeps back and forth around its place in the cluster.
      const u = Math.min(0.985, Math.max(0.01, s.u0 + 0.035 * Math.sin(t * s.speed + s.phase * 6.28)));
      const f = u * (path.count - 1);
      const i0 = Math.min(path.count - 2, Math.floor(f));
      const k = f - i0;
      const a = i0 * 3;
      const x = n.center.x + path.pts[a] + (path.pts[a + 3] - path.pts[a]) * k;
      const y = n.center.y + path.pts[a + 1] + (path.pts[a + 4] - path.pts[a + 1]) * k;
      const z = n.center.z + path.pts[a + 2] + (path.pts[a + 5] - path.pts[a + 2]) * k;
      // Individual blink cycle...
      const cyc = (t / s.period + s.phase) % 1;
      let e = cyc < s.duty ? Math.sin((Math.PI * cyc) / s.duty) : 0;
      e = 0.25 + 0.75 * e * e;
      // Cluster pulse: slow rise and fall shared by the whole cluster.
      const cc = (t / s.cPeriod + s.cPhase) % 1;
      const pulse = cc < 0.7 ? Math.sin((Math.PI * cc) / 0.7) : 0;
      e *= pulse * pulse;
      // ...gated by slow waves of activity sweeping through the tissue, and
      // faded at both ends of the branch so impulses never pop.
      const w1 = Math.sin(x * 0.13 + y * 0.09 - z * 0.05 - t * 1.25 + 2.5 * Math.sin(z * 0.07 + t * 0.4));
      const w2 = Math.sin(y * 0.17 - x * 0.06 + z * 0.11 + t * 0.8);
      let wave = (w1 * 0.65 + w2 * 0.35) * 0.5 + 0.5;
      wave = Math.min(1, Math.max(0, (wave - 0.3) / 0.3));
      wave = wave * wave * (3 - 2 * wave);
      const ends = 1;
      iPos[o * 3] = x;
      iPos[o * 3 + 1] = y;
      iPos[o * 3 + 2] = z;
      iData[o * 2] = e * wave * ends * s.gain;
      iData[o * 2 + 1] = s.size;
      o++;
    }
    for (const sp of sparks) {
      const h = HEROES[sp.hero];
      const n = neurons[sp.hero];
      const fl = flashAt(t, h.flashes);
      const tw = Math.max(0, Math.sin(t * sp.rate + sp.phase));
      iPos[o * 3] = n.center.x + sp.dir.x * 1.04;
      iPos[o * 3 + 1] = n.center.y + sp.dir.y * 1.04;
      iPos[o * 3 + 2] = n.center.z + sp.dir.z * 1.04;
      iData[o * 2] = fl * tw * tw * 2.2;
      iData[o * 2 + 1] = sp.size;
      o++;
    }
    posAttr.needsUpdate = true;
    dataAttr.needsUpdate = true;
  };

  return {
    render: (frame) => {
      const t = frame / fps;
      const pose = track[Math.min(track.length - 1, Math.max(0, frame))];
      camera.position.copy(pose.pos);
      camera.quaternion.copy(pose.quat);
      camera.updateMatrixWorld();
      for (const h of heroMats) {
        const fl = flashAt(t, HEROES[h.hero].flashes);
        h.mats.forEach((m) => (m.uniforms.uFlash.value = fl));
      }
      updateSignals(t);
      params.seed = frame;
      post.render(scene, camera, params, overlay);
    },
    dispose: () => {
      post.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
};
