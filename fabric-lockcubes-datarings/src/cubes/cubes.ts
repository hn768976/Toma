import * as THREE from "three";
import { phase, TAU } from "../lib/constants";
import { PostPipeline } from "../lib/post";
import { mulberry32 } from "../lib/random";
import type { Look } from "../lib/Stage";
import { makeGlyphAtlas } from "./glyphs";

export type CubesParams = {
  cube: string; // matte body colour
  glyph: string; // cool glyph glow
  hot: string; // inner glow of the hot cubes
  hotGlyph: string; // padlock on the hot cube
  background: string;
};

const GRID = 50; // 2,500 cubes
const SIZE = 0.76; // cube edge; pitch is 1.0, so the gap is 0.24
const BOB = 0.25 * SIZE;
// Hot cubes: two neighbours at the centre of the grid.
const HOT_A: [number, number] = [25, 25];
const HOT_B: [number, number] = [24, 25];

// ---- Module-level seeded tables (never random at render time) ----
const rng = mulberry32(0x10c4c0be);
const WAVES = 7;
const waveA = new Float32Array(WAVES * 4); // dir.x, dir.z, spatial freq, temporal cycles (integer)
const waveB = new Float32Array(WAVES * 4); // phase, amplitude, -, -
{
  let ampSum = 0;
  for (let k = 0; k < WAVES; k++) {
    const ang = rng() * TAU;
    const freq = 0.18 + rng() * 0.35;
    const cycles = 1 + Math.floor(rng() * 3) * (rng() < 0.5 ? -1 : 1); // whole cycles per loop
    const amp = 0.5 + rng() * 0.5;
    waveA.set([Math.cos(ang), Math.sin(ang), freq, cycles === 0 ? 1 : cycles], k * 4);
    waveB.set([rng() * TAU, amp, 0, 0], k * 4);
    ampSum += amp;
  }
  // Normalise so the sum stays within about +-1.
  for (let k = 0; k < WAVES; k++) waveB[k * 4 + 1] /= ampSum * 0.55;
}
// Per-cell table: static height offset + three random seeds.
const cellData = new Float32Array(GRID * GRID * 4);
for (let i = 0; i < GRID * GRID; i++) {
  cellData[i * 4 + 0] = (rng() - 0.5) * 1.0;
  cellData[i * 4 + 1] = rng();
  cellData[i * 4 + 2] = rng();
  cellData[i * 4 + 3] = rng();
}
// Keep the padlock face of the hot cube in view: its front neighbours sit lower.
const setOffset = (x: number, z: number, v: number) => (cellData[(z * GRID + x) * 4] = v);
setOffset(HOT_A[0], HOT_A[1], 0.08);
setOffset(HOT_B[0], HOT_B[1], 0.0);
setOffset(HOT_A[0], HOT_A[1] + 1, -0.25);
setOffset(HOT_A[0] + 1, HOT_A[1] + 1, -0.1);
setOffset(HOT_A[0] - 1, HOT_A[1] + 1, 0.05);
setOffset(HOT_A[0] + 1, HOT_A[1], -0.12);

const COMMON = /* glsl */ `
uniform sampler2D cellTex;
uniform vec4 waveA[${WAVES}];
uniform vec4 waveB[${WAVES}];
uniform float loopPhase;
const float TAU = 6.283185307;
const int GRID = ${GRID};
const float SIZE = ${SIZE.toFixed(4)};
const float BOB = ${BOB.toFixed(4)};

vec2 cellPos(ivec2 c) { return vec2(c) - vec2(float(GRID / 2)); }

// Height of a cube's centre: static offset + travelling waves with integer
// temporal cycles, so it closes exactly after one loop.
float cellHeight(ivec2 c) {
  if (c.x < 0 || c.y < 0 || c.x >= GRID || c.y >= GRID) return -10.0;
  vec2 p = cellPos(c);
  float h = 0.0;
  for (int k = 0; k < ${WAVES}; k++) {
    vec4 a = waveA[k];
    vec4 b = waveB[k];
    h += b.y * sin(dot(a.xy, p) * a.z + TAU * a.w * loopPhase + b.x);
  }
  return texelFetch(cellTex, c, 0).r + BOB * h;
}
`;

