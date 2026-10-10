import React, { useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { LOOP_FRAMES, PadlockRow } from "../data";
import { PostPipeline } from "../lib/post";
import { mulberry32 } from "../lib/random";
import { buildStripGeometry, STRIP_VERT, StripLine } from "../lib/strips";
import { LookFactory, ThreeLook } from "../lib/ThreeLook";
import { buildPadlockGeometry } from "./padlockModel";

const TAU = Math.PI * 2;
const FLOOR_TEX_PERIOD = 4; // world units per floor-texture tile
const REFLECT_LAYER = 1;

export type PadlockMode = "topdown" | "flyover" | "modelcheck";

type Lock = { x: number; z: number; yaw: number; rand: number };

// ------------------------------------------------------------ floor texture
// r = grid lines, g = fine pixel/dot matrix, b = circuit patches. Tiles every
// FLOOR_TEX_PERIOD units; the loop periods are multiples of it.
const drawFloorTexture = (seed: number, mode: PadlockMode) => {
  const rng = mulberry32(seed * 733 + 5);
  const S = 1024;
  const cell = S / FLOOR_TEX_PERIOD; // one grid cell per world unit
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const g = c.getContext("2d")!;
    g.fillStyle = "#000";
    g.fillRect(0, 0, S, S);
    return { c, g };
  };
  const R = mk();
  const G = mk();
  const B = mk();
  // grid
  R.g.fillStyle = "#fff";
  for (let i = 0; i < FLOOR_TEX_PERIOD; i++) {
    const p = i * cell;
    const lw = mode === "flyover" ? 5 : 7;
    for (const o of [0, S]) {
      R.g.fillRect(p - lw / 2 + o, 0, lw, S);
      R.g.fillRect(0, p - lw / 2 + o, S, lw);
    }
  }
  // finer sub-grid (dimmer)
  R.g.fillStyle = "rgba(255,255,255,0.28)";
  for (let i = 0; i < FLOOR_TEX_PERIOD * 4; i++) {
    if (i % 4 === 0) continue;
    const p = i * (cell / 4);
    R.g.fillRect(p - 1, 0, 2, S);
    R.g.fillRect(0, p - 1, S, 2);
  }
  // pixel/dot matrix in some cells
  for (let cy = 0; cy < FLOOR_TEX_PERIOD * 2; cy++) {
    for (let cx = 0; cx < FLOOR_TEX_PERIOD * 2; cx++) {
      if (rng() < 0.45) continue;
      const b = 0.25 + rng() * 0.6;
      G.g.fillStyle = `rgba(255,255,255,${b})`;
      const half = cell / 2;
      const pitch = 21;
      for (let y = 10; y < half - 8; y += pitch) {
        for (let x = 10; x < half - 8; x += pitch) {
          if (rng() < 0.25) continue;
          G.g.fillRect(cx * half + x, cy * half + y, 9, 9);
        }
      }
    }
  }
  // circuit patches: short bright segments and small blocks
  B.g.strokeStyle = "#fff";
  B.g.fillStyle = "#fff";
  for (let i = 0; i < 70; i++) {
    let x = Math.floor(rng() * 64) * 16;
    let y = Math.floor(rng() * 64) * 16;
    const n = 1 + Math.floor(rng() * 3);
    B.g.lineWidth = rng() < 0.3 ? 4 : 2;
    B.g.globalAlpha = 0.4 + rng() * 0.6;
    B.g.beginPath();
    B.g.moveTo(x, y);
    for (let k = 0; k < n; k++) {
      if (rng() < 0.5) x += (rng() < 0.5 ? -1 : 1) * 16 * (2 + Math.floor(rng() * 5));
      else y += (rng() < 0.5 ? -1 : 1) * 16 * (2 + Math.floor(rng() * 5));
      B.g.lineTo(x, y);
    }
    B.g.stroke();
    if (rng() < 0.5) B.g.fillRect(x - 4, y - 4, 8, 8);
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rng() * 64) * 16;
    const y = Math.floor(rng() * 64) * 16;
    B.g.globalAlpha = 0.3 + rng() * 0.6;
    const w = 8 + Math.floor(rng() * 4) * 8;
    const h = 4 + Math.floor(rng() * 3) * 4;
    for (let k = 0; k < 4; k++) B.g.fillRect(x + k * (w + 6), y, w, h);
  }
  B.g.globalAlpha = 1;
  // merge channels
  const out = mk();
  const id = out.g.getImageData(0, 0, S, S);
  const rd = R.g.getImageData(0, 0, S, S).data;
  const gd = G.g.getImageData(0, 0, S, S).data;
  const bd = B.g.getImageData(0, 0, S, S).data;
  for (let i = 0; i < S * S; i++) {
    id.data[i * 4] = rd[i * 4];
    id.data[i * 4 + 1] = gd[i * 4];
    id.data[i * 4 + 2] = bd[i * 4];
    id.data[i * 4 + 3] = 255;
  }
  out.g.putImageData(id, 0, 0);
  const tex = new THREE.CanvasTexture(out.c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 16;
  return tex;
};

