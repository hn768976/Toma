import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bakeSphere, vnoise, worley } from "../engine/bake";
import { Post } from "../engine/post";
import type { SceneFactory } from "../engine/ThreeStage";
import type { Palette } from "./palettes";
import { makeRng } from "./rng";
import {
  BG_FRAG,
  BG_VERT,
  MEMBRANE_FRAG,
  MEMBRANE_VERT,
  NUCLEUS_FRAG,
  NUCLEUS_VERT,
} from "./shaders";

export type StemParams = { palette: Palette };

const FOV = 35;
const TAN = Math.tan((FOV * Math.PI) / 360);
const ASPECT = 16 / 9;

// Camera move: slow, constant-speed pull-back that drifts down-left while
// panning with it - the cells slide up and to the right through the frame.
const CAM_START = new THREE.Vector3(0.0, 0.05, 7.9);
const CAM_END = new THREE.Vector3(-8.2, -4.2, 18.4);
const PULL = 2.3; // end distance / start distance
const AIM_START = new THREE.Vector3(0.0, 0.0, 0);
const AIM_END = new THREE.Vector3(-2.7, -1.7, 0);

type Cell = {
  pos: THREE.Vector3;
  r: number; // nucleus radius
  m: number; // membrane radius
  off: THREE.Vector3; // nucleus offset inside the membrane
  seed: number;
  axis: THREE.Vector3;
  spin: number;
  bob: THREE.Vector3;
  phase: number;
};

// Hand-placed cells reproduce the opening layout of the reference.
const HERO: [number, number, number, number][] = [
  [0, 0, 0, 1.0],
  [-2.6, 2.0, -2.6, 0.98],
  [-3.7, 1.75, 1.0, 1.02],
  [3.65, -0.85, 0.7, 1.05],
  [-3.4, -2.35, 1.3, 1.0],
  [3.3, -0.2, -4.6, 0.95],
  [-0.2, 5.6, -13, 1.0],
  [1.6, -3.6, -3.2, 0.97],
  [-5.6, -4.6, -2.4, 1.02],
  [-1.6, -5.4, 0.6, 1.0],
];

const buildCells = (): Cell[] => {
  const rnd = makeRng(20240611);
  const cells: Cell[] = [];
  const mk = (x: number, y: number, z: number, r: number): Cell => {
    const m = r * (1.58 + rnd() * 0.24);
    const o = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5)
      .normalize()
      .multiplyScalar(rnd() * 0.22 * m);
    return {
      pos: new THREE.Vector3(x, y, z),
      r,
      m,
      off: o,
      seed: rnd() * 90 + 3,
      axis: new THREE.Vector3(
        rnd() - 0.5,
        rnd() - 0.5,
        rnd() - 0.5,
      ).normalize(),
      spin: (rnd() - 0.5) * 0.09,
      bob: new THREE.Vector3(
        rnd() - 0.5,
        rnd() - 0.5,
        rnd() - 0.5,
      ).multiplyScalar(0.22),
      phase: rnd() * 6.28,
    };
  };
  HERO.forEach((h, i) => {
    const c = mk(...h);
    if (i === 0) c.off.set(0.12, -0.05, 0.1);
    cells.push(c);
  });

  // camera frames used to keep random cells inside what is ever visible
  const views = [0, 0.5, 1].map((t) => {
    const cam = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 200);
    cam.position.lerpVectors(CAM_START, CAM_END, t);
    cam.lookAt(new THREE.Vector3().lerpVectors(AIM_START, AIM_END, t));
    cam.updateMatrixWorld();
    return cam.matrixWorldInverse.clone();
  });
  const seg = new THREE.Line3(CAM_START, CAM_END);
  const tmp = new THREE.Vector3();
  const closest = new THREE.Vector3();
  let tries = 0;
  while (cells.length < 96 && tries++ < 40000) {
    const p = new THREE.Vector3(
      -36 + rnd() * 56,
      -24 + rnd() * 38,
      -24 + rnd() * 28,
    );
    const r = 0.86 + rnd() * 0.3;
    const visible = views.some((mi) => {
      tmp.copy(p).applyMatrix4(mi);
      const d = -tmp.z;
      return (
        d > 4.5 &&
        Math.abs(tmp.x) < d * TAN * ASPECT + 2.6 &&
        Math.abs(tmp.y) < d * TAN + 2.6
      );
    });
    if (!visible) continue;
    seg.closestPointToPoint(p, true, closest);
    if (closest.distanceTo(p) < 4.0) continue;
    const mr = r * 1.75;
    if (cells.some((c) => c.pos.distanceTo(p) < (c.m + mr) * 0.98)) continue;
    cells.push(mk(p.x, p.y, p.z, r));
  }
  return cells;
};

