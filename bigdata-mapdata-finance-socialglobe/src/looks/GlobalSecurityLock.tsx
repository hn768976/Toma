import * as THREE from "three";
import { Assets, traceLand } from "../lib/assets";
import { Batch2D, linearRGB, premultBlend, texPlaneMaterial } from "../lib/batch2d";
import { ICONS, canvasTexture, glyphAtlas, makeCanvas } from "../lib/canvas";
import { Billboards, Lines3D } from "../lib/prims3d";
import { clamp01, easeOutCubic, hash2, irange, mulberry32, pick, range, remap, stepIndex } from "../lib/random";
import { BuildFn, LookProps, Stage } from "../lib/Stage";
import { LayerSpec } from "../lib/pipeline";

// Look 5 — Global Security Lock. A padlock drawn by an SDF shader (edges draw
// on, then binary digits from the glyph atlas fill and scroll), radial light
// burst with outward dashes, a horizontal anamorphic streak, and line icons
// at many depths over a dark Natural Earth map.

export const LOCK_FRAMES = 600;

const EDGE = "#9FECFF";
const GLOW = "#1FA0FF";
const DIGIT = "#7FD4FF";
const LANDC = "#071A3C";
const MAP_TINT = 0.6;
const BG = "#020C24";

const CAM_Z = 20;
const FOV = 30;
const VIS_H = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const VIS_W = (VIS_H * 16) / 9;

const LOCK_H = VIS_H * 0.4; // lock quad height (world)

// ---------------------------------------------------------------------------

