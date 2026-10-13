// Look 5 — Binary Plane. ~36k instanced glyph quads (120 columns x 300 rows)
// on a tilted plane, sampled from a JetBrains Mono atlas (mipmaps +
// anisotropic filtering). Streams run down ~50% of the columns, each moving
// a whole number of periods per 600 frames. DoF is analytic on the plane.
import * as THREE from "three";
import type { SceneBuilder } from "../lib/ThreeStage";
import { GLYPHS } from "../lib/glyphAtlas";
import { hexToLinear, LOOP, mulberry32 } from "../lib/random";

export type BinaryVersion = { head: string; tail: string; dim: string };

const COLS = 120, ROWS = 300, PX = 0.72, PZ = 0.7; // column / row pitch (world)
const Z_NEAR = 60; // row 0 world z (rows recede to -z)
const HOLDS = [20, 30, 40, 50, 60, 75]; // glyph swap holds, all divide 600
const PERIODS = [20, 25, 30, 50]; // stream repeat along a column (rows), all divide 300

const layout = () => {
  const rnd = mulberry32(0x1a4a8a);
  const n = COLS * ROWS;
  const cell = new Float32Array(n * 2);
  const misc = new Float32Array(n * 3); // glyph seed, hold, brightness
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const k = r * COLS + c;
      cell.set([c, r], k * 2);
      misc.set([Math.floor(rnd() * 1e6), HOLDS[Math.floor(rnd() * HOLDS.length)], 0.6 + 0.4 * rnd()], k * 3);
    }
  // per-column stream: [has, period(rows), length(rows), speed (periods/loop), phase]
  const streams = new Float32Array(COLS * 4);
  for (let c = 0; c < COLS; c++) {
    const has = rnd() < 0.5;
    const period = PERIODS[Math.floor(rnd() * PERIODS.length)];
    const len = 8 + Math.floor(rnd() * 23);
    const speed = 1 + Math.floor(rnd() * 3);
    streams.set([has ? period : 0, len, speed, rnd()], c * 4);
  }
  return { n, cell, misc, streams };
};

const VERT = /* glsl */ `
precision highp float;
uniform mat4 projectionMatrix; uniform mat4 viewMatrix;
uniform float uFrame; uniform vec4 uStreams[${COLS}];
uniform vec3 uHead; uniform vec3 uTail; uniform vec3 uDim;
in vec3 position; in vec2 iCell; in vec3 iMisc;
out vec2 vUv; out vec3 vColor;
uint hashU(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
void main() {
  float c = iCell.x, r = iCell.y;
  // glyph choice: mostly 0/1, ~10% S H T = +, re-picked on a seeded hold
  float bucket = floor(uFrame / iMisc.y);
  uint h = hashU(uint(iMisc.x) * 747796405u + uint(bucket) * 2891336453u);
  float u01 = float(h & 0xffffu) / 65536.0;
  float g = u01 < 0.9 ? floor(u01 / 0.45) : 2.0 + floor((u01 - 0.9) / 0.1 * 5.0);
  g = min(g, ${(GLYPHS.length - 1).toFixed(1)});
  // stream
  vec4 s = uStreams[int(c)];
  vec3 col = uDim * 0.25 * iMisc.z * 4.5;
  if (s.x > 0.0) {
    float period = s.x, len = s.y;
    float head = fract(s.w + s.z * uFrame / ${LOOP.toFixed(1)}) * period; // moves toward row 0 ("down")
    float d = mod(r - (period - head), period);  // rows behind the head (0 = head)
    float t = d / len;
    if (t < 1.0) {
      float headGlow = exp(-d * d / 1.2);
      float tail = pow(1.0 - t, 0.9);
      // a few glyphs in each tail lean aqua-green
      float aqua = float((h >> 20) & 7u) < 3.0 ? 0.55 : 0.0;
      vec3 tc = mix(uTail, vec3(uTail.g * 0.25, uTail.g, uTail.b * 0.45), aqua);
      col += uHead * headGlow * 0.8 + tc * tail * 2.2 * (1.0 - headGlow * 0.6);
    }
  }
  vColor = col;
  vUv = vec2((g + position.x * 0.5 + 0.5) / 8.0, position.y * 0.5 + 0.5);
  vec3 world = vec3((c - ${(COLS / 2).toFixed(1)}) * ${PX.toFixed(3)} + position.x * 0.32,
                    0.0,
                    ${Z_NEAR.toFixed(1)} - r * ${PZ.toFixed(3)} - position.y * 0.36);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uAtlas;
in vec2 vUv; in vec3 vColor; out vec4 outColor;
void main() {
  float a = texture(uAtlas, vUv).r;
  outColor = vec4(vColor * a, 1.0);
}`;

