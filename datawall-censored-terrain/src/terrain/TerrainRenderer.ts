import * as THREE from "three";
import { hexLinear, type RGB } from "../lib/color";
import { PostPipeline } from "../lib/post";
import { irange, mulberry32, range } from "../lib/random";
import { HASH, HEADER } from "../lib/shaders";
import type { LookRenderer } from "../lib/Stage";
import type { TerrainVersion } from "../versions";
import {
  DEPTH,
  DS,
  DX,
  GRID_Y,
  NS,
  NT,
  NX,
  TILE,
  X0,
  buildField,
  buildNodes,
  gridColumns,
  gridRows,
} from "./heightmap";

export const LOOP_FRAMES = 600;

// ---------------------------------------------------------------- data (module level, seeded)
const FIELD = buildField();
const NODES = buildNodes(FIELD);

// Camera height: 1.5 m above the mean surface of the flight corridor.
const CORRIDOR = (() => {
  let sum = 0;
  let n = 0;
  for (let r = 0; r < NT; r += 5) {
    for (let c = NX / 2 - 15; c <= NX / 2 + 15; c++) {
      sum += FIELD.height(c, r);
      n++;
    }
  }
  return sum / n;
})();

export const CAM = {
  fov: 22,
  height: CORRIDOR + 2.1,
  horizonFromTop: 0.22,
  focus: 19, // metres, roughly 30% of the visible depth on screen
};

// Extra points: grid lines, nodes (core + halo), vertical node lines, dust.
// aPos: x, y, s (terrain coords, s in [0, DEPTH)); aP: size(m), intensity, pulse rate, phase
// aK: colour kind (0 grid, 1 node, 2 dust), profile (0 disc, 1 gaussian), drift amp, drift seed
const buildExtras = () => {
  const pos: number[] = [];
  const p: number[] = [];
  const k: number[] = [];
  const add = (x: number, y: number, s: number, size: number, inten: number, rate: number, phase: number, kind: number, profile: number, drift = 0, dseed = 0) => {
    pos.push(x, y, s);
    p.push(size, inten, rate, phase);
    k.push(kind, profile, drift, dseed);
  };
  // Dotted grid lines (flat, slightly above the valley floor), closer spacing than the dot grid.
  for (const c of gridColumns) {
    const x = X0 + c * DX;
    for (let i = 0; i < NS / 6; i++) add(x, GRID_Y, i * DS * 6, 0.035, 2.4, 0, 0, 0, 0);
  }
  for (const r of gridRows) {
    for (const tileOff of [0, TILE]) {
      const s = r * DS + tileOff;
      for (let i = 0; i < NX; i++) add(X0 + i * DX, GRID_Y, s, 0.035, 2.8, 0, 0, 0, 0);
    }
  }
  // Bright nodes where some dotted grid lines cross.
  const irng = mulberry32(6060);
  for (const r of gridRows) {
    for (const c of gridColumns) {
      if (irng() > 0.3) continue;
      for (const tileOff of [0, TILE]) {
        add(X0 + c * DX, GRID_Y, r * DS + tileOff, 0.07, 10, irange(irng, 1, 4), irng(), 1, 0);
        add(X0 + c * DX, GRID_Y, r * DS + tileOff, 0.22, 0.25, 0, 0, 1, 1);
      }
    }
  }
  // Nodes and vertical lines, replicated for both visible tiles.
  for (const n of NODES) {
    for (const tileOff of [0, TILE]) {
      const x = X0 + n.col * DX;
      const s = n.row * DS + tileOff;
      add(x, n.y, s, 0.06, 9 * n.bright, n.rate, n.phase, 1, 0);
      add(x, n.y, s, 0.22, 0.22 * n.bright, n.rate, n.phase, 1, 1);
      if (n.line > 0) {
        const steps = Math.floor(n.line / 0.035);
        for (let i = 1; i <= steps; i++) {
          const f = i / steps;
          add(x, n.y + i * 0.035, s, 0.03, 9 * (1 - f) * n.bright, n.rate, n.phase, 1, 0, -1);
        }
      }
    }
  }
  // Dust above the terrain.
  const rng = mulberry32(880);
  for (let i = 0; i < 3000; i++) {
    const warm = rng() < 0.25;
    const big = rng() < 0.06;
    add(range(rng, -18, 18), rng() < 0.85 ? range(rng, 0.3, 3) : range(rng, 3, 9), range(rng, 0, DEPTH), big ? range(rng, 0.06, 0.12) : range(rng, 0.012, 0.03), range(rng, 0.3, 1.2), 0, rng(), warm ? 3 : 2, 0, range(rng, 0.1, 0.5), i);
  }
  return { count: pos.length / 3, pos: new Float32Array(pos), p: new Float32Array(p), k: new Float32Array(k) };
};
const EXTRAS = buildExtras();

