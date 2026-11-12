import * as THREE from "three";
import type { BuildFn } from "../lib/useThreeScene";
import { hash, rng, smoothstep, clamp01, lerp } from "../lib/useThreeScene";
import type { WallPalette } from "./palettes";
import type { CameraRig } from "./cameraRigs";

/* ------------------------------------------------------------------ */
/* Layout constants (world units)                                      */
/* ------------------------------------------------------------------ */
const UNIT_H = 5; // height of one repeating "rack" unit
const PANEL_Y0 = 0.15; // panel row bottom inside a unit
const PANEL_H = 1.9; // panel row height
const WALL_X0 = -40;
const WALL_X1 = 200;
const UNIT_MIN = -2;
const UNIT_MAX = 8;

const col = (hex: string) => new THREE.Color(hex); // converts sRGB -> linear

/* ------------------------------------------------------------------ */
/* Shared GLSL helpers                                                  */
/* ------------------------------------------------------------------ */
const GLSL_COMMON = /* glsl */ `
float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float h31(vec3 p) { return h21(p.xy + vec2(p.z * 37.17, p.z * 11.31)); }
vec3 applyFog(vec3 c, vec3 fogCol, float depth, float density) {
  float f = 1.0 - exp(-pow(max(depth - 4.0, 0.0) * density, 1.6));
  return mix(c, fogCol, clamp(f, 0.0, 1.0));
}
`;

/* ------------------------------------------------------------------ */
/* Wall plane: procedural dot-matrix display + glyph text                */
/* ------------------------------------------------------------------ */
const wallVert = /* glsl */ `
varying vec2 vWall;
varying float vDepth;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWall = wp.xy;
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const wallFrag = /* glsl */ `
uniform float uTime;
uniform float uBoot;
uniform vec3 uWall;
uniform vec3 uDotDim;
uniform vec3 uDotBright;
uniform vec3 uFog;
uniform float uFogDensity;
varying vec2 vWall;
varying float vDepth;
${GLSL_COMMON}

int glyphBits(int c) {
  if (c == 0) return 15324974; // 0
  if (c == 1) return 4591758;  // 1
  if (c == 2) return 15269425; // A
  if (c == 3) return 31744;    // -
  if (c == 4) return 4;        // .
  if (c == 5) return 15252014; // 8
  if (c == 6) return 32032318; // D
  if (c == 7) return 1016800;  // =
  return 0;
}

