import * as THREE from "three";
import type { LandPolygons } from "../lib/assets";
import { DEFAULT_POST } from "../lib/pipeline";
import { mulberry32 } from "../lib/random";
import type { LookFactory } from "../lib/Stage";

export type PanelsParams = {
  panel: string; // panel fill
  panelAlpha: number;
  text: string; // numbers, lines, edges
  map: string; // land colour
  mapAlpha: number;
  background: string;
  glow: string; // backlight glow colour (top left)
  haze: string; // depth haze
  bloom: number;
};

const FOV = 40;
const ASPECT = 16 / 9;
const viewW = (d: number) => 2 * d * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * ASPECT;

// Depth layers. Each layer is a periodic strip of panels, `lw` wide, and
// slides left by exactly k·lw per loop. Screen speed grows with k: parallax.
type Layer = { depth: number; k: number; count: number; minW: number; maxW: number; yRange: [number, number] };
const LAYERS: Layer[] = [
  { depth: 26, k: 1, count: 10, minW: 5, maxW: 9, yRange: [-6, 7] },
  { depth: 17, k: 1, count: 10, minW: 3.5, maxW: 6.5, yRange: [-3.0, 5] },
  { depth: 11.5, k: 1, count: 5, minW: 2.6, maxW: 4.2, yRange: [2.3, 3.8] },
  { depth: 6.8, k: 2, count: 2, minW: 2.2, maxW: 3.0, yRange: [2.6, 3.2] },
];
const MAP_LAYER = { depth: 16, k: 1 };

type Panel = {
  layer: number;
  x: number; // within [0, lw)
  y: number;
  w: number;
  h: number;
  type: number; // 0 numbers, 1 text columns, 2 map window
  cols: number;
  rows: number;
  seed: number;
  rotY: number;
  rotX: number;
  mapWin: [number, number, number, number];
};

// Generated once with a seeded PRNG at module level.
const PANELS: Panel[] = (() => {
  const rnd = mulberry32(424242);
  const out: Panel[] = [];
  LAYERS.forEach((L, li) => {
    const lw = viewW(L.depth) * 1.25;
    for (let i = 0; i < L.count; i++) {
      const w = L.minW + rnd() * (L.maxW - L.minW);
      const r = rnd();
      const type = r < 0.78 ? 0 : r < 0.88 ? 1 : 2;
      // far layers: tall slabs packed with small cells
      const tall = li < 2 && type === 0;
      const cols = type === 0 ? (tall ? 6 + Math.floor(rnd() * 5) : 4 + Math.floor(rnd() * 4)) : type === 1 ? 1 + Math.floor(rnd() * 2) : 1;
      const h = w * (tall ? 0.9 + rnd() * 0.7 : 0.45 + rnd() * 0.4);
      const rows = Math.max(4, Math.round((h / w) * cols * 2.9));
      const mu = rnd() * 0.7;
      const mv = 0.2 + rnd() * 0.4;
      out.push({
        layer: li,
        x: ((i + rnd() * 0.6) / L.count) * lw,
        y: L.yRange[0] + rnd() * (L.yRange[1] - L.yRange[0]),
        w,
        h,
        type,
        cols,
        rows,
        seed: Math.floor(rnd() * 100000),
        rotY: (li < 2 ? 0.78 : 0.5) + (rnd() - 0.5) * 0.2,
        rotX: (rnd() - 0.5) * 0.08,
        mapWin: [mu, mv, mu + 0.22, mv + 0.22 * (h / w) * 2],
      });
    }
  });
  // Hero: a large, sharp number table at the lower left of the focus layer.
  const lw2 = viewW(LAYERS[2].depth) * 1.25;
  for (const hx of [0.68]) {
    out.push({
      layer: 2, x: lw2 * hx, y: -2.2, w: 7.6, h: 4.6, type: 0, cols: 6, rows: 12, seed: 77,
      rotY: 0.04, rotX: 0.0, mapWin: [0, 0, 1, 1],
    });
  }
  return out;
})();