// ---------------------------------------------------------------- shaders
const POINT_COMMON = /* glsl */ `
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform float uU;          // loop phase, (frame % 600) / 600
uniform float uSCam;       // camera terrain coordinate
uniform float uPxPerUnit;  // pixels per metre at 1 m depth
uniform float uFocusInv;
uniform float uCocK;       // CoC radius (px) = uCocK * |1/zf - 1/z|
uniform float uMaxCoc;     // max CoC diameter px
uniform float uMinPx;      // minimum drawn diameter px
uniform float uGain;
uniform float uFogLen;
uniform vec3 cHaze;
uniform vec3 cFar;
out vec3 vCol;
out float vD;
flat out float vProfile;
${HASH}

// Place a point; size is its physical diameter. DoF: the drawn disc grows to the CoC and
// its intensity drops so the total energy stays constant (blur is free and deterministic).
void emit(vec3 world, float sizeW, vec3 col, float inten, float sRel, float profile) {
  vec4 v = viewMatrix * vec4(world, 1.0);
  float z = max(-v.z, 0.05);
  gl_Position = projectionMatrix * v;
  float geo = sizeW * uPxPerUnit / z;
  float coc = min(2.0 * uCocK * abs(uFocusInv - 1.0 / z), uMaxCoc);
  float d = max(max(geo, coc), uMinPx);
  float a = inten * uGain * min(geo * geo, d * d) / (d * d);
  float fog = 1.0 - exp(-sRel / uFogLen);
  // Distance: a bright, cool, streaky band toward the horizon (as in the reference).
  col = mix(col, cFar, fog * 0.45);
  a *= mix(1.0, 1.1, fog);
  a *= (1.0 - smoothstep(${(DEPTH * 0.8).toFixed(2)}, ${(DEPTH * 0.97).toFixed(2)}, sRel));
  a *= smoothstep(0.3, 1.5, sRel);
  vCol = col * a;
  vD = d;
  vProfile = profile;
  gl_PointSize = d;
}
`;

const GRID_VERT = /* glsl */ `${HEADER}
in float position;
uniform highp sampler2D tField;
uniform vec3 cLow;
uniform vec3 cRidge;
uniform vec3 cPlateau;
uniform vec3 cNodeTint;
${POINT_COMMON}
void main() {
  int id = gl_VertexID;
  int col = id % ${NX};
  int row = id / ${NX};
  int trow = row % ${NT};
  vec4 f = texelFetch(tField, ivec2(col, trow), 0);
  float plateau = f.g;
  // Small jitter outside plateaus; plateaus keep the tidy grid. Seeded by tile position.
  uint key = uint(col) * 7919u + uint(trow) * 104729u;
  float jx = (hash2u(key, 3u) - 0.5) * ${(DX * 0.7).toFixed(4)} * (1.0 - plateau * 0.8);
  float js = (hash2u(key, 4u) - 0.5) * ${(DS * 1.6).toFixed(4)} * (1.0 - plateau * 0.8);
  float jy = (hash2u(key, 5u) - 0.5) * 0.03 * (1.0 - plateau);
  float sRel = mod(float(row) * ${DS} + js - uSCam, ${DEPTH.toFixed(2)});
  vec3 world = vec3(${X0.toFixed(4)} + float(col) * ${DX} + jx, f.r + jy, -sRel);
  // Height/slope colour: valleys low colour, mid heights lift toward the pale plateau colour,
  // ridges and slopes ember.
  float mid = smoothstep(0.3, 1.2, f.r) * (1.0 - f.b);
  float ember = smoothstep(0.4, 0.65, f.b);
  vec3 cool = mix(cPlateau, cNodeTint, 0.3);
  vec3 col3 = mix(mix(cLow, cool, 0.35 + mid * 0.5), cRidge, ember);
  float inten = 1.0 + 0.5 * ember + 0.5 * mid;
  col3 = mix(col3, cPlateau, plateau * 0.7);
  inten *= 1.0 + 0.1 * plateau;
  // Faint per-dot variation.
  // Glittery clusters: per-dot sparkle weighted by a coarse cluster hash (tile-periodic).
  uint ckey = uint(col / 6) * 7919u + uint(trow / 9) * 104729u;
  float cluster = hash2u(ckey, 21u);
  float sp = hash2u(key, 9u);
  inten *= (0.35 + 1.3 * sp * sp) * (0.08 + 1.5 * cluster * cluster);
  emit(world, 0.034, col3, inten * 0.8, sRel, 0.0);
}
`;