// Near-round nucleus with shallow cellular lumps and creases between them.
const bakeNucleus = (base: THREE.BufferGeometry, seed: number) =>
  bakeSphere(
    base,
    (x, y, z, o) => {
      const [f1, f2] = worley(x * 3.2 + seed, y * 3.2 + seed, z * 3.2 + seed);
      const big = vnoise(
        x * 1.3 + seed * 1.7,
        y * 1.3 + seed * 1.7,
        z * 1.3 + seed * 1.7,
      );
      const lump = (1 - f1 * f1 * 1.35) * 0.095 + big * 0.07;
      const r = 0.83 + lump;
      o[0] = x * r;
      o[1] = y * r;
      o[2] = z * r;
      o[3] = lump;
      o[4] = f2 - f1;
    },
    0.035,
  );

// Glassy membrane shell: a gently irregular, wavy sphere.
const bakeMembrane = (base: THREE.BufferGeometry, seed: number) =>
  bakeSphere(
    base,
    (x, y, z, o) => {
      const n = (f: number, k: number) =>
        vnoise(x * f + seed * k, y * f + seed * k, z * f + seed * k);
      const r = 0.92 + n(1.9, 1) * 0.085 + n(5.5, 3) * 0.036 + n(12, 5) * 0.015;
      o[0] = x * r;
      o[1] = y * r;
      o[2] = z * r;
      o[3] = 0;
      o[4] = 0;
    },
    0.05,
  );

