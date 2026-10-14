// Look 2 — AI Brain Chat. A folded glass brain on a glowing chip, ~120
// right-angled neon traces with outward pulses, ~40 glass cubes, and four
// speech bubbles per loop (three dots) that pop in, rise and fade.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { makeSimplex3 } from "../lib/noise";
import { LOOP, TAU, mulberry32, range, osc, fract, easeOutBack, smoothstep, clamp01 } from "../lib/rng";
import { makeBackground, makeScreenLines, makeScreenPoints } from "../lib/lines";
import type { BuildCtx, LookHandle } from "../lib/types";

export type BrainParams = {
  bg: string;
  brain: string;
  brainRim: string;
  brainFold: string;
  traceColors: string[];
  chipRimA: string;
  chipRimB: string;
  cube: string;
  bubble: string;
  exposure: number;
};

const SEED = 0xb8a1;
const simplex = makeSimplex3(SEED);
const CHIP = 1.65; // chip half-size

// ---- brain hemisphere geometry (built once) -------------------------------
function hemisphere(side: number) {
  const g = new THREE.SphereGeometry(1, 320, 220);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const sulciArr = new Float32Array(pos.count);
  const v = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    p.set(v.x * 0.82, v.y * 0.74, v.z * 1.3);
    // medial face flattened
    if (v.x * side < 0) p.x *= 0.22;
    // flatter underside
    if (v.y < -0.15) p.y = -0.15 * 0.8 + (v.y + 0.15) * 0.8 * 0.5;
    // temporal lobe: lower, lateral, front-middle bulge
    const tl = Math.exp(-((v.y + 0.45) ** 2) / 0.05 - ((v.z - 0.15) ** 2) / 0.25) * Math.max(0, v.x * side);
    p.x += side * tl * 0.12;
    p.y -= tl * 0.08;
    // frontal lobe slightly narrower, occipital rounder
    p.x *= 1 - 0.1 * Math.max(0, v.z);
    p.y *= 1 + 0.06 * Math.max(0, -v.z);
    // gyri / sulci: iso-lines of noise become winding grooves
    const q = p.clone().multiplyScalar(1.75).add(new THREE.Vector3(side * 3.1, 0, 0));
    // domain warp stretches the noise iso-lines into long winding gyri
    const wx = simplex(q.x * 0.55 + 11, q.y * 0.55, q.z * 0.55);
    const wy = simplex(q.x * 0.55, q.y * 0.55 + 23, q.z * 0.55);
    const wz = simplex(q.x * 0.55, q.y * 0.55, q.z * 0.55 + 37);
    const n = simplex(q.x + 0.75 * wx, q.y + 0.75 * wy, q.z + 0.75 * wz) + 0.22 * simplex(q.x * 2.2, q.y * 2.2 + 5, q.z * 2.2);
    const sulci = 1 - smoothstep(0.0, 0.085, Math.abs(n));
    const medial = v.x * side < -0.2 ? 0.3 : 1;
    const disp = (-0.1 * sulci + 0.035 * smoothstep(0.08, 0.5, Math.abs(n)) + 0.008 * simplex(q.x * 6, q.y * 6, q.z * 6)) * medial;
    const nrm = p.clone().normalize();
    p.addScaledVector(nrm, disp);
    p.x += side * 0.2;
    pos.setXYZ(i, p.x, p.y, p.z);
    sulciArr[i] = sulci * medial;
  }
  g.setAttribute("aSulci", new THREE.BufferAttribute(sulciArr, 1));
  g.computeVertexNormals();
  return g;
}
const HEMIS = [hemisphere(-1), hemisphere(1)];