// ------------------------------------------------------------ layouts
type Layout = { L: number; locks: Lock[]; tiles: [number, number][] };

const makeLayout = (row: PadlockRow, mode: PadlockMode): Layout => {
  const rng = mulberry32(row.seed * 1000 + 17);
  if (mode === "modelcheck") {
    return { L: 1000, locks: [{ x: 0, z: 0, yaw: -0.35, rand: 0.3 }], tiles: [[0, 0]] };
  }
  if (mode === "topdown") {
    const L = 21; // 4 x 4 loose grid per tile
    const locks: Lock[] = [];
    const cell = L / 4;
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const skip = rng() < 0.08;
        const x = (i + 0.5) * cell + (rng() - 0.5) * cell * 0.5 + (j % 2) * cell * 0.3;
        const z = (j + 0.5) * cell + (rng() - 0.5) * cell * 0.45;
        // roughly facing the camera (which looks from yaw -32 deg)
        const yaw = -0.5 + (rng() - 0.5) * 0.5;
        const rand = rng();
        if (!skip) locks.push({ x, z, yaw, rand });
      }
    }
    const tiles: [number, number][] = [];
    for (let tz = -3; tz <= 2; tz++) for (let tx = -3; tx <= 3; tx++) tiles.push([tx, tz]);
    return { L, locks, tiles };
  }
  // flyover: random field, clear lane for the camera at x = 0 (wrapped)
  const L = 16;
  const locks: Lock[] = [];
  let guard = 0;
  while (locks.length < 6 && guard++ < 5000) {
    const x = rng() * L;
    const z = rng() * L;
    // lane: the camera flies along x = 0 (== L): keep 1.3 units clear
    const lane = Math.min(Math.abs(x), Math.abs(L - x));
    if (lane < 2.2) continue;
    let ok = true;
    for (const o of locks) {
      for (const dx of [-L, 0, L]) {
        for (const dz of [-L, 0, L]) {
          if (Math.hypot(o.x + dx - x, o.z + dz - z) < 4.6) ok = false;
        }
      }
    }
    if (!ok) continue;
    locks.push({ x, z, yaw: (rng() - 0.5) * 0.5, rand: rng() });
  }
  const tiles: [number, number][] = [];
  for (let tz = -9; tz <= 1; tz++) for (let tx = -6; tx <= 5; tx++) tiles.push([tx, tz]);
  return { L, locks, tiles };
};

