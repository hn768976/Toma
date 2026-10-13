import * as THREE from "three";
import { createBokeh, type BokehLight } from "../engine/bokeh";
import { NOISE } from "../engine/glsl";
import type { Look, LookFactory } from "../engine/LoopCanvas";
import { cyc } from "../engine/loop";
import { shaderMat } from "../engine/material";
import { COC_GLSL, PERIODIC_GLSL, periodicUniforms } from "../engine/periodic";
import { Post } from "../engine/post";
import { mulberry32, range } from "../engine/rng";

export interface CircuitHorizonParams {
  board: string;
  light: string;
  horizon: string;
}

// ---------------------------------------------------------------------------
// Periodic layout: one tile P long (z) is repeated K times. Camera at the origin
// looking down -z; the board slides +z by exactly P per loop.
// ---------------------------------------------------------------------------
const P = 10;
const K = 4;
const WRAP = P * K;
const BEHIND = 2.5;
const HALF_X = 19;
const CAM_Y = 0.36;

interface Comp {
  kind: 0 | 1 | 2; // 0 chip, 1 small part, 2 capacitor (cylinder)
  x: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  tint: number; // 0 dark .. 1 silver top
}
const COMPS: Comp[] = [];
const LIGHTS: BokehLight[] = [];
{
  const rng = mulberry32(0xc1c0174);
  const tile: Comp[] = [];
  // Occupancy grid to keep parts from overlapping.
  const CELL = 0.05;
  const gw = Math.ceil((HALF_X * 2) / CELL);
  const gh = Math.ceil(P / CELL);
  const occ = new Uint8Array(gw * gh);
  const tryPlace = (c: Comp, pad: number) => {
    const x0 = Math.floor((c.x - c.sx / 2 - pad + HALF_X) / CELL);
    const x1 = Math.floor((c.x + c.sx / 2 + pad + HALF_X) / CELL);
    const z0 = Math.floor((c.z - c.sz / 2 - pad) / CELL);
    const z1 = Math.floor((c.z + c.sz / 2 + pad) / CELL);
    for (let gz = z0; gz <= z1; gz++)
      for (let gx = x0; gx <= x1; gx++) {
        if (gx < 0 || gx >= gw) return false;
        if (occ[gx + ((gz + gh * 4) % gh) * gw]) return false; // wraps in z: the tile is periodic
      }
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) occ[gx + ((gz + gh * 4) % gh) * gw] = 1;
    tile.push(c);
    return true;
  };
  // Density falls off sideways a little (keeps the far sides from being noisy).
  // Denser toward the centre line, where the near and middle distance is seen.
  const rx = () => {
    const u = rng();
    return (rng() < 0.5 ? -1 : 1) * HALF_X * u * u;
  };
  const want = [
    { n: 30, kind: 0 as const, size: () => [range(rng, 0.35, 0.9), range(rng, 0.02, 0.045), range(rng, 0.2, 0.6)] },
    { n: 40, kind: 2 as const, size: () => { const r = range(rng, 0.04, 0.12); return [r * 2, range(rng, 0.03, 0.09), r * 2]; } },
    { n: 130, kind: 0 as const, size: () => [range(rng, 0.12, 0.32), range(rng, 0.015, 0.035), range(rng, 0.08, 0.25)] },
    { n: 250, kind: 1 as const, size: () => [range(rng, 0.03, 0.12), range(rng, 0.01, 0.025), range(rng, 0.025, 0.07)] },
  ];
  for (const w of want) {
    let placed = 0;
    for (let tries = 0; placed < w.n && tries < w.n * 40; tries++) {
      const [sx, sy, sz] = w.size();
      const c: Comp = { kind: w.kind, x: rx(), z: rng() * P, sx, sy, sz, tint: rng() };
      if (tryPlace(c, 0.02)) placed++;
    }
  }
  for (let k = 0; k < K; k++) for (const c of tile) COMPS.push({ ...c, z: c.z + k * P });

  // Lights (3000 total, 750 per tile): LED rows on the board and along chip edges.
  const lc = new THREE.Color();
  const tileLights: BokehLight[] = [];
  const add = (x: number, y: number, z: number, e: number) => {
    const white = rng() < 0.12;
    tileLights.push({
      x, y, z: ((z % P) + P) % P,
      color: lc.clone(), // replaced per version in the factory
      energy: e * (white ? 1.4 : 1),
      twinkleK: rng() < 0.3 ? 1 + Math.floor(rng() * 4) : 0,
      twinklePhase: rng(),
      size: white ? 1.2 : 1,
    });
  };
  const bigChips = tile.filter((c) => c.kind === 0 && c.sx > 0.25);
  while (tileLights.length < 750) {
    const r = rng();
    if (r < 0.3 && bigChips.length) {
      // A row of dots along one edge of a chip, sitting just above the board.
      const c = bigChips[Math.floor(rng() * bigChips.length)];
      const n = 3 + Math.floor(rng() * 6);
      const alongX = rng() < 0.6;
      const side = rng() < 0.5 ? -1 : 1;
      const sp = range(rng, 0.07, 0.13);
      const e = range(rng, 0.6, 1.6);
      for (let i = 0; i < n && tileLights.length < 750; i++) {
        const t = (i - (n - 1) / 2) * sp;
        if (alongX) add(c.x + t, 0.012, c.z + side * (c.sz / 2 + 0.06), e);
        else add(c.x + side * (c.sx / 2 + 0.06), 0.012, c.z + t, e);
      }
    } else if (r < 0.88) {
      // Clusters of LEDs on the board, concentrated toward the centre line.
      // Log-distributed across x: about as many lights per screen area near the
      // camera (narrow view) as far away (wide view).
      const u = rng();
      const cx = (rng() < 0.5 ? -1 : 1) * 0.3 * (Math.pow(HALF_X / 0.3 + 1, u) - 1);
      const cz = rng() * P;
      const n = 3 + Math.floor(rng() * 8);
      const e = range(rng, 0.5, 1.5);
      for (let i = 0; i < n && tileLights.length < 750; i++) add(cx + (rng() - 0.5) * 0.5, 0.012, cz + (rng() - 0.5) * 0.35, e);
    } else {
      // Single lights on component tops.
      const c = tile[Math.floor(rng() * tile.length)];
      add(c.x + (rng() - 0.5) * c.sx * 0.8, c.sy + 0.006, c.z + (rng() - 0.5) * c.sz * 0.8, range(rng, 0.4, 1.2));
    }
  }
  for (let k = 0; k < K; k++) for (const l of tileLights) LIGHTS.push({ ...l, z: l.z + k * P });
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------
const ENV_GLSL = /* glsl */ `
uniform vec3 uGlow;
// The environment: black sky with a bright band at the horizon, hottest at the centre.
vec3 env(vec3 d) {
  float h = exp(-abs(d.y) * 26.0) * 1.6 + exp(-abs(d.y) * 6.0) * 0.25;
  float c = exp(-d.x * d.x * 9.0);
  return uGlow * h * (0.45 + 1.4 * c) * step(-0.25, d.y);
}
float fogOf(float dist) {
  return pow(smoothstep(8.0, ${(WRAP - BEHIND - 1).toFixed(1)}, dist), 1.6);
}
`;