// ---- traces (built once) ---------------------------------------------------
type Trace = { pts: [number, number][]; color: number; period: number; phase: number; len: number };
function buildTraces(): Trace[] {
  const rnd = mulberry32(SEED + 7);
  const out: Trace[] = [];
  const per = 30;
  const periods = [60, 75, 100, 120, 150, 200];
  for (let side = 0; side < 4; side++) {
    const ang = (side * Math.PI) / 2;
    const ux = Math.cos(ang), uz = Math.sin(ang); // outward
    const vx = -uz, vz = ux; // lateral
    const spread = range(rnd, 2.4, 3.2);
    for (let j = 0; j < per; j++) {
      const o = -1 + (2 * (j + 0.5)) / per;
      const v0 = o * CHIP * 0.86;
      const l1 = 0.22 + 1.5 * (1 - Math.abs(o)) + 0.06 * rnd();
      const v1 = v0 + o * Math.abs(o) * spread;
      const l3 = l1 + range(rnd, 1.5, 9);
      const P = (u: number, vv: number): [number, number] => [ux * u + vx * vv, uz * u + vz * vv];
      const pts = [P(CHIP + 0.02, v0), P(CHIP + l1, v0), P(CHIP + l1, v1), P(CHIP + l3, v1)];
      let len = 0;
      for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      const cr = rnd();
      out.push({ pts, color: cr < 0.45 ? 0 : cr < 0.65 ? 3 : cr < 0.85 ? 1 : 2, period: periods[Math.floor(rnd() * periods.length)], phase: rnd(), len });
    }
  }
  return out;
}
const TRACES = buildTraces();

function speechBubbleGeometry(tailRight: boolean) {
  const w = 1.5, h = 0.74, r = 0.37;
  const s = new THREE.Shape();
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  s.moveTo(x0 + r, y0);
  if (!tailRight) {
    s.lineTo(x0 + 0.42, y0);
    s.lineTo(x0 + 0.18, y0 - 0.3);
    s.lineTo(x0 + 0.68, y0);
  }
  if (tailRight) {
    s.lineTo(x1 - 0.68, y0);
    s.lineTo(x1 - 0.18, y0 - 0.3);
    s.lineTo(x1 - 0.42, y0);
  }
  s.lineTo(x1 - r, y0);
  s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r);
  s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y1);
  s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, Math.PI, (3 * Math.PI) / 2, false);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 6,
    curveSegments: 28,
  });
  g.translate(0, 0, -0.08);
  return g;
}