void main() {
  float unitH = ${UNIT_H.toFixed(1)};
  float unitId = floor(vWall.y / unitH);
  float uy = vWall.y - unitId * unitH;
  vec3 col = uWall;

  // structural rails
  float rail = smoothstep(0.03, 0.0, abs(uy - 2.13)) + smoothstep(0.02, 0.0, abs(uy - 4.9)) * 0.6;
  col += uDotDim * rail * 0.18;

  // dot matrix zone: y in [2.25, 4.85]
  float zy = uy - 2.25;
  if (zy > 0.0 && zy < 2.6) {
    // --- coarse dot rows (pitch 0.2) -------------------------------------
    vec2 dp = vec2(vWall.x, zy) / 0.2;
    vec2 cell = floor(dp);
    vec2 f = fract(dp) - 0.5;
    float px = max(fwidth(dp.x), fwidth(dp.y));
    float aa = max(px, 0.0001);
    float sq = smoothstep(0.24 + aa, 0.24 - aa, max(abs(f.x), abs(f.y)));
    float seg = floor(cell.x / 18.0);
    float segH = h31(vec3(seg, unitId, cell.y * 0.0 + 3.0));
    float rnd = h31(vec3(cell, unitId));
    float twinkle = h31(vec3(cell, floor(uTime * (0.6 + rnd * 2.0) + rnd * 10.0)));
    float level = 0.0;
    if (rnd > 0.36 + segH * 0.4) level = mix(0.25, 0.72, twinkle);
    if (h31(vec3(cell * 0.5, unitId + 9.0)) > 0.985) level = 0.9; // rare bright pixels

    // text strips (fine 5x5 glyphs, pitch 0.07) replace some dot rows
    float strip = -1.0;
    float sy = 0.0;
    if (zy > 0.42 && zy < 0.8) { strip = 0.0; sy = zy - 0.42; }
    else if (zy > 1.62 && zy < 2.0) { strip = 1.0; sy = zy - 1.62; }
    vec3 dotCol = mix(uDotDim, uDotBright, smoothstep(0.35, 0.95, level)) * (0.25 + level * 1.4);
    float on = step(h31(vec3(cell * 0.37, unitId + 2.0)) * 0.85, uBoot);
    vec3 lit = mix(uWall, dotCol, sq * on * step(0.01, level));
    float energy = 0.12;

    if (strip >= 0.0) {
      lit = uWall;
      vec2 gp = vec2(vWall.x, sy - 0.02) / 0.07;
      vec2 gc = floor(gp);
      vec2 gf = fract(gp) - 0.5;
      float gpx = max(fwidth(gp.x), fwidth(gp.y));
      float gaa = max(gpx, 0.0001);
      float gsq = smoothstep(0.36 + gaa, 0.36 - gaa, max(abs(gf.x), abs(gf.y)));
      float cx = floor(gc.x / 6.0);
      float gx = gc.x - cx * 6.0;
      float gy = gc.y;
      float tseg = floor(cx / 9.0);
      float segOn = h31(vec3(tseg, unitId * 3.0 + strip, 7.0));
      float glev = 0.0;
      if (segOn > 0.35 && gx < 5.0 && gy >= 0.0 && gy < 5.0) {
        float rate = 1.0 + h31(vec3(tseg, strip, unitId + 11.0)) * 6.0;
        float ph = h31(vec3(cx, strip, unitId + 19.0));
        float tick = floor(uTime * rate + ph * 13.0);
        float pick = h31(vec3(cx, unitId * 3.0 + strip, tick));
        int c = pick < 0.30 ? 3 : (pick < 0.48 ? 0 : (pick < 0.62 ? 1 : (pick < 0.72 ? 2 : (pick < 0.82 ? 4 : (pick < 0.88 ? 5 : (pick < 0.94 ? 6 : 7))))));
        if (h31(vec3(cx, tick, strip + 5.0)) < 0.15) c = 9; // blank
        int bits = glyphBits(c);
        int bit = int(gy) * 5 + (4 - int(gx));
        if (((bits >> bit) & 1) == 1) glev = 0.65 + 0.35 * h31(vec3(cx, strip, tick + 3.0));
      }
      float gon = step(h31(vec3(gc * 0.21, unitId + 4.0)) * 0.9, uBoot);
      lit = mix(uWall, uDotBright * (0.3 + glev), gsq * glev * gon);
      px = gpx;
      energy = 0.2;
    }
    // anti-alias far-away dots by blending to their average energy
    vec3 avg = mix(uWall, uDotDim, energy * on);
    col = mix(lit, avg, smoothstep(0.35, 0.9, px));
  }

  col = applyFog(col, uFog, vDepth, uFogDensity);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Panels: instanced boxes protruding from the wall                      */
/* ------------------------------------------------------------------ */
const panelVert = /* glsl */ `
attribute vec4 aData;   // seed, kind, onTime, rate
attribute vec3 aSize;
varying vec3 vLocal;
varying vec3 vN;
varying float vDepth;
varying vec4 vData;
varying vec3 vSize;
void main() {
  vLocal = position;
  vN = normal;
  vData = aData;
  vSize = aSize;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const panelFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uFace;
uniform vec3 uSide;
uniform vec3 uLine;
uniform vec3 uLight;
uniform vec3 uFog;
uniform float uFogDensity;
varying vec3 vLocal;
varying vec3 vN;
varying float vDepth;
varying vec4 vData;
varying vec3 vSize;
${GLSL_COMMON}

void main() {
  float seed = vData.x;
  float kind = vData.y;
  float onT = vData.z;
  float rate = vData.w;

  // switch-on with a short electrical flicker
  float on = step(onT, uTime);
  float flick = step(0.45, h21(vec2(seed * 91.0, floor(uTime * 24.0))));
  on *= mix(flick, 1.0, smoothstep(onT + 0.05, onT + 0.35, uTime));

  vec3 col;
  if (vN.z > 0.5) {
    float fx = (vLocal.x + 0.5) * vSize.x;
    float fy = (vLocal.y + 0.5) * vSize.y;
    float edge = min(min(fx, vSize.x - fx), min(fy, vSize.y - fy));
    float aa = fwidth(edge) * 1.2 + 1e-4;
    float frameLine = smoothstep(0.045 + aa, 0.045 - aa, edge);
    col = uFace;
    if (kind < 0.5) {
      // barcode-style vertical bars
      float sl = floor(fx / 0.055);
      float tick = floor(uTime * rate + seed * 7.0);
      float b = h31(vec3(sl, seed * 13.0, tick));
      float lenTop = vSize.y - 0.12 - step(0.6, h31(vec3(sl, seed, 2.0))) * h31(vec3(sl, seed, 5.0)) * vSize.y * 0.5;
      float inBar = step(0.12, fy) * step(fy, lenTop);
      float barOn = step(0.5, b) * inBar;
      float fxl = fract(fx / 0.055);
      float aab = fwidth(fx / 0.055) + 1e-4;
      float barShape = smoothstep(0.12 - aab, 0.12 + aab, fxl) * smoothstep(0.88 + aab, 0.88 - aab, fxl);
      // when a bar slice gets close to a pixel wide, fade to its average coverage
      // so the barcode texture does not shimmer as the camera drifts
      float coverage = mix(barShape, 0.76, smoothstep(0.18, 0.5, aab));
      col = mix(col, uLine * (0.7 + 0.5 * b), barOn * coverage * on);
      col = mix(col, uLine * 0.75, frameLine * on);
    } else if (kind < 1.5) {
      // luminous light block, split into sub-cells
      float n = 1.0 + floor(h21(vec2(seed, 4.0)) * 3.0);
      float cw = vSize.x / n;
      float cxl = mod(fx, cw);
      float sep = min(cxl, cw - cxl);
      float aas = fwidth(fx) * 1.5 + 1e-4;
      float inner = smoothstep(0.05 - aas, 0.05 + aas, sep) * smoothstep(0.06 - aa, 0.06 + aa, edge);
      float grad = 0.82 + 0.18 * (fy / vSize.y);
      float pulse = 0.9 + 0.1 * sin(uTime * (0.7 + seed * 0.13) + seed * 40.0);
      col = mix(uFace, uLight * grad * pulse * 1.5, inner * on);
    } else {
      // dark slot with a thin bright outline and a few status LEDs
      col = mix(col, uLine * 0.55, frameLine * on);
      vec2 led = vec2(fx - 0.18, fy - vSize.y * 0.5);
      float ld = length(led);
      float ledOn = step(0.5, h21(vec2(seed, floor(uTime * (1.0 + seed * 0.01)))));
      col += uLine * smoothstep(0.05, 0.02, ld) * ledOn * on;
    }
  } else {
    // sides / top / bottom
    float lightTop = vN.y > 0.5 ? 0.55 : (vN.y < -0.5 ? 0.15 : 0.32);
    col = uSide * lightTop * (0.5 + 0.5 * on);
  }
  col = applyFog(col, uFog, vDepth, uFogDensity);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Particles                                                            */
/* ------------------------------------------------------------------ */
const particleVert = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uScale;
varying float vAlpha;
varying float vDepth;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.21 + aSeed * 30.0) * 0.6 + uTime * 0.08;
  p.y += cos(uTime * 0.17 + aSeed * 21.0) * 0.4;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + aSeed) + aSeed * 50.0));
  gl_PointSize = uScale * (0.02 + aSeed * 0.035) / max(vDepth, 0.1);
  gl_Position = projectionMatrix * mv;
}
`;
const particleFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
varying float vDepth;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.15, d) * vAlpha * uOpacity;
  a *= exp(-max(vDepth - 6.0, 0.0) * 0.05);
  gl_FragColor = vec4(uColor * a, a);
}
`;

/* ------------------------------------------------------------------ */
/* Final single pass: depth of field + grade + sRGB output              */
/* ------------------------------------------------------------------ */
// The scene is rendered once into a render target that carries its own depth
// texture; this one full-screen pass then does the lens blur, exposure,
// vignette, grain and fade and writes straight to the canvas. No render
// target is written and read more than once per frame, which keeps software
// WebGL (SwiftShader) from ever showing partially-updated tiles.
const finalVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const finalFrag = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxBlur;
uniform float uAspect;
uniform float uFade;
uniform float uSeed;
uniform float uVignette;
uniform float uGrain;
uniform float uExposure;
varying vec2 vUv;
float h(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float viewDepth(vec2 uv) {
  return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
}
vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
void main() {
  float depth = viewDepth(vUv);
  float coc = clamp(abs(depth - uFocus) * uAperture, 0.0, uMaxBlur) * 0.45;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  const int N = 56;
  for (int i = 0; i < N; i++) {
    float r = sqrt((float(i) + 0.5) / float(N));
    float a = float(i) * 2.39996323;
    vec2 off = vec2(cos(a), sin(a)) * r * coc;
    off.x /= uAspect;
    vec3 c = texture2D(tColor, vUv + off).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float w = 1.0 + 2.5 * max(l - 0.45, 0.0); // brighter bokeh highlights
    acc += c * w;
    wsum += w;
  }
  vec3 col = (coc < 0.0002 ? texture2D(tColor, vUv).rgb : acc / wsum) * uExposure;
  vec2 q = vUv - 0.5;
  q.x *= 1.35;
  col *= mix(1.0, smoothstep(0.85, 0.2, length(q)), uVignette);
  col = toSRGB(col);
  col += (h(vUv * 1733.0 + uSeed) - 0.5) * uGrain;
  col *= uFade;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Laser-fan events                                                      */
/* ------------------------------------------------------------------ */
type FanEvent = {
  start: number; // seconds
  dur: number;
  hub: THREE.Vector3;
  targets: THREE.Vector3[];
};

const makeFanEvents = (
  seed: number,
  durationSec: number,
  region: { x0: number; x1: number; y0: number; y1: number },
): FanEvent[] => {
  const r = rng(seed);
  const events: FanEvent[] = [];
  let t = 1.3;
  while (t < durationSec - 0.6) {
    const dur = 1.0 + r() * 1.5;
    const hx = lerp(region.x0, region.x1, r());
    const hy = lerp(region.y0, region.y1, r());
    // hub floats in front of the wall, above the area it connects to
    const hub = new THREE.Vector3(hx, hy, 3 + r() * 5);
    const n = 6 + Math.floor(r() * 5);
    const targets: THREE.Vector3[] = [];
    const spread = 3.5 + r() * 3.5;
    for (let i = 0; i < n; i++) {
      targets.push(
        new THREE.Vector3(
          hx + lerp(-spread, spread * 0.7, r()),
          hy - lerp(2, 7, r()),
          0.45,
        ),
      );
    }
    events.push({ start: t, dur, hub, targets });
    t += dur + 0.15 + r() * 0.6; // one fan at a time, like the reference
  }
  return events;
};

/* ------------------------------------------------------------------ */
/* Builder                                                              */
/* ------------------------------------------------------------------ */
export const makeDataWallBuilder =
  (palette: WallPalette, rig: CameraRig): BuildFn =>
  ({ renderer, width, height, pixelRatio, fps, durationInFrames }) => {
    const durationSec = durationInFrames / fps;
    const scene = new THREE.Scene();
    scene.background = col(palette.background);

    const camera = new THREE.PerspectiveCamera(rig.fov, width / height, 0.1, 400);

    /* wall */
    const wallUniforms = {
      uTime: { value: 0 },
      uBoot: { value: 0 },
      uWall: { value: col(palette.wall) },
      uDotDim: { value: col(palette.dotDim) },
      uDotBright: { value: col(palette.dotBright) },
      uFog: { value: col(palette.fog) },
      uFogDensity: { value: rig.fogDensity },
    };
    const wallMat = new THREE.ShaderMaterial({
      uniforms: wallUniforms,
      vertexShader: wallVert,
      fragmentShader: wallFrag,
    });
    const wallGeo = new THREE.PlaneGeometry(WALL_X1 - WALL_X0, (UNIT_MAX - UNIT_MIN) * UNIT_H);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set((WALL_X0 + WALL_X1) / 2, ((UNIT_MAX + UNIT_MIN) * UNIT_H) / 2, 0);
    scene.add(wall);

    /* panels */
    const r = rng(1337);
    type P = { x: number; y: number; w: number; h: number; d: number; kind: number; seed: number; on: number; rate: number };
    const panels: P[] = [];
    for (let u = UNIT_MIN; u < UNIT_MAX; u++) {
      const rowKindBias = hash(u, 17); // how "light-heavy" a row is
      let x = WALL_X0 + r() * 2;
      while (x < WALL_X1) {
        const w = 0.35 + r() * r() * 2.4;
        const k = r();
        const kind = k < 0.18 + rowKindBias * 0.32 ? 1 : k < 0.75 ? 0 : 2;
        const yb = u * UNIT_H + PANEL_Y0;
        const distIntro = Math.abs(x - 12) / 40;
        panels.push({
          x: x + w / 2,
          y: yb + PANEL_H / 2,
          w,
          h: PANEL_H * (kind === 1 ? 0.92 + r() * 0.08 : 0.8 + r() * 0.2),
          d: 0.22 + r() * 0.3,
          kind,
          seed: r() * 100,
          on: 1.0 + distIntro * 0.35 + r() * 0.6,
          rate: 0.5 + r() * 3.5,
        });
        x += w + 0.06 + r() * 0.16;
      }
    }
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const aData = new Float32Array(panels.length * 4);
    const aSize = new Float32Array(panels.length * 3);
    const panelUniforms = {
      uTime: { value: 0 },
      uFace: { value: col(palette.panelFace) },
      uSide: { value: col(palette.panelSide) },
      uLine: { value: col(palette.panelLine) },
      uLight: { value: col(palette.lightBlock) },
      uFog: { value: col(palette.fog) },
      uFogDensity: { value: rig.fogDensity },
    };
    const panelMat = new THREE.ShaderMaterial({
      uniforms: panelUniforms,
      vertexShader: panelVert,
      fragmentShader: panelFrag,
    });
    const panelMesh = new THREE.InstancedMesh(boxGeo, panelMat, panels.length);
    const m = new THREE.Matrix4();
    panels.forEach((p, i) => {
      m.compose(
        new THREE.Vector3(p.x, p.y, p.d / 2),
        new THREE.Quaternion(),
        new THREE.Vector3(p.w, p.h, p.d),
      );
      panelMesh.setMatrixAt(i, m);
      aData.set([p.seed, p.kind, p.on, p.rate], i * 4);
      aSize.set([p.w, p.h, p.d], i * 3);
    });
    boxGeo.setAttribute("aData", new THREE.InstancedBufferAttribute(aData, 4));
    boxGeo.setAttribute("aSize", new THREE.InstancedBufferAttribute(aSize, 3));
    panelMesh.frustumCulled = false;
    scene.add(panelMesh);

    /* laser fans */
    const events = makeFanEvents(rig.fanSeed, durationSec, rig.fanRegion);
    const maxBeams = events.reduce((a, e) => Math.max(a, e.targets.length), 0) * 3;
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    beamGeo.translate(0, 0.5, 0);
    beamGeo.rotateX(Math.PI / 2); // along +z
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beams = new THREE.InstancedMesh(beamGeo, beamMat, maxBeams);
    beams.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxBeams * 3), 3);
    beams.frustumCulled = false;
    scene.add(beams);
    const nodeGeo = new THREE.SphereGeometry(1, 10, 8);
    const nodes = new THREE.InstancedMesh(nodeGeo, beamMat, maxBeams + 8);
    nodes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((maxBeams + 8) * 3), 3);
    nodes.frustumCulled = false;
    scene.add(nodes);
    const laserColor = col(palette.laser);

    /* particles */
    const pr = rng(99);
    const PN = 900;
    const pPos = new Float32Array(PN * 3);
    const pSeed = new Float32Array(PN);
    for (let i = 0; i < PN; i++) {
      pPos[i * 3] = lerp(-10, 60, pr());
      pPos[i * 3 + 1] = lerp(-6, 28, pr());
      pPos[i * 3 + 2] = lerp(0.6, 9, pr());
      pSeed[i] = pr();
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("aSeed", new THREE.BufferAttribute(pSeed, 1));
    const pUniforms = {
      uTime: { value: 0 },
      uScale: { value: height * pixelRatio * 0.9 },
      uColor: { value: col(palette.particle) },
      uOpacity: { value: 0 },
    };
    const pMat = new THREE.ShaderMaterial({
      uniforms: pUniforms,
      vertexShader: particleVert,
      fragmentShader: particleFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(pGeo, pMat);
    points.frustumCulled = false;
    scene.add(points);

    /* post-processing: one scene render target + one final pass */
    const rt = new THREE.WebGLRenderTarget(Math.round(width * pixelRatio), Math.round(height * pixelRatio), {
      type: THREE.HalfFloatType,
      samples: 4,
      depthTexture: new THREE.DepthTexture(Math.round(width * pixelRatio), Math.round(height * pixelRatio)),
    });
    const finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: rt.texture },
        tDepth: { value: rt.depthTexture },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uFocus: { value: rig.focus(0) },
        uAperture: { value: rig.aperture },
        uMaxBlur: { value: rig.maxBlur },
        uAspect: { value: width / height },
        uFade: { value: 1 },
        uSeed: { value: 0 },
        uVignette: { value: 0.55 },
        uGrain: { value: 0.004 },
        uExposure: { value: 1.28 },
      },
      vertexShader: finalVert,
      fragmentShader: finalFrag,
      depthTest: false,
      depthWrite: false,
    });
    const fsGeo = new THREE.PlaneGeometry(2, 2);
    const postScene = new THREE.Scene();
    postScene.add(new THREE.Mesh(fsGeo, finalMat));
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const tmpQ = new THREE.Quaternion();
    const zAxis = new THREE.Vector3(0, 0, 1);
    const dir = new THREE.Vector3();
    const tmpM = new THREE.Matrix4();
    const tmpC = new THREE.Color();

    const render = (frame: number) => {
      const t = frame / fps;

      // camera
      rig.apply(camera, t, durationSec);
      camera.updateMatrixWorld();

      // boot sequence
      const boot = smoothstep(0.1, 1.4, t);
      wallUniforms.uTime.value = t;
      wallUniforms.uBoot.value = boot;
      panelUniforms.uTime.value = t;
      pUniforms.uTime.value = t;
      pUniforms.uOpacity.value = smoothstep(0.6, 2.0, t);

      // laser fans
      let bi = 0;
      let ni = 0;
      for (const ev of events) {
        const lt = t - ev.start;
        if (lt < 0 || lt > ev.dur) continue;
        const env = smoothstep(0, 0.25, lt) * (1 - smoothstep(ev.dur - 0.35, ev.dur, lt));
        ev.targets.forEach((tg, k) => {
          if (bi >= maxBeams) return;
          // each beam draws on from the hub, staggered
          const grow = clamp01((lt - k * 0.03) / 0.35);
          if (grow <= 0) return;
          const flick = 0.75 + 0.25 * hash(frame, k, ev.start * 10);
          dir.subVectors(tg, ev.hub);
          const len = dir.length() * grow;
          dir.normalize();
          tmpQ.setFromUnitVectors(zAxis, dir);
          const radius = 0.0042 * (1 + 0.5 * hash(k, ev.start));
          tmpM.compose(ev.hub, tmpQ, new THREE.Vector3(radius, radius, len));
          beams.setMatrixAt(bi, tmpM);
          tmpC.copy(laserColor).multiplyScalar(env * flick * 0.75);
          beams.setColorAt(bi, tmpC);
          bi++;
          if (grow >= 1 && ni < maxBeams) {
            tmpM.compose(tg, tmpQ.identity(), new THREE.Vector3(0.035, 0.035, 0.035));
            nodes.setMatrixAt(ni, tmpM);
            tmpC.copy(laserColor).multiplyScalar(env * 1.4);
            nodes.setColorAt(ni, tmpC);
            ni++;
          }
        });
        if (ni < maxBeams + 8) {
          tmpM.compose(ev.hub, tmpQ.identity(), new THREE.Vector3(0.06, 0.06, 0.06));
          nodes.setMatrixAt(ni, tmpM);
          tmpC.copy(laserColor).multiplyScalar(env * 2.0);
          nodes.setColorAt(ni, tmpC);
          ni++;
        }
      }
      beams.count = bi;
      nodes.count = ni;
      beams.instanceMatrix.needsUpdate = true;
      if (beams.instanceColor) beams.instanceColor.needsUpdate = true;
      nodes.instanceMatrix.needsUpdate = true;
      if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true;

      // depth of field + grade
      finalMat.uniforms.uFocus.value = rig.focus(t);
      finalMat.uniforms.uFade.value = smoothstep(0.15, 1.6, t);
      finalMat.uniforms.uSeed.value = (frame * 7.31) % 97;

      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    };

    return {
      render,
      dispose: () => {
        rt.dispose();
        finalMat.dispose();
        fsGeo.dispose();
        wallGeo.dispose();
        wallMat.dispose();
        boxGeo.dispose();
        panelMat.dispose();
        beamGeo.dispose();
        nodeGeo.dispose();
        beamMat.dispose();
        pGeo.dispose();
        pMat.dispose();
      },
    };
  };
