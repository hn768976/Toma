import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { rand } from "../lib/random";
import { makeRig, PATH_V1, PATH_V2 } from "./cameraPaths";
import { makeHudTexture } from "./hudTexture";
import { PostChain } from "./post";

export type Variant = "reference" | "orbit";

// --- DNA geometry constants (world units) ---------------------------------
const DNA_X0 = -20;
const DNA_X1 = 2;
const RUNG_SPACING = 0.26;
const RUNGS_PER_TURN = 31;
const HELIX_RADIUS = 0.7;
const BEAD_RADIUS = 0.123;
const SPIN_SPEED = 0.33; // rad / s around the helix axis

export type Engine = {
  render: (timeSec: number) => void;
  dispose: () => void;
};

const depthOnly = (opts: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide, ...opts });

export const createEngine = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  pixelRatio: number,
  variant: Variant,
): Engine => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;
  const W = Math.round(width * pixelRatio);
  const H = Math.round(height * pixelRatio);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.05);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 300);
  const disposables: { dispose: () => void }[] = [envTex, pmrem];
  const depthMats = new Map<THREE.Object3D, THREE.Material>();

  // --- DNA -----------------------------------------------------------------
  const dna = new THREE.Group();
  scene.add(dna);
  // Translucent, holographic material: the HUD layers show through the
  // helix and both strands are visible through each other.
  const dnaMat = new THREE.MeshStandardMaterial({
    color: 0xe6e4dc,
    metalness: 0.3,
    roughness: 0.45,
    emissive: 0x2a2c2a,
    envMapIntensity: 0.75,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const stickMat = new THREE.MeshStandardMaterial({
    color: 0xdedcd4,
    metalness: 0.3,
    roughness: 0.5,
    emissive: 0x222422,
    envMapIntensity: 0.7,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const rungCount = Math.floor((DNA_X1 - DNA_X0) / RUNG_SPACING) + 1;
  const beadGeo = new THREE.SphereGeometry(BEAD_RADIUS, 28, 18);
  const stickGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 10, 1);
  const beads = new THREE.InstancedMesh(beadGeo, dnaMat, rungCount * 2);
  const sticks = new THREE.InstancedMesh(stickGeo, stickMat, rungCount);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < rungCount; i++) {
    const x = DNA_X0 + i * RUNG_SPACING;
    const a = (i / RUNGS_PER_TURN) * Math.PI * 2;
    const p1 = new THREE.Vector3(x, Math.cos(a) * HELIX_RADIUS, Math.sin(a) * HELIX_RADIUS);
    const p2 = new THREE.Vector3(x, -p1.y, -p1.z);
    // tiny size jitter so the strands feel organic
    const s1 = 1 + (rand(i, 1) - 0.5) * 0.12;
    const s2 = 1 + (rand(i, 2) - 0.5) * 0.12;
    beads.setMatrixAt(i * 2, m4.compose(p1, q.identity(), new THREE.Vector3(s1, s1, s1)));
    beads.setMatrixAt(i * 2 + 1, m4.compose(p2, q.identity(), new THREE.Vector3(s2, s2, s2)));
    // one continuous base-pair rung between the two beads
    const dir = p2.clone().sub(p1).normalize();
    const len = p1.distanceTo(p2) - BEAD_RADIUS * 1.6;
    q.setFromUnitVectors(up, dir);
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    sticks.setMatrixAt(i, m4.compose(mid, q, new THREE.Vector3(1, len, 1)));
  }
  dna.add(beads, sticks);
  const dnaDepth = depthOnly({ side: THREE.FrontSide });
  depthMats.set(beads, dnaDepth);
  depthMats.set(sticks, dnaDepth);
  disposables.push(beadGeo, stickGeo, dnaMat, stickMat, dnaDepth);

  const key = new THREE.DirectionalLight(0xfff1e0, 1.8);
  key.position.set(3, 7, 6);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 1.6);
  rim.position.set(-5, 2, -7);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(0, -4, 5);
  scene.add(key, rim, fill, new THREE.AmbientLight(0xffffff, 0.12));

  // --- HUD layers ----------------------------------------------------------
  type Layer = {
    seed: number;
    size: [number, number];
    pos: [number, number, number];
    rot: [number, number, number];
    repeat: [number, number];
    intensity: number;
    bigLabels?: number;
    density?: number;
  };
  const H90 = -Math.PI / 2;
  const layers: Layer[] = [
    { seed: 11, size: [46, 28], pos: [-6, -1.9, 1], rot: [H90, 0, 0], repeat: [2.3, 1.4], intensity: 0.3, bigLabels: 0.4, density: 0.65 },
    { seed: 23, size: [64, 40], pos: [-4, -2.75, -2], rot: [H90, 0, 0.02], repeat: [2.6, 1.6], intensity: 0.24, bigLabels: 0.4 },
    { seed: 37, size: [90, 60], pos: [-2, -4.1, -6], rot: [H90, 0, -0.03], repeat: [3.0, 2.0], intensity: 0.15, density: 1.2, bigLabels: 0.3 },
    { seed: 41, size: [80, 26], pos: [-6, 3.0, -8], rot: [0, 0, 0], repeat: [2.6, 0.85], intensity: 0.17, density: 1.3, bigLabels: 0.15 },
    { seed: 53, size: [50, 30], pos: [-4, 4.2, -1], rot: [Math.PI / 2, 0, 0], repeat: [2, 1.2], intensity: 0.07, bigLabels: 0.2 },
    // near wall behind the helix: fills the upper frame with blurred data
    { seed: 61, size: [72, 14], pos: [-6, 2.2, -4.5], rot: [0, 0, 0], repeat: [3.2, 0.62], intensity: 0.11, density: 1.3, bigLabels: 0.15 },
    // faint layer in FRONT of the helix (mostly out of focus) so data passes over it
    { seed: 67, size: [56, 6.5], pos: [-6, 1.1, 2.4], rot: [0, 0, 0], repeat: [2.6, 0.3], intensity: 0.045, density: 0.8, bigLabels: 0 },
  ];
  // small tilted floating panels along the opening flight path
  for (let i = 0; i < 9; i++) {
    layers.push({
      seed: 100 + i,
      size: [3 + rand(i, 3) * 3, 1.6 + rand(i, 4) * 1.4],
      pos: [19 - i * 2.2 + rand(i, 5) * 1.5, -1.7 + rand(i, 6) * 0.45, -0.5 + rand(i, 7) * 4.5],
      rot: [H90 + 0.25 + rand(i, 8) * 0.5, (rand(i, 9) - 0.5) * 0.6, (rand(i, 10) - 0.5) * 0.4],
      repeat: [0.35, 0.25],
      intensity: 0.22,
      bigLabels: 0.6,
    });
  }
  layers.forEach((L) => {
    const tex = makeHudTexture({ seed: L.seed, bigLabels: L.bigLabels, density: L.density }, renderer);
    tex.repeat.set(L.repeat[0], L.repeat[1]);
    // Tessellate large planes: software rasterisers (SwiftShader) can mis-
    // interpolate UVs when clipping huge two-triangle quads at grazing angles.
    const geo = new THREE.PlaneGeometry(L.size[0], L.size[1], Math.ceil(L.size[0] / 2), Math.ceil(L.size[1] / 2));
    const m = new THREE.MeshBasicMaterial({
      map: tex,
      color: new THREE.Color(1, 1, 1).multiplyScalar(L.intensity * 1.25),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(...L.pos);
    mesh.rotation.set(...L.rot);
    mesh.renderOrder = 1;
    scene.add(mesh);
    const dm = depthOnly({ map: tex, alphaTest: 0.18 });
    depthMats.set(mesh, dm);
    disposables.push(tex, geo, m, dm);
  });

  // --- light streaks and travelling pulses on the floor -------------------
  const streakGeo = new THREE.PlaneGeometry(1, 1, 48, 1); // tessellated (see HUD layers)
  const streakMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.75, 0.76, 0.8),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const pulseMat = streakMat.clone();
  pulseMat.color = new THREE.Color(3.2, 3.1, 3.0);
  const streakDepth = depthOnly();
  disposables.push(streakGeo, streakMat, pulseMat, streakDepth);
  type Pulse = { mesh: THREE.Mesh; axis: "x" | "z"; from: number; to: number; speed: number; phase: number };
  const pulses: Pulse[] = [];
  for (let i = 0; i < 16; i++) {
    const alongX = rand(i, 200) < 0.7;
    const y = (rand(i, 201) < 0.6 ? -1.88 : -2.73) + 0.01;
    const len = 10 + rand(i, 202) * 26;
    const w = 0.012 + rand(i, 203) * 0.02;
    const c = alongX ? -6 + (rand(i, 204) - 0.5) * 30 : -6 + (rand(i, 204) - 0.5) * 34;
    const off = (rand(i, 205) - 0.5) * (alongX ? 14 : 30);
    const line = new THREE.Mesh(streakGeo, streakMat);
    line.rotation.x = H90;
    if (alongX) {
      line.scale.set(len, w, 1);
      line.position.set(c, y, off);
    } else {
      line.rotation.z = Math.PI / 2;
      line.scale.set(len, w, 1);
      line.position.set(off, y, c * 0.3);
    }
    scene.add(line);
    depthMats.set(line, streakDepth);
    if (rand(i, 206) < 0.6) {
      const pulse = new THREE.Mesh(streakGeo, pulseMat);
      pulse.rotation.copy(line.rotation);
      pulse.scale.set(0.9 + rand(i, 207) * 1.6, w * 2.2, 1);
      pulse.position.copy(line.position);
      pulse.position.y += 0.005;
      scene.add(pulse);
      depthMats.set(pulse, streakDepth);
      const center = alongX ? line.position.x : line.position.z;
      pulses.push({
        mesh: pulse,
        axis: alongX ? "x" : "z",
        from: center - len / 2,
        to: center + len / 2,
        speed: (2 + rand(i, 208) * 5) * (rand(i, 209) < 0.5 ? 1 : -1),
        phase: rand(i, 210),
      });
    }
  }

  // --- warm bokeh particles + cool sparkles --------------------------------
  const dotGeo = new THREE.SphereGeometry(1, 10, 8);
  const orange = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 1.45, 0.3), toneMapped: false });
  const white = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 3.1, 3.3), toneMapped: false });
  const dotDepth = depthOnly({ side: THREE.FrontSide });
  disposables.push(dotGeo, orange, white, dotDepth);
  const makeDots = (count: number, material: THREE.Material, seed: number, minR: number, maxR: number) => {
    const inst = new THREE.InstancedMesh(dotGeo, material, count);
    for (let i = 0; i < count; i++) {
      const r = minR + rand(seed, i, 1) * (maxR - minR);
      const p = new THREE.Vector3(
        -24 + rand(seed, i, 2) * 44,
        -2.7 + rand(seed, i, 3) * (rand(seed, i, 6) < 0.75 ? 1.3 : 5.5),
        -8 + rand(seed, i, 4) * 15,
      );
      inst.setMatrixAt(i, m4.compose(p, q.identity(), new THREE.Vector3(r, r, r)));
    }
    scene.add(inst);
    depthMats.set(inst, dotDepth);
    return inst;
  };
  makeDots(45, orange, 300, 0.014, 0.034);
  makeDots(70, white, 400, 0.01, 0.03);

  // --- post ----------------------------------------------------------------
  const post = new PostChain(renderer, W, H);
  const rig = makeRig(variant === "orbit" ? PATH_V2 : PATH_V1);
  // cool blue-teal grade with lifted blacks, like the reference
  const shadowTint = new THREE.Color(0.8, 0.97, 1.12);
  const highlightTint = new THREE.Color(0.98, 1.0, 1.0);
  const lift = new THREE.Color(0.0, 0.009, 0.022);
  const tmpTarget = new THREE.Vector3();
  const closest = new THREE.Vector3();

  const renderDepth = (target: THREE.WebGLRenderTarget) => {
    const saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    depthMats.forEach((dm, obj) => {
      const mesh = obj as THREE.Mesh;
      saved.set(mesh, mesh.material);
      mesh.material = dm;
    });
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    saved.forEach((m, mesh) => {
      mesh.material = m;
    });
  };

  const render = (t: number) => {
    // helix spin
    dna.rotation.x = -t * SPIN_SPEED;
    // pulses travel along their streaks
    pulses.forEach((p) => {
      const span = p.to - p.from;
      const u = (((p.phase * span + t * p.speed) % span) + span) % span;
      if (p.axis === "x") p.mesh.position.x = p.from + u;
      else p.mesh.position.z = p.from + u;
    });

    const cam = rig.sample(t);
    camera.position.copy(cam.pos);
    camera.up.set(Math.sin(cam.roll), Math.cos(cam.roll), 0);
    camera.lookAt(tmpTarget.copy(cam.target));
    camera.updateMatrixWorld();

    // auto-focus on the closest point of the helix axis to the look-at ray,
    // blended with an explicit focus distance for the opening.
    const ray = new THREE.Ray(cam.pos, cam.target.clone().sub(cam.pos).normalize());
    const axisX = THREE.MathUtils.clamp(cam.target.x, DNA_X0, DNA_X1);
    ray.closestPointToPoint(new THREE.Vector3(axisX, 0, 0), closest);
    const targetDist = cam.pos.distanceTo(cam.target);
    const focus =
      cam.focus !== null ? THREE.MathUtils.lerp(targetDist, cam.focus, cam.focusBlend) : targetDist;

    post.render(scene, camera, renderDepth, {
      focus,
      aperture: cam.aperture,
      bloom: 0.3,
      exposure: cam.exposure,
      time: t,
      fade: 1,
      lift,
      gain: 0.8,
      shadowTint,
      highlightTint,
    });
  };

  return {
    render,
    dispose: () => {
      post.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
};
