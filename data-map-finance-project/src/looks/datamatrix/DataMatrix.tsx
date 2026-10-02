import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useThree } from "@react-three/fiber";
import { ThreeStage } from "../../lib/ThreeStage";
import { THREE, col } from "../../lib/three-setup";
import { makeDotGeometry, makeDotMaterial, pxPerUnit } from "../../lib/dots";
import { makeRand } from "../../lib/random";
import { clamp, easeInOut, lerp } from "../../lib/loop";
import type { DataMatrixPalette } from "../../versions";
import { COLS, ROWS, DZ, ROW_DELAY, columns, colLand, strands, STRAND_COUNT } from "./layout";

const FOV = 38;
const SEGMENTS = 96;
const APERTURE = 0.014;

// ---------- matrix dots ----------

const buildMatrix = () => {
  const r = makeRand(906);
  const off: number[] = [];
  const size: number[] = [];
  const br: number[] = [];
  const mix: number[] = [];
  const on: number[] = [];
  const flick: number[] = [];
  for (let c = 0; c < COLS; c++) {
    const x = columns[c];
    if (x === null) continue;
    const seed = colLand[c] < 0;
    // some columns are denser / brighter, like data columns
    const colGain = r.range(0.55, 1.0);
    for (let row = 0; row < ROWS; row++) {
      const v = r.next();
      if (v < 0.12) continue; // sparse holes
      off.push(x, 0, -row * DZ);
      size.push(0.105);
      br.push(colGain * r.range(0.35, 1.0));
      mix.push(r.next() < 0.09 ? 1 : 0);
      if (seed) on.push(row < 34 ? -30 + row * 0.3 : 95 + (row - 34) * ROW_DELAY);
      else on.push(colLand[c] + row * ROW_DELAY);
      flick.push(r.range(0.45, 0.9));
    }
  }
  return {
    offsets: new Float32Array(off),
    sizes: new Float32Array(size),
    bright: new Float32Array(br),
    mix: new Float32Array(mix),
    on: new Float32Array(on),
    flick: new Float32Array(flick),
  };
};

// Faint, unlit floor of dots in front of the matrix, where the strands land.
const buildFloor = () => {
  const r = makeRand(907);
  const off: number[] = [];
  const size: number[] = [];
  const br: number[] = [];
  for (let c = 0; c < COLS; c += 2) {
    const x = (c - COLS / 2 + 0.5) * 0.5;
    for (let z = 1.1; z < 60; z += 1.1) {
      off.push(x, 0, z);
      size.push(0.06);
      br.push(r.range(0.06, 0.16));
    }
  }
  return makeDotGeometry({
    offsets: new Float32Array(off),
    sizes: new Float32Array(size),
    bright: new Float32Array(br),
  });
};

// ---------- strands ----------

const STRAND_VERT = /* glsl */ `
precision highp float;
in float aT;
in float aSide;
in vec3 aP0;
in vec3 aP1;
in vec3 aP2;
in vec3 aP3;
in vec4 aInfo; // start, dur, accent, bright
uniform float uFrame;
uniform float uFocus;
uniform float uAperture;
uniform float uPxPerUnit;
uniform float uWidth;
out float vAlpha;
out float vMix;
out float vSide;
out float vSoft;

vec3 bez(float t) {
  float u = 1.0 - t;
  return u*u*u*aP0 + 3.0*u*u*t*aP1 + 3.0*u*t*t*aP2 + t*t*t*aP3;
}
vec3 dbez(float t) {
  float u = 1.0 - t;
  return 3.0*u*u*(aP1 - aP0) + 6.0*u*t*(aP2 - aP1) + 3.0*t*t*(aP3 - aP2);
}
void main() {
  float prog = clamp((uFrame - aInfo.x) / aInfo.y, 0.0, 1.0);
  // ease-in fall, settling into the matrix
  float head = 1.0 - pow(1.0 - prog, 2.2);
  float t = min(aT, head);
  vec3 p = bez(t);
  vec3 tng = dbez(t);
  vec4 vp = viewMatrix * vec4(p, 1.0);
  vec3 tv = (viewMatrix * vec4(tng, 0.0)).xyz;
  vec3 side = normalize(cross(tv, vp.xyz));
  float d = max(-vp.z, 0.001);
  float blur = min(uAperture * abs(d - uFocus), 0.35);
  float w = uWidth + blur;
  float a = uWidth / w;
  float wpx = w * uPxPerUnit / d;
  if (wpx < 1.2) { a *= wpx / 1.2; w *= 1.2 / wpx; wpx = 1.2; }
  vp.xyz += side * aSide * w;
  gl_Position = projectionMatrix * vp;

  float visible = step(aT, head + 1e-4) * step(0.0005, prog);
  float spark = exp(-(head - aT) * 38.0) * (1.0 - prog * 0.6);
  float fadeTop = smoothstep(0.0, 0.12, aT);
  // after landing, the strand glows a little where it meets the matrix
  float base = 0.8 * (1.0 - 0.75 * smoothstep(0.86, 1.0, aT));
  vAlpha = a * aInfo.w * visible * fadeTop * (base + 2.2 * spark);
  vMix = aInfo.z;
  vSide = aSide;
  vSoft = clamp(blur / w + 1.2 / wpx, 0.05, 1.0);
}
`;