const makeFactory = (row: PadlockRow, mode: PadlockMode): LookFactory => (gl, w, h) => {
  const flyover = mode === "flyover";
  const topdown = mode === "topdown";
  const layout = makeLayout(row, mode);
  const { L, locks, tiles } = layout;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(flyover ? 42 : topdown ? 32 : 30, w / h, 0.1, flyover ? 260 : 200);

  // ------------------------------------------------------------ lights / env
  const pmrem = new THREE.PMREMGenerator(gl);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  // r16x+: scene.environment is scaled by scene.environmentIntensity
  scene.environmentIntensity = flyover ? 0.05 : 0.3;
  const lights: THREE.Light[] = [];
  if (flyover) {
    lights.push(new THREE.HemisphereLight(0x7ad0f0, 0x0a3048, 0.22));
    const key = new THREE.DirectionalLight(0x9adcff, 0.22);
    key.position.set(-3, 6, 8);
    const rim = new THREE.DirectionalLight(new THREE.Color(row.rim), 0.8);
    rim.position.set(2, 3, -10);
    lights.push(key, rim);
  } else {
    lights.push(new THREE.HemisphereLight(0xc8d8ff, new THREE.Color(row.ringGlow), 0.42));
    const key = new THREE.DirectionalLight(0xffd6cc, 0.5);
    key.position.set(-4, 10, 7);
    const rim = new THREE.DirectionalLight(new THREE.Color(row.rim), 2.4);
    rim.position.set(6, 3, -8);
    lights.push(key, rim);
  }
  for (const l of lights) {
    l.layers.enable(REFLECT_LAYER);
    scene.add(l);
  }

  // ------------------------------------------------------------ padlocks
  const { lock: lockGeo, insert: insertGeo } = buildPadlockGeometry(mode === "modelcheck" ? 2 : 1);
  const padCol = new THREE.Color(row.padlock);
  const padMat = new THREE.MeshPhysicalMaterial({
    color: padCol,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.14,
    sheen: 0.4,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(row.rim),
    envMapIntensity: 1,
    emissive: flyover ? padCol.clone().multiplyScalar(0.2) : new THREE.Color(0x000000),
  });
  const insertMat = new THREE.MeshStandardMaterial({
    color: padCol.clone().multiplyScalar(0.12),
    roughness: 0.8,
    envMapIntensity: 0.4,
  });
  const count = locks.length * tiles.length;
  const lockMesh = new THREE.InstancedMesh(lockGeo, padMat, count);
  const insertMesh = new THREE.InstancedMesh(insertGeo, insertMat, count);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const instPos: THREE.Vector3[] = [];
  let k = 0;
  for (const [tx, tz] of tiles) {
    for (const lk of locks) {
      const p = new THREE.Vector3(lk.x + tx * L, 0, lk.z + tz * L);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), lk.yaw);
      m4.compose(p, q, new THREE.Vector3(1, 1, 1));
      lockMesh.setMatrixAt(k, m4);
      insertMesh.setMatrixAt(k, m4);
      instPos.push(p);
      k++;
    }
  }
  for (const m of [lockMesh, insertMesh]) {
    m.frustumCulled = false;
    m.layers.enable(REFLECT_LAYER);
    m.instanceMatrix.needsUpdate = true;
    scene.add(m);
  }

  // ------------------------------------------------------------ rings
  const ringGeo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(2, 2);
  ringGeo.index = quad.index;
  ringGeo.setAttribute("position", quad.getAttribute("position"));
  const rOff = new Float32Array(count * 3);
  const rDat = new Float32Array(count * 4);
  k = 0;
  for (let t = 0; t < tiles.length; t++) {
    locks.forEach((lk, i) => {
      rOff.set([instPos[k].x, 0, instPos[k].z], k * 3);
      // direction alternates; extra arc on some
      rDat.set([i % 2 === 0 ? 1 : -1, lk.rand, lk.rand < 0.4 ? 1 : 0, lk.rand], k * 4);
      k++;
    });
  }
  ringGeo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(rOff, 3));
  ringGeo.setAttribute("aRing", new THREE.InstancedBufferAttribute(rDat, 4));
  ringGeo.instanceCount = count;
  const RING_EXTENT = 1.45;
  const ringMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      in vec3 aOffset;
      in vec4 aRing;
      out vec2 vP;
      flat out vec4 vRing;
      void main() {
        vP = position.xy * ${RING_EXTENT.toFixed(3)};
        vec3 wp = vec3(aOffset.x + vP.x, 0.012, aOffset.z - vP.y);
        vRing = aRing;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uPhase;
      uniform vec3 uRing;
      uniform vec3 uGlow;
      in vec2 vP;
      flat in vec4 vRing;
      out vec4 outColor;
      const float TAU = 6.2831853;
      uniform float uVary;
      float uBright(float w) { return mix(1.0, 0.35 + 1.4 * step(0.8, w), uVary); }
      float band(float x, float c, float hw, float aa) { return 1.0 - smoothstep(hw, hw + aa, abs(x - c)); }
      void main() {
        float r = length(vP);
        float aa = max(fwidth(r), 1e-4);
        float ang = atan(vP.y, vP.x) / TAU + 0.5; // 0..1
        float a = fract(ang + vRing.x * uPhase + vRing.y);
        // outer dashed circle (28 dashes)
        // two dash styles: long arcs with a few gaps, or a ring of dots
        bool dotted = vRing.w > 0.6;
        float nd = dotted ? 44.0 : 5.0;
        float duty = dotted ? 0.5 : 0.82;
        float dashCoord = fract(a * nd);
        float daa = max(fwidth(a * nd), 1e-4);
        float dash = smoothstep(0.0, daa, dashCoord) * (1.0 - smoothstep(duty - daa, duty, dashCoord));
        float outer = band(r, 0.98, dotted ? 0.026 : 0.02, aa) * dash;
        // inner thin solid ring
        float inner = band(r, 0.84, 0.012, aa) * (uVary > 0.5 ? 1.0 : 0.45);
        // fine tick ring just inside the dashes
        float ticks = band(r, 0.9, 0.012, aa) * step(0.5, fract(a * 72.0)) * uVary;
        // extra arc segment on some rings (rotates the other way)
        float a2 = fract(ang - vRing.x * uPhase + vRing.w);
        float arc = vRing.z * band(r, 1.14, 0.018, aa) * step(a2, 0.2);
        // soft glow on the floor
        float glow = exp(-pow((r - 0.93) / 0.14, 2.0)) * 0.55 + exp(-r * r * 1.6) * 0.06;
        float fade = (1.0 - smoothstep(1.25, 1.45, r)) * uBright(vRing.w);
        vec3 c = uRing * (outer * 1.15 + inner * 0.7 + ticks * 0.45 + arc * 0.9) + uGlow * glow * 0.35;
        outColor = vec4(c * fade, 1.0);
      }`,
    uniforms: {
      uPhase: { value: 0 },
      uRing: { value: new THREE.Color(row.ring) },
      uGlow: { value: new THREE.Color(row.ringGlow) },
      uVary: { value: flyover ? 1 : 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
  const rings = new THREE.Mesh(ringGeo, ringMat);
  rings.frustumCulled = false;
  rings.renderOrder = 2;
  scene.add(rings);

  // ------------------------------------------------------------ contact shadows
  const shadowGeo = new THREE.InstancedBufferGeometry();
  shadowGeo.index = quad.index;
  shadowGeo.setAttribute("position", quad.getAttribute("position"));
  shadowGeo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(rOff, 3));
  shadowGeo.instanceCount = count;
  const shadowMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      in vec3 aOffset;
      out vec2 vP;
      void main() {
        vP = position.xy * vec2(0.75, 0.45);
        gl_Position = projectionMatrix * viewMatrix * vec4(aOffset.x + vP.x, 0.006, aOffset.z - vP.y, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      in vec2 vP;
      out vec4 outColor;
      void main() {
        vec2 q = vP / vec2(0.62, 0.3);
        float a = exp(-dot(q, q) * 2.0) * 0.9;
        outColor = vec4(0.0, 0.0, 0.0, a);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const shadows = new THREE.Mesh(shadowGeo, shadowMat);
  shadows.frustumCulled = false;
  shadows.renderOrder = 1;
  scene.add(shadows);

  // ------------------------------------------------------------ network lines
  const lines: StripLine[] = [];
  const lrng = mulberry32(row.seed * 1000 + 55);
  if (mode !== "modelcheck") {
    const seen = new Set<string>();
    const baseLinks: [THREE.Vector3, THREE.Vector3, number][] = [];
    locks.forEach((a, i) => {
      const c: { j: number; dx: number; dz: number; d: number }[] = [];
      locks.forEach((b, j) => {
        for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
          if (j === i && dx === 0 && dz === 0) continue;
          c.push({ j, dx, dz, d: Math.hypot(b.x + dx * L - a.x, b.z + dz * L - a.z) });
        }
      });
      c.sort((p, r) => p.d - r.d || p.j - r.j || p.dx - r.dx || p.dz - r.dz);
      const n = 2 + (lrng() < 0.5 ? 1 : 0);
      for (let m = 0; m < n; m++) {
        const { j, dx, dz } = c[m];
        const key = i < j ? `${i},${j},${dx},${dz}` : `${j},${i},${-dx},${-dz}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const raised = lrng() < 0.3;
        const y = raised ? 0.35 + lrng() * 0.25 : 0.03;
        baseLinks.push([
          new THREE.Vector3(a.x, y, a.z),
          new THREE.Vector3(locks[j].x + dx * L, y, locks[j].z + dz * L),
          raised ? 1 : 0,
        ]);
      }
    });
    // a few long lines crossing the field (along the floor)
    const nLong = topdown ? 5 : 3;
    for (let i = 0; i < nLong; i++) {
      const a = locks[Math.floor(lrng() * locks.length)];
      const ang = lrng() * TAU;
      const len = L * (0.8 + lrng() * 0.6);
      baseLinks.push([
        new THREE.Vector3(a.x, 0.03, a.z),
        new THREE.Vector3(a.x + Math.cos(ang) * len, 0.03, a.z + Math.sin(ang) * len),
        0,
      ]);
    }
    const SEG = 10;
    for (const [tx, tz] of tiles) {
      for (const [a, b, raised] of baseLinks) {
        const off = new THREE.Vector3(tx * L, 0, tz * L);
        const pts: THREE.Vector3[] = [];
        for (let s = 0; s <= SEG; s++) pts.push(a.clone().lerp(b, s / SEG).add(off));
        const r = mulberry32(Math.floor(a.x * 1000 + b.z * 7919 + raised * 13))();
        lines.push({ points: pts, rand: [r, (r * 7.13) % 1, raised, (r * 3.71) % 1], width: 1 });
      }
    }
  }
  const lineStrip = {
    uRes: { value: new THREE.Vector2(w, h) },
    uHalfWidth: { value: flyover ? 0.035 : 0.035 },
    uMinPx: { value: Math.max(0.7, h / 1080) * 1.6 },
  };
  const lineUniforms = {
    ...lineStrip,
    uLine: { value: new THREE.Color(row.line).lerp(new THREE.Color(row.circuit), 0.35).multiplyScalar(flyover ? 0.6 : 1) },
    uPhase: { value: 0 },
    uSpark: { value: flyover ? 0.6 : 1.6 },
  };
  const lineGeo = lines.length ? buildStripGeometry(lines) : null;
  const lineMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: STRIP_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uLine;
      uniform float uPhase;
      uniform float uSpark;
      in float vS;
      in float vT;
      flat in float vLen;
      flat in vec4 vRand;
      in float vThin;
      out vec4 outColor;
      void main() {
        float s = abs(vS);
        float core = (1.0 - smoothstep(0.1, 0.32, s)) * vThin;
        float halo = exp(-s * s * 7.0) * 0.18;
        // sparkles: an integer number of trips per loop along each line
        float trips = 1.0 + floor(vRand.y * 3.0);
        float head = fract(vRand.x + trips * uPhase * (vRand.w < 0.5 ? 1.0 : -1.0));
        float d = abs(vT - head) * vLen;
        float spark = (exp(-d * d * 18.0) + exp(-pow((fract(vT * vLen / 3.0 + vRand.w) - 0.5) * 3.0, 2.0) * 60.0) * 0.5) * (1.0 - smoothstep(0.2, 0.9, s));
        float ends = smoothstep(0.0, 0.04, vT) * smoothstep(1.0, 0.96, vT);
        vec3 c = uLine * ((core * 0.45 + halo * 0.6) * (0.55 + 0.45 * vRand.z) + spark * uSpark);
        outColor = vec4(c * ends, 1.0);
      }`,
    uniforms: lineUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  if (lineGeo) {
    const lm = new THREE.Mesh(lineGeo, lineMat);
    lm.frustumCulled = false;
    lm.renderOrder = 3;
    scene.add(lm);
  }

  // ------------------------------------------------------------ reflection
  const rw = Math.max(2, Math.round(w / 2));
  const rh = Math.max(2, Math.round(h / 2));
  const reflRT = new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType });
  const reflBlur = [
    new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType, depthBuffer: false }),
    new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType, depthBuffer: false }),
  ];
  const blurMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tSrc;
      uniform vec2 uDir;
      in vec2 vUv;
      out vec4 outColor;
      void main() {
        vec3 c = texture(tSrc, vUv).rgb * 0.2270270270;
        c += texture(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
        c += texture(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
        c += texture(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
        c += texture(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
        outColor = vec4(c, 1.0);
      }`,
    uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
    depthTest: false,
    depthWrite: false,
  });
  const blurScene = new THREE.Scene();
  const blurQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat);
  blurQuad.frustumCulled = false;
  blurScene.add(blurQuad);
  const blurCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const virtualCam = new THREE.PerspectiveCamera();
  virtualCam.layers.set(REFLECT_LAYER);
  const texMat = new THREE.Matrix4();

  // ------------------------------------------------------------ floor
  const floorTex = drawFloorTexture(row.seed, mode);
  const streakTrips = flyover ? 3 : 2;
  const floorMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      uniform mat4 uTexMat;
      out vec3 vW;
      out vec4 vR;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vR = uTexMat * wp;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tFloor;
      uniform sampler2D tRefl;
      uniform vec3 uFloor;
      uniform vec3 uGrid;
      uniform vec3 uCircuit;
      uniform vec3 uStreak;
      uniform float uPhase;
      uniform float uL;
      uniform float uRefl;
      uniform float uStreakX;
      uniform float uStreakZ;
      uniform float uDots;
      uniform vec3 uCam;
      in vec3 vW;
      in vec4 vR;
      out vec4 outColor;
      float hash(float n) { return fract(sin(n * 91.345 + 47.1) * 47453.5453); }
      float streak(float across, float along, float dir) {
        // nearest integer grid line
        float n = floor(across + 0.5);
        float dl = abs(across - n);
        float idx = mod(n, uL);
        float h = hash(idx + dir * 31.0);
        if (h > 0.2) return 0.0;
        float trips = ${streakTrips.toFixed(1)} + floor(hash(idx * 3.7 + dir) * 3.0);
        float s = fract(along / uL * 2.0 + h * 9.0 + dir * trips * uPhase * 2.0);
        float dash = smoothstep(0.0, 0.01, s) * exp(-s / 0.12);
        float aa = fwidth(across) * 1.5;
        return dash * (1.0 - smoothstep(0.012, 0.012 + aa, dl));
      }
      void main() {
        vec2 uv = vW.xz / ${FLOOR_TEX_PERIOD.toFixed(1)};
        vec3 t = texture(tFloor, uv).rgb;
        vec3 c = uFloor;
        c += uGrid * (t.r * 0.9);
        c += uGrid * t.g * uDots;
        c += uCircuit * t.b * 0.45;
        // streaks racing along grid lines
        float st = 0.0;
        if (uStreakZ > 0.5) st += streak(vW.x, vW.z, 1.0);
        if (uStreakX > 0.5) st += streak(vW.z, -vW.x, -1.0);
        c += uStreak * st * (uStreakX > 0.5 ? 1.2 : 2.6);
        // glossy reflection
        vec3 v = normalize(uCam - vW);
        float fres = 0.25 + 0.75 * pow(clamp(1.0 - v.y, 0.0, 1.0), 3.0);
        vec3 r = texture(tRefl, vR.xy / vR.w).rgb;
        c += r * uRefl * fres;
        outColor = vec4(c, 1.0);
      }`,
    uniforms: {
      tFloor: { value: floorTex },
      tRefl: { value: reflBlur[1].texture },
      uTexMat: { value: texMat },
      uFloor: { value: new THREE.Color(row.floor).multiplyScalar(flyover ? 0.9 : 0.75) },
      uGrid: { value: new THREE.Color(row.grid).multiplyScalar(flyover ? 0.55 : 0.45) },
      uCircuit: { value: new THREE.Color(row.circuit).multiplyScalar(flyover ? 0.9 : 0.3) },
      uStreak: { value: new THREE.Color(flyover ? row.ring : row.circuit) },
      uPhase: { value: 0 },
      uL: { value: L },
      uRefl: { value: flyover ? 0.65 : 1.2 },
      uStreakX: { value: topdown ? 1 : 0 },
      uStreakZ: { value: 1 },
      uDots: { value: flyover ? 0.55 : 0.6 },
      uCam: { value: new THREE.Vector3() },
    },
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.frustumCulled = false;
  floor.renderOrder = 0;
  scene.add(floor);

  // ------------------------------------------------------------ post
  const post = new PostPipeline(gl, w, h, {
    exposure: flyover ? 1.0 : 1.0,
    bloomStrength: flyover ? 0.7 : 0.7,
    bloomThreshold: flyover ? 0.85 : 0.9,
    bloomRadius: 0.65,
    vignette: flyover ? 0.4 : 0.45,
    grain: 0.015,
    loopFrames: LOOP_FRAMES,
    samples: 4,
    clearColor: new THREE.Color(flyover ? row.fogTop : row.floor),
    fog: flyover
      ? {
          near: 5,
          far: 85,
          density: 2.2,
          colorTop: new THREE.Color(row.fogTop),
          colorBottom: new THREE.Color(row.fogBottom).multiplyScalar(1.25),
          horizon: 0.55,
        }
      : null,
    dof: flyover
      ? { focus: 11, range: 3, ramp: 7, nearMax: 0.013, farMax: 0.006 }
      : topdown
        ? { focus: 14.5, range: 1.3, ramp: 5, nearMax: 0.021, farMax: 0.021 }
        : { focus: 4.6, range: 1.5, ramp: 4, nearMax: 0.004, farMax: 0.006 },
  });

  // ------------------------------------------------------------ camera rig
  const target = new THREE.Vector3();
  const reflectorNormal = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3();
  const lookAtPos = new THREE.Vector3();
  const rotM = new THREE.Matrix4();
  const placeCamera = (ph: number) => {
    if (topdown) {
      // look down ~55 deg at a yawed floor, drift diagonally (one tile per loop)
      target.set(L * ph + 3, 0, 4 + 0.6 * Math.sin(TAU * ph));
      const dist = 14.5;
      const pitch = THREE.MathUtils.degToRad(50);
      const yaw = THREE.MathUtils.degToRad(-32);
      camera.position.set(
        target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist,
        target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
      );
      camera.up.set(Math.sin(THREE.MathUtils.degToRad(8)), 1, 0).normalize();
      camera.lookAt(target);
    } else if (flyover) {
      const z = -L * ph;
      camera.position.set(0.25 * Math.sin(TAU * ph), 0.7 + 0.05 * Math.sin(TAU * 2 * ph), z + 6);
      target.set(0.4 * Math.sin(TAU * ph + 0.8), 0.7 - 0.6, z + 6 - 100);
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
    } else {
      camera.position.set(1.7, 1.55, 4.1);
      target.set(0, 0.62, 0);
      camera.lookAt(target);
    }
    camera.updateMatrixWorld();
  };

  const renderReflection = () => {
    // mirror the camera in the floor plane (y = 0), as three's Reflector does
    tmp.setFromMatrixPosition(camera.matrixWorld);
    const view = new THREE.Vector3(0, 0, 0).sub(tmp).reflect(reflectorNormal).negate();
    rotM.extractRotation(camera.matrixWorld);
    lookAtPos.set(0, 0, -1).applyMatrix4(rotM).add(tmp);
    const tgt = new THREE.Vector3(0, 0, 0).sub(lookAtPos).reflect(reflectorNormal).negate();
    virtualCam.position.copy(view);
    virtualCam.up.set(0, 1, 0).applyMatrix4(rotM).reflect(reflectorNormal);
    virtualCam.lookAt(tgt);
    virtualCam.far = camera.far;
    virtualCam.near = camera.near;
    virtualCam.updateMatrixWorld();
    virtualCam.projectionMatrix.copy(camera.projectionMatrix);
    texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    texMat.multiply(virtualCam.projectionMatrix).multiply(virtualCam.matrixWorldInverse);

    gl.setRenderTarget(reflRT);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, true);
    gl.render(scene, virtualCam);
    // two separable blur passes
    let src: THREE.Texture = reflRT.texture;
    for (let i = 0; i < 1; i++) {
      blurMat.uniforms.tSrc.value = src;
      blurMat.uniforms.uDir.value.set(1.6 / rw, 0);
      gl.setRenderTarget(reflBlur[0]);
      gl.render(blurScene, blurCam);
      blurMat.uniforms.tSrc.value = reflBlur[0].texture;
      blurMat.uniforms.uDir.value.set(0, 1.6 / rh);
      gl.setRenderTarget(reflBlur[1]);
      gl.render(blurScene, blurCam);
      src = reflBlur[1].texture;
    }
  };

  return {
    render: (frame) => {
      const f = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
      const ph = f / LOOP_FRAMES;
      ringMat.uniforms.uPhase.value = ph;
      lineUniforms.uPhase.value = ph;
      floorMat.uniforms.uPhase.value = ph;
      placeCamera(ph);
      floorMat.uniforms.uCam.value.copy(camera.position);
      renderReflection();
      post.render(scene, camera, frame);
    },
    dispose: () => {
      post.dispose();
      envRT.dispose();
      pmrem.dispose();
      lockGeo.dispose();
      insertGeo.dispose();
      padMat.dispose();
      insertMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      lineGeo?.dispose();
      lineMat.dispose();
      reflRT.dispose();
      reflBlur.forEach((t) => t.dispose());
      blurMat.dispose();
      floorTex.dispose();
      floorMat.dispose();
    },
  };
};

export const PadlockField: React.FC<{ row: PadlockRow; mode?: PadlockMode }> = ({ row, mode }) => {
  const m = mode ?? row.shot;
  const factory = useMemo(() => makeFactory(row, m), [row, m]);
  return <ThreeLook factory={factory} />;
};