const VERT = /* glsl */ `
precision highp float;
precision highp sampler2D;
in vec3 position;
in vec3 normal;
in vec2 cell;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
${COMMON}
out vec3 vLocal;
out vec3 vWorld;
out vec3 vN;
out float vViewZ;
flat out ivec2 vCell;
void main() {
  ivec2 c = ivec2(cell);
  vec3 center = vec3(cellPos(c).x, cellHeight(c), cellPos(c).y);
  vec3 w = center + position * SIZE;
  vLocal = position;
  vWorld = w;
  vN = normal;
  vCell = c;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler2D;
in vec3 vLocal;
in vec3 vWorld;
in vec3 vN;
in float vViewZ;
flat in ivec2 vCell;
out vec4 outColor;
${COMMON}
uniform sampler2D atlas;
uniform vec3 cCube;
uniform vec3 cGlyph;
uniform vec3 cHot;
uniform vec3 cHotGlyph;
uniform vec3 camPos;
uniform vec3 hotA;
uniform vec3 hotB;
uniform float hotPulse;
uniform ivec2 hotCellA;
uniform ivec2 hotCellB;

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float rnd(uint h) { return float(pcg(h)) / 4294967296.0; }

// Face-local 2D coords in [-0.5, 0.5] and a face id.
void faceCoords(vec3 n, vec3 l, out vec2 uv, out int face) {
  vec3 an = abs(n);
  if (an.y > 0.5) { uv = l.xz; face = n.y > 0.0 ? 0 : 5; }
  else if (an.x > 0.5) { uv = vec2(l.z * sign(n.x), -l.y); face = n.x > 0.0 ? 1 : 2; }
  else { uv = vec2(-l.x * sign(n.z), -l.y); face = n.z > 0.0 ? 3 : 4; }
}

// Glyph mask at face coords: index 0..2, rotation 0..3 (90 degree steps).
float glyphMask(vec2 uv, int glyph, int rot, float lod) {
  vec2 g = uv / 0.56;
  for (int i = 0; i < 4; i++) { if (i < rot) g = vec2(-g.y, g.x); }
  g += 0.5;
  if (any(lessThan(g, vec2(0.0))) || any(greaterThan(g, vec2(1.0)))) return 0.0;
  return textureLod(atlas, vec2((float(glyph) + g.x) * 0.25, g.y), lod).r;
}

vec3 orangeLight(vec3 P, vec3 N, vec3 src, float I) {
  vec3 v = src - P;
  float d = length(v);
  float ndl = max(dot(N, v / d), 0.0);
  float att = I / (1.0 + d * d * 0.55);
  att *= smoothstep(4.5, 1.0, d);
  return cHot * ndl * att;
}

void main() {
  vec3 N0 = normalize(vN);
  vec2 uv; int face;
  faceCoords(N0, vLocal, uv, face);

  // Rounded-edge (bevel) normal: lean toward the nearest edges.
  const float BEV = 0.045;
  vec3 N = N0;
  vec3 axU, axV;
  if (face == 0 || face == 5) { axU = vec3(1, 0, 0); axV = vec3(0, 0, 1); }
  else if (face == 1 || face == 2) { axU = vec3(0, 0, 1); axV = vec3(0, 1, 0); }
  else { axU = vec3(1, 0, 0); axV = vec3(0, 1, 0); }
  vec2 lc = (face == 0 || face == 5) ? vLocal.xz : (face == 1 || face == 2) ? vLocal.zy : vLocal.xy;
  vec2 eb = clamp((abs(lc) - (0.5 - BEV)) / BEV, 0.0, 1.0);
  N = normalize(N + axU * sign(lc.x) * eb.x * 0.9 + axV * sign(lc.y) * eb.y * 0.9);
  float edge = max(eb.x, eb.y);

  bool isA = vCell == hotCellA;
  bool isB = vCell == hotCellB;
  float myH = cellHeight(vCell);
  float y = vLocal.y; // -0.5..0.5 within the cube

  // ---- Analytic ambient occlusion from the four neighbours (no noise, no history) ----
  float ao = 1.0;
  ivec2 dirs[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
  for (int i = 0; i < 4; i++) {
    ivec2 d = dirs[i];
    float hn = cellHeight(vCell + d);
    float topN = hn + 0.5 * SIZE;
    if (face == 0) {
      // Top face: a taller neighbour shades the edge next to it.
      float toward = dot(vLocal.xz, vec2(d));
      float rise = clamp((topN - (myH + 0.5 * SIZE)) / 0.5, 0.0, 1.0);
      ao -= 0.55 * rise * smoothstep(0.05, 0.5, toward);
    } else if (face != 5) {
      vec2 fn = (face == 1 || face == 2) ? vec2(N0.x, 0.0) : vec2(0.0, N0.z);
      if (dot(fn, vec2(d)) > 0.5) {
        float wy = myH + y * SIZE;
        // How far below the neighbour's top this point is (the gap is 0.2).
        float depthBelow = clamp((topN - wy) / 0.6, 0.0, 1.0);
        ao -= 0.6 * depthBelow;
      }
    }
  }
  // Sides darken toward the bottom: the gaps are deep.
  if (face != 0) ao *= mix(0.4, 1.0, smoothstep(-0.55, 0.45, y));
  ao = clamp(ao, 0.08, 1.0);

  // ---- Lighting: cool ambient from above, soft key, warm only from hot cubes ----
  vec3 V = normalize(camPos - vWorld);
  vec3 L = normalize(vec3(-0.6, 0.75, 0.15));
  float hemi = 0.5 + 0.5 * N.y;
  vec3 amb = mix(vec3(0.03, 0.08, 0.2), vec3(0.42, 0.95, 1.3), hemi);
  float key = max(dot(N, L), 0.0);
  vec3 col = cCube * (amb * 0.75 + vec3(0.6, 0.95, 1.15) * key * 1.1) * ao;
  // Bevel catches a little light.
  col += vec3(0.25, 0.32, 0.5) * edge * pow(max(dot(N, normalize(L + V)), 0.0), 6.0) * 0.6 * ao;

  // Warm light from the two hot cubes.
  if (!isA && !isB) {
    vec3 warm = orangeLight(vWorld, N, hotA, 2.4 * hotPulse) + orangeLight(vWorld, N, hotB, 1.2 * hotPulse);
    col += warm * cCube * 4.0 * mix(0.6, 1.0, ao) * (1.0 - 0.75 * step(0.5, N0.y));
  }

  // ---- Glyphs ----
  vec4 cd = texelFetch(cellTex, vCell, 0);
  uint seed = uint(cd.g * 65535.0) * 7919u + uint(face) * 104729u + uint(cd.b * 65535.0);
  float lod = 0.0;
  if (isA || isB) {
    // Inner glow: brighter toward the middle of each face, like warm translucent glass.
    float r = length(uv);
    float inner = smoothstep(0.75, 0.0, r);
    float k = isA ? 1.0 : 0.3;
    vec3 glow = cHot * (0.08 + 0.6 * inner) * k * hotPulse;
    col = col * 0.75 + glow * (face == 0 ? 0.6 : 1.0) * (1.0 - 0.5 * edge);
    if (isA && face == 3) {
      float m = glyphMask(uv * 0.8, 2, 0, 0.0);
      col = mix(col, mix(cHotGlyph, vec3(1.0, 0.95, 0.8), 0.35) * 14.0 * hotPulse, m);
      col += cHotGlyph * glyphMask(uv * 0.8, 2, 0, 4.5) * 2.0 * hotPulse;
    }
  } else if (face != 5) {
    float r0 = rnd(seed);
    float glowP = face == 0 ? 0.18 : 0.3;
    bool glow = r0 < glowP;
    bool engraved = !glow && rnd(seed + 17u) < 0.75;
    if (glow || engraved) {
      // Each cube face changes glyph a whole number of times per loop.
      float n = floor(rnd(seed + 29u) * 4.0); // 0..3
      float off = rnd(seed + 31u);
      float slot = 0.0;
      float fade = 1.0;
      if (n > 0.0) {
        float s = mod(loopPhase * n + off, n);
        slot = floor(s);
        float fr = fract(s);
        fade = smoothstep(0.0, 0.03 * n, fr) * smoothstep(1.0, 1.0 - 0.03 * n, fr);
      }
      uint sh = pcg(seed + uint(slot) * 7u + 101u);
      int glyph = int(rnd(sh) * 3.0);
      int rot = int(rnd(sh + 3u) * 4.0);
      float m = glyphMask(uv, glyph, rot, lod);
      if (glow) {
        float halo = glyphMask(uv, glyph, rot, 4.0);
        float b = 0.85 + 0.5 * rnd(seed + 41u);
        col += cGlyph * (m * 1.7 + halo * 0.12) * b * fade * mix(0.5, 1.0, ao);
      } else {
        col *= 1.0 - 0.3 * m;
        col += cCube * 0.05 * m * key;
      }
    }
  }
  outColor = vec4(col, vViewZ);
}
`;