const lockMaterial = () => {
  const ga = glyphAtlas();
  return premultBlend(
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uGlyphs: { value: ga.texture },
        uGrid: { value: new THREE.Vector2(ga.cols, ga.rows) },
        uIdx: { value: new THREE.Vector2(ga.index("0"), ga.index("1")) },
        uFrame: { value: 0 },
        uEdge: { value: 0 }, // body draw-on 0..1
        uShackle: { value: 0 }, // shackle draw-on 0..1
        uFill: { value: 0 }, // digit fill 0..1
        uPulse: { value: 1 },
        uEdgeCol: { value: new THREE.Vector3(...linearRGB(EDGE)) },
        uGlowCol: { value: new THREE.Vector3(...linearRGB(GLOW)) },
        uDigitCol: { value: new THREE.Vector3(...linearRGB(DIGIT)) },
      },
      vertexShader: /* glsl */ `
        out vec2 vP;
        void main(){ vP = (uv - 0.5) * vec2(1.0, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        layout(location = 0) out highp vec4 fragOut;
        in vec2 vP;
        uniform sampler2D uGlyphs; uniform vec2 uGrid; uniform vec2 uIdx;
        uniform float uFrame, uEdge, uShackle, uFill, uPulse;
        uniform vec3 uEdgeCol, uGlowCol, uDigitCol;
        const float PI = 3.14159265;
        // lock-local coordinates: quad is 1 x 1, y up, centre (0,0)
        const vec2 BODY_C = vec2(0.0, -0.17);
        const vec2 BODY_H = vec2(0.33, 0.25);
        const float BODY_R = 0.022;
        const vec2 SH_C = vec2(0.0, 0.13);   // shackle arc centre
        const float SH_R = 0.205;           // shackle centre-line radius
        const float SH_T = 0.055;           // shackle half thickness
        const float LEG_B = 0.08;           // legs go down into the body top
        float sdRoundBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
        float sdShackle(vec2 p){
          vec2 q = p - SH_C;
          float d;
          if (q.y > 0.0) d = abs(length(q) - SH_R);
          else d = (p.y < LEG_B) ? 1e3 : abs(abs(q.x) - SH_R);
          return d - SH_T;
        }
        float h21(vec2 p){ uvec2 u = uvec2(ivec2(p) + 4096); uint v = u.x * 1664525u + u.y * 1013904223u; v ^= v >> 16; v *= 0x7feb352du; v ^= v >> 15; v *= 0x846ca68bu; v ^= v >> 16; return float(v) / 4294967295.0; }
        void main(){
          vec2 p = vP;
          float fw = fwidth(p.x) + fwidth(p.y);
          vec2 pDx = dFdx(p), pDy = dFdy(p);
          float dB = sdRoundBox(p - BODY_C, BODY_H, BODY_R);
          float dS = sdShackle(p);
          // keyhole
          vec2 kc = vec2(0.0, -0.13);
          float dK = length(p - kc) - 0.055;
          vec2 ks = p - vec2(0.0, -0.24);
          float slot = max(abs(ks.x) - (0.022 + 0.03 * clamp(-ks.y / 0.1, 0.0, 1.0)), abs(ks.y) - 0.09);
          dK = min(dK, slot);

          // ---- draw-on parameters
          // body: from bottom centre, both ways, up to the top centre
          vec2 bq = p - BODY_C;
          float ang = abs(atan(bq.x, -bq.y)) / PI;           // 0 bottom .. 1 top
          float bodyOn = smoothstep(ang - 0.02, ang, uEdge * 1.02);
          // shackle: from the leg bottoms up to the top of the arc
          vec2 sq = p - SH_C;
          float legLen = SH_C.y - LEG_B;
          float tot = legLen + SH_R * PI * 0.5;
          float s = sq.y < 0.0 ? (p.y - LEG_B) : legLen + SH_R * atan(sq.y, abs(sq.x));
          float shOn = smoothstep(s / tot - 0.02, s / tot, uShackle * 1.02);

          vec3 col = vec3(0.0);
          float alpha = 0.0;

          // ---- edges: body outer + inner line; shackle both edges + centre dots
          float line = 0.0045;
          float eB = (1.0 - smoothstep(line - fw, line + fw, abs(dB))) * bodyOn;
          float eB2 = (1.0 - smoothstep(line * 0.7 - fw, line * 0.7 + fw, abs(dB + 0.028))) * bodyOn * 0.75;
          float eS = (1.0 - smoothstep(line - fw, line + fw, abs(dS))) * shOn;
          float eK = (1.0 - smoothstep(line * 0.8 - fw, line * 0.8 + fw, abs(dK))) * smoothstep(0.6, 1.0, uEdge);
          float edges = max(max(eB, eB2), max(eS, eK));
          // soft glow outside
          float g = exp(-max(dB, 0.0) * 28.0) * bodyOn + exp(-max(dS, 0.0) * 30.0) * shOn;
          col += uGlowCol * g * 0.55 * uPulse;
          col += uEdgeCol * edges * 2.6;

          // ---- digits: inside body (minus keyhole) and inside the shackle band
          float inBody = (1.0 - smoothstep(-0.034 - fw, -0.034 + fw, dB)) * smoothstep(-fw, fw, dK - 0.012);
          float inSh = 1.0 - smoothstep(-0.018 - fw, -0.018 + fw, dS);
          float region = max(inBody, inSh * step(LEG_B + 0.015, p.y));
          float cell = 0.03;
          vec2 cp = p / cell;
          float colI = floor(cp.x);
          float speed = 0.02 + 0.05 * h21(vec2(colI, 7.0));
          float off = uFrame * speed;
          float rowF = cp.y + off;
          float rowI = floor(rowF);
          vec2 cuv = vec2(fract(cp.x), 1.0 - fract(rowF));
          float bit = step(0.5, h21(vec2(colI, rowI)));
          float idx = mix(uIdx.x, uIdx.y, bit);
          // glyph sample: atlas cell, padding so digits sit centred & small
          vec2 guv = (cuv - 0.5) * 1.1 + 0.5;
          float gcol = mod(idx, uGrid.x), grow = floor(idx / uGrid.x);
          vec2 a = vec2((gcol + guv.x) / uGrid.x, 1.0 - (grow + guv.y) / uGrid.y);
          vec2 sc = vec2(1.1 / (cell * uGrid.x), -1.1 / (cell * uGrid.y));
          float gl = textureGrad(uGlyphs, a, pDx * sc, pDy * sc).a;
          gl *= step(abs(cuv.x - 0.5), 0.5) * step(abs(cuv.y - 0.5), 0.5);
          float reveal = smoothstep(h21(vec2(colI, floor(cp.y) + 333.0)) - 0.05, h21(vec2(colI, floor(cp.y) + 333.0)) + 0.05, uFill * 1.1 - 0.05);
          float bright = 0.55 + 0.45 * smoothstep(-0.4, 0.3, p.y) + 0.35 * step(0.9, h21(vec2(colI, rowI + 99.0)));
          float dig = gl * region * reveal;
          col += uDigitCol * dig * bright * 2.4;
          // faint body tint behind digits
          float fillA = region * 0.35 * clamp(uFill * 2.0, 0.0, 1.0);
          col += uGlowCol * fillA * 0.18;
          // keyhole interior: dark
          float kIn = (1.0 - smoothstep(-fw, fw, dK)) * clamp(uFill * 3.0, 0.0, 1.0);
          alpha = max(fillA, kIn * 0.9);
          col = mix(col, uGlowCol * 0.9 + uEdgeCol * 0.25, kIn); // solid bright keyhole
          col += uEdgeCol * eK * 2.0 * kIn;
          fragOut = vec4(col, alpha);
        }`,
    }),
  ) as THREE.ShaderMaterial;
};