const COMP_VERT = /* glsl */ `
${PERIODIC_GLSL}
in vec4 aBox;  // x, zLocal, sx, sz
in vec3 aMisc; // sy, kind, tint
out vec3 vN;
out vec3 vW;
out vec3 vVP;
out float vTint;
out float vTop;
void main() {
  vec3 p = position;
  vec3 s = vec3(aBox.z, aMisc.x, aBox.w);
  // Unit geometry has its base at y = 0.
  vec3 w = vec3(aBox.x, 0.0, wrapZ(aBox.y)) + p * s;
  vW = w;
  vN = normalize(normal / s);
  vTint = aMisc.z;
  vTop = step(0.5, normal.y);
  vec4 vp = viewMatrix * vec4(w, 1.0);
  vVP = vp.xyz;
  gl_Position = projectionMatrix * vp;
}
`;

const COMP_FRAG = /* glsl */ `
precision highp float;
${COC_GLSL}
${ENV_GLSL}
in vec3 vN;
in vec3 vW;
in vec3 vVP;
in float vTint;
in float vTop;
uniform vec3 uCam;
uniform vec3 uLightC;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  vec3 R = reflect(-V, N);
  float fres = 0.04 + 0.96 * pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 5.0);
  // Dark grey bodies; tops range from dark matte to brushed silver.
  float metal = vTop * mix(0.25, 0.85, vTint);
  vec3 base = vTop > 0.5 ? mix(vec3(0.012, 0.013, 0.015), vec3(0.14, 0.15, 0.16), vTint * vTint) : vec3(0.008, 0.009, 0.011);
  vec3 spec = env(normalize(R + vec3(0.0, 0.06, 0.0))) * mix(0.03, 0.35, metal) * (0.4 + fres);
  // Soft fill from above, and LED spill from the board.
  float fill = max(N.y, 0.0) * 0.35 + 0.08;
  vec3 col = base * fill + spec + uLightC * 0.004 * (1.0 - vTop);
  float dist = length(vW - uCam);
  col = mix(col, uGlow * 0.55, fogOf(dist));
  gl_FragColor = vec4(col, cocOf(-vVP.z));
}
`;