export function buildBrain(ctx: BuildCtx, p: BrainParams): LookHandle {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, ctx.width / ctx.height, 0.3, 200);
  const bg = new THREE.Color(p.bg);
  const traceCols = p.traceColors.map((c) => new THREE.Color(c));
  const FOG: [number, number] = [9, 34];

  scene.add(
    makeBackground(
      `in vec2 vUv; uniform vec3 uBg; void main(){ vec3 haze = vec3(0.02, 0.06, 0.16) * (1.0 - smoothstep(0.3, 1.0, vUv.y)); gl_FragColor = vec4(uBg + haze, 1.0); }`,
      { uBg: { value: bg } },
    ),
  );

  // environment for glossy reflections (coloured panels)
  const envScene = new THREE.Scene();
  envScene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(10, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec3 vD;
          void main(){
            vec3 c = vec3(0.01, 0.02, 0.05);
            c += vec3(0.25, 0.8, 1.6) * pow(max(dot(vD, normalize(vec3(-0.6, 0.7, 0.4))), 0.0), 12.0) * 3.0;
            c += vec3(1.4, 0.3, 1.0) * pow(max(dot(vD, normalize(vec3(0.8, 0.3, -0.5))), 0.0), 10.0) * 1.5;
            c += vec3(0.2, 0.6, 1.2) * smoothstep(-0.1, -0.6, vD.y) * 0.25;
            c += vec3(0.6, 0.8, 1.0) * pow(max(vD.y, 0.0), 4.0) * 0.6;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    ),
  );
  const pmrem = new THREE.PMREMGenerator(ctx.gl);
  const envTex = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();
  scene.environment = envTex;

  // ---- board -----------------------------------------------------------------
  const boardMat = new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color("#061430") },
      uBg: { value: bg },
      uGlowA: { value: new THREE.Color(p.chipRimA) },
      uGlowB: { value: new THREE.Color(traceCols[0]) },
      uFog: { value: new THREE.Vector2(...FOG) },
    },
    vertexShader: `out vec3 vW; out float vDepth; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix*w; vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase, uBg, uGlowA, uGlowB; uniform vec2 uFog;
      in vec3 vW; in float vDepth;
      void main(){
        vec2 q = vW.xz;
        // faint dot grid, filtered by footprint so it never aliases
        vec2 g = fract(q / 0.35) - 0.5;
        float fw = fwidth(q.x / 0.35);
        float dots = (1.0 - smoothstep(0.06, 0.06 + fw * 1.5, length(g))) * (1.0 - smoothstep(0.12, 0.35, fw));
        float r = max(abs(q.x), abs(q.y));
        vec3 c = uBase + uBase * dots * 2.5;
        c += uGlowB * 0.3 * exp(-max(r - ${CHIP.toFixed(2)}, 0.0) / 0.9);
        c += vec3(0.015, 0.05, 0.14) * exp(-length(q) / 7.0);
        c += uGlowA * 0.10 * exp(-max(r - ${CHIP.toFixed(2)}, 0.0) / 1.4);
        float fog = smoothstep(uFog.x, uFog.y, vDepth);
        gl_FragColor = vec4(mix(c, uBg, fog), 1.0);
      }`,
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), boardMat);
  board.rotation.x = -Math.PI / 2;
  scene.add(board);

  // ---- traces (flat emissive strips) ----------------------------------------
  const tpos: number[] = [], ts: number[] = [], tp: number[] = [], tidx: number[] = [];
  const W = 0.018;
  let vi = 0;
  TRACES.forEach((tr) => {
    let s = 0;
    for (let k = 1; k < tr.pts.length; k++) {
      const [ax, az] = tr.pts[k - 1];
      const [bx, bz] = tr.pts[k];
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      const nx = -dz * W, nz = dx * W;
      // extend by half-width so right-angle corners join cleanly
      const ex = dx * W, ez = dz * W;
      const y = 0.004;
      tpos.push(ax - ex + nx, y, az - ez + nz, ax - ex - nx, y, az - ez - nz, bx + ex + nx, y, bz + ez + nz, bx + ex - nx, y, bz + ez - nz);
      ts.push(s, s, s + len, s + len);
      for (let q = 0; q < 4; q++) tp.push(tr.len, tr.period, tr.phase, tr.color);
      tidx.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3);
      vi += 4;
      s += len;
    }
  });
  const tgeo = new THREE.BufferGeometry();
  tgeo.setAttribute("position", new THREE.Float32BufferAttribute(tpos, 3));
  tgeo.setAttribute("aS", new THREE.Float32BufferAttribute(ts, 1));
  tgeo.setAttribute("aT", new THREE.Float32BufferAttribute(tp, 4));
  tgeo.setIndex(tidx);
  const uFrame = { value: 0 };
  const traceMat = new THREE.ShaderMaterial({
    uniforms: {
      uCols: { value: traceCols },
      uFrame,
      uBg: { value: bg },
      uFog: { value: new THREE.Vector2(...FOG) },
    },
    vertexShader: `in float aS; in vec4 aT; out float vS; out vec4 vT; out float vDepth;
      void main(){ vS = aS; vT = aT; vec4 mv = modelViewMatrix*vec4(position,1.0); vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCols[4]; uniform float uFrame; uniform vec3 uBg; uniform vec2 uFog;
      in float vS; in vec4 vT; in float vDepth;
      void main(){
        vec3 col = uCols[int(vT.w + 0.5)];
        float L = vT.x;
        // pulse travels outward; whole cycles per 600 frames (period divides 600)
        float head = fract(uFrame / vT.y + vT.z) * (L + 3.0) - 1.0;
        float d = head - vS;
        float pulse = d >= 0.0 ? exp(-d / 0.55) : exp(d / 0.05);
        float fade = 1.0 - smoothstep(L - 1.5, L, vS) * 0.6;
        vec3 c = col * (0.5 * fade + 5.0 * pulse);
        float fog = smoothstep(uFog.x, uFog.y, vDepth);
        gl_FragColor = vec4(c * (1.0 - fog), 1.0);
      }`,
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  scene.add(new THREE.Mesh(tgeo, traceMat));

  // end pads
  const pads = new Float32Array(TRACES.length * 3);
  const padP = new Float32Array(TRACES.length * 4);
  TRACES.forEach((tr, i) => {
    const [x, z] = tr.pts[tr.pts.length - 1];
    pads.set([x, 0.01, z], i * 3);
    padP[i * 4] = tr.color;
  });
  scene.add(
    makeScreenPoints(pads, {
      color: "#ffffff",
      sizePx: 4.5,
      pxScale: ctx.pxScale,
      params: padP,
      softness: 0.3,
      uniforms: { uCols: { value: traceCols } },
      decl: "uniform vec3 uCols[4];",
      body: "col.rgb = uCols[int(P.x + 0.5)] * 2.0;",
    }),
  );

  // far bokeh specks (defocused by the DoF)
  const brnd = mulberry32(SEED + 11);
  const NB = 260;
  const bpos = new Float32Array(NB * 3);
  const bpar = new Float32Array(NB * 4);
  const bsz = new Float32Array(NB);
  for (let i = 0; i < NB; i++) {
    const a = brnd() * TAU, r = range(brnd, 11, 34);
    bpos.set([Math.cos(a) * r, 0.02, Math.sin(a) * r - 6], i * 3);
    bpar[i * 4] = Math.floor(brnd() * 4);
    bpar[i * 4 + 1] = range(brnd, 0.2, 1);
    bsz[i] = range(brnd, 0.7, 1.6);
  }
  scene.add(
    makeScreenPoints(bpos, {
      color: "#ffffff",
      sizePx: 5,
      pxScale: ctx.pxScale,
      sizes: bsz,
      params: bpar,
      softness: 0.2,
      uniforms: { uCols: { value: traceCols } },
      decl: "uniform vec3 uCols[4];",
      body: "col.rgb = mix(uCols[int(P.x + 0.5)], vec3(0.4, 0.6, 1.0), 0.5) * P.y * 1.2;",
    }),
  );

  // ---- chip ----------------------------------------------------------------
  const chip = new THREE.Group();
  scene.add(chip);
  const chipBase = new THREE.Mesh(
    new RoundedBoxGeometry(CHIP * 2, 0.26, CHIP * 2, 3, 0.05),
    new THREE.MeshPhysicalMaterial({ color: "#0a1226", metalness: 0.7, roughness: 0.3, clearcoat: 0.6 }),
  );
  chipBase.position.y = 0.13;
  chip.add(chipBase);
  const chipTop = new THREE.Mesh(
    new RoundedBoxGeometry(CHIP * 1.62, 0.1, CHIP * 1.62, 3, 0.03),
    new THREE.MeshPhysicalMaterial({ color: "#0e1a3a", metalness: 0.5, roughness: 0.25, emissive: new THREE.Color("#0a2a6a"), emissiveIntensity: 0.6 }),
  );
  chipTop.position.y = 0.3;
  chip.add(chipTop);
  const frame = (half: number, y: number, t: number, color: THREE.Color) => {
    const m = new THREE.MeshBasicMaterial({ color });
    const g1 = new THREE.BoxGeometry(half * 2 + t, t, t);
    const g2 = new THREE.BoxGeometry(t, t, half * 2 + t);
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(g1, m);
      a.position.set(0, y, s * half);
      chip.add(a);
      const b = new THREE.Mesh(g2, m);
      b.position.set(s * half, y, 0);
      chip.add(b);
    }
  };
  frame(CHIP + 0.01, 0.255, 0.035, new THREE.Color(p.chipRimA).multiplyScalar(5));
  frame(CHIP * 0.81 + 0.01, 0.36, 0.03, new THREE.Color(p.chipRimB).multiplyScalar(4));
  frame(CHIP + 0.02, 0.015, 0.03, new THREE.Color(traceCols[0]).multiplyScalar(3));

  // ---- brain -------------------------------------------------------------------
  const brain = new THREE.Group();
  brain.position.set(0, 0.36 + 0.62, 0);
  scene.add(brain);
  const brainMat = new THREE.MeshPhysicalMaterial({
    color: p.brain,
    transmission: 0.45,
    thickness: 1.2,
    roughness: 0.3,
    ior: 1.4,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: new THREE.Color(p.brain).multiplyScalar(0.25),
    attenuationColor: new THREE.Color(p.brain),
    attenuationDistance: 2.5,
    envMapIntensity: 1.2,
  });
  const rimCol = new THREE.Color(p.brainRim);
  const foldCol = new THREE.Color(p.brainFold);
  brainMat.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rimCol };
    sh.uniforms.uFold = { value: foldCol };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSulci;\nvarying float vSulci;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSulci = aSulci;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRim; uniform vec3 uFold; varying float vSulci;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float bNdV = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += uRim * (pow(1.0 - bNdV, 2.5) * 1.4) + uFold * pow(vSulci, 2.0) * 2.6;`,
      );
  };
  brainMat.customProgramCacheKey = () => "brain-glass";
  for (const g of HEMIS) brain.add(new THREE.Mesh(g, brainMat));
  brain.scale.setScalar(1.12);

  // surface sparkles
  const srnd = mulberry32(SEED + 21);
  const NS = 1100;
  const spos = new Float32Array(NS * 3), spar = new Float32Array(NS * 4), ssz = new Float32Array(NS);
  const cycles = [2, 3, 4, 5, 6];
  for (let i = 0; i < NS; i++) {
    const g = HEMIS[i % 2];
    const pa = g.attributes.position as THREE.BufferAttribute;
    const na = g.attributes.normal as THREE.BufferAttribute;
    const k = Math.floor(srnd() * pa.count);
    spos.set([pa.getX(k) + na.getX(k) * 0.012, pa.getY(k) + na.getY(k) * 0.012, pa.getZ(k) + na.getZ(k) * 0.012], i * 3);
    spar[i * 4] = cycles[Math.floor(srnd() * cycles.length)];
    spar[i * 4 + 1] = srnd();
    ssz[i] = range(srnd, 0.6, 1.4);
  }
  const sparkles = makeScreenPoints(spos, {
    color: "#cfefff",
    sizePx: 2.6,
    pxScale: ctx.pxScale,
    sizes: ssz,
    params: spar,
    softness: 0.5,
    uniforms: { uT: { value: 0 } },
    decl: "uniform float uT;",
    body: "float tw = 0.5 + 0.5 * sin(6.2831853 * (uT * P.x + P.y)); col.rgb = base * (0.35 + 2.4 * tw * tw * tw);",
  });
  brain.add(sparkles);

  // ---- cubes ------------------------------------------------------------------
  const crnd = mulberry32(SEED + 31);
  const cubeMatGlass = new THREE.MeshPhysicalMaterial({
    color: p.cube,
    transmission: 0.9,
    thickness: 0.4,
    roughness: 0.04,
    ior: 1.45,
    clearcoat: 1,
    envMapIntensity: 0.5,
    attenuationColor: new THREE.Color(p.cube),
    attenuationDistance: 0.6,
    emissive: new THREE.Color(p.cube).multiplyScalar(0.02),
  });
  const cubeMatGlow = cubeMatGlass.clone();
  cubeMatGlow.emissive = new THREE.Color(p.cube).multiplyScalar(0.3);
  const cubeSegs: number[] = [];
  const placed: [number, number, number][] = [];
  for (let i = 0; i < 40; i++) {
    let x = 0, z = 0, s = 0.3;
    for (let tries = 0; tries < 100; tries++) {
      const a = crnd() * TAU;
      const r = range(crnd, CHIP * 1.8, 7.0);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r - 1.5;
      s = range(crnd, 0.2, 0.48);
      if (placed.every(([px, pz, ps]) => Math.hypot(px - x, pz - z) > (ps + s) * 1.2)) break;
    }
    placed.push([x, z, s]);
    const glow = crnd() < 0.35;
    const m = new THREE.Mesh(new RoundedBoxGeometry(s, s, s, 2, s * 0.06), glow ? cubeMatGlow : cubeMatGlass);
    m.position.set(x, s / 2, z);
    m.rotation.y = crnd() * Math.PI;
    m.updateMatrixWorld();
    scene.add(m);
    const eg = new THREE.EdgesGeometry(new THREE.BoxGeometry(s * 1.002, s * 1.002, s * 1.002));
    const ea = eg.attributes.position.array as Float32Array;
    const v = new THREE.Vector3();
    for (let k = 0; k < ea.length; k += 3) {
      v.set(ea[k], ea[k + 1], ea[k + 2]).applyMatrix4(m.matrixWorld);
      cubeSegs.push(v.x, v.y, v.z);
    }
  }
  scene.add(
    makeScreenLines(new Float32Array(cubeSegs), {
      color: p.cube,
      intensity: 2.4,
      opacity: 0.9,
      widthPx: 1.1,
      pxScale: ctx.pxScale,
      resolution: ctx.resolution,
      fog: FOG,
    }),
  );

  // ---- lights -------------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(new THREE.Color("#4a7aff"), new THREE.Color("#050a18"), 0.5));
  const key = new THREE.DirectionalLight(new THREE.Color("#bfe0ff"), 1.4);
  key.position.set(-5, 8, 6);
  scene.add(key);
  const rimL = new THREE.DirectionalLight(new THREE.Color("#a050ff"), 1.4);
  rimL.position.set(4, 3, -7);
  scene.add(rimL);
  const inner = new THREE.PointLight(new THREE.Color("#3ae8ff"), 6, 7, 2);
  inner.position.set(0, 0.9, 0);
  scene.add(inner);

  // ---- bubbles ----------------------------------------------------------------
  type Bubble = { group: THREE.Group; body: THREE.MeshPhysicalMaterial; dots: THREE.MeshBasicMaterial[]; spawn: number; start: THREE.Vector3; rise: THREE.Vector3 };
  const bubbles: Bubble[] = [];
  const bubbleGeos = [speechBubbleGeometry(false), speechBubbleGeometry(true)];
  const dotGeo = new THREE.SphereGeometry(0.075, 20, 12);
  for (let k = 0; k < 4; k++) {
    const group = new THREE.Group();
    const body = new THREE.MeshPhysicalMaterial({
      color: p.bubble,
      roughness: 0.2,
      metalness: 0.0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      emissive: new THREE.Color(p.bubble).multiplyScalar(0.55),
      transparent: true,
      envMapIntensity: 1.5,
    });
    group.add(new THREE.Mesh(bubbleGeos[k % 2], body));
    const dots: THREE.MeshBasicMaterial[] = [];
    for (let d = 0; d < 3; d++) {
      const dm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), transparent: true });
      const dot = new THREE.Mesh(dotGeo, dm);
      dot.position.set((d - 1) * 0.3, 0.02, 0.16);
      dot.scale.set(1, 1, 0.45);
      group.add(dot);
      dots.push(dm);
    }
    scene.add(group);
    const side = k % 2 === 0 ? 1 : -1;
    bubbles.push({
      group,
      body,
      dots,
      spawn: k * 150 + 10,
      start: new THREE.Vector3(side > 0 ? 1.85 : -1.7, 1.45, side > 0 ? 0.3 : 0.1),
      rise: new THREE.Vector3(side > 0 ? 0.3 : -0.25, 1.25, -0.3),
    });
  }

  const target = new THREE.Vector3(0, 1.05, 0);
  const post = {
    exposure: p.exposure,
    bloomStrength: 0.55,
    bloomThreshold: 0.85,
    bloomKnee: 0.6,
    bloomRadius: 0.85,
    dof: { focus: 10, aperture: 0.03, maxCoc: 0.014, nearScale: 1.0 },
    vignette: 0.35,
    grain: 0.015,
    grainFadeLum: 0,
  };
  const LIFE = 165;

  const update = (f: number) => {
    const t = f / LOOP;
    uFrame.value = f;
    (sparkles.material as THREE.ShaderMaterial).uniforms.uT.value = t;

    // camera ~30° down, closed orbit ±8°
    const yaw = THREE.MathUtils.degToRad(-10 + 8 * osc(f, 1));
    const elev = THREE.MathUtils.degToRad(28);
    const dist = 8.8;
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(elev) * dist,
      target.y + Math.sin(elev) * dist,
      target.z + Math.cos(yaw) * Math.cos(elev) * dist,
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    post.dof.focus = camera.position.distanceTo(brain.position);

    // brain turns slowly ±10° (cosine)
    brain.rotation.y = THREE.MathUtils.degToRad(-78 + 10 * Math.cos(TAU * t));

    for (const b of bubbles) {
      const age = (((f - b.spawn) % LOOP) + LOOP) % LOOP;
      const alive = age < LIFE;
      b.group.visible = alive;
      if (!alive) continue;
      const pop = easeOutBack(clamp01(age / 16), 2.2);
      const k = age / LIFE;
      const riseE = 1 - Math.pow(1 - k, 1.7);
      b.group.position.copy(b.start).addScaledVector(b.rise, riseE);
      b.group.quaternion.copy(camera.quaternion);
      b.group.scale.setScalar(Math.max(0.0001, pop) * 1.0);
      const op = clamp01(age / 5) * (1 - smoothstep(LIFE * 0.62, LIFE, age));
      b.body.opacity = op;
      b.dots.forEach((dm, i) => {
        // dots pulse in sequence: 15 cycles per loop (40-frame period)
        const ph = fract(f / 40 - i * 0.2);
        const bump = Math.exp(-(((ph - 0.2) / 0.1) ** 2));
        dm.color.setScalar(1.3 + 3.0 * bump);
        dm.opacity = op;
      });
    }
  };

  return { scene, camera, post, update };
}