const burstMaterial = () =>
  premultBlend(
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uAmt: { value: 0 },
        uFrame: { value: 0 },
        uAspect: { value: VIS_W / VIS_H },
        uCol: { value: new THREE.Vector3(...linearRGB("#3FB4FF")) },
        uCore: { value: new THREE.Vector3(...linearRGB("#CFF2FF")) },
        uCenter: { value: new THREE.Vector2(0, 0.03) },
      },
      vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        layout(location = 0) out highp vec4 fragOut;
        in vec2 vUv;
        uniform float uAmt, uFrame, uAspect; uniform vec3 uCol, uCore; uniform vec2 uCenter;
        float h1(float n){ uint v = uint(int(n) + 100000) * 747796405u + 2891336453u; v = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u; v = (v >> 22u) ^ v; return float(v) / 4294967295.0; }
        void main(){
          vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) - uCenter;
          float r = length(p);
          float a = atan(p.y, p.x) / 6.2831853 + 0.5; // 0..1
          float rays = 0.0;
          // three octaves of thin rays with slowly varying strength
          for (int o = 0; o < 3; o++) {
            float n = o == 0 ? 160.0 : (o == 1 ? 420.0 : 900.0);
            float x = a * n;
            float id = floor(x);
            float fx = fract(x) - 0.5;
            float w = 0.04 + 0.06 * h1(id + float(o) * 1000.0);
            float prof = exp(-pow(fx / w, 2.0));
            float str = pow(h1(id * 3.0 + float(o) * 77.0), 3.0);
            float fl = 0.75 + 0.25 * sin(uFrame * (0.02 + 0.05 * h1(id + 5000.0)) + 6.2831 * h1(id + 9000.0));
            rays += prof * str * fl * (o == 0 ? 1.0 : (o == 1 ? 0.7 : 0.5));
          }
          float fall = (exp(-r * 1.8) * 0.95 + 0.12) * smoothstep(0.0, 0.05, r);
          float glow = exp(-r * r * 22.0) * 1.1 + exp(-r * 5.0) * 0.35;
          vec3 c = uCol * (rays * fall * 1.3 + glow * 0.7) + uCore * exp(-r * r * 160.0) * 0.6;
          c *= uAmt;
          fragOut = vec4(c, 0.0);
        }`,
    }),
  );

// Crisp scan-line grid (horizontal lines of varying brightness, sparse
// verticals), brighter towards the centre. Procedural, so it stays sharp.
const gridMaterial = () =>
  premultBlend(
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthWrite: false,
      depthTest: false,
      uniforms: { uAmt: { value: 0 }, uAspect: { value: VIS_W / VIS_H }, uCol: { value: new THREE.Vector3(...linearRGB("#4FBEF5")) } },
      vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        layout(location = 0) out highp vec4 fragOut;
        in vec2 vUv;
        uniform float uAmt, uAspect; uniform vec3 uCol;
        float h1(float n){ uint v = uint(int(n) + 100000) * 747796405u + 2891336453u; v = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u; v = (v >> 22u) ^ v; return float(v) / 4294967295.0; }
        // coverage of a line of width wpx (pixels) at every integer x
        float lineAA(float x, float wpx){
          float fw = max(fwidth(x), 1e-5);
          float d = abs(fract(x + 0.5) - 0.5);
          float hw = 0.5 * max(wpx, 1.0) * fw;
          return clamp((hw + 0.5 * fw - d) / fw, 0.0, 1.0) * min(wpx, 1.0);
        }
        void main(){
          vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
          float ny = vUv.y * 52.0;
          float hy = lineAA(ny, 1.3) * (0.3 + 0.7 * pow(h1(floor(ny + 0.5)), 2.0));
          float nx = vUv.x * 40.0;
          float vx = lineAA(nx, 1.0) * 0.25 * step(0.75, h1(floor(nx + 0.5) + 300.0));
          float center = exp(-pow(p.y / 0.18, 2.0)) * 0.8 + exp(-dot(p, p) * 1.6) * 0.3 + 0.15;
          float a = (hy * 0.42 + vx * 0.16) * center * uAmt;
          fragOut = vec4(uCol * a, 0.0);
        }`,
    }),
  );