const BOARD_VERT = /* glsl */ `
${PERIODIC_GLSL}
out vec3 vW;
out vec3 vVP;
out vec2 vBoard; // board coordinates (periodic in z with P)
void main() {
  vec3 w = position;
  vW = w;
  // Board coordinate that moves with the components.
  vBoard = vec2(w.x, uBehind - w.z + uShift);
  vec4 vp = viewMatrix * vec4(w, 1.0);
  vVP = vp.xyz;
  gl_Position = projectionMatrix * vp;
}
`;

const BOARD_FRAG = /* glsl */ `
precision highp float;
${COC_GLSL}
${ENV_GLSL}
${NOISE}
in vec3 vW;
in vec3 vVP;
in vec2 vBoard;
uniform vec3 uBoard;
uniform vec3 uCam;
uniform vec3 uLightC;
void main() {
  vec3 V = normalize(uCam - vW);
  // Faint traces: thin lines on a coarse grid with hashed on/off segments (period P in z).
  vec2 b = vec2(vBoard.x, mod(vBoard.y, ${P.toFixed(1)}));
  vec2 g = b / 0.25;
  vec2 cell = floor(g);
  vec2 f = fract(g);
  float hx = hash31(vec3(cell, 1.0));
  float hz = hash31(vec3(cell, 2.0));
  vec2 fw = fwidth(g);
  float lx = (hx > 0.55) ? 1.0 - smoothstep(0.04, 0.04 + fw.y * 1.5, abs(f.y - 0.5)) : 0.0;
  float lz = (hz > 0.6) ? 1.0 - smoothstep(0.04, 0.04 + fw.x * 1.5, abs(f.x - 0.5)) : 0.0;
  float trace = max(lx, lz);
  float far = length(vW - uCam);
  // Traces fade into an average tone with distance (avoids moire).
  float fade = 1.0 - smoothstep(4.0, 14.0, far);
  vec3 col = uBoard * 0.25 * (0.7 + 0.6 * vnoise(vec3(b * 0.7, 3.0)));
  col += uBoard * 0.9 * trace * fade + uBoard * 0.12 * (1.0 - fade);
  // Glossy board: horizon glow reflected at grazing angles.
  vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
  float fres = 0.02 + 0.98 * pow(clamp(1.0 - V.y, 0.0, 1.0), 5.0);
  col += env(R) * fres * 0.06;
  col += uLightC * 0.006;
  col = mix(col, uGlow * 0.55, fogOf(far));
  gl_FragColor = vec4(col, cocOf(-vVP.z));
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform float uCocFar;
${ENV_GLSL}
void main() {
  vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize((uCamWorld * vec4(normalize(v.xyz / v.w), 0.0)).xyz);
  // Bright haze band hugging the horizon, plus a wide faint halo above it.
  float up = max(d.y, 0.0);
  float hot = exp(-d.x * d.x * 9.0);
  vec3 col = uGlow * (exp(-up * 120.0) * 1.5 + exp(-up * 30.0) * 0.1 + exp(-up * 9.0) * 0.012) * (0.4 + 1.4 * hot);
  col += vec3(0.8, 0.9, 1.0) * exp(-up * 160.0) * hot * hot * 1.5;
  col += uGlow * 0.55 * step(d.y, 0.0);
  gl_FragColor = vec4(col, uCocFar);
}
`;