const NUMBERS = 256;
const buildNumberAtlas = () => {
  const cw = 256;
  const ch = 64;
  const canvas = document.createElement("canvas");
  canvas.width = cw * 16;
  canvas.height = ch * 16;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = `400 38px "JetBrains Mono"`;
  ctx.textBaseline = "middle";
  const rnd = mulberry32(99);
  for (let i = 0; i < NUMBERS; i++) {
    // random data numbers, e.g. 6510.552
    const v = (rnd() * 9999).toFixed(3).padStart(8, "0").replace(/^0+(?=\d)/, "");
    ctx.fillText(v, (i % 16) * cw + 14, Math.floor(i / 16) * ch + ch / 2 + 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  return tex;
};

// Natural Earth 1:110m land, equirectangular, white on black.
const buildMapTexture = (land: LandPolygons) => {
  const W = 4096;
  const H = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  for (const ring of land) {
    ctx.beginPath();
    ring.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * W;
      const y = ((90 - lat) / 180) * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  return tex;
};

const PANEL_VERT = /* glsl */ `
attribute vec4 aInfo; // type, cols, rows, seed
attribute vec2 aSize; // world w, h
attribute vec4 aMapWin;
varying vec2 vUv;
flat varying vec4 vInfo;
varying vec2 vSize;
varying vec4 vMapWin;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  vInfo = aInfo;
  vSize = aSize;
  vMapWin = aMapWin;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const PANEL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D numbers;
uniform sampler2D mapTex;
uniform vec3 fillCol, textCol, mapCol;
uniform float fillAlpha, mapAlpha;
uniform float frame; // modulo loop length
uniform vec3 fogCol;
varying float vDepth;
varying vec2 vUv;
flat varying vec4 vInfo;
varying vec2 vSize;
varying vec4 vMapWin;
uint h32(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}
float r01(uvec3 v) { return float(h32(v)) / 4294967295.0; }
// accumulate a layer over (col, a)
void over(inout vec3 col, inout float a, vec3 c, float ca) {
  col = mix(col, c, ca);
  a = a + ca * (1.0 - a);
}
float lineAA(float d, float wpx) {
  float fw = fwidth(d);
  return 1.0 - smoothstep(wpx * fw * 0.5, (wpx * 0.5 + 1.0) * fw, abs(d));
}
void main() {
  int type = int(vInfo.x + 0.5);
  float cols = vInfo.y, rows = vInfo.z;
  uint seed = uint(vInfo.w + 0.5);
  vec2 uv = vUv;
  // glass fill, a touch brighter at the top
  vec3 col = fillCol * (0.85 + 0.3 * uv.y);
  // the hero table is nearly opaque, like the large foreground table in the reference
  float a = seed == 77u ? 0.9 : fillAlpha;

  if (type == 2) {
    vec2 muv = mix(vMapWin.xy, vMapWin.zw, uv);
    muv.y = 1.0 - muv.y;
    float land = texture2D(mapTex, muv).r;
    over(col, a, mapCol, land * mapAlpha);
  } else {
    vec2 g = vec2(uv.x * cols, (1.0 - uv.y) * rows);
    vec2 cell = floor(g);
    vec2 f = fract(g);
    // fine grid lines
    float gl = max(lineAA(f.x - 0.0, 1.0) , lineAA(f.y - 0.0, 1.0));
    gl = max(gl, max(lineAA(f.x - 1.0, 1.0), lineAA(f.y - 1.0, 1.0)));
    over(col, a, textCol, gl * 0.5);
    uvec3 cid = uvec3(uvec2(cell), seed);
    // hold schedule: each cell keeps its value for 15/20/30/60 frames (÷600)
    float hs = r01(cid + uvec3(0, 0, 11u));
    float holds[4] = float[4](15.0, 20.0, 30.0, 60.0);
    float hold = holds[int(hs * 3.999)];
    float st = mod(floor((frame + floor(hs * hold)) / hold), 600.0 / hold);
    if (type == 0) {
      float blank = step(r01(cid + uvec3(0, 0, 5u)), 0.08);
      // some panels show every cell as a lighter "block"
      float blocky = seed == 77u ? 0.0 : step(0.3, r01(uvec3(seed, 1u, 2u)));
      vec2 cellSz = vSize / vec2(cols, rows);
      vec2 pc = f * cellSz; // position inside the cell, world units
      float inset = 0.13 * cellSz.y;
      float blk = blocky * step(inset, pc.x) * step(pc.x, cellSz.x - inset) * step(inset, pc.y) * step(pc.y, cellSz.y - inset);
      over(col, a, mix(fillCol, vec3(0.2, 0.5, 0.95), 0.5), blk * 0.9);
      float n = floor(r01(uvec3(cid.xy, seed + uint(st) * 7919u)) * ${NUMBERS}.0);
      vec2 nc = vec2(mod(n, 16.0), floor(n / 16.0));
      // aspect-correct glyph box (atlas cell is 4:1)
      float gh = cellSz.y * (blocky > 0.5 ? 0.5 : 0.7);
      float gw = gh * 4.0;
      float k = min(1.0, cellSz.x * 0.94 / gw);
      gh *= k; gw *= k;
      vec2 o = vec2(cellSz.x * 0.04, (cellSz.y - gh) * 0.5);
      vec2 inCell = (pc - o) / vec2(gw, gh);
      float inside = step(0.0, inCell.x) * step(inCell.x, 1.0) * step(0.0, inCell.y) * step(inCell.y, 1.0);
      vec2 auv = (nc + inCell) / 16.0;
      auv.y = 1.0 - auv.y;
      float glyph = texture2D(numbers, auv).r * inside * (1.0 - blank);
      // numbers too small to read become a faint texture instead of noise
      float cellPx = 1.0 / max(fwidth(g.y), 1e-5);
      glyph *= smoothstep(9.0, 16.0, cellPx);
      over(col, a, textCol, glyph);
    } else {
      // text columns: short bars like lines of text, lengths re-picked per hold
      vec2 g2 = vec2(uv.x * cols, (1.0 - uv.y) * rows * 3.0);
      vec2 c2 = floor(g2);
      vec2 f2 = fract(g2);
      float len = 0.2 + 0.75 * r01(uvec3(uvec2(c2), seed + uint(st) * 131u));
      float bar = step(0.06, f2.x) * step(f2.x, 0.06 + len * 0.85) * step(0.38, f2.y) * step(f2.y, 0.62);
      over(col, a, textCol, bar * 0.9);
    }
  }
  // thin bright edges
  vec2 e = min(uv, 1.0 - uv) * vSize; // distance to edge in world units
  float edge = 1.0 - smoothstep(0.0, max(fwidth(e.x), fwidth(e.y)) * 1.5 + 0.004, min(e.x, e.y));
  over(col, a, textCol, edge * 0.7);
  // depth haze towards teal
  col = mix(col, fogCol, smoothstep(9.0, 32.0, vDepth) * 0.5);
  gl_FragColor = vec4(col, a);
}
`;

const MAP_FRAG = /* glsl */ `
uniform sampler2D mapTex;
uniform vec3 mapCol;
uniform float mapAlpha;
uniform float shift; // in map widths
uniform vec3 hazeCol;
varying vec2 vUv;
void main() {
  vec2 muv = vec2(vUv.x + shift, vUv.y);
  float land = texture2D(mapTex, muv).r;
  // fade out the poles (no Antarctica band across the bottom)
  float edgeFade = smoothstep(0.14, 0.26, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
  // same depth haze as the panels at this distance
  gl_FragColor = vec4(mix(mapCol, hazeCol, 0.45), land * mapAlpha * edgeFade);
}
`;

const BG_FRAG = /* glsl */ `
uniform vec3 base, glow;
varying vec2 vUv;
void main() {
  vec2 q = (vUv - vec2(0.12, 0.92)) * vec2(1.7, 1.0);
  float g = exp(-dot(q, q) * 3.2);
  vec2 q2 = (vUv - vec2(0.62, 0.28)) * vec2(1.4, 1.0);
  float g2 = exp(-dot(q2, q2) * 6.0) * 0.35;
  gl_FragColor = vec4(base + glow * (g * 0.9 + g2), 1.0);
}
`;

export const dataPanels =
  (p: PanelsParams, frames: number): LookFactory =>
  ({ assets, aspect }) => {
    if (!assets.land) throw new Error("map data not loaded");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(p.background);
    const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.5, 200);
    camera.position.set(0, 0, 0);
    camera.rotation.set(0.02, -0.06, 0.0);
    camera.updateMatrixWorld();

    const numbers = buildNumberAtlas();
    const mapTex = buildMapTexture(assets.land);

    // Background glow plane, far behind everything.
    const bgMat = new THREE.ShaderMaterial({
      uniforms: { base: { value: new THREE.Color(p.background) }, glow: { value: new THREE.Color(p.glow) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: BG_FRAG,
      depthWrite: true,
    });
    const bgD = 60;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(viewW(bgD) * 1.6, (viewW(bgD) * 1.6) / ASPECT), bgMat);
    bg.position.set(-viewW(bgD) * 0.12, 0, -bgD);
    bg.renderOrder = 0;
    scene.add(bg);

    // The large world map (its own layer; the map is periodic in longitude).
    const mapW = viewW(MAP_LAYER.depth) * 0.85;
    const mapMat = new THREE.ShaderMaterial({
      uniforms: {
        mapTex: { value: mapTex },
        mapCol: { value: new THREE.Color(p.map) },
        mapAlpha: { value: p.mapAlpha },
        shift: { value: 0 },
        hazeCol: { value: new THREE.Color(p.haze) },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: MAP_FRAG,
      transparent: true,
      depthWrite: true,
    });
    // Covers the view; the texture scrolls (one full 360° per loop).
    const mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(mapW * 1.4, mapW * 0.7), mapMat);
    mapPlane.position.set(-mapW * 0.05, 1.3, -MAP_LAYER.depth);
    mapPlane.renderOrder = 15;
    scene.add(mapPlane);

    // Panels: instanced, with copies so each periodic strip always covers the view.
    const COPIES = 5; // m = -1 .. 3
    const count = PANELS.length * COPIES;
    const geo = new THREE.PlaneGeometry(1, 1);
    const info = new Float32Array(count * 4);
    const size = new Float32Array(count * 2);
    const win = new Float32Array(count * 4);
    PANELS.forEach((pn, i) => {
      for (let c = 0; c < COPIES; c++) {
        const j = i * COPIES + c;
        info.set([pn.type, pn.cols, pn.rows, pn.seed], j * 4);
        size.set([pn.w, pn.h], j * 2);
        win.set(pn.mapWin, j * 4);
      }
    });
    geo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(info, 4));
    geo.setAttribute("aSize", new THREE.InstancedBufferAttribute(size, 2));
    geo.setAttribute("aMapWin", new THREE.InstancedBufferAttribute(win, 4));
    const panelMat = new THREE.ShaderMaterial({
      vertexShader: PANEL_VERT,
      fragmentShader: PANEL_FRAG,
      uniforms: {
        numbers: { value: numbers },
        mapTex: { value: mapTex },
        fillCol: { value: new THREE.Color(p.panel) },
        textCol: { value: new THREE.Color(p.text) },
        mapCol: { value: new THREE.Color(p.map) },
        fillAlpha: { value: p.panelAlpha },
        mapAlpha: { value: p.mapAlpha },
        frame: { value: 0 },
        fogCol: { value: new THREE.Color(p.haze) },
      },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    // One instanced mesh per layer so the layers draw far → near.
    const layerMeshes = LAYERS.map((_, li) => {
      const ids = PANELS.map((pn, i) => (pn.layer === li ? i : -1)).filter((i) => i >= 0);
      const lgeo = new THREE.InstancedBufferGeometry();
      lgeo.index = geo.index;
      lgeo.setAttribute("position", geo.getAttribute("position"));
      lgeo.setAttribute("uv", geo.getAttribute("uv"));
      lgeo.setAttribute("normal", geo.getAttribute("normal"));
      const n = ids.length * COPIES;
      const pick = (src: Float32Array, k: number) => {
        const out = new Float32Array(n * k);
        ids.forEach((pi, a) => {
          for (let c = 0; c < COPIES; c++) out.set(src.subarray((pi * COPIES + c) * k, (pi * COPIES + c + 1) * k), (a * COPIES + c) * k);
        });
        return out;
      };
      lgeo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(pick(info, 4), 4));
      lgeo.setAttribute("aSize", new THREE.InstancedBufferAttribute(pick(size, 2), 2));
      lgeo.setAttribute("aMapWin", new THREE.InstancedBufferAttribute(pick(win, 4), 4));
      const mesh = new THREE.InstancedMesh(lgeo, panelMat, n);
      mesh.frustumCulled = false;
      // map layer sits between the two far layers and the near ones
      mesh.renderOrder = li < 2 ? 10 + li : 20 + li;
      scene.add(mesh);
      return { mesh, ids };
    });

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();

    return {
      scene,
      camera,
      update: (frame) => {
        const fm = ((frame % frames) + frames) % frames;
        const t = fm / frames;
        panelMat.uniforms.frame.value = fm;
        layerMeshes.forEach(({ mesh, ids }, li) => {
          const L = LAYERS[li];
          const lw = viewW(L.depth) * 1.25;
          const shift = L.k * lw * t; // whole layout widths per loop
          ids.forEach((pi, a) => {
            const pn = PANELS[pi];
            for (let c = 0; c < COPIES; c++) {
              const mIdx = c - 1;
              const x = pn.x - lw * 0.5 - shift + mIdx * lw - lw * 0.15;
              // small per-panel depth offsets avoid coplanar overlaps; the hero sits in front
              v.set(x, pn.y, -L.depth + (pn.seed === 77 ? 1.6 : ((pn.seed % 97) / 97 - 0.5) * 0.6));
              q.setFromEuler(e.set(pn.rotX, pn.rotY, 0));
              s.set(pn.w, pn.h, 1);
              m.compose(v, q, s);
              mesh.setMatrixAt(a * COPIES + c, m);
            }
          });
          mesh.instanceMatrix.needsUpdate = true;
        });
        mapMat.uniforms.shift.value = MAP_LAYER.k * t + 0.72; // one full 360° per loop
        return {
          ...DEFAULT_POST,
          focusDist: 10.6,
          aperture: 0.9,
          focusBand: 0.1,
          nearScale: 0.25,
          maxBlur: 0.012,
          bloomThreshold: 0.45,
          bloomStrength: p.bloom,
          bloomWeights: [0.5, 0.5, 0.45, 0.4],
          vignette: 0.2,
          flare: { x: 0.0, y: 1.0, radius: 0.36, color: [0.6, 0.92, 1.0], strength: 0.75 },
          veil: { color: [0.01, 0.16, 0.26], amount: 0.32 },
        };
      },
      dispose: () => {
        numbers.dispose();
        mapTex.dispose();
        panelMat.dispose();
        mapMat.dispose();
        bgMat.dispose();
      },
    };
  };
