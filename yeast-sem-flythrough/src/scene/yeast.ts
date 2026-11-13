import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bakeSphere, vnoise } from "../engine/bake";
import { Post } from "../engine/post";
import type { SceneFactory } from "../engine/ThreeStage";
import { makeRng } from "./rng";
import { BG_FRAG, BG_VERT, CELL_FRAG, CELL_VERT } from "./shaders";

export type CameraMode = "flythrough" | "orbit-pullback";
export type YeastParams = { camera: CameraMode };

const FOV = 35;
const HERO_C = new THREE.Vector3(0, 0, 0);
// Axis the fly-through camera travels along (towards the hero cluster)
const AXIS = new THREE.Vector3(0.2, 0.3, 1).normalize();
const FINAL_DIST = 8.7;
const HI_DETAIL_RADIUS = 7.5;
const TRAVEL = 46;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

type Rig = {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  roll: number;
  focus: number;
  aperture: number;
};

const SIDE = new THREE.Vector3()
  .crossVectors(AXIS, new THREE.Vector3(0, 1, 0))
  .normalize();
const UP = new THREE.Vector3().crossVectors(SIDE, AXIS).normalize();

/** Version 1: fast, curving push-in through the colony that decelerates and
 *  settles on the hero trio (as in the reference). */
const flythrough = (t: number, dur: number): Rig => {
  const x = clamp01(t / 6.6);
  const ease = 1 - Math.pow(1 - x, 1.5);
  const s = (TRAVEL - 0.7) * (1 - ease) + 0.7 * (1 - t / dur);
  const k = 1 - ease;
  const lat = Math.pow(k, 1.35);
  const pos = HERO_C.clone()
    .addScaledVector(AXIS, FINAL_DIST + s)
    .addScaledVector(SIDE, -7.5 * lat + Math.sin(t * 0.9) * 0.35 * k)
    .addScaledVector(UP, 4.2 * lat + Math.cos(t * 0.7) * 0.3 * k);
  const target = HERO_C.clone().add(new THREE.Vector3(0.05, -0.05, 0));
  const dHero = pos.distanceTo(HERO_C) - 0.9;
  const focus = THREE.MathUtils.lerp(
    Math.min(17, dHero),
    dHero,
    smooth(3.2, 6.0, t),
  );
  const aperture = THREE.MathUtils.lerp(0.6, 0.26, smooth(4.5, 6.8, t));
  return { pos, target, roll: -0.3 * k + 0.03 * (t / dur), focus, aperture };
};

/** Version 2: starts as a macro shot of the hero trio, then orbits and pulls
 *  back to reveal the surrounding colony (rack-focus stays on the trio). */
const orbitPullback = (t: number, dur: number): Rig => {
  const u = t / dur;
  const e = u * u * (3 - 2 * u);
  const yaw = THREE.MathUtils.degToRad(-26 + 46 * e);
  const pitch = THREE.MathUtils.degToRad(9 - 15 * e);
  const dist = 7.4 + 11 * Math.pow(e, 1.25);
  const dir = AXIS.clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    .applyAxisAngle(new THREE.Vector3(1, 0, 0), -pitch);
  const pos = HERO_C.clone().addScaledVector(dir, dist);
  const target = HERO_C.clone().add(new THREE.Vector3(0.2 - 0.2 * e, 0.1, 0));
  return {
    pos,
    target,
    roll: 0.1 - 0.16 * e,
    focus: dist - 1.0,
    aperture: THREE.MathUtils.lerp(0.26, 0.42, e),
  };
};

export const rigAt = (mode: CameraMode, t: number, dur: number) =>
  mode === "flythrough" ? flythrough(t, dur) : orbitPullback(t, dur);

// Baked body variants: [noise seed, elongation]. Slightly egg-shaped, lumpy.
const VARIANTS: [number, number][] = [
  [3.1, 1.04],
  [9.7, 1.2],
  [15.3, 1.12],
  [22.9, 1.06],
  [31.4, 1.26],
  [40.2, 1.16],
  [47.8, 1.02],
  [55.5, 1.22],
  [63.1, 1.1],
  [72.6, 1.3],
];
const bakeBody = (base: THREE.BufferGeometry, seed: number, elong: number) =>
  bakeSphere(
    base,
    (x, y, z, o) => {
      const r =
        0.88 +
        vnoise(x * 1.5 + seed, y * 1.5 + seed, z * 1.5 + seed) * 0.17 +
        vnoise(
          x * 3.3 + seed * 2.1,
          y * 3.3 + seed * 2.1,
          z * 3.3 + seed * 2.1,
        ) *
          0.05;
      const egg = 1 + 0.13 * y;
      o[0] = x * r * egg;
      o[1] = y * r * elong;
      o[2] = z * r * egg;
      o[3] = 0;
      o[4] = 0;
    },
    0.05,
  );