export const createCircuitHorizon: LookFactory<CircuitHorizonParams> = (gl, params): Look => {
  const FOCUS = 4.2;
  const COC_K = 0.0085;
  const post = new Post(gl, {
    msaa: 0,
    depthTexture: true,
    dof: { maxRadius: 0.04 },
    bloomStrength: 0.5,
    bloomRadius: 0.35,
    bloomThreshold: 0.8,
    bloomKnee: 0.6,
    exposure: 1.0,
    vignette: 0.45,
    grain: 0.015,
    grainDarkCut: 0.03,
  });
  const pu = periodicUniforms(WRAP, BEHIND, FOCUS, COC_K, 0.04);
  const boardC = new THREE.Color(params.board);
  const lightC = new THREE.Color(params.light);
  const glowC = new THREE.Color(params.horizon);

  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 80);
  camera.position.set(0, CAM_Y, 0);
  camera.rotation.set((-5.0 * Math.PI) / 180, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  const scene = new THREE.Scene();
  const common = { ...pu, uGlow: { value: glowC }, uCam: { value: camera.position.clone() }, uLightC: { value: lightC } };

  // Sky (full-screen, first).
  const skyMat = shaderMat({
    vertexShader: /* glsl */ `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.99999, 1.0); }`,
    fragmentShader: SKY_FRAG,
    uniforms: {
      ...common,
      uInvProj: { value: camera.projectionMatrixInverse },
      uCamWorld: { value: camera.matrixWorld },
      uCocFar: { value: COC_K },
    },
    depthTest: false,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // Board.
  const boardGeo = new THREE.PlaneGeometry(HALF_X * 2 + 10, WRAP + 6, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, BEHIND - (WRAP + 6) / 2 + 2);
  const boardMat = shaderMat({
    vertexShader: BOARD_VERT,
    fragmentShader: BOARD_FRAG,
    uniforms: { ...common, uBoard: { value: boardC } },
  });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.frustumCulled = false;
  scene.add(board);

  // Components: boxes (chips, small parts) and cylinders (capacitors).
  const compMat = shaderMat({ vertexShader: COMP_VERT, fragmentShader: COMP_FRAG, uniforms: { ...common } });
  const makeComp = (base: THREE.BufferGeometry, list: Comp[]) => {
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.getAttribute("position"));
    g.setAttribute("normal", base.getAttribute("normal"));
    const box = new Float32Array(list.length * 4);
    const misc = new Float32Array(list.length * 3);
    list.forEach((c, i) => {
      box.set([c.x, c.z, c.sx, c.sz], i * 4);
      misc.set([c.sy, c.kind, c.tint], i * 3);
    });
    g.setAttribute("aBox", new THREE.InstancedBufferAttribute(box, 4));
    g.setAttribute("aMisc", new THREE.InstancedBufferAttribute(misc, 3));
    g.instanceCount = list.length;
    const m = new THREE.Mesh(g, compMat);
    m.frustumCulled = false;
    scene.add(m);
    return g;
  };
  const boxBase = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const cylBase = new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1).translate(0, 0.5, 0);
  const g1 = makeComp(boxBase, COMPS.filter((c) => c.kind !== 2));
  const g2 = makeComp(cylBase, COMPS.filter((c) => c.kind === 2));

  // Lights.
  const lights = LIGHTS.map((l) => ({ ...l, color: l.size > 1 ? lightC.clone().lerp(new THREE.Color(1, 1, 1), 0.55) : lightC.clone() }));
  const bokeh = createBokeh(lights, pu);
  bokeh.mat.uniforms.uGain.value = 2.6;
  bokeh.mat.uniforms.uFalloff.value = 1.1;
  bokeh.mat.uniforms.uSharpR.value = 0.0034;
  bokeh.mat.uniforms.uFade.value.set(WRAP * 0.45, WRAP * 0.85);

  const black = new THREE.Color(0, 0, 0);
  return {
    render(frame) {
      const [w, h] = post.ensureSize();
      // The board moves exactly one layout period toward the camera per loop.
      pu.uShift.value = P * cyc(frame, 1);
      post.beginScene(black, COC_K);
      gl.render(scene, camera);
      post.runDof();
      bokeh.update(camera, post.scene.depthTexture!, w, h, frame);
      gl.setRenderTarget(post.dofOut);
      gl.render(bokeh.scene, camera);
      post.finish(frame);
    },
    dispose() {
      post.dispose();
      bokeh.dispose();
      for (const m of [skyMat, boardMat, compMat]) m.dispose();
      for (const g of [g1, g2, boardGeo, boxBase, cylBase, sky.geometry]) g.dispose();
    },
  };
};
