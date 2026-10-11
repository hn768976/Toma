import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ATLAS_GLSL, getAtlas, LOCK_CLOSED, LOCK_OPEN, SET_ALL, SET_BINARY, SET_HEX } from "../engine/atlas";
import { HASH_GLSL, SNOISE_GLSL } from "../engine/glsl";
import { PostPipeline, PostSettings } from "../engine/post";
import { mulberry32, LOOP_FRAMES } from "../engine/rng";
import type { LookFactory } from "../engine/Stage";

/**
 * Shared glyph-surface engine (looks 3-5): one InstancedMesh of cells
 * (quads, or rounded boxes for Binary Cubes). Per-instance attributes:
 * grid position, base colour, brightness, flicker phase, hold length.
 * The glyph, its swap dip, the wave height and the flicker are all evaluated
 * on the GPU from the loop frame alone.
 */
type RGB = string;
export type GlyphVersion = {
  kind: "floor" | "wave" | "cubes";
  seed: number;
  palette: { color: RGB; weight: number }[];
  accent: RGB; // bright accent / flare colour
  camera: { fov: number; pos: [number, number, number]; target: [number, number, number]; sway: [number, number, number]; orbitDeg: number; up?: [number, number, number] };
  pixelate?: number; // >0: quantise glyphs to an LCD pixel grid of this many columns
  glyphScale?: number;
  nearBump?: number; // Binary Cubes: central dome height
  bg: RGB;
  post: Omit<PostSettings, "depthScale">;
  // floor / wave specifics
  fill?: RGB;
  glyphFraction?: number;
  fog?: { color: RGB; density: number };
};

const DEPTH_SCALE = 400;
// Hold lengths in frames; every one divides 600 so the schedule loops exactly.
const HOLDS = [10, 12, 15, 20, 24, 30, 40, 60];
const HOLDS_GLSL = `const float HOLDS[8] = float[8](${HOLDS.map((h) => h.toFixed(1)).join(",")});`;

const SCHEDULE_GLSL = /* glsl */ `
${HOLDS_GLSL}
uniform int uSet[66];
uniform int uSetCount;
uniform float uFrame;
// glyph slot for this cell at this frame, plus the 2-frame brightness dip on a swap
vec2 glyphState(uint cellId, float holdIdx) {
  float hold = HOLDS[int(holdIdx)];
  // per-cell phase so swaps never line up across the grid (no global flash)
  float off = float(hash3u(cellId, 5u, 311u) % uint(hold));
  float f = uFrame + off;
  float stepI = mod(floor(f / hold), ${LOOP_FRAMES}.0 / hold);
  float since = mod(f, hold);
  uint h = hash3u(cellId, uint(stepI), 977u);
  float slot = float(uSet[int(h % uint(uSetCount))]);
  float dip = since < 1.0 ? 0.3 : (since < 2.0 ? 0.65 : 1.0);
  return vec2(slot, dip);
}
const float TAU = 6.28318530718;
`;

const pickWeighted = (rng: () => number, items: { color: RGB; weight: number }[]) => {
  const total = items.reduce((a, b) => a + b.weight, 0);
  let r = rng() * total;
  for (const it of items) {
    if ((r -= it.weight) <= 0) return it.color;
  }
  return items[items.length - 1].color;
};

const setUniform = (set: number[]) => {
  const arr = new Array(66).fill(0);
  set.forEach((v, i) => (arr[i] = v));
  return arr;
};