export const stemCellsFactory: SceneFactory<StemParams> = ({
  renderer,
  width,
  height,
  fps,
  durationInFrames,
  params,
}) => {
  const pal = params.palette;
  const col = (h: string) => new THREE.Color(h).convertLinearToSRGB(); // keep hex values as display values
  const v3 = (h: string) => {
    const c = col(h);
    return new THREE.Vector3(c.r, c.g, c.b);
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.5, 90);
  const post = new Post(renderer, width, height);

  const disposables: { dispose: () => void }[] = [];
  const baseHi = mergeVertices(new THREE.IcosahedronGeometry(1, 34));
  const baseLo = mergeVertices(new THREE.IcosahedronGeometry(1, 14));
  // a handful of baked nucleus variants, shared between cells
  const geoHi = [11.3, 27.9, 43.1, 58.7, 71.4, 86.2].map((s) =>
    bakeNucleus(baseHi, s),
  );
  const geoLo = [15.5, 33.3, 64.9].map((s) => bakeNucleus(baseLo, s));
  const memBaseHi = mergeVertices(new THREE.IcosahedronGeometry(1, 26));
  const memBaseLo = mergeVertices(new THREE.IcosahedronGeometry(1, 11));
  const memHi = [4.2, 19.6, 37.3, 52.8, 77.7].map((s) =>
    bakeMembrane(memBaseHi, s),
  );
  const memLo = [8.8, 46.1, 69.4].map((s) => bakeMembrane(memBaseLo, s));
  disposables.push(
    baseHi,
    baseLo,
    memBaseHi,
    memBaseLo,
    ...geoHi,
    ...geoLo,
    ...memHi,
    ...memLo,
  );

  // backdrop
  const bgMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: BG_VERT,
    fragmentShader: BG_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uBgA: { value: v3(pal.bgA) },
      uBgB: { value: v3(pal.bgB) },
      uBgC: { value: v3(pal.bgC) },
      uTime: { value: 0 },
      uAspect: { value: width / height },
      uShift: { value: new THREE.Vector2() },
    },
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);
  disposables.push(bg.geometry, bgMat);

  const fog = {
    uFogNear: { value: 14 },
    uFogFar: { value: 52 },
    uFog: { value: v3(pal.fog) },
  };
  const cells = buildCells();
  const nodes = cells.map((c, i) => {
    const far = i >= HERO.length && c.pos.z < -9;
    const group = new THREE.Group();
    const nMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: NUCLEUS_VERT,
      fragmentShader: NUCLEUS_FRAG,
      uniforms: {
        ...fog,
        uSeed: { value: c.seed },
        uScale: { value: c.r },
        uDeep: { value: v3(pal.deep) },
        uMid: { value: v3(pal.mid) },
        uRim: { value: v3(pal.rim) },
      },
    });
    const nucleus = new THREE.Mesh(
      far ? geoLo[i % geoLo.length] : geoHi[i % geoHi.length],
      nMat,
    );
    nucleus.scale.setScalar(c.r);
    nucleus.position.copy(c.off);
    const mU = () => ({
      ...fog,
      uSeed: { value: c.seed * 1.31 },
      uTime: { value: 0 },
      uScale: { value: c.m },
      uDepthOnly: { value: 0 },
      uBack: { value: 0 },
      uTint: { value: v3(pal.tint) },
      uRim: { value: v3(pal.memRim) },
    });
    const mMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: MEMBRANE_VERT,
      fragmentShader: MEMBRANE_FRAG,
      uniforms: mU(),
      transparent: true,
      depthWrite: false,
    });
    // depth-only pass so the crisp membrane rim takes part in depth of field
    const dMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: MEMBRANE_VERT,
      fragmentShader: MEMBRANE_FRAG,
      uniforms: mU(),
      transparent: true,
      colorWrite: false,
      depthWrite: true,
    });
    dMat.uniforms.uDepthOnly.value = 1;
    // inner (far) wall of the shell, drawn before the front wall
    const bMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: MEMBRANE_VERT,
      fragmentShader: MEMBRANE_FRAG,
      uniforms: mU(),
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
    });
    bMat.uniforms.uBack.value = 1;
    const mGeo = far ? memLo[i % memLo.length] : memHi[i % memHi.length];
    const memB = new THREE.Mesh(mGeo, bMat);
    const mem = new THREE.Mesh(mGeo, mMat);
    const memD = new THREE.Mesh(mGeo, dMat);
    const shell = new THREE.Group();
    shell.scale.setScalar(c.m);
    shell.add(memB, mem, memD);
    memB.renderOrder = 1;
    mem.renderOrder = 1;
    memD.renderOrder = 2;
    group.add(nucleus, shell);
    scene.add(group);
    disposables.push(nMat, mMat, dMat, bMat);
    return { c, group, nucleus, shell, mMat, dMat, bMat };
  });

  const q = new THREE.Quaternion();
  const aim = new THREE.Vector3();
  const total = Math.max(1, durationInFrames - 1);

  return {
    render: (frame) => {
      const t = frame / fps;
      // geometric pull-back: the picture shrinks at a constant rate, so the
      // move never appears to ease out
      const lin = frame / total;
      const u = (Math.pow(PULL, lin) - 1) / (PULL - 1);
      camera.position.lerpVectors(CAM_START, CAM_END, u);
      aim.lerpVectors(AIM_START, AIM_END, u);
      camera.up.set(Math.sin(-0.05 + u * 0.11), Math.cos(-0.05 + u * 0.11), 0);
      camera.lookAt(aim);
      camera.updateMatrixWorld();

      for (const n of nodes) {
        const c = n.c;
        n.group.position.set(
          c.pos.x + Math.sin(t * 0.21 + c.phase) * c.bob.x,
          c.pos.y + Math.sin(t * 0.17 + c.phase * 1.7) * c.bob.y,
          c.pos.z + Math.sin(t * 0.19 + c.phase * 2.3) * c.bob.z,
        );
        q.setFromAxisAngle(c.axis, c.phase + t * c.spin);
        n.nucleus.quaternion.copy(q);
        n.mMat.uniforms.uTime.value = t;
        n.dMat.uniforms.uTime.value = t;
        n.bMat.uniforms.uTime.value = t;
        q.setFromAxisAngle(c.axis, c.phase * 0.7 - t * c.spin * 0.6);
        n.shell.quaternion.copy(q);
      }
      bgMat.uniforms.uTime.value = t;
      (bgMat.uniforms.uShift.value as THREE.Vector2).set(u * 0.1, u * 0.06);

      const focus =
        camera.position.distanceTo(nodes[0].group.position) * (1 - 0.08 * u);
      post.render(scene, camera, {
        focus,
        aperture: 0.1,
        maxCoc: 0.02,
        vignette: 0.16,
        grain: 0.014,
        contrast: 1.04,
        saturation: pal.saturation,
        lift: pal.lift,
        frame,
      });
    },
    dispose: () => {
      post.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
};
