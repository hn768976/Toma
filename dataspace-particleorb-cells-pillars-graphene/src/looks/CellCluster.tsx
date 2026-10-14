import { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { SIMPLEX3_GLSL } from "../lib/glsl";
import { mulberry32, phaseOf, TAU } from "../lib/random";
import { BG_VERT, CameraPose, ThreeStage } from "../three/ThreeStage";
import { useBufferSize } from "../three/useBuffer";
import type { CellPalette } from "../versions";

const N_CELLS = 24;
const N_DIVIDING = 4;
const SPACING = 0.98;
const CHAIN = N_CELLS * SPACING; // chain period (world units along the chain)
const DIR = new THREE.Vector2(1, 0.38).normalize(); // lower-left -> upper-right
const PERP = new THREE.Vector2(-DIR.y, DIR.x);
const N_FLECKS = 300;
const FLECK_BOX = 24; // flecks wrap in a box this long along the drift direction

type Cell = {
  s: number; // position along the chain
  off: number; // perpendicular offset
  z: number;
  radius: number;
  squash: number;
  dividing: boolean;
  axisAng: number;
  nucOff: [number, number, number];
  nucScale: [number, number, number];
  wobPh: number;
  turnAmp: number;
  turnPh: number;
  turnCycles: number;
  seed: number;
};

const CELLS: Cell[] = (() => {
  const rnd = mulberry32(2236104543);
  const divIdx = new Set<number>();
  while (divIdx.size < N_DIVIDING) divIdx.add(Math.floor(rnd() * N_CELLS));
  const out: Cell[] = [];
  let s = 0;
  for (let i = 0; i < N_CELLS; i++) {
    const dividing = divIdx.has(i);
    out.push({
      s,
      off: (rnd() - 0.5) * 0.9,
      z: (rnd() - 0.5) * 2.6,
      radius: dividing ? 0.68 + rnd() * 0.08 : 0.57 + rnd() * 0.14,
      squash: 0.55 + rnd() * 0.2,
      dividing,
      axisAng: rnd() * Math.PI,
      nucOff: [(rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.15],
      nucScale: [0.46 + rnd() * 0.08, 0.41 + rnd() * 0.08, 0.36],
      wobPh: rnd(),
      turnAmp: 0.15 + rnd() * 0.25,
      turnPh: rnd(),
      turnCycles: 1 + Math.floor(rnd() * 2),
      seed: rnd() * 100,
    });
    // loose chain: mostly even spacing, some clustered pairs (sums to CHAIN)
    s += SPACING;
  }
  // jitter positions but keep the total period exact
  out.forEach((c, i) => { c.s = i * SPACING + (rnd() - 0.5) * 0.5; });
  return out;
})();

const FLECKS = (() => {
  const rnd = mulberry32(51);
  return Array.from({ length: N_FLECKS }, () => ({
    u: rnd() * FLECK_BOX, // along drift
    v: (rnd() - 0.8) * 5, // across (biased below the chain)
    z: (rnd() - 0.5) * 7,
    size: 0.6 + Math.pow(rnd(), 2) * 2.0,
    fibre: rnd() < 0.1,
    ang: rnd() * Math.PI,
    alpha: 0.55 + rnd() * 0.45,
    ph: rnd(),
  }));
})();

// ---- shaders -------------------------------------------------------------
const CELL_COMMON = /* glsl */ `
uniform float uPhase;
uniform float uDividing;   // 0/1
uniform float uWaist;
uniform float uSeed;
uniform float uSquash;
${SIMPLEX3_GLSL}
// unit sphere -> cell shape (object space)
vec3 shapeOf(vec3 n){
  vec3 p = n;
  if (uDividing > 0.5) {
    // peanut along x: stretch, then pinch the middle
    p.x *= 1.55;
    float pinch = 1.0 - uWaist * exp(-n.x * n.x / 0.08);
    p.yz *= pinch;
  }
  p.z *= uSquash;
  float th = 6.2831853 * uPhase;
  vec3 tOff = vec3(cos(th), sin(th), 0.0) * 0.6 + vec3(uSeed);
  p *= 1.0 + 0.045 * snoise(n * 1.6 + tOff);
  return p;
}
`;

const CELL_VERT = /* glsl */ `
${CELL_COMMON}
out vec3 vObj;
out vec3 vN;
out vec3 vViewPos;
void main(){
  vec3 n = normalize(position);
  vec3 p = shapeOf(n);
  // normal by finite differences on the sphere
  vec3 t1 = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  float e = 0.01;
  vec3 pa = shapeOf(normalize(n + t1 * e));
  vec3 pb = shapeOf(normalize(n + t2 * e));
  vec3 nn = normalize(cross(pa - p, pb - p));
  if (dot(nn, p) < 0.0) nn = -nn;
  vObj = n;
  vN = normalize(normalMatrix * nn);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const MEMBRANE_FRAG = /* glsl */ `
uniform float uPhase;
uniform float uSeed;
uniform vec3 uMembrane; uniform vec3 uCyto; uniform vec3 uRim;
in vec3 vObj; in vec3 vN; in vec3 vViewPos;
out vec4 fragColor;
${SIMPLEX3_GLSL}
vec3 rainbow(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(-vViewPos);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float rim = 1.0 - ndv;
  // cytoplasm: faint mottled texture
  float th = 6.2831853 * uPhase;
  float tex = snoise(vObj * 5.0 + vec3(uSeed) + vec3(cos(th), sin(th), 0.0) * 0.3) * 0.5
            + snoise(vObj * 11.0 - vec3(uSeed)) * 0.25;
  // centre: stained blue cytoplasm; a lighter halo ring inside the membrane;
  // a thin darker membrane line at the silhouette
  // blotchy stain: darker, more saturated clumps
  float blot = smoothstep(-0.1, 0.6, tex);
  vec3 col = mix(uCyto, uCyto * vec3(0.6, 0.6, 1.05), blot * 0.8);
  float a = 0.46 + 0.25 * blot;
  float halo = smoothstep(0.3, 0.55, rim) * (1.0 - smoothstep(0.62, 0.78, rim));
  col = mix(col, uMembrane, halo * 0.2);
  a = mix(a, 0.38, halo);
  float ring = smoothstep(0.7, 0.86, rim) * (1.0 - smoothstep(0.95, 1.0, rim));
  col = mix(col, uRim, ring * 0.85);
  a = mix(a, 0.75, ring);
  // chromatic fringe at the very edge (direction dependent)
  float edge = smoothstep(0.62, 0.95, rim);
  float ang = atan(N.y, N.x) / 6.2831853;
  vec3 fringe = rainbow(fract(ang * 1.0 + 0.62)) * 1.2;
  col = mix(col, fringe, edge * 0.9);
  a = mix(a, 0.85, edge * 0.6);
  float hl = pow(max(dot(reflect(-V, N), normalize(vec3(-0.4, 0.7, 0.6))), 0.0), 40.0);
  col += vec3(0.8) * hl * 0.25;
  a = clamp(a + hl * 0.1, 0.0, 0.85);
  fragColor = vec4(col, a);
}
`;

const NUCLEUS_FRAG = /* glsl */ `
uniform float uPhase;
uniform float uSeed;
uniform vec3 uNucleus;
in vec3 vObj; in vec3 vN; in vec3 vViewPos;
out vec4 fragColor;
${SIMPLEX3_GLSL}
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(-vViewPos);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float m = snoise(vObj * 3.0 + vec3(uSeed)) * 0.7 + snoise(vObj * 7.0 + vec3(uSeed * 1.3)) * 0.2;
  vec3 col = uNucleus * vec3(0.25, 0.45, 1.15) * (1.0 + 0.4 * m);
  // saturated indigo/violet toward the edge, soft boundary
  col = mix(col, uNucleus * vec3(2.6, 2.0, 5.5), pow(1.0 - ndv, 2.0) * 0.75);
  float a = smoothstep(0.0, 0.35, ndv);
  fragColor = vec4(col, a);
}
`;

const FLECK_VERT = /* glsl */ `
uniform float uShift;
uniform vec2 uRes;
uniform vec2 uDir; uniform vec2 uPerp;
in vec3 aBase; in vec4 aShape; // size, fibre, angle, alpha
out vec2 vUv; out float vA; out float vFibre;
const float BOX = ${FLECK_BOX.toFixed(1)};
void main(){
  float u = mod(aBase.x + uShift, BOX) - BOX * 0.5;
  vec2 xy = uDir * u + uPerp * aBase.y;
  vec4 mv = viewMatrix * vec4(xy, aBase.z, 1.0);
  vec4 cp = projectionMatrix * mv;
  float scale = uRes.y / 720.0;
  float len = aShape.y > 0.5 ? 5.0 : 1.0;
  float sz = (3.0 + aShape.x * 2.4) * scale;
  float c = cos(aShape.z), s = sin(aShape.z);
  vec2 q = position.xy * vec2(sz * len, sz);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  cp.xy += q * 2.0 / uRes * cp.w;
  gl_Position = cp;
  vUv = position.xy;
  float edgeFade = smoothstep(BOX * 0.5, BOX * 0.38, abs(u));
  vA = aShape.w * edgeFade;
  vFibre = aShape.y;
}
`;
const FLECK_FRAG = /* glsl */ `
uniform vec3 uFleck;
in vec2 vUv; in float vA; in float vFibre;
out vec4 fragColor;
void main(){
  float d = vFibre > 0.5 ? max(abs(vUv.x) * 0.8, abs(vUv.y)) * 2.0 : length(vUv) * 2.0;
  float a = (1.0 - smoothstep(0.5, 1.0, d)) * vA;
  if (a < 0.02) discard;
  fragColor = vec4(uFleck, a);
}
`;

const BG_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uPatch; uniform float uPhase; uniform vec2 uRes;
in vec2 vUv;
out vec4 fragColor;
void main(){
  vec2 uv = vUv;
  float asp = uRes.x / uRes.y;
  vec3 col = mix(uBottom, uTop, smoothstep(0.1, 1.3, uv.y * 0.5 + (1.0 - uv.x) * 0.15 + 0.3)) * 0.82;
  float th = 6.2831853 * uPhase;
  // soft darker blur patches: out-of-focus cells far behind
  vec2 c1 = vec2(0.53, 0.25) + 0.03 * vec2(cos(th), sin(th));
  vec2 c2 = vec2(0.86, 0.72) + 0.03 * vec2(sin(th + 1.0), cos(th + 2.0));
  vec2 c3 = vec2(0.12, 0.82) + 0.025 * vec2(cos(th + 3.0), sin(th));
  vec2 q1 = (uv - c1) * vec2(asp, 1.0);
  vec2 q2 = (uv - c2) * vec2(asp, 1.0);
  vec2 q3 = (uv - c3) * vec2(asp, 1.0);
  float pch = 0.9 * exp(-dot(q1, q1) / 0.014) + 0.35 * exp(-dot(q1, q1) / 0.06)
            + 0.22 * exp(-dot(q2, q2) / 0.03) + 0.18 * exp(-dot(q3, q3) / 0.025);
  col = mix(col, uPatch, clamp(pch, 0.0, 0.85));
  fragColor = vec4(col, 1.0);
}
`;

const Scene: React.FC<{ palette: CellPalette; frame: number }> = ({ palette, frame }) => {
  const { w, h } = useBufferSize();
  const p = phaseOf(frame);

  const objs = useMemo(() => {
    const sphere = new THREE.SphereGeometry(1, 72, 48);
    const cols = {
      membrane: new THREE.Color(palette.membrane), cyto: new THREE.Color(palette.cytoplasm),
      rim: new THREE.Color(palette.cytoplasm).multiplyScalar(0.4), nucleus: new THREE.Color(palette.nucleus),
    };
    // draw order: far cells first (z ascending), nucleus before its membrane
    const order = CELLS.map((c, i) => ({ i, z: c.z })).sort((a, b) => a.z - b.z);
    const groups: { group: THREE.Group; mats: THREE.ShaderMaterial[] }[] = [];
    CELLS.forEach((c) => {
      const group = new THREE.Group();
      const rank = order.findIndex((o) => o.i === CELLS.indexOf(c));
      const mats: THREE.ShaderMaterial[] = [];
      const uni = () => ({
        uPhase: { value: 0 }, uDividing: { value: c.dividing ? 1 : 0 }, uWaist: { value: 0.32 },
        uSeed: { value: c.seed }, uSquash: { value: c.squash },
      });
      const nucMat = (offX: number, scl: number) => {
        const m = new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3, vertexShader: CELL_VERT, fragmentShader: NUCLEUS_FRAG,
          uniforms: { ...uni(), uDividing: { value: 0 }, uSquash: { value: 1 }, uSeed: { value: c.seed + offX * 10 }, uNucleus: { value: cols.nucleus } },
          // drawn after its own membrane and always on top of it, so the
          // nucleus stays dark; nearer cells are drawn later and still cover it
          transparent: true, depthWrite: true, depthFunc: THREE.AlwaysDepth,
        });
        mats.push(m);
        const mesh = new THREE.Mesh(sphere, m);
        mesh.position.set(c.nucOff[0] * c.radius + offX * c.radius, c.nucOff[1] * c.radius, 0);
        mesh.scale.set(c.nucScale[0] * c.radius * scl, c.nucScale[1] * c.radius * scl, c.nucScale[2] * c.radius * c.squash * scl);
        mesh.renderOrder = rank * 3 + 2;
        mesh.frustumCulled = false;
        return mesh;
      };
      if (c.dividing) {
        group.add(nucMat(-0.62, 0.9));
        group.add(nucMat(0.62, 0.9));
      } else {
        group.add(nucMat(0, 1));
      }
      const memMat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: CELL_VERT, fragmentShader: MEMBRANE_FRAG,
        uniforms: { ...uni(), uMembrane: { value: cols.membrane }, uCyto: { value: cols.cyto }, uRim: { value: cols.rim } },
        transparent: true, depthWrite: true,
      });
      mats.push(memMat);
      const mem = new THREE.Mesh(sphere, memMat);
      mem.scale.setScalar(c.radius);
      mem.renderOrder = rank * 3 + 1;
      mem.frustumCulled = false;
      group.add(mem);
      groups.push({ group, mats });
    });

    // flecks
    const fq = new THREE.InstancedBufferGeometry();
    fq.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    fq.setIndex([0, 1, 2, 0, 2, 3]);
    const fb = new Float32Array(N_FLECKS * 3), fs = new Float32Array(N_FLECKS * 4);
    FLECKS.forEach((f, i) => { fb.set([f.u, f.v, f.z], i * 3); fs.set([f.size, f.fibre ? 1 : 0, f.ang, f.alpha], i * 4); });
    fq.setAttribute("aBase", new THREE.InstancedBufferAttribute(fb, 3));
    fq.setAttribute("aShape", new THREE.InstancedBufferAttribute(fs, 4));
    fq.instanceCount = N_FLECKS;
    const fleckUniforms = {
      uShift: { value: 0 }, uRes: { value: new THREE.Vector2(1280, 720) },
      uDir: { value: DIR.clone() }, uPerp: { value: PERP.clone() }, uFleck: { value: new THREE.Color(palette.fleck) },
    };
    const flecks = new THREE.Mesh(fq, new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: FLECK_VERT, fragmentShader: FLECK_FRAG, uniforms: fleckUniforms, transparent: true, depthWrite: true,
    }));
    flecks.frustumCulled = false;
    flecks.renderOrder = 1000;

    const bgUniforms = {
      uTop: { value: new THREE.Color(palette.bgTop) }, uBottom: { value: new THREE.Color(palette.bgBottom) },
      uPatch: { value: new THREE.Color(palette.cytoplasm).multiplyScalar(0.55) },
      uPhase: { value: 0 }, uRes: fleckUniforms.uRes,
    };
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: bgUniforms, depthWrite: false,
    }));
    bg.frustumCulled = false; bg.renderOrder = -1;
    return { groups, flecks, fleckUniforms, bg, bgUniforms };
  }, [palette]);

  useLayoutEffect(() => {
    const shift = p * CHAIN;
    CELLS.forEach((c, i) => {
      const { group, mats } = objs.groups[i];
      // position along the periodic chain, centred on the view
      const s = ((c.s + shift) % CHAIN + CHAIN) % CHAIN - CHAIN / 2;
      const wig = 0.75 * Math.sin(TAU * (s / CHAIN) * 3) + 0.15 * Math.sin(TAU * (s / CHAIN) * 7 + c.wobPh * TAU);
      const xy = DIR.clone().multiplyScalar(s).add(PERP.clone().multiplyScalar(c.off + wig));
      group.position.set(xy.x, xy.y + 0.55, c.z);
      const turn = c.turnAmp * Math.sin(TAU * (c.turnCycles * p + c.turnPh));
      group.rotation.set(0.25 * Math.sin(TAU * (p + c.turnPh)), 0.3 * Math.cos(TAU * (p + c.wobPh)), c.axisAng + turn);
      mats.forEach((m) => { m.uniforms.uPhase.value = (p * 2 + c.wobPh) % 1; });
    });
    objs.fleckUniforms.uShift.value = p * FLECK_BOX * 2; // two box lengths per loop
    objs.fleckUniforms.uRes.value.set(w, h);
    objs.bgUniforms.uPhase.value = p;
  }, [objs, p, w, h]);

  return (
    <>
      <primitive object={objs.bg} />
      {objs.groups.map((g, i) => <primitive key={i} object={g.group} />)}
      <primitive object={objs.flecks} />
    </>
  );
};

export const CellCluster: React.FC<{ palette: CellPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const camera: CameraPose = useMemo(() => ({ fov: 18, position: [0, 0, 13], target: [0, 0, 0], near: 1, far: 60 }), []);
  const post = useMemo(() => ({
    focus: 12.7, range: 0.75, nearRange: 0.6, sharpZone: 0.0, maxBlur: 22, farMax: 1,
    bloomStrength: 0.3, bloomThreshold: 0.5, bloomRadius: 2.6,
    grain: 0.015, vignette: 0.08, chroma: 6,
  }), []);
  return (
    <ThreeStage camera={camera} post={post}>
      <Scene palette={palette} frame={frame} />
    </ThreeStage>
  );
};