const STRAND_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColorA;
uniform vec3 uColorB;
in float vAlpha;
in float vMix;
in float vSide;
in float vSoft;
out vec4 outColor;
void main() {
  float e = abs(vSide);
  float m = 1.0 - smoothstep(1.0 - vSoft, 1.0, e);
  outColor = vec4(mix(uColorA, uColorB, vMix) * vAlpha * m, 1.0);
}
`;

const buildStrands = () => {
  const base = new THREE.BufferGeometry();
  const tArr: number[] = [];
  const sArr: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    tArr.push(t, t);
    sArr.push(-1, 1);
    if (i < SEGMENTS) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute("aT", new THREE.Float32BufferAttribute(tArr, 1));
  geo.setAttribute("aSide", new THREE.Float32BufferAttribute(sArr, 1));
  // dummy position so three knows the vertex count
  geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(tArr.length * 3), 3));
  base.dispose();
  const p = (k: "p0" | "p1" | "p2" | "p3") =>
    new THREE.InstancedBufferAttribute(new Float32Array(strands.flatMap((s) => s[k])), 3);
  geo.setAttribute("aP0", p("p0"));
  geo.setAttribute("aP1", p("p1"));
  geo.setAttribute("aP2", p("p2"));
  geo.setAttribute("aP3", p("p3"));
  geo.setAttribute(
    "aInfo",
    new THREE.InstancedBufferAttribute(
      new Float32Array(strands.flatMap((s) => [s.start, s.dur, s.accent, s.bright])),
      4,
    ),
  );
  geo.instanceCount = STRAND_COUNT;
  return geo;
};

// ---------- background ----------

const BG_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uBg;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 c = uBg * (0.55 + 0.65 * smoothstep(1.1, 0.15, vUv.y));
  vec2 q = vUv - 0.5;
  c *= 1.0 - 0.6 * dot(q, q);
  outColor = vec4(c, 1.0);
}
`;
const BG_VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;

// ---------- camera path ----------

type V3 = [number, number, number];
const KEYS: { f: number; pos: V3; look: V3 }[] = [
  { f: 0, pos: [0, 30, 74], look: [0, 9, -12] },
  { f: 150, pos: [0, 25, 60], look: [0, 5, -12] },
  { f: 330, pos: [0, 7.5, 18], look: [0, 0, 3] },
  { f: 450, pos: [0, 5, 2], look: [0, 0, -9.5] },
];

const cameraAt = (frame: number) => {
  let k = 0;
  while (k < KEYS.length - 2 && frame > KEYS[k + 1].f) k++;
  const a = KEYS[k];
  const b = KEYS[k + 1];
  const u = clamp((frame - a.f) / (b.f - a.f));
  // middle segment eases; first and last glide linearly-ish
  const e = k === 1 ? easeInOut(u) : k === 0 ? u * u * 0.5 + u * 0.5 : u * (1.4 - 0.4 * u);
  const mixv = (p: V3, q: V3): V3 => [lerp(p[0], q[0], e), lerp(p[1], q[1], e), lerp(p[2], q[2], e)];
  return { pos: mixv(a.pos, b.pos), look: mixv(a.look, b.look) };
};