const EXTRA_VERT = /* glsl */ `${HEADER}
in vec3 position; // x, y, s
in vec4 aP;       // size, intensity, pulse rate, phase
in vec4 aK;       // kind, profile, drift amp, drift seed
uniform vec3 cGrid;
uniform vec3 cNode;
uniform vec3 cDust;
uniform vec3 cWarm;
${POINT_COMMON}
void main() {
  float u = uU;
  vec3 p = position;
  float inten = aP.y;
  if (aP.z > 0.0) inten *= 0.5 + 0.5 * sin(6.2831853 * (aP.z * u + aP.w));
  float sRel0 = mod(p.z - uSCam, ${DEPTH.toFixed(2)});
  // Vertical node lines only read in the middle distance and beyond.
  if (aK.z < 0.0) inten *= smoothstep(5.0, 9.0, sRel0);
  if (aK.z > 0.0) {
    uint sd = uint(aK.w);
    float k1 = 1.0 + floor(hash2u(sd, 1u) * 3.0);
    float k2 = 1.0 + floor(hash2u(sd, 2u) * 3.0);
    p.x += aK.z * sin(6.2831853 * (k1 * u + aP.w));
    p.y += aK.z * 0.6 * sin(6.2831853 * (k2 * u + aP.w * 1.7));
    // twinkle, whole cycles
    inten *= 0.6 + 0.4 * sin(6.2831853 * ((k1 + k2) * u + aP.w * 3.1));
  }
  float sRel = mod(p.z - uSCam, ${DEPTH.toFixed(2)});
  vec3 world = vec3(p.x, p.y, -sRel);
  vec3 c = aK.x < 0.5 ? cGrid : (aK.x < 1.5 ? cNode : (aK.x < 2.5 ? cDust : cWarm));
  emit(world, aP.x, c, inten, sRel, aK.y);
}
`;

const POINT_FRAG = /* glsl */ `${HEADER}
in vec3 vCol;
in float vD;
flat in float vProfile;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = length(q);
  float w;
  if (vProfile > 0.5) {
    w = exp(-r * r * 5.0) * 2.2;
  } else {
    // Flat disc with a one-pixel soft edge (bokeh); tiny dots become a soft blob.
    float edge = clamp(2.0 / vD + vD * 0.03, 0.08, 1.0);
    w = 1.0 - smoothstep(1.0 - edge, 1.0, r);
    w *= 1.27; // compensate for the disc area (pi/4)
  }
  if (w <= 0.0) discard;
  outColor = vec4(vCol * w, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `${HEADER}