const lin = (hex: string) => new THREE.Color(hex);

export const createCubes = (params: CubesParams) => (gl: THREE.WebGLRenderer): Look => {
  void gl;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(19, 16 / 9, 0.5, 160);
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.deleteAttribute("uv");
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = box.index;
  geo.setAttribute("position", box.getAttribute("position"));
  geo.setAttribute("normal", box.getAttribute("normal"));
  const cells = new Float32Array(GRID * GRID * 2);
  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) cells.set([x, z], (z * GRID + x) * 2);
  geo.setAttribute("cell", new THREE.InstancedBufferAttribute(cells, 2));
  geo.instanceCount = GRID * GRID;

  const cellTex = new THREE.DataTexture(cellData, GRID, GRID, THREE.RGBAFormat, THREE.FloatType);
  cellTex.needsUpdate = true;
  const atlas = makeGlyphAtlas();
  const uniforms = {
    cellTex: { value: cellTex },
    atlas: { value: atlas },
    waveA: { value: Array.from({ length: WAVES }, (_, k) => new THREE.Vector4().fromArray(waveA, k * 4)) },
    waveB: { value: Array.from({ length: WAVES }, (_, k) => new THREE.Vector4().fromArray(waveB, k * 4)) },
    loopPhase: { value: 0 },
    cCube: { value: lin(params.cube) },
    cGlyph: { value: lin(params.glyph) },
    cHot: { value: lin(params.hot) },
    cHotGlyph: { value: lin(params.hotGlyph) },
    camPos: { value: new THREE.Vector3() },
    hotA: { value: new THREE.Vector3() },
    hotB: { value: new THREE.Vector3() },
    hotPulse: { value: 1 },
    hotCellA: { value: new THREE.Vector2(...HOT_A) },
    hotCellB: { value: new THREE.Vector2(...HOT_B) },
  };
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const post = new PostPipeline({ msaa: 4 });
  const bg = lin(params.background);

  // CPU copy of the GLSL height function, for the light positions and focus.
  const heightAt = (cx: number, cz: number, p: number) => {
    const px = cx - GRID / 2;
    const pz = cz - GRID / 2;
    let h = 0;
    for (let k = 0; k < WAVES; k++) {
      h +=
        waveB[k * 4 + 1] *
        Math.sin((waveA[k * 4] * px + waveA[k * 4 + 1] * pz) * waveA[k * 4 + 2] + TAU * waveA[k * 4 + 3] * p + waveB[k * 4]);
    }
    return cellData[(cz * GRID + cx) * 4] + BOB * h;
  };

  return {
    render(gl, frame, width, height) {
      const p = phase(frame);
      const t = p * TAU;
      post.setSize(width, height);
      uniforms.loopPhase.value = p;
      const ha = heightAt(HOT_A[0], HOT_A[1], p);
      const hb = heightAt(HOT_B[0], HOT_B[1], p);
      uniforms.hotA.value.set(HOT_A[0] - GRID / 2, ha, HOT_A[1] - GRID / 2);
      uniforms.hotB.value.set(HOT_B[0] - GRID / 2, hb, HOT_B[1] - GRID / 2);
      // Gentle pulse, whole cycles.
      uniforms.hotPulse.value = 0.88 + 0.12 * Math.sin(2 * t) + 0.04 * Math.sin(5 * t + 1.0);

      // High angle (~50 deg), small closed drift; hot cubes stay near the centre.
      const target = new THREE.Vector3(-0.2 + 0.35 * Math.cos(t), 0, 0.15 + 0.3 * Math.sin(t));
      const az = THREE.MathUtils.degToRad(40 + 3 * Math.sin(t));
      const el = THREE.MathUtils.degToRad(54 + 1.5 * Math.cos(t));
      const dist = 12.8 + 0.45 * Math.sin(t);
      cam.position.set(
        target.x + dist * Math.cos(el) * Math.sin(az),
        target.y + dist * Math.sin(el),
        target.z + dist * Math.cos(el) * Math.cos(az),
      );
      cam.lookAt(target);
      cam.aspect = width / height;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      uniforms.camPos.value.copy(cam.position);

      post.beginScene(gl, bg);
      gl.render(scene, cam);
      const focus = cam.position.distanceTo(uniforms.hotA.value);
      const dof = post.dof(gl, cam, {
        enabled: true,
        focus,
        aperture: 0.012,
        maxCoc: 0.006,
        samples: 32,
      });
      post.finish(gl, dof, frame, {
        exposure: 0.95,
        tonemap: "soft",
        bloomStrength: 0.5,
        bloomThreshold: 0.9,
        bloomRadius: 0.6,
        vignette: 0.8,
        fringe: 0,
        grain: 0.015,
        dither: true,
        saturation: 1.05,
      });
    },
    dispose() {
      geo.dispose();
      box.dispose();
      mat.dispose();
      cellTex.dispose();
      atlas.dispose();
      post.dispose();
    },
  };
};