const streakMaterial = () =>
  premultBlend(
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uAmt: { value: 0 },
        uAspect: { value: VIS_W / VIS_H },
        uCol: { value: new THREE.Vector3(...linearRGB("#38B0FF")) },
        uCore: { value: new THREE.Vector3(...linearRGB("#DFF6FF")) },
      },
      vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        layout(location = 0) out highp vec4 fragOut;
        in vec2 vUv;
        uniform float uAmt, uAspect; uniform vec3 uCol, uCore;
        void main(){
          vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
          float ay = abs(p.y);
          float x = abs(p.x);
          float core = exp(-ay * 420.0) * (exp(-x * 1.4) * 0.35 + 0.12);
          float wide = exp(-ay * 120.0) * exp(-x * 1.1) * 0.6;
          float haze = exp(-ay * 22.0) * exp(-x * 2.2) * 0.25;
          // faint secondary lines above and below
          float sec = (exp(-abs(p.y - 0.035) * 1500.0) + exp(-abs(p.y + 0.03) * 1500.0)) * exp(-x * 2.5) * 0.35;
          float band = exp(-pow(p.y / 0.04, 2.0)) * (0.55 + 0.45 * exp(-x * 1.2)) * 0.32;
          float yb = p.y + 0.105;   // weaker band at the lock base
          float band2 = (exp(-pow(yb / 0.016, 2.0)) * 0.3 + exp(-abs(yb) * 1100.0) * 0.35) * exp(-x * 1.4);
          float flash = exp(-(x * x * 260.0 + (yb + 0.012) * (yb + 0.012) * 4000.0));
          vec3 warm = vec3(0.75, 0.95, 1.0);
          vec3 c = uCore * core * 1.6 + uCol * (wide + haze + sec + band) * 1.2 + uCore * band2 * 1.2 + warm * flash * 2.0;
          fragOut = vec4(c * uAmt, 0.0);
        }`,
    }),
  );

// ---------------------------------------------------------------------------

const drawMap = (assets: Assets) => {
  const W = 4096;
  const H = 2304;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = "#0B2E52"; // ocean lighter than the land
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);
  g.addColorStop(0, "rgba(30,80,170,0.32)");
  g.addColorStop(1, "rgba(30,80,170,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // land: lon -170..190 so the map fills the frame, slightly zoomed
  const mx = (lon: number) => ((lon + 168) / 352) * W;
  const my = (lat: number) => ((84 - lat) / 144) * H * 1.02;
  // polygons that wrap the antimeridian would smear across this cropped map
  const land = {
    polygons: assets.land.polygons.filter((poly) => {
      let lo = 999;
      let hi = -999;
      for (let i = 0; i < poly[0].length; i += 2) {
        lo = Math.min(lo, poly[0][i]);
        hi = Math.max(hi, poly[0][i]);
      }
      return hi - lo < 180;
    }),
  };
  traceLand(ctx, land, (lon, lat) => [mx(lon), my(lat)]);
  ctx.fillStyle = LANDC;
  ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(80,140,220,0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();
  // texture inside land: fine dots
  ctx.save();
  ctx.clip("evenodd");
  const r = mulberry32(5);
  ctx.fillStyle = "rgba(120,170,240,0.12)";
  for (let i = 0; i < 26000; i++) ctx.fillRect(r() * W, r() * H, 3, 3);
  ctx.restore();
  // horizontal scan lines + faint verticals
  for (let y = 0; y < H; y += 12) {
    ctx.fillStyle = y % 48 === 0 ? "rgba(120,190,255,0.16)" : "rgba(120,190,255,0.05)";
    ctx.fillRect(0, y, W, y % 48 === 0 ? 3 : 2);
  }
  for (let x = 0; x < W; x += 64) {
    ctx.fillStyle = x % 256 === 0 ? "rgba(120,190,255,0.12)" : "rgba(120,190,255,0.05)";
    ctx.fillRect(x, 0, 2, H);
  }
  return c;
};

type Icon = { name: (typeof ICONS)[number]; x: number; y: number; z: number; vx: number; vy: number; s: number; a: number; flick: boolean; seed: number };

const rng = mulberry32(0x10c5);
const ICON_SET = ["cloud", "database", "chart", "phone", "globe", "chat", "folder", "shield", "house", "headphones", "note", "camera", "mail", "gear", "wifi", "monitor", "lockSmall", "doc", "pin", "person"] as const;
// depth bins: [zMin, zMax]
const BINS: [number, number][] = [
  [-6, -2.5],
  [-2.5, 2.5],
  [2.5, 7],
  [7, 12],
];
const ICONS_BY_BIN: Icon[][] = BINS.map(([z0, z1], b) =>
  Array.from({ length: [12, 22, 6, 3][b] }, () => {
    const z = range(rng, z0, z1);
    const sc = (CAM_Z - z) / CAM_Z;
    let x = 0;
    let y = 0;
    // keep the very centre (lock) mostly clear
    do {
      x = range(rng, -0.55, 0.55) * VIS_W * sc;
      y = range(rng, -0.55, 0.55) * VIS_H * sc;
    } while (Math.abs(x / sc) < 3.0 && Math.abs(y / sc) < 2.8);
    return {
      name: pick(rng, ICON_SET),
      x,
      y,
      z,
      vx: range(rng, -0.012, 0.012),
      vy: range(rng, -0.008, 0.008),
      s: range(rng, 0.32, 0.55) * (b >= 2 ? 1.3 : 1),
      a: range(rng, 0.55, 1),
      flick: rng() < 0.15,
      seed: irange(rng, 1, 1e9),
    };
  }),
);

const SPECKS = Array.from({ length: 160 }, () => ({
  x: range(rng, -1, 1),
  y: range(rng, -1, 1),
  z: range(rng, -4, 2.5),
  s: range(rng, 0.012, 0.028),
  a: range(rng, 0.2, 0.55),
  vx: range(rng, -0.01, 0.01),
  vy: range(rng, -0.006, 0.006),
  dash: rng() < 0.3,
}));

// floating binary digits on two depth planes (panel px, 1920 x 1080 frame)
const FLOAT_DIGITS = [0, 1].map(() =>
  Array.from({ length: 80 }, () => ({
    x: range(rng, 0, 1920),
    y: range(rng, 0, 1080),
    size: range(rng, 9, 17),
    a: range(rng, 0.25, 0.8),
    vy: range(rng, 0.05, 0.25),
    seed: irange(rng, 1, 1e9),
  })),
);

const DASHES = Array.from({ length: 220 }, () => ({
  ang: rng() * Math.PI * 2,
  period: range(rng, 60, 160),
  ph: rng(),
  len: range(rng, 0.05, 0.16),
  a: range(rng, 0.25, 0.8),
}));

const build: BuildFn = (assets) => {
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 1, 100);
  const layers: LayerSpec[] = [];

  // map
  const sMap = new THREE.Scene();
  const mapZ = -4;
  const ms = (CAM_Z - mapZ) / CAM_Z;
  const mapMat = texPlaneMaterial(canvasTexture(drawMap(assets)), { tint: [MAP_TINT, MAP_TINT, MAP_TINT] });
  const map = new THREE.Mesh(new THREE.PlaneGeometry(VIS_W * ms * 1.06, VIS_H * ms * 1.06), mapMat);
  map.position.z = mapZ;
  sMap.add(map);
  layers.push({ scene: sMap, blur: 0.0055 });

  // icon bins + specks
  const binScenes = BINS.map(() => new THREE.Scene());
  const binIcons = BINS.map((_, b) => {
    const bb = new Billboards(120);
    binScenes[b].add(bb.mesh);
    return bb;
  });
  const binLines = BINS.map((_, b) => {
    const l = new Lines3D(60);
    binScenes[b].add(l.mesh);
    return l;
  });

  // lock layer
  const sLock = new THREE.Scene();
  const burst = new THREE.Mesh(new THREE.PlaneGeometry(VIS_W * 1.02, VIS_H * 1.02), burstMaterial());
  burst.position.z = -0.4;
  burst.renderOrder = 0;
  sLock.add(burst);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(VIS_W * 1.04, VIS_H * 1.04), gridMaterial());
  grid.position.z = -0.6;
  grid.renderOrder = 0;
  sLock.add(grid);
  const dashes = new Lines3D(200);
  dashes.mesh.renderOrder = 1;
  sLock.add(dashes.mesh);
  const lockMat = lockMaterial();
  const lock = new THREE.Mesh(new THREE.PlaneGeometry(LOCK_H, LOCK_H), lockMat);
  lock.position.set(0, VIS_H * 0.02, 0);
  lock.renderOrder = 2;
  sLock.add(lock);
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(VIS_W * 1.02, VIS_H * 1.02), streakMaterial());
  // main band through the lower body; the shader adds a second, thinner
  // band and a warm flash exactly at the lock's base (0.105 below)
  streak.position.set(0, lock.position.y + LOCK_H * (-0.17 - 0.25) + VIS_H * 0.105, 0.1);
  streak.renderOrder = 3;
  sLock.add(streak);

  // floating 0/1 digits: a sharp plane with the lock, a soft one behind
  const digitPlanes = [
    { z: 1.2, scene: sLock, order: 5 },
    { z: -3.2, scene: binScenes[0], order: 1 },
  ].map((d) => {
    const sc = (CAM_Z - d.z) / CAM_Z;
    const b = new Batch2D({ capacity: 200, width: 1920, height: 1080, unitsPerPx: (VIS_W * sc * 1.04) / 1920, z: 0 });
    b.mesh.position.z = d.z;
    b.mesh.renderOrder = d.order;
    d.scene.add(b.mesh);
    return b;
  });

  layers.push({ scene: binScenes[0], blur: 0.004 });
  // the mid icon bin is in focus with the lock: same pass
  for (const o of [...binScenes[1].children]) {
    o.renderOrder = 4;
    sLock.add(o);
  }
  layers.push({ scene: sLock, blur: 0.0009 });
  layers.push({ scene: binScenes[2], blur: 0.0055 });
  layers.push({ scene: binScenes[3], blur: 0.013 });

  return {
    camera,
    layers,
    pipeline: { background: BG, bloomThreshold: 0.55, bloomKnee: 0.5, bloomIntensity: 0.95, bloomRadius: 0.9, vignette: 0.9, saturation: 1.05 },
    update: (f) => {
      camera.position.set(0.15 * Math.sin(f * 0.004), 0.08 * Math.sin(f * 0.003 + 1), CAM_Z - f * 0.0015);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();

      // timing
      const edge = easeOutCubic(remap(f, 45, 82));
      const shackle = easeOutCubic(remap(f, 55, 92));
      const fill = remap(f, 72, 108);
      const flare = remap(f, 45, 60) * (1 - 0.55 * easeOutCubic(remap(f, 60, 110)));
      const pulse = 0.85 + 0.15 * Math.sin(f * 0.07);
      const burstAmt = flare * (f > 110 ? pulse : 1);

      const lu = lockMat.uniforms;
      lu.uFrame.value = f;
      lu.uEdge.value = edge;
      lu.uShackle.value = shackle;
      lu.uFill.value = fill;
      lu.uPulse.value = 0.8 + 0.2 * Math.sin(f * 0.06) + (1 - remap(f, 60, 110)) * remap(f, 45, 60) * 0.8;
      const bu = (burst.material as THREE.ShaderMaterial).uniforms;
      bu.uAmt.value = burstAmt;
      bu.uFrame.value = f;
      (streak.material as THREE.ShaderMaterial).uniforms.uAmt.value = easeOutCubic(remap(f, 58, 96)) * (0.9 + 0.1 * Math.sin(f * 0.05));

      // outward dashes (warp streaks) once the burst is on
      dashes.begin();
      for (const d of DASHES) {
        const t = (((f / d.period + d.ph) % 1) + 1) % 1;
        const r0 = 0.6 + t * VIS_W * 0.6;
        const r1 = r0 + d.len * VIS_H * (0.3 + t);
        const c = Math.cos(d.ang);
        const s = Math.sin(d.ang);
        const a = d.a * burstAmt * Math.sin(Math.PI * t);
        dashes.seg(c * r0, s * r0 + lock.position.y * 0.6, -0.3, c * r1, s * r1 + lock.position.y * 0.6, -0.3, 1.0, "#8FD8FF", a * 0.9, 1.4);
      }
      dashes.end();

      // icons drifting; a few flicker
      // 0-1.5s: dark map with icons drifting, visible from the first frame
      const fadeIn = 1;
      ICONS_BY_BIN.forEach((list, b) => {
        const bb = binIcons[b];
        bb.begin();
        for (const ic of list) {
          let a = ic.a * fadeIn;
          if (ic.flick) a *= hash2(ic.seed, stepIndex(f, 4, 600)) > 0.35 ? 1 : 0.15;
          bb.icon(ic.name, ic.x + ic.vx * f, ic.y + ic.vy * f, ic.z, ic.s, "#EAF6FF", a * (b >= 2 ? 0.6 : 1), { i: 1.4 });
        }
        // specks in this bin
        for (const s of SPECKS) {
          if (s.z < BINS[b][0] || s.z >= BINS[b][1]) continue;
          const sc = (CAM_Z - s.z) / CAM_Z;
          const x = s.x * VIS_W * 0.55 * sc + s.vx * f;
          const y = s.y * VIS_H * 0.55 * sc + s.vy * f;
          if (!s.dash) bb.blob(x, y, s.z, s.s, "#9FD8FF", s.a * fadeIn, { i: 1.6 });
        }
        bb.end();
        const ll = binLines[b];
        ll.begin();
        for (const s of SPECKS) {
          if (!s.dash || s.z < BINS[b][0] || s.z >= BINS[b][1]) continue;
          const sc = (CAM_Z - s.z) / CAM_Z;
          const x = s.x * VIS_W * 0.55 * sc + s.vx * f;
          const y = s.y * VIS_H * 0.55 * sc + s.vy * f;
          ll.seg(x, y, s.z, x + s.s * 3, y, s.z, 1.6, "#9FD8FF", s.a * 0.8 * fadeIn, 1.3);
        }
        ll.end();
      });

      digitPlanes.forEach((b, k) => {
        b.begin();
        for (const d of FLOAT_DIGITS[k]) {
          const y = (((d.y - d.vy * f) % 1080) + 1080) % 1080;
          const ch = hash2(d.seed, stepIndex(f, 12, 600)) < 0.5 ? "0" : "1";
          b.text(ch, d.x, y, d.size * (k === 1 ? 1.4 : 1), "#9FE2FF", d.a * 0.55 * fadeIn, { i: 1.2, align: "center" });
        }
        b.end();
      });

      (grid.material as THREE.ShaderMaterial).uniforms.uAmt.value = fadeIn;
      mapMat.uniforms.uOpacity.value = fadeIn * (0.85 + 0.15 * clamp01(remap(f, 45, 90)));
      return { fade: Math.max(0.0001, fadeIn), exposure: 0.78 };
    },
  };
};

export const GlobalSecurityLock: React.FC<LookProps> = ({ grade }) => <Stage build={build} grade={grade} />;