type Cell = {
  pos: THREE.Vector3;
  size: number;
  variant: number;
  quat: THREE.Quaternion;
  axis: THREE.Vector3;
  spin: number;
  drift: THREE.Vector3;
  phase: number;
  seed: number;
  scar1: [number, number, number, number];
  scar2: [number, number, number, number];
};

const buildCells = (): Cell[] => {
  const rnd = makeRng(771133);
  const rv = () =>
    new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
  const cells: Cell[] = [];
  const mk = (p: THREE.Vector3, size: number): Cell => {
    const s1 = rv();
    const s2 = rv();
    const k = rnd();
    return {
      pos: p,
      size,
      variant: Math.floor(rnd() * VARIANTS.length),
      quat: new THREE.Quaternion().setFromAxisAngle(rv(), rnd() * 6.28),
      axis: rv(),
      spin: (rnd() - 0.5) * 0.12,
      drift: rv().multiplyScalar(0.14),
      phase: rnd() * 6.28,
      seed: rnd() * 80 + 2,
      scar1: [s1.x, s1.y, s1.z, k < 0.5 ? 0.22 + rnd() * 0.22 : 0],
      scar2: [s2.x, s2.y, s2.z, k < 0.16 ? 0.16 + rnd() * 0.16 : 0],
    };
  };

  // Hero trio, laid out like the closing frames of the reference.
  // Their bud scars face the fly-through camera.
  const basis = new THREE.Matrix4().lookAt(
    AXIS,
    new THREE.Vector3(),
    new THREE.Vector3(0, 1, 0),
  );
  const toWorld = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, y, z).applyMatrix4(basis);
  const scarDir = (x: number, y: number): [number, number, number] => {
    const v = new THREE.Vector3(
      x,
      y,
      Math.sqrt(Math.max(0, 1 - x * x - y * y)),
    );
    return [v.x, v.y, v.z];
  };
  const hero = [
    {
      p: toWorld(-2.35, 0.2, -0.2),
      size: 1.2,
      variant: 0,
      tilt: 0.1,
      s1: [...scarDir(-0.05, -0.38), 0.34],
      s2: [...scarDir(0.5, 0.55), 0],
    },
    {
      p: toWorld(-0.15, 1.0, 0.75),
      size: 1.22,
      variant: 1,
      tilt: 1.15,
      s1: [...scarDir(0.1, 0.42), 0.3],
      s2: [...scarDir(0.62, 0.3), 0.15],
    },
    {
      p: toWorld(2.4, -0.95, 0.35),
      size: 1.3,
      variant: 2,
      tilt: -0.9,
      s1: [...scarDir(0.12, -0.22), 0.4],
      s2: [...scarDir(-0.45, 0.6), 0.14],
    },
  ];
  const baseQ = new THREE.Quaternion().setFromRotationMatrix(basis);
  hero.forEach((h) => {
    const c = mk(h.p, h.size);
    c.variant = h.variant;
    c.quat = baseQ
      .clone()
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          h.tilt,
        ),
      );
    c.spin = 0.012;
    c.axis = new THREE.Vector3(0.3, 1, 0.2).normalize();
    c.drift.multiplyScalar(0.3);
    c.scar1 = h.s1 as Cell["scar1"];
    c.scar2 = h.s2 as Cell["scar2"];
    cells.push(c);
  });

  // Keep-clear zones: the flight path itself (close shaves allowed, so
  // cells sweep past the lens) and the hero sight-lines of both camera rigs
  const pathPts: THREE.Vector3[] = [];
  const sight: THREE.Line3[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * 10;
    const r = flythrough(t, 10);
    pathPts.push(r.pos.clone());
    if (t >= 5.2 && i % 6 === 0) {
      hero.forEach((h) =>
        sight.push(new THREE.Line3(h.p.clone(), r.pos.clone())),
      );
    }
  }
  const wide: THREE.Line3[] = [];
  for (let i = 0; i <= 30; i++) {
    const r = orbitPullback((i / 30) * 10, 10);
    hero.forEach((h) => wide.push(new THREE.Line3(h.p.clone(), r.pos.clone())));
  }
  const startCam = pathPts[0];
  const tmp = new THREE.Vector3();
  const blocked = (p: THREE.Vector3, rad: number) =>
    p.distanceTo(startCam) < 14 ||
    pathPts.some((c) => c.distanceTo(p) < 0.45 + rad) ||
    sight.some((s) => {
      s.closestPointToPoint(p, true, tmp);
      return tmp.distanceTo(p) < 0.5 + rad;
    }) ||
    wide.some((s) => {
      s.closestPointToPoint(p, true, tmp);
      return tmp.distanceTo(p) < 1.3 + rad;
    });

  // Dense colony inside a wide tube around the flight axis
  const side = SIDE;
  const up = UP;
  let tries = 0;
  while (cells.length < 820 && tries++ < 120000) {
    const s = -17 + rnd() * (FINAL_DIST + TRAVEL + 6);
    const rho = Math.sqrt(rnd()) * 15.5;
    const a = rnd() * 6.2832;
    const p = HERO_C.clone()
      .addScaledVector(AXIS, s)
      .addScaledVector(side, Math.cos(a) * rho * 1.25)
      .addScaledVector(up, Math.sin(a) * rho * 0.9);
    const size = 0.85 + rnd() * 0.45;
    if (blocked(p, size)) continue;
    if (
      cells.some(
        (c) => c.pos.distanceToSquared(p) < Math.pow((c.size + size) * 0.86, 2),
      )
    )
      continue;
    cells.push(mk(p, size));
  }
  return cells;
};

