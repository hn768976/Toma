import * as THREE from "three";
import {
  DOT_FRAG,
  DOT_VERT,
  LINE_FRAG,
  LINE_VERT,
  SPRITE_FRAG,
  SPRITE_VERT,
} from "./shaders";

export type DofParams = {
  focus: number;
  coc: number; // px@2160 at infinity
  cocMax: number; // px@2160
  fade: [number, number, number, number]; // near0, near1, far0, far1
  farFloor?: number;
  near: number;
};

export const defaultDof = (): DofParams => ({
  focus: 10,
  coc: 0,
  cocMax: 1,
  fade: [-1, 0, 1e8, 1e9],
  near: 0.05,
});

const commonUniforms = () => ({
  uRes: { value: new THREE.Vector2(1, 1) },
  uFocus: { value: 10 },
  uCoc: { value: 0 },
  uCocMax: { value: 1 },
  uFade: { value: new THREE.Vector4(-1, 0, 1e8, 1e9) },
  uFarFloor: { value: 0 },
  uNear: { value: 0.05 },
});

const additive = (m: THREE.RawShaderMaterial) => {
  m.transparent = true;
  m.depthTest = false;
  m.depthWrite = false;
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneFactor;
  m.blendSrcAlpha = THREE.OneFactor;
  m.blendDstAlpha = THREE.OneFactor;
  return m;
};

export const applyDof = (
  m: THREE.RawShaderMaterial,
  dof: DofParams,
  res: THREE.Vector2,
) => {
  const u = m.uniforms;
  u.uRes.value.copy(res);
  u.uFocus.value = dof.focus;
  u.uCoc.value = dof.coc;
  u.uCocMax.value = Math.max(dof.cocMax, 1e-3);
  u.uFade.value.set(...dof.fade);
  u.uFarFloor.value = dof.farFloor ?? 0;
  if (u.uNear) u.uNear.value = dof.near;
};

const quadAlong = () => {
  // x: 0..1 along the segment, y: -1..1 across.
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

const quadCentered = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

const quadUnit = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

const inst = (g: THREE.InstancedBufferGeometry, name: string, arr: Float32Array, size: number, dynamic: boolean) => {
  const a = new THREE.InstancedBufferAttribute(arr, size);
  if (dynamic) a.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute(name, a);
  return a;
};

export type LineBatch = {
  mesh: THREE.Mesh;
  material: THREE.RawShaderMaterial;
  a: Float32Array;
  b: Float32Array;
  color: Float32Array;
  width: Float32Array;
  count: number;
  /** Mark attributes dirty after editing the arrays. */
  touch: (which?: { pos?: boolean; color?: boolean; width?: boolean }) => void;
};

export const makeLines = (count: number, dynamic = false): LineBatch => {
  const g = quadAlong();
  const a = new Float32Array(count * 3);
  const b = new Float32Array(count * 3);
  const color = new Float32Array(count * 4);
  const width = new Float32Array(count).fill(1);
  const aA = inst(g, "iA", a, 3, dynamic);
  const aB = inst(g, "iB", b, 3, dynamic);
  const aC = inst(g, "iColor", color, 4, dynamic);
  const aW = inst(g, "iWidth", width, 1, dynamic);
  g.instanceCount = count;
  const material = additive(
    new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: commonUniforms(),
    }),
  );
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    material,
    a,
    b,
    color,
    width,
    count,
    touch: (w = { pos: true, color: true, width: true }) => {
      if (w.pos) {
        aA.needsUpdate = true;
        aB.needsUpdate = true;
      }
      if (w.color) aC.needsUpdate = true;
      if (w.width) aW.needsUpdate = true;
    },
  };
};

export type DotBatch = {
  mesh: THREE.Mesh;
  material: THREE.RawShaderMaterial;
  p: Float32Array;
  color: Float32Array;
  size: Float32Array;
  count: number;
  touch: () => void;
};

export const makeDots = (count: number, dynamic = false): DotBatch => {
  const g = quadCentered();
  const p = new Float32Array(count * 3);
  const color = new Float32Array(count * 4);
  const size = new Float32Array(count).fill(2);
  const aP = inst(g, "iP", p, 3, dynamic);
  const aC = inst(g, "iColor", color, 4, dynamic);
  const aS = inst(g, "iSize", size, 1, dynamic);
  g.instanceCount = count;
  const material = additive(
    new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      uniforms: commonUniforms(),
    }),
  );
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    material,
    p,
    color,
    size,
    count,
    touch: () => {
      aP.needsUpdate = true;
      aC.needsUpdate = true;
      aS.needsUpdate = true;
    },
  };
};

export type SpriteBatch = {
  mesh: THREE.Mesh;
  material: THREE.RawShaderMaterial;
  p: Float32Array;
  size: Float32Array;
  uv: Float32Array;
  color: Float32Array;
  count: number;
  touch: () => void;
};

export const makeSprites = (
  count: number,
  sharp: THREE.Texture,
  blur: THREE.Texture,
  axisU: THREE.Vector3,
  axisV: THREE.Vector3,
): SpriteBatch => {
  const g = quadUnit();
  const p = new Float32Array(count * 3);
  const size = new Float32Array(count * 2);
  const uv = new Float32Array(count * 4);
  const color = new Float32Array(count * 4);
  const aP = inst(g, "iP", p, 3, true);
  const aS = inst(g, "iSize", size, 2, true);
  const aU = inst(g, "iUv", uv, 4, true);
  const aC = inst(g, "iColor", color, 4, true);
  g.instanceCount = count;
  const material = additive(
    new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SPRITE_VERT,
      fragmentShader: SPRITE_FRAG,
      uniforms: {
        ...commonUniforms(),
        uSharp: { value: sharp },
        uBlur: { value: blur },
        uAxisU: { value: axisU.clone() },
        uAxisV: { value: axisV.clone() },
      },
    }),
  );
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    material,
    p,
    size,
    uv,
    color,
    count,
    touch: () => {
      aP.needsUpdate = true;
      aS.needsUpdate = true;
      aU.needsUpdate = true;
      aC.needsUpdate = true;
    },
  };
};