const GRID_VERT = /* glsl */ `
precision highp float;
uniform mat4 projectionMatrix; uniform mat4 viewMatrix; uniform mat4 modelMatrix;
in vec3 position; out vec2 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GRID_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uDim; in vec2 vW; out vec4 outColor;
void main() {
  // fine grid: 4 lines per glyph cell, faded out where the lines get thinner than a pixel
  vec2 p = vW * vec2(4.0 / ${PX.toFixed(3)}, 4.0 / ${PZ.toFixed(3)});
  vec2 fw = fwidth(p);
  vec2 l = 1.0 - smoothstep(vec2(0.0), fw * 1.2, abs(fract(p) - 0.5) * 2.0 * 0.5);
  // horizontal scanlines a little stronger than the verticals
  float line = max(l.x * 0.2, l.y) * (1.0 - smoothstep(0.25, 0.6, max(fw.x, fw.y)));
  outColor = vec4(uDim * (0.012 + 0.04 * line), 1.0);
}`;

export const makeBinary = (v: BinaryVersion, atlasCanvas: HTMLCanvasElement): SceneBuilder => {
  const L = layout();
  return ({ maxAniso }) => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.2, 400);
    const atlas = new THREE.CanvasTexture(atlasCanvas);
    atlas.generateMipmaps = true;
    atlas.minFilter = THREE.LinearMipmapLinearFilter;
    atlas.magFilter = THREE.LinearFilter;
    atlas.anisotropy = maxAniso;
    atlas.colorSpace = THREE.NoColorSpace;
    atlas.needsUpdate = true;

    const streams: THREE.Vector4[] = [];
    for (let c = 0; c < COLS; c++) streams.push(new THREE.Vector4(...L.streams.slice(c * 4, c * 4 + 4)));
    const uniforms = {
      uFrame: { value: 0 },
      uStreams: { value: streams },
      uHead: { value: new THREE.Color(...hexToLinear(v.head)) },
      uTail: { value: new THREE.Color(...hexToLinear(v.tail)) },
      uDim: { value: new THREE.Color(...hexToLinear(v.dim)) },
      uAtlas: { value: atlas },
    };
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.setAttribute("iCell", new THREE.InstancedBufferAttribute(L.cell, 2));
    geo.setAttribute("iMisc", new THREE.InstancedBufferAttribute(L.misc, 3));
    geo.instanceCount = L.n;
    const glyphs = new THREE.Mesh(geo, new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }));
    glyphs.frustumCulled = false;

    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(COLS * PX, ROWS * PZ).rotateX(-Math.PI / 2),
      new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: GRID_VERT, fragmentShader: GRID_FRAG, uniforms, depthWrite: false, depthTest: false }),
    );
    grid.position.set(-PX / 2, 0, Z_NEAR - (ROWS * PZ) / 2 + PZ / 2);
    grid.renderOrder = -1;
    scene.add(grid, glyphs);

    const H = 8.0;
    const update = (f: number) => {
      uniforms.uFrame.value = f;
      const ph = (2 * Math.PI * f) / LOOP;
      camera.position.set(4 + 0.6 * Math.sin(ph), H + 0.15 * Math.sin(2 * ph), 50 + 0.6 * Math.cos(ph));
      camera.rotation.order = "YXZ";
      camera.rotation.set(
        THREE.MathUtils.degToRad(-40),
        THREE.MathUtils.degToRad(12 + 1.2 * Math.sin(ph)),
        THREE.MathUtils.degToRad(-24),
      );
    };
    const focus = H / Math.sin(THREE.MathUtils.degToRad(40));
    return {
      scene, camera, update,
      post: {
        bloomStrength: 0.3, bloomThreshold: 0.0, bloomRadius: 1.0, vignette: 0.35,
        grain: 0.015, grainFloor: 0, exposure: 1.0,
        dof: { surface: { kind: "plane", normal: new THREE.Vector3(0, 1, 0), d: 0 }, focusDist: focus, scale: 0.042, farScale: 0.03, maxCoc: 0.014 },
      },
    };
  };
};
