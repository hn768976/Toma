import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
// staying aimed at the hero cell - near cells slide up/right in parallax.
const CAM_START = new THREE.Vector3(0.0, 0.05, 7.9);
const CAM_END = new THREE.Vector3(-4.3, -2.9, 12.0);
const AIM_START = new THREE.Vector3(0.0, 0.0, 0);
const AIM_END = new THREE.Vector3(-0.9, 1.1, 0);

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
  [-1.95, 1.5, -1.3, 0.98],
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
    const m = r * (1.62 + rnd() * 0.22);
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
  while (cells.length < 84 && tries++ < 40000) {
    const p = new THREE.Vector3(
      -30 + rnd() * 52,
      -20 + rnd() * 36,
      -27 + rnd() * 31,
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
    if (closest.distanceTo(p) < 4.6) continue;
    const mr = r * 1.75;
    if (cells.some((c) => c.pos.distanceTo(p) < (c.m + mr) * 0.8)) continue;
    cells.push(mk(p.x, p.y, p.z, r));
  }
  return cells;
};

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
  const geoHi = mergeVertices(new THREE.IcosahedronGeometry(1, 34));
  const geoLo = mergeVertices(new THREE.IcosahedronGeometry(1, 14));
  const memHi = mergeVertices(new THREE.IcosahedronGeometry(1, 26));
  const memLo = mergeVertices(new THREE.IcosahedronGeometry(1, 12));
  disposables.push(geoHi, geoLo, memHi, memLo);

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
    uFogNear: { value: 9 },
    uFogFar: { value: 34 },
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
    const nucleus = new THREE.Mesh(far ? geoLo : geoHi, nMat);
    nucleus.scale.setScalar(c.r);
    nucleus.position.copy(c.off);
    const mU = () => ({
      ...fog,
      uSeed: { value: c.seed * 1.31 },
      uTime: { value: 0 },
      uScale: { value: c.m },
      uDepthOnly: { value: 0 },
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
    const mem = new THREE.Mesh(far ? memLo : memHi, mMat);
    const memD = new THREE.Mesh(far ? memLo : memHi, dMat);
    mem.scale.setScalar(c.m);
    memD.scale.setScalar(c.m);
    mem.renderOrder = 1;
    memD.renderOrder = 2;
    group.add(nucleus, mem, memD);
    scene.add(group);
    disposables.push(nMat, mMat, dMat);
    return { c, group, nucleus, mMat, dMat };
  });

  const q = new THREE.Quaternion();
  const aim = new THREE.Vector3();
  const total = Math.max(1, durationInFrames - 1);

  return {
    render: (frame) => {
      const t = frame / fps;
      const u = frame / total;
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
      }
      bgMat.uniforms.uTime.value = t;
      (bgMat.uniforms.uShift.value as THREE.Vector2).set(u * 0.1, u * 0.06);

      const focus =
        camera.position.distanceTo(nodes[0].group.position) * (1 - 0.08 * u);
      post.render(scene, camera, {
        focus,
        aperture: 0.27,
        maxCoc: 0.028,
        vignette: 0.26,
        grain: 0.012,
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