in vec2 vUv;
out vec4 outColor;
uniform float uHorizon;     // NDC y of the horizon
uniform float uTanHalf;
uniform vec3 cTop;
uniform vec3 cHaze;
uniform vec3 cBand;
uniform float uBand;
void main() {
  float y = vUv.y * 2.0 - 1.0;
  float e = (y - uHorizon) * uTanHalf;  // ~ elevation (rad) above the horizon
  vec3 c = mix(cHaze, cTop, smoothstep(-0.005, 0.2, e));
  c += cBand * uBand * exp(-pow((e - 0.012) / 0.02, 2.0));
  // Faint warm glow in the top-left corner.
  c += cBand * 0.35 * smoothstep(0.75, 0.0, length(vec2(vUv.x, 1.0 - vUv.y) * vec2(1.4, 1.6)));
  // Below the horizon the far terrain sits in haze that darkens toward the ground.
  c = mix(c, cHaze * 0.25, smoothstep(0.0, -0.08, e));
  outColor = vec4(c, 1.0);
}
`;

// ---------------------------------------------------------------- renderer
export class TerrainRenderer implements LookRenderer {
  private post: PostPipeline;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(CAM.fov, 16 / 9, 0.05, 200);
  private uni: Record<string, THREE.IUniform>;
  private sky: THREE.RawShaderMaterial;
  private fieldTex: THREE.DataTexture;
  private h = 1;
  private maxPoint = 256;

  constructor(
    gl: THREE.WebGLRenderer,
    private v: TerrainVersion,
  ) {
    this.post = new PostPipeline(gl);
    const ctx = gl.getContext();
    this.maxPoint = (ctx.getParameter(ctx.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1];

    this.fieldTex = new THREE.DataTexture(FIELD.data, NX, NT, THREE.RGBAFormat, THREE.FloatType);
    this.fieldTex.minFilter = THREE.NearestFilter;
    this.fieldTex.magFilter = THREE.NearestFilter;
    this.fieldTex.generateMipmaps = false;
    this.fieldTex.needsUpdate = true;

    const L = (h: string) => new THREE.Vector3(...hexLinear(h));
    this.uni = {
      uU: { value: 0 },
      uSCam: { value: 0 },
      uPxPerUnit: { value: 1 },
      uFocusInv: { value: 1 / CAM.focus },
      uCocK: { value: 1 },
      uMaxCoc: { value: 64 },
      uMinPx: { value: 1.5 },
      uGain: { value: 1 },
      uFogLen: { value: 38 },
      cHaze: { value: L(v.skyHaze) },
      cFar: { value: L(v.node) },
    };

    // Sky (drawn first, full screen).
    this.sky = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `${HEADER}\nin vec3 position;\nout vec2 vUv;\nvoid main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uHorizon: { value: 0.4 },
        uTanHalf: { value: Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2)) },
        cTop: { value: L(v.skyTop) },
        cHaze: { value: L(v.skyHaze) },
        cBand: { value: L(v.hazeBand) },
        uBand: { value: v.hazeBandStrength },
      },
      depthTest: false,
      depthWrite: false,
    });
    const skyGeo = new THREE.BufferGeometry();
    skyGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const skyMesh = new THREE.Mesh(skyGeo, this.sky);
    skyMesh.frustumCulled = false;
    skyMesh.renderOrder = 0;
    this.scene.add(skyMesh);

    // Main dot grid: positions come from gl_VertexID + the field texture.
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NX * NS), 1));
    const grid = new THREE.Points(
      gridGeo,
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: GRID_VERT,
        fragmentShader: POINT_FRAG,
        uniforms: {
          ...this.uni,
          tField: { value: this.fieldTex },
          cLow: { value: L(v.low) },
          cRidge: { value: L(v.ridge) },
          cPlateau: { value: L(v.plateau) },
          cNodeTint: { value: L(v.node) },
        },
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    grid.frustumCulled = false;
    grid.renderOrder = 1;
    this.scene.add(grid);

    const exGeo = new THREE.BufferGeometry();
    exGeo.setAttribute("position", new THREE.BufferAttribute(EXTRAS.pos, 3));
    exGeo.setAttribute("aP", new THREE.BufferAttribute(EXTRAS.p, 4));
    exGeo.setAttribute("aK", new THREE.BufferAttribute(EXTRAS.k, 4));
    const extras = new THREE.Points(
      exGeo,
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: EXTRA_VERT,
        fragmentShader: POINT_FRAG,
        uniforms: {
          ...this.uni,
          cGrid: { value: L(v.plateau).lerp(L(v.node), 0.5) },
          cNode: { value: L(v.node) },
          cDust: { value: L(v.plateau).lerp(L(v.node), 0.3) },
          cWarm: { value: L(v.ridge).multiplyScalar(1.6) },
        },
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    extras.frustumCulled = false;
    extras.renderOrder = 2;
    this.scene.add(extras);
  }

  setSize(w: number, h: number) {
    this.h = h;
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(frame: number) {
    const f = frame % LOOP_FRAMES;
    const u = f / LOOP_FRAMES;
    const cam = this.camera;
    const tau = Math.PI * 2;
    // Glide forward exactly one tile per loop, with a tiny sway (whole cycles).
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2));
    const pitch = -Math.atan((0.5 - CAM.horizonFromTop) * 2 * tanHalf);
    cam.position.set(0.18 * Math.sin(tau * u), CAM.height + 0.05 * Math.sin(tau * 2 * u + 1), 0);
    cam.rotation.set(pitch + 0.003 * Math.sin(tau * 3 * u), 0.004 * Math.sin(tau * u + 0.5), 0.004 * Math.sin(tau * u + 2), "YXZ");
    cam.updateMatrixWorld(true);
    // Horizon in NDC (for the sky).
    const hv = new THREE.Vector3(0, CAM.height, -1e4).project(cam);
    this.sky.uniforms.uHorizon.value = hv.y;

    const res = this.h / 2160;
    this.uni.uU.value = u;
    this.uni.uSCam.value = u * TILE;
    this.uni.uPxPerUnit.value = this.h / (2 * tanHalf);
    // Near ground (~6 m) gets a CoC radius of ~2.2% of frame height.
    const nearZ = 6;
    this.uni.uCocK.value = (0.028 * this.h) / (1 / nearZ - 1 / CAM.focus);
    this.uni.uMaxCoc.value = Math.min(0.06 * this.h, this.maxPoint);
    this.uni.uMinPx.value = Math.max(1.5 * res * 3, 1.25);
    this.uni.uGain.value = 0.36;

    this.post.renderScene(this.scene, cam, [0, 0, 0]);
    this.post.finish(this.post.scene.texture, {
      bloomStrength: 0.6,
      bloomThreshold: 0.6,
      bloomKnee: 0.4,
      bloomRadius: 0.8,
      caEdge: 0.004,
      rgbSplit: 0,
      gradeGain: this.v.gradeGain as RGB,
      gradeLift: this.v.gradeLift as RGB,
      exposure: 1,
      vignette: 0.75,
      grain: 0.015,
      grainFrame: f,
    });
  }

  dispose() {
    this.post.dispose();
    this.fieldTex.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