const additive = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
} as const;

const Scene: React.FC<{ palette: DataMatrixPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { camera, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;

  const objs = useMemo(() => {
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: BG_VERT,
        fragmentShader: BG_FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: { uBg: { value: col(palette.bg) } },
      }),
    );
    bg.frustumCulled = false;
    bg.renderOrder = -10;

    const inst = buildMatrix();
    const geo = makeDotGeometry(inst);
    const opts = {
      colorA: palette.dots,
      colorB: palette.accent,
      focus: 40,
      aperture: APERTURE,
      maxBlur: 0.3,
      farStart: 38,
      farEnd: 80,
      onRamp: 6,
      flickStep: 7,
    };
    const dots = new THREE.Mesh(geo, makeDotMaterial({ ...opts, intensity: 1.25 }));
    dots.frustumCulled = false;
    // a wide, faint copy of every dot reads as glow
    const glowGeo = makeDotGeometry({ ...inst, sizes: inst.sizes.map((s) => s * 3.2) });
    const glow = new THREE.Mesh(glowGeo, makeDotMaterial({ ...opts, intensity: 0.1, softMin: 1 }));
    glow.frustumCulled = false;
    glow.renderOrder = -2;

    const floor = new THREE.Mesh(buildFloor(), makeDotMaterial({ ...opts, flickStep: 1e6 }));
    floor.frustumCulled = false;
    floor.renderOrder = -3;

    const strandMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: STRAND_VERT,
      fragmentShader: STRAND_FRAG,
      ...additive,
      side: THREE.DoubleSide,
      uniforms: {
        uFrame: { value: 0 },
        uFocus: { value: 40 },
        uAperture: { value: APERTURE },
        uPxPerUnit: { value: 1000 },
        uWidth: { value: 0.05 },
        uColorA: { value: col(palette.dots) },
        uColorB: { value: col(palette.accent) },
      },
    });
    const strandMesh = new THREE.Mesh(buildStrands(), strandMat);
    strandMesh.frustumCulled = false;
    strandMesh.renderOrder = 2;
    return {
      bg,
      dots,
      glow,
      floor,
      strandMesh,
      mats: [dots.material, glow.material, floor.material, strandMat] as THREE.ShaderMaterial[],
    };
  }, [palette]);

  const c = cameraAt(frame);
  cam.fov = FOV;
  cam.position.set(...c.pos);
  cam.lookAt(...c.look);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  const focus = Math.hypot(c.pos[0] - c.look[0], c.pos[1] - c.look[1], c.pos[2] - c.look[2]);

  const buf = gl.getDrawingBufferSize(new THREE.Vector2());
  const ppu = pxPerUnit(FOV, buf.y);
  for (const m of objs.mats) {
    m.uniforms.uFrame.value = frame;
    m.uniforms.uFocus.value = focus;
    m.uniforms.uPxPerUnit.value = ppu;
  }
  // far fade follows the camera so the matrix always dissolves into the distance
  for (const m of [objs.mats[0], objs.mats[1], objs.mats[2]]) {
    m.uniforms.uFarStart.value = focus + 12;
    m.uniforms.uFarEnd.value = focus + 70;
  }

  return (
    <>
      <primitive object={objs.bg} />
      <primitive object={objs.floor} />
      <primitive object={objs.glow} />
      <primitive object={objs.dots} />
      <primitive object={objs.strandMesh} />
    </>
  );
};

export const DataMatrix: React.FC<{ palette: DataMatrixPalette }> = ({ palette }) => (
  <AbsoluteFill style={{ backgroundColor: palette.bg }}>
    <ThreeStage post={{ grain: 0.02, blackSafe: false }}>
      <Scene palette={palette} />
    </ThreeStage>
  </AbsoluteFill>
);