// ---------------------------------------------------------------- quads ----
const QUAD_VERT = /* glsl */ `
precision highp float;
precision highp int;
in vec3 position; in vec2 uv;
in vec3 aCell;     // ix, iz, patch
in vec3 aColor;
in vec4 aInfo;     // brightness, phase, holdIdx, glyph flag (0/1/2 = none/glyph/flare)
in vec2 aInfo2;    // flicker cycles per loop, streak lane seed
uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat4 viewMatrix;
uniform vec2 uGrid; uniform float uPitch; uniform float uPatchDepth;
uniform float uWaveAmp; uniform float uWaveScale; uniform int uMode; uniform float uZ0;
out vec2 vUv; out vec3 vColor; out float vDepth; out float vDist;
flat out vec4 vGlyph; // slot, dip*brightness, flag, streak
${HASH_GLSL}
${SNOISE_GLSL}
${SCHEDULE_GLSL}
float waveHeight(vec2 p) {
  float th = uFrame / ${LOOP_FRAMES}.0 * TAU;
  vec2 c = vec2(cos(th), sin(th));
  float a = snoise(vec3(p * uWaveScale + c * 0.9, 1.7));
  float b = snoise(vec3(p * uWaveScale * 1.9 + vec2(13.1, 7.3), 0.0) + vec3(0.0, c * 0.7));
  return uWaveAmp * (0.7 * a + 0.3 * b);
}
void main() {
  uint cellId = uint(aCell.x) * 4099u + uint(aCell.y) * 131u + 7u;
  vec2 gs = glyphState(cellId, aInfo.z);
  float t = uFrame / ${LOOP_FRAMES}.0;
  // flicker: whole cycles per loop
  float fl = 0.78 + 0.22 * sin(TAU * (aInfo2.x * t + aInfo.y));
  float bright = aInfo.x * fl;
  float streak = 0.0;
  if (uMode == 0) {
    // streak pulses race along the depth axis toward the camera, runs of 3-8 cells
    for (int lane = 0; lane < 5; lane++) {
      uint lh = hash3u(uint(aCell.x), uint(lane), 31u);
      float on = float((lh & 255u)) / 255.0;
      if (on > 0.6) continue;
      float len = 3.0 + float((lh >> 8u) % 6u);
      float trips = 1.0 + float((lh >> 12u) % 2u);
      float p0 = float((lh >> 16u) % 64u);
      float head = mod(p0 - trips * uGrid.y * t, uGrid.y);
      float d = mod(aCell.y - head, uGrid.y);
      if (d < len) streak = max(streak, 1.0 - d / len * 0.65);
    }
  } else if (aInfo.w > 1.5) {
    // occasional white flares, whole-cycle pulses
    bright += 2.5 * pow(max(0.0, sin(TAU * (aInfo2.x * t + aInfo.y * 3.1))), 12.0);
  }
  vec3 local = position; // plane in XZ, [-0.5, 0.5]
  vec3 wp;
  wp.x = (aCell.x - uGrid.x * 0.5 + local.x + 0.5) * uPitch;
  wp.z = -(aCell.y + aCell.z * uGrid.y - local.z - 0.5) * uPitch + uZ0;
  wp.y = uMode == 1 ? waveHeight(wp.xz) : 0.0;
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  vDepth = -mv.z;
  vDist = length(mv.xyz);
  vUv = vec2(local.x + 0.5, local.z + 0.5);
  vColor = aColor;
  vGlyph = vec4(gs.x, gs.y * bright, aInfo.w, streak);
}
`;

