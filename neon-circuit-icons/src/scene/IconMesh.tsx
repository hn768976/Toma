import { useMemo } from 'react';
import {
  AdditiveBlending, Color, ExtrudeGeometry, InstancedBufferAttribute, InstancedBufferGeometry,
  PlaneGeometry, ShaderMaterial, Shape, Vector2, Vector3,
} from 'three';
import type { IconAssets } from '../lib/assets';
import { paletteAt } from '../lib/palette';
import { GLINT_SEED, mulberry32 } from '../lib/random';
import { OKLAB_GLSL } from './glsl';

// The neon icon: SVG → Clipper → ExtrudeGeometry with a generous rounded
// bevel, emissive gradient shader (OKLab mix of the two palette colours),
// brighter bevels, a faint white core on the hottest areas, glints on the
// edges, and the optional label set in front of the base.

const ICON_LIFT = 0.07; // gap between board and icon when there is no label
const LABEL_Z = 0.3;
const LABEL_Y = 0.025;
const LABEL_GAP = 0.08;

const iconMaterial = (intensity: number) =>
  new ShaderMaterial({
    uniforms: {
      uColA: { value: new Color() },
      uColB: { value: new Color() },
      uBMin: { value: new Vector2() },
      uBMax: { value: new Vector2(1, 1) },
      uIntensity: { value: intensity },
      uLightDir: { value: new Vector3(-0.35, 0.8, 0.5).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vObj;
      varying vec3 vObjN;
      varying vec3 vWN;
      varying vec3 vW;
      void main() {
        vObj = position;
        vObjN = normal;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vWN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColA;
      uniform vec3 uColB;
      uniform vec2 uBMin;
      uniform vec2 uBMax;
      uniform float uIntensity;
      uniform vec3 uLightDir;
      varying vec3 vObj;
      varying vec3 vObjN;
      varying vec3 vWN;
      varying vec3 vW;
      ${OKLAB_GLSL}
      void main() {
        vec2 q = (vObj.xy - uBMin) / max(uBMax - uBMin, vec2(1e-4));
        // left → right with a little diagonal
        float g = clamp(q.x * 0.84 + (1.0 - q.y) * 0.16, 0.0, 1.0);
        g = smoothstep(0.0, 1.0, g);
        vec3 base = oklab2lin(mix(lin2oklab(uColA), lin2oklab(uColB), g));

        vec3 n = normalize(vObjN);
        float az = abs(n.z);
        float face = smoothstep(0.93, 0.995, az);
        float side = 1.0 - smoothstep(0.05, 0.32, az);
        float bevel = clamp(1.0 - face - side, 0.0, 1.0);

        vec3 N = normalize(vWN);
        vec3 V = normalize(cameraPosition - vW);
        float ndv = abs(dot(N, V));
        float fres = pow(1.0 - ndv, 3.0);

        float I = face * 1.25 + bevel * 3.4 + side * 0.85;
        I *= 1.0 + fres * 0.5;
        vec3 col = base * I;
        // white streak on the bevels as the camera sways
        vec3 H = normalize(uLightDir + V);
        float spec = pow(max(dot(N, H), 0.0), 36.0) * (bevel + 0.25 * face);
        col += vec3(1.0, 0.96, 1.0) * spec * 2.2;
        // faint white core where it is brightest
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(col, vec3(lum) * 1.1, smoothstep(2.2, 6.0, lum) * 0.25);
        gl_FragColor = vec4(col * uIntensity, 1.0);
      }`,
  });

const glintMaterial = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uT: { value: 0 }, uCol: { value: new Color() } },
    vertexShader: /* glsl */ `
      attribute vec4 aG; // x, y, z, k (whole cycles per loop)
      attribute vec4 aH; // phase, size, rotation, -
      uniform float uT;
      varying vec2 vQ;
      varying float vE;
      void main() {
        float s = sin(6.283185307 * (aG.w * uT + aH.x));
        float e = pow(max(s, 0.0), 6.0);
        vE = e;
        vQ = position.xy * 2.0;
        float c = cos(aH.z), si = sin(aH.z);
        vec2 p = mat2(c, si, -si, c) * position.xy * aH.y * (0.35 + 0.65 * e);
        vec4 mv = modelViewMatrix * vec4(aG.xyz, 1.0);
        mv.xy += p;
        mv.z += 0.03;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol;
      varying vec2 vQ;
      varying float vE;
      void main() {
        vec2 q = vQ;
        float core = exp(-dot(q, q) * 60.0);
        float s1 = exp(-abs(q.x) * 9.0) * exp(-q.y * q.y * 900.0);
        float s2 = exp(-abs(q.y) * 9.0) * exp(-q.x * q.x * 900.0);
        vec3 c = mix(uCol, vec3(1.0), 0.6) * (core * 9.0 + (s1 + s2) * 4.0);
        gl_FragColor = vec4(c * vE, 1.0);
      }`,
  });

const GLINTS = 7;

const buildGlints = (outlines: Vector2[][], frontZ: number) => {
  // same seed for every icon; positions follow each icon's outline
  const rng = mulberry32(GLINT_SEED);
  const lens = outlines.map((o) => {
    let L = 0;
    for (let i = 0; i < o.length; i++) L += o[i].distanceTo(o[(i + 1) % o.length]);
    return L;
  });
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const g = new InstancedBufferGeometry();
  const base = new PlaneGeometry(1, 1);
  g.index = base.index;
  g.setAttribute('position', base.getAttribute('position'));
  const a = new Float32Array(GLINTS * 4);
  const b = new Float32Array(GLINTS * 4);
  for (let i = 0; i < GLINTS; i++) {
    // pick a point along all outlines by arc length
    let s = rng() * total;
    let ci = 0;
    while (ci < lens.length - 1 && s > lens[ci]) { s -= lens[ci]; ci++; }
    const o = outlines[ci];
    let p = o[0];
    for (let j = 0; j < o.length; j++) {
      const q0 = o[j];
      const q1 = o[(j + 1) % o.length];
      const d = q0.distanceTo(q1);
      if (s <= d) { p = q0.clone().lerp(q1, d > 0 ? s / d : 0); break; }
      s -= d;
    }
    const k = 2 + Math.floor(rng() * 3); // 2..4 whole cycles per loop
    a.set([p.x, p.y, frontZ, k], i * 4);
    b.set([rng(), 0.2 + rng() * 0.14, rng() * 0.6 - 0.3, 0], i * 4);
  }
  g.setAttribute('aG', new InstancedBufferAttribute(a, 4));
  g.setAttribute('aH', new InstancedBufferAttribute(b, 4));
  g.instanceCount = GLINTS;
  return g;
};

const extrude = (shapes: Shape[], depth: number, bevelT: number, bevelS: number, segs: number) => {
  const geo = new ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevelT,
    bevelSize: bevelS,
    bevelOffset: 0,
    bevelSegments: segs,
    curveSegments: 4,
    steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeBoundingBox();
  return geo;
};

export const IconMesh = ({ assets, t }: { assets: IconAssets; t: number }) => {
  const built = useMemo(() => {
    const h = assets.height;
    const depth = 0.12 * h;
    const bevelT = 0.03 * h;
    const bevelS = 0.0125 * h;
    const icon = extrude(assets.shapes, depth, bevelT, bevelS, 6);
    const iconMat = iconMaterial(1.0);
    const bb = icon.boundingBox!;
    iconMat.uniforms.uBMin.value.set(bb.min.x, bb.min.y);
    iconMat.uniforms.uBMax.value.set(bb.max.x, bb.max.y);
    const frontZ = depth / 2 + bevelT;
    const glints = buildGlints(assets.outlines, frontZ);
    const glintMat = glintMaterial();
    let label = null as null | { geo: ExtrudeGeometry; mat: ShaderMaterial };
    let lift = ICON_LIFT;
    if (assets.label) {
      const geo = extrude(assets.label.shapes, 0.022, 0.0045, 0.0028, 3);
      const mat = iconMaterial(0.5);
      const lb = geo.boundingBox!;
      mat.uniforms.uBMin.value.set(lb.min.x, lb.min.y);
      mat.uniforms.uBMax.value.set(lb.max.x, lb.max.y);
      label = { geo, mat };
      lift = LABEL_Y + assets.label.height + LABEL_GAP;
    }
    return { icon, iconMat, glints, glintMat, label, lift };
  }, [assets]);

  const { iconMat, glintMat, label } = built;
  paletteAt(t, iconMat.uniforms.uColA.value, iconMat.uniforms.uColB.value);
  if (label) {
    label.mat.uniforms.uColA.value.copy(iconMat.uniforms.uColA.value);
    label.mat.uniforms.uColB.value.copy(iconMat.uniforms.uColB.value);
  }
  glintMat.uniforms.uT.value = t;
  glintMat.uniforms.uCol.value.copy(iconMat.uniforms.uColB.value);

  return (
    <group>
      <group position={[0, built.lift, 0]}>
        <mesh geometry={built.icon} material={iconMat} />
        <mesh geometry={built.glints} material={glintMat} frustumCulled={false} renderOrder={10} />
      </group>
      {label && (
        <mesh geometry={label.geo} material={label.mat} position={[0, LABEL_Y, LABEL_Z]} rotation={[-0.1, 0, 0]} />
      )}
    </group>
  );
};