export const yeastFactory: SceneFactory<YeastParams> = ({
  renderer,
  width,
  height,
  fps,
  durationInFrames,
  params,
}) => {
  const v3 = (h: string) => {
    const c = new THREE.Color(h).convertLinearToSRGB(); // keep hex as display values
    return new THREE.Vector3(c.r, c.g, c.b);
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.25, 140);
  const post = new Post(renderer, width, height);

  const bgMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: BG_VERT,
    fragmentShader: BG_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uBgA: { value: v3("#010a22") },
      uBgB: { value: v3("#03102e") },
    },
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  const cells = buildCells();
  // two levels of detail: fine geometry only around the hero cluster, where
  // cells are ever seen large and in focus
  const baseHi = mergeVertices(new THREE.IcosahedronGeometry(1, 30));
  const baseLo = mergeVertices(new THREE.IcosahedronGeometry(1, 12));
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: CELL_VERT,
    fragmentShader: CELL_FRAG,
    uniforms: {
      uDark: { value: v3("#143743") },
      uMid: { value: v3("#2f6c7e") },
      uRim: { value: v3("#c4f1fa") },
      uFog: { value: v3("#06222e") },
      uFogNear: { value: 14 },
      uFogFar: { value: 60 },
    },
  });
  // one instanced mesh per baked body variant
  const groups = VARIANTS.flatMap((v, vi) =>
    [true, false].map((hi) => ({ v, vi, hi })),
  ).map(({ v, vi, hi }) => {
    const list = cells.filter(
      (c) =>
        c.variant === vi && c.pos.distanceTo(HERO_C) < HI_DETAIL_RADIUS === hi,
    );
    // front-to-back along the view axis, so hidden pixels are rejected early
    list.sort((a, b) => b.pos.dot(AXIS) - a.pos.dot(AXIS));
    const geo = bakeBody(hi ? baseHi : baseLo, v[0], v[1]);
    const f32 = (n: number, fn: (c: Cell) => number[]) => {
      const arr = new Float32Array(list.length * n);
      list.forEach((c, i) => arr.set(fn(c), i * n));
      return new THREE.InstancedBufferAttribute(arr, n);
    };
    geo.setAttribute(
      "aSeed",
      f32(1, (c) => [c.seed]),
    );
    geo.setAttribute(
      "aScar1",
      f32(4, (c) => c.scar1),
    );
    geo.setAttribute(
      "aScar2",
      f32(4, (c) => c.scar2),
    );
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { list, geo, mesh };
  });

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const dur = durationInFrames / fps;

  return {
    render: (frame) => {
      const t = frame / fps;
      for (const g of groups) {
        g.list.forEach((c, i) => {
          p.set(
            c.pos.x + Math.sin(t * 0.23 + c.phase) * c.drift.x,
            c.pos.y + Math.sin(t * 0.19 + c.phase * 1.9) * c.drift.y,
            c.pos.z + Math.sin(t * 0.21 + c.phase * 2.7) * c.drift.z,
          );
          q2.setFromAxisAngle(c.axis, t * c.spin);
          q.copy(q2).multiply(c.quat);
          sc.setScalar(c.size);
          m.compose(p, q, sc);
          g.mesh.setMatrixAt(i, m);
        });
        g.mesh.instanceMatrix.needsUpdate = true;
      }

      const rig = rigAt(params.camera, t, dur);
      camera.position.copy(rig.pos);
      camera.up.set(Math.sin(rig.roll), Math.cos(rig.roll), 0);
      camera.lookAt(rig.target);
      camera.updateMatrixWorld();

      post.render(scene, camera, {
        focus: rig.focus,
        aperture: rig.aperture,
        maxCoc: 0.05,
        vignette: 0.22,
        grain: 0.03,
        contrast: 1.03,
        saturation: 1,
        lift: [0, 0, 0],
        frame,
      });
    },
    dispose: () => {
      post.dispose();
      baseHi.dispose();
      baseLo.dispose();
      groups.forEach((g) => {
        g.geo.dispose();
        g.mesh.dispose();
      });
      mat.dispose();
      bg.geometry.dispose();
      bgMat.dispose();
    },
  };
};