const QUAD_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv; in vec3 vColor; in float vDepth; in float vDist;
flat in vec4 vGlyph;
out vec4 outColor;
uniform float uPitch; uniform float uGap; uniform vec3 uGapColor; uniform vec3 uFill;
uniform vec3 uAccent; uniform vec3 uFogColor; uniform float uFogDensity; uniform float uDepthScale;
uniform int uMode; uniform float uPixelate; uniform float uGlyphScale;
${ATLAS_GLSL}
float boxCover(float p, float lo, float hi, float w) {
  w = max(w, 1e-4);
  return clamp((min(p + 0.5 * w, hi) - max(p - 0.5 * w, lo)) / w, 0.0, 1.0);
}
void main() {
  vec2 p = vUv * uPitch;
  vec2 w = fwidth(p);
  float g = uGap * 0.5;
  float tile = boxCover(p.x, g, uPitch - g, w.x) * boxCover(p.y, g, uPitch - g, w.y);
  vec2 gl = (p - g) / (uPitch - 2.0 * g);
  gl = (gl - 0.5) / uGlyphScale + 0.5;
  float hasGlyph = step(0.5, vGlyph.z);
  float mask;
  if (uPixelate > 0.0) {
    // LCD look: sample the glyph on a coarse pixel grid, draw each pixel as a soft square dot
    vec2 grid = vec2(uPixelate, uPixelate * 1.4);
    vec2 cell = (floor(gl * grid) + 0.5) / grid;
    vec2 f = fract(gl * grid) - 0.5;
    float dotm = 1.0 - smoothstep(0.32, 0.5, max(abs(f.x), abs(f.y)));
    mask = hasGlyph * smoothstep(0.25, 0.6, glyphMask(vGlyph.x, cell)) * mix(1.0, dotm, 0.3);
  } else {
    mask = hasGlyph * glyphMask(vGlyph.x, gl);
  }
  float b = vGlyph.y;
  vec3 col;
  if (uMode == 0) {
    float s = vGlyph.w;
    vec3 base = vColor * b * (0.4 + 6.0 * s);
    vec3 tint = mix(vColor, uAccent * 0.6 + vec3(0.2, 0.6, 0.7), 0.45) * (0.9 + 0.8 * b) * (1.0 + 3.0 * s);
    col = mix(uGapColor, base, tile);
    col = mix(col, tint, mask * tile * 0.9);
  } else {
    vec3 gc = vColor * b * 3.0;
    if (vGlyph.z > 1.5) gc = mix(gc, uAccent * b * 1.6, 0.8);
    col = mix(uGapColor, uFill * 0.35, tile);
    col = mix(col, gc, mask * tile);
  }
  float fog = 1.0 - exp(-uFogDensity * vDist);
  col = mix(col, uFogColor, fog);
  outColor = vec4(col, vDepth / uDepthScale);
}
`;

// ---------------------------------------------------------------- cubes ----
const CUBE_N = 64, CUBE_M = 40, CUBE_PITCH = 1.0, CUBE_SIZE = 0.9;

export const glyphFactory: LookFactory<GlyphVersion> = (renderer, v) => {
  renderer.toneMapping = THREE.NoToneMapping;
  const post = new PostPipeline(renderer);
  const scene = new THREE.Scene();
  const atlas = getAtlas();
  const rng = mulberry32(v.seed);
  const disposables: { dispose(): void }[] = [atlas as never];
  const frameUniforms: { value: number }[] = [];

  if (v.kind === "floor" || v.kind === "wave") {
    const floor = v.kind === "floor";
    const nx = floor ? 96 : 120, ny = floor ? 64 : 80, patches = floor ? 5 : 1;
    const pitch = floor ? 1.12 : 1.1;
    const count = nx * ny * patches;
    const geo = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    geo.index = plane.index;
    geo.setAttribute("position", plane.attributes.position);
    geo.setAttribute("uv", plane.attributes.uv);
    const aCell = new Float32Array(count * 3), aColor = new Float32Array(count * 3);
    const aInfo = new Float32Array(count * 4), aInfo2 = new Float32Array(count * 2);
    // one periodic patch of per-cell data, repeated along depth
    const patch: { c: THREE.Color; info: number[]; info2: number[] }[] = [];
    const col = new THREE.Color();
    for (let iz = 0; iz < ny; iz++)
      for (let ix = 0; ix < nx; ix++) {
        col.set(pickWeighted(rng, v.palette));
        const accent = floor && rng() < 0.05;
        if (accent) col.set(v.accent).multiplyScalar(1.6);
        const bright = floor ? 0.08 + 0.92 * Math.pow(rng(), 1.7) : 0.2 + 0.8 * Math.pow(rng(), 1.4);
        const glyphFlag = floor ? (rng() < (v.glyphFraction ?? 0.4) ? 1 : 0) : rng() < 0.03 ? 2 : 1;
        const blend = rng();
        const c = floor ? col.clone() : new THREE.Color(v.palette[0].color).lerp(new THREE.Color(v.palette[1].color), blend * blend * blend);
        patch.push({
          c,
          info: [bright, rng(), Math.floor(rng() * 8), glyphFlag],
          info2: [1 + Math.floor(rng() * 4), rng()],
        });
      }
    for (let p = 0, i = 0; p < patches; p++)
      for (let iz = 0; iz < ny; iz++)
        for (let ix = 0; ix < nx; ix++, i++) {
          const d = patch[iz * nx + ix];
          aCell.set([ix, iz, floor ? p - 1 : 0], i * 3);
          aColor.set([d.c.r, d.c.g, d.c.b], i * 3);
          aInfo.set(d.info, i * 4);
          aInfo2.set(d.info2, i * 2);
        }
    geo.setAttribute("aCell", new THREE.InstancedBufferAttribute(aCell, 3));
    geo.setAttribute("aColor", new THREE.InstancedBufferAttribute(aColor, 3));
    geo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(aInfo, 4));
    geo.setAttribute("aInfo2", new THREE.InstancedBufferAttribute(aInfo2, 2));
    geo.instanceCount = count;
    const uFrame = { value: 0 };
    frameUniforms.push(uFrame);
    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: QUAD_FRAG,
      uniforms: {
        uFrame,
        uSet: { value: setUniform(floor ? SET_HEX : SET_ALL) },
        uSetCount: { value: floor ? SET_HEX.length : SET_ALL.length },
        uGrid: { value: new THREE.Vector2(nx, ny) },
        uPitch: { value: pitch },
        uPatchDepth: { value: ny * pitch },
        uZ0: { value: floor ? 0 : ny * pitch * 0.5 },
        uWaveAmp: { value: floor ? 0 : 3.0 },
        uWaveScale: { value: 0.045 },
        uMode: { value: floor ? 0 : 1 },
        uGap: { value: floor ? 0.12 : 0.1 },
        uGapColor: { value: new THREE.Color(v.bg) },
        uFill: { value: new THREE.Color(v.fill ?? "#000000") },
        uAccent: { value: new THREE.Color(v.accent) },
        uFogColor: { value: new THREE.Color(v.fog?.color ?? "#000000") },
        uFogDensity: { value: v.fog?.density ?? 0 },
        uDepthScale: { value: DEPTH_SCALE },
        uAtlas: { value: atlas },
        uPixelate: { value: v.pixelate ?? 0 },
        uGlyphScale: { value: v.glyphScale ?? 0.9 },
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    disposables.push(geo, mat, plane);
  } else {
    // Binary Cubes: rounded boxes, satin material lit by RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.16;
    pmrem.dispose();
    disposables.push(envRT);
    const count = CUBE_N * CUBE_M;
    const geo = new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 3, 0.07);
    const aInfo = new Float32Array(count * 4), aCell = new Float32Array(count * 3);
    for (let iz = 0, i = 0; iz < CUBE_M; iz++)
      for (let ix = 0; ix < CUBE_N; ix++, i++) {
        const lock = rng() < 0.12 ? (rng() < 0.5 ? 1 : 2) : 0;
        aInfo.set([Math.floor(rng() * 8), rng(), lock, rng() < 0.7 ? 0 : 1], i * 4);
        aCell.set([ix, iz, (rng() * 2 - 1) * 0.38], i * 3);
      }
    geo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(aInfo, 4));
    geo.setAttribute("aCell", new THREE.InstancedBufferAttribute(aCell, 3));
    const uFrame = { value: 0 };
    frameUniforms.push(uFrame);
    const grad = v.palette.map((p) => new THREE.Color(p.color));
    const mat = new THREE.MeshStandardMaterial({ color: "#4a4ae8", roughness: 0.45, metalness: 0.0 });
    mat.customProgramCacheKey = () => "binary-cubes";
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, {
        uFrame,
        uSet: { value: setUniform(SET_BINARY) },
        uSetCount: { value: 2 },
        uAtlas: { value: atlas },
        uDepthScale: { value: DEPTH_SCALE },
        uGrad: { value: grad },
        uGlyphCol: { value: new THREE.Color("#bff4ff") },
        uAmber: { value: new THREE.Color("#ffc85a") },
        uGrid: { value: new THREE.Vector2(CUBE_N, CUBE_M) },
        uBump: { value: v.nearBump ?? 0 },
        uGradNear: { value: 11.0 },
        uGradFar: { value: 21.0 },
      });
      sh.vertexShader = sh.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          in vec4 aInfo; in vec3 aCell;
          uniform vec2 uGrid; uniform float uGradNear; uniform float uGradFar; uniform float uBump;
          out float vDepthZ; out vec3 vObjPos; out vec3 vObjN; out float vGradT;
          flat out vec4 vGlyph;
          ${HASH_GLSL}
          ${SNOISE_GLSL}
          ${SCHEDULE_GLSL}`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vObjPos = position; vObjN = normal;
          vec2 cellXZ = vec2((aCell.x - uGrid.x * 0.5) * ${CUBE_PITCH.toFixed(2)}, (aCell.y - uGrid.y * 0.5 + 0.5) * ${CUBE_PITCH.toFixed(2)});
          float th = uFrame / ${LOOP_FRAMES}.0 * TAU;
          vec2 cc = vec2(cos(th), sin(th));
          float hA = snoise(vec3(cellXZ * 0.075 + cc * 0.85, 3.3));
          float hB = snoise(vec3(cellXZ * 0.16 + vec2(5.2, 1.3), 0.0) + vec3(0.0, cc * 0.6));
          transformed.x += cellXZ.x; transformed.z += cellXZ.y;
          transformed.y += 0.6 * (0.72 * hA + 0.28 * hB) + aCell.z + uBump * exp(-dot(cellXZ, cellXZ) / 90.0);
          uint cellId = uint(aCell.x) * 4099u + uint(aCell.y) * 131u + 3u;
          vec2 gs = glyphState(cellId, aInfo.x);
          float t = uFrame / ${LOOP_FRAMES}.0;
          float fl = 0.85 + 0.15 * sin(TAU * (float(1u + cellId % 3u) * t + aInfo.y));
          float slot = aInfo.z > 1.5 ? ${LOCK_OPEN}.0 : (aInfo.z > 0.5 ? ${LOCK_CLOSED}.0 : gs.x);
          float dip = aInfo.z > 0.5 ? 1.0 : gs.y;
          vGlyph = vec4(slot, dip * fl, aInfo.z, aInfo.w);`,
        )
        .replace("#include <project_vertex>", "#include <project_vertex>\nvDepthZ = -mvPosition.z;\n{ vec4 cp = projectionMatrix * mvPosition; vec2 nd = cp.xy / cp.w; vGradT = clamp(0.5 - 0.5 * nd.y + 0.22 * nd.x * nd.x, 0.0, 1.0); }");
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          in float vDepthZ; in vec3 vObjPos; in vec3 vObjN; in float vGradT;
          flat in vec4 vGlyph;
          uniform float uDepthScale; uniform vec3 uGrad[4]; uniform vec3 uGlyphCol; uniform vec3 uAmber;
          ${ATLAS_GLSL}
          vec3 gradColor(float t) {
            t = clamp(t, 0.0, 1.0) * 3.0;
            if (t < 1.0) return mix(uGrad[0], uGrad[1], t);
            if (t < 2.0) return mix(uGrad[1], uGrad[2], t - 1.0);
            return mix(uGrad[2], uGrad[3], t - 2.0);
          }`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          diffuseColor.rgb = gradColor(0.12 + 0.72 * pow(vGradT, 1.6));`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          {
            float top = smoothstep(0.6, 0.9, vObjN.y);
            vec2 gl = vec2(vObjPos.x, vObjPos.z) / ${(CUBE_SIZE * 0.78).toFixed(3)} + 0.5;
            float inside = step(0.0, gl.x) * step(gl.x, 1.0) * step(0.0, gl.y) * step(gl.y, 1.0);
            float m = glyphMask(vGlyph.x, vec2(gl.x, gl.y)) * top * inside;
            vec3 gcol = vGlyph.z > 0.5 ? (vGlyph.w < 0.5 ? uAmber * 1.6 : uGlyphCol * vec3(0.5, 0.9, 1.0) * 1.6) : uGlyphCol * vec3(0.4, 0.85, 1.0) * 2.2;
            float glow = vGlyph.z > 0.5 ? 2.0 : 1.4;
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.15, m);
            totalEmissiveRadiance += gcol * m * vGlyph.y * glow;
            // faint face tint so the lit tops read as glowing panels
            totalEmissiveRadiance += diffuseColor.rgb * top * 0.05;
          }`,
        )
        .replace("#include <dithering_fragment>", "gl_FragColor.a = vDepthZ / uDepthScale;");
    };
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m.identity());
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    disposables.push(geo, mat);
  }

  const camera = new THREE.PerspectiveCamera(v.camera.fov, 16 / 9, 0.05, 600);
  const bg = new THREE.Color(v.bg);
  const size = new THREE.Vector2();
  const base = new THREE.Vector3(...v.camera.pos);
  const target = new THREE.Vector3(...v.camera.target);
  const patchDepth = 64 * 1.12;

  return {
    render(frame) {
      renderer.getDrawingBufferSize(size);
      post.setSize(size.x, size.y);
      camera.aspect = size.x / size.y;
      frameUniforms.forEach((u) => (u.value = frame));
      const t = frame / LOOP_FRAMES;
      const a = t * Math.PI * 2;
      const p = base.clone();
      const tg = target.clone();
      if (v.kind === "floor") {
        // forward exactly one patch depth per loop
        p.z -= patchDepth * t;
        tg.z -= patchDepth * t;
        p.x += Math.sin(a) * v.camera.sway[0];
        p.y += Math.sin(a * 2) * v.camera.sway[1];
      } else {
        const off = p.clone().sub(tg);
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(v.camera.orbitDeg) * Math.sin(a));
        p.copy(tg).add(off);
        p.x += Math.sin(a) * v.camera.sway[0];
        p.y += (1 - Math.cos(a)) * 0.5 * v.camera.sway[1];
        p.z += Math.sin(a * 2) * v.camera.sway[2];
      }
      camera.position.copy(p);
      camera.up.set(...(v.camera.up ?? [0, 1, 0]));
      camera.lookAt(tg);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      post.render(scene, camera, { ...v.post, depthScale: DEPTH_SCALE }, frame, bg);
    },
    dispose() {
      post.dispose();
      disposables.forEach((d) => d !== (atlas as never) && d.dispose());
    },
  };
};
