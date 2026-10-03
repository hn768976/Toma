import * as THREE from "three";
import { ServerColorway } from "../colorways";
import { Bloom } from "../common/Bloom";
import { hexToLinear } from "../common/color";
import { LOOP } from "../common/constants";
import { FullscreenPass, TargetCache } from "../common/FullscreenPass";
import { GRAIN_DITHER, HASH, LINEAR_TO_SRGB } from "../common/glsl";
import { LoopRenderer } from "../common/GLLoop";
import {
  DRIFT_PATTERNS,
  PATTERN,
  PATTERN_Z,
  RACK_BOTTOM,
  RACK_FIRST,
  RACK_H,
  RACK_LAST,
  RACK_TYPES,
  RACK_W,
  RAIL_W,
  S,
  SLOTS,
  U,
} from "./layout";

// =============================================================================
// Camera / lens
// =============================================================================
const CAM_Z = 0.7;
const AISLE = 1.8; // z of the opposite row's fronts
const CAM_Y = 0.05;
const CAM_X0 = 0.0;
const YAW = THREE.MathUtils.degToRad(46); // looking left, along the rack row
const VFOV = 34;
const FOCUS = (0.84 * CAM_Z) / Math.cos(YAW); // just in front of where the centre ray meets the wall
const COC_K_FAR = 55; // px at 720p, behind focus:   K_far  * (1 - focus / depth)
const COC_K_NEAR = 300; // px at 720p, in front:     K_near * (focus / depth - 1)
const COC_MAX = 130; // px at 720p
const BAND_LO = 9; // sprite radius (720p px) where LEDs move to the low-res bokeh pass
const BAND_HI = 14;

const COC_GLSL = /* glsl */ `
uniform float uFocus, uKFar, uKNear, uMaxCoc, uPx;
// Blur radius in output pixels for a view depth d (thin-lens shape; the near
// side uses a larger constant so the close racks melt into big bokeh).
float cocPx(float d) {
  float c = d > uFocus ? uKFar * (1.0 - uFocus / d) : uKNear * (uFocus / d - 1.0);
  return min(c, uMaxCoc) * uPx;
}
`;

// =============================================================================
// Rack fronts (procedural panel shader). Output: rgb = linear colour, a = CoC.
// =============================================================================
const RACK_VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec2 uv;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
uniform vec2 uSize;
out vec2 vL;
out float vDepth;
void main() {
  vec4 vp = viewMatrix * modelMatrix * vec4(position, 1.0);
  vDepth = -vp.z;
  vL = uv * uSize;
  gl_Position = projectionMatrix * vp;
}
`;

const RACK_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vL;
in float vDepth;
out vec4 outColor;
uniform vec4 uSlots[${SLOTS}];   // type, part, height, seed
uniform vec3 cLight, cHaze, cWhite;
uniform float uSheen;
${COC_GLSL}
${HASH}

const float W = ${RACK_W.toFixed(4)};
const float RAIL = ${RAIL_W.toFixed(4)};
const float UH = ${U.toFixed(5)};

float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float fillAA(float sd, float aa) { return 1.0 - smoothstep(-aa, aa, sd); }
float h1(float a, float b) { return hash33u(uvec3(uint(a * 7919.0 + 13.0), uint(b * 104729.0 + 7.0), 17u)).x; }

void main() {
  float u = vL.x;
  float v = vL.y;
  float aa = max(fwidth(u), fwidth(v)) * 0.75 + 1e-5;
  // Cool blue light falling across the fronts.
  float sheen = 0.55 + 0.45 * smoothstep(0.2, 2.4, v) + 0.15 * sin(u * 9.0 + v * 2.0);
  vec3 metal = vec3(0.002, 0.003, 0.006) + cLight * 0.025 * sheen * uSheen;
  vec3 col = metal;
  vec3 emit = vec3(0.0);

  if (u < RAIL || u > W - RAIL) {
    // ---- vertical rail: square holes every 1/3 U, screw heads, tiny made-up marks
    float ru = u < RAIL ? u : W - u;            // 0 at the cabinet edge
    col = vec3(0.005, 0.006, 0.01) + cLight * 0.03 * sheen * uSheen;
    float third = UH / 3.0;
    float hv = mod(v, third) - third * 0.5;
    float hole = fillAA(sdBox(vec2(ru - RAIL * 0.62, hv), vec2(0.0032, 0.0032)), aa);
    col = mix(col, vec3(0.001), hole);
    float slot = floor(v / UH);
    float sv = v - (slot + 0.5) * UH;
    float screwPresent = step(0.45, h1(slot, 3.0));
    float sd = length(vec2(ru - RAIL * 0.62, sv)) - 0.0042;
    float ring = fillAA(abs(sd) - 0.0009, aa) * screwPresent;
    col += (cWhite * 0.4 + cLight * 0.35) * ring * sheen;
    // Unit tick marks (two tiny bars, not text).
    float mark = fillAA(sdBox(vec2(ru - RAIL * 0.22, sv - 0.004), vec2(0.0035, 0.0006)), aa)
               + fillAA(sdBox(vec2(ru - RAIL * 0.22, sv + 0.002), vec2(0.0022, 0.0006)), aa) * step(0.5, h1(slot, 9.0));
    col += cWhite * 0.035 * mark;
    // Light catching the outer edge of the cabinet.
    col += cLight * 0.18 * (1.0 - smoothstep(0.0, 0.004, ru)) * sheen;
  } else {
    int k = int(clamp(floor(v / UH), 0.0, ${SLOTS - 1}.0));
    vec4 s = uSlots[k];
    int type = int(s.x + 0.5);
    float uh = s.z * UH;                         // unit height
    float uv0 = v - (float(k) - s.y) * UH;       // 0..uh inside the unit
    float x = u - RAIL;                          // 0.. inner width
    float iw = W - 2.0 * RAIL;
    float seed = s.w;
    // Seams between units + a thin top highlight.
    float seam = 1.0 - smoothstep(0.0, 0.0012, min(uv0, uh - uv0));
    col = vec3(0.003, 0.004, 0.007) + cLight * 0.03 * sheen * uSheen;

    if (type == 1) {
      // ---- switch: LED sockets, tiny port numbers, SFP cages
      float u0 = ${(RAIL_W + 0.012 + 0.115).toFixed(4)};
      float pitch = 0.0118;
      float gx = u - u0;
      float c = floor((gx - (gx > 8.0 * pitch ? 0.006 : 0.0)) / pitch + 0.5);
      if (c >= 0.0 && c < 16.0) {
        float cx = u0 + c * pitch + (c >= 8.0 ? 0.006 : 0.0);
        for (int r = 0; r < 2; r++) {
          float cy = uh * (r == 0 ? 0.62 : 0.3);
          float d = length(vec2(u - cx, uv0 - cy));
          col = mix(col, vec3(0.002), fillAA(d - 0.0024, aa));
          col += cWhite * 0.12 * fillAA(abs(d - 0.0021) - 0.0004, aa);
        }
        // Port numbers: a dim tick above each column (made-up marks).
        col += cWhite * 0.03 * fillAA(sdBox(vec2(u - cx, uv0 - uh * 0.88), vec2(0.0012, 0.0008)), aa);
      }
      // SFP cages to the right.
      float p0 = u0 + 16.0 * pitch + 0.02;
      if (u > p0 && u < W - RAIL - 0.01) {
        float pw = 0.0135;
        float pi = floor((u - p0) / pw);
        float px = p0 + (pi + 0.5) * pw;
        for (int r = 0; r < 2; r++) {
          float py = uh * (r == 0 ? 0.7 : 0.3);
          float b = sdBox(vec2(u - px, uv0 - py), vec2(0.0055, 0.0042));
          col = mix(col, vec3(0.012, 0.014, 0.02) + cLight * 0.02, fillAA(abs(b) - 0.0006, aa));
          col = mix(col, vec3(0.0015), fillAA(b + 0.0006, aa));
          float cable = step(0.97, h1(pi + float(r) * 31.0, seed * 97.0));
          emit += cLight * 0.6 * cable * fillAA(b + 0.0015, aa);
        }
      }
      // Left: little made-up marks + a vent.
      col += cWhite * 0.025 * fillAA(sdBox(vec2(x - 0.05, uv0 - uh * 0.65), vec2(0.012, 0.0009)), aa);
    } else if (type == 2) {
      // ---- 2U server: drive bays with handles, vent dots
      float bw = 0.058;
      float bi = floor((x - 0.0) / bw);
      float bx = (bi + 0.5) * bw;
      float bay = sdBox(vec2(x - bx, uv0 - uh * 0.5), vec2(bw * 0.44, uh * 0.4));
      col = mix(col, vec3(0.02, 0.024, 0.036) + cLight * 0.06 * sheen, fillAA(abs(bay) - 0.0008, aa));
      vec2 vd = fract(vec2(x, uv0) / 0.004) - 0.5;
      col += cLight * 0.05 * fillAA(sdBox(vec2(x - bx, uv0 - uh * 0.78), vec2(bw * 0.3, 0.0012)), aa);
    } else if (type == 3) {
      // ---- lit fibre bundle (bright blue)
      float wave = 0.004 * sin(u * 31.0 + seed * 40.0) + 0.003 * sin(u * 73.0 + seed * 11.0);
      float strands = fract((uv0 + wave) / 0.0036);
      float line = exp(-pow((strands - 0.5) / 0.18, 2.0));
      float mask = smoothstep(0.03, 0.1, x) * (1.0 - smoothstep(iw - 0.12, iw - 0.05, x))
                 * smoothstep(0.0, uh * 0.25, uv0) * (1.0 - smoothstep(uh * 0.75, uh, uv0));
      float bundle = 0.6 + 0.4 * sin(x * 22.0 + seed * 9.0);
      emit += mix(cLight, vec3(0.75, 0.9, 1.0), 0.25) * 4.5 * line * mask * bundle + cLight * 0.45 * mask;
    } else if (type == 4) {
      // ---- 1U server: horizontal bays
      float bw = 0.12;
      float bi = floor(x / bw);
      float b = sdBox(vec2(x - (bi + 0.5) * bw, uv0 - uh * 0.5), vec2(bw * 0.46, uh * 0.32));
      col = mix(col, vec3(0.02, 0.024, 0.036) + cLight * 0.05 * sheen, fillAA(abs(b) - 0.0007, aa));
    } else {
      // ---- blank panel with slots
      float sl = fract(x / 0.01);
      col *= mix(1.0, 0.5, step(0.6, sl) * step(uh * 0.3, uv0) * step(uv0, uh * 0.7));
    }
    col = mix(col, vec3(0.001), seam);
    col += cLight * 0.12 * (1.0 - smoothstep(0.0, 0.0015, uh - uv0)) * sheen;
  }

  col += emit;
  // Atmosphere: distant racks fade into the blue room light.
  float haze = 1.0 - exp(-max(vDepth - 1.1, 0.0) * 0.55);
  col = mix(col, cHaze, haze);
  outColor = vec4(col, cocPx(vDepth));
}
`;

const SIDE_FRAG = /* glsl */ `
precision highp float;
in vec2 vL;
in float vDepth;
out vec4 outColor;
uniform vec3 cLight, cHaze;
${COC_GLSL}
void main() {
  // Perforated side panel catching a little blue light from the aisle.
  vec2 g = fract(vL / 0.012) - 0.5;
  float perf = 1.0 - smoothstep(0.18, 0.28, length(g));
  vec3 col = vec3(0.004, 0.005, 0.009) + cLight * (0.02 + 0.05 * smoothstep(0.0, 0.3, vL.x)) * (1.0 - 0.5 * perf);
  col += cLight * 0.12 * perf * smoothstep(0.6, 2.4, vL.y);
  float haze = 1.0 - exp(-max(vDepth - 1.1, 0.0) * 0.55);
  outColor = vec4(mix(col, cHaze, haze), cocPx(vDepth));
}
`;

const BG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec3 cHaze, cLight;
uniform float uMaxCoc, uPx;
void main() {
  vec3 col = cHaze * (0.5 + 0.4 * smoothstep(0.0, 1.0, vUv.y));
  outColor = vec4(col, uMaxCoc * uPx);
}
`;

// =============================================================================
// Depth of field: gather blur on a mip-mapped half-res copy.
// =============================================================================
const HALF_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 uTexel;
void main() {
  vec4 a = texture(tSrc, vUv + uTexel * vec2(-0.5, -0.5));
  vec4 b = texture(tSrc, vUv + uTexel * vec2(0.5, -0.5));
  vec4 c = texture(tSrc, vUv + uTexel * vec2(-0.5, 0.5));
  vec4 d = texture(tSrc, vUv + uTexel * vec2(0.5, 0.5));
  outColor = (a + b + c + d) * 0.25;
}
`;

const GATHER_TAPS = 64;
const GATHER_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;     // half res, rgb + coc (full-res px) in a, mip-mapped
uniform vec2 uTexel;        // 1 / half-res size
void main() {
  vec4 c0 = textureLod(tSrc, vUv, 0.0);
  float R = c0.a * 0.5;     // in half-res px
  if (R < 0.6) { outColor = c0; return; }
  const int N = ${GATHER_TAPS};
  float lod = max(0.0, log2(R * 2.2 / sqrt(float(N))));
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float r = R * sqrt(fi / float(N));
    float th = fi * 2.39996323;
    vec2 off = vec2(cos(th), sin(th)) * r;
    vec4 s = textureLod(tSrc, vUv + off * uTexel, lod);
    // A sharper sample only contributes where its own blur reaches us.
    float sR = s.a * 0.5;
    float w = clamp(1.0 + (sR - r) * 0.5, 0.2, 1.0);
    acc += s.rgb * w;
    wsum += w;
  }
  outColor = vec4(acc / wsum, c0.a);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSharp;
uniform sampler2D tBlur;
uniform float uPx;
void main() {
  vec4 s = texture(tSharp, vUv);
  vec4 b = texture(tBlur, vUv);
  float t = smoothstep(0.7 * uPx, 2.2 * uPx, max(s.a, b.a * 0.85));
  outColor = vec4(mix(s.rgb, b.rgb, t), 1.0);
}
`;

// =============================================================================
// LED sprites: in-focus dots / out-of-focus hexagonal bokeh.
// =============================================================================
const LED_VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec3 aPos;
in vec4 aLed;      // radius (m), colour idx, power, -
in vec3 aBlink;    // period, phase, duty
uniform mat4 viewMatrix, projectionMatrix;
uniform vec2 uRes;           // this pass's target size
uniform vec2 uFullRes;
uniform float uFocalPx;      // full-res px
uniform float uFrame;
uniform float uBand;         // 0 = full-res small sprites, 1 = low-res bokeh
uniform float uBandLo, uBandHi, uGain, uFalloff;
uniform vec3 cLed, cAlt, cBlue, cHaze;
${COC_GLSL}
out vec2 vQ;
out vec3 vCol;
out float vCoc;
out float vR;
void main() {
  vec4 vp = viewMatrix * vec4(aPos, 1.0);
  float d = -vp.z;
  vec4 C = projectionMatrix * vp;
  float phys = aLed.x * uFocalPx / max(d, 0.01);
  float coc = cocPx(d);
  float r = max(phys, 0.9 * uPx) + coc;              // full-res px
  float big = smoothstep(uBandLo * uPx, uBandHi * uPx, r);
  float wBand = uBand < 0.5 ? 1.0 - big : big;
  float f = mod(uFrame + aBlink.y, aBlink.x);
  float on = f < aBlink.z * aBlink.x ? 1.0 : 0.0;
  float I = aLed.z * on * wBand * uGain * pow(clamp(phys / r, 0.0, 1.0), uFalloff);
  float haze = exp(-max(d - 0.7, 0.0) * 0.4);
  vec3 base = aLed.y < 0.5 ? cLed : (aLed.y < 1.5 ? cAlt : cBlue);
  vCol = base * I * haze;
  float ext = uBand < 0.5 ? 2.2 : 1.12;               // room for the glow of small dots
  float scale = uRes.y / uFullRes.y;                  // full-res px -> target px
  vec2 sp = C.xy / C.w * 0.5 * uRes + position.xy * r * ext * scale;
  gl_Position = vec4(sp / (0.5 * uRes) * C.w, 0.0, C.w);
  if (I <= 0.0 || d < 0.05) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vQ = position.xy * ext;
  vCoc = coc / uPx;
  vR = r * scale;
}
`;

const LED_FRAG = /* glsl */ `
precision highp float;
in vec2 vQ;
in vec3 vCol;
in float vCoc;
in float vR;
out vec4 outColor;
float hexDist(vec2 p) {
  // Rotated so the aperture blades are slightly off-axis.
  const float c = 0.9659, s = 0.2588;
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  p = abs(p);
  return max(p.x * 0.866025 + p.y * 0.5, p.y) / 0.866025 * 0.93;
}
void main() {
  float dc = length(vQ);
  float hexMix = smoothstep(2.0, 6.0, vCoc);
  float dd = mix(dc, hexDist(vQ), hexMix);
  float soft = clamp(1.3 / vR + 0.04 + 0.3 * smoothstep(4.0, 40.0, vCoc), 0.04, 0.5);
  float disc = 1.0 - smoothstep(1.0 - soft, 1.0 + soft * 0.3, dd);
  float rim = smoothstep(0.55, 0.97, dd) * disc;
  float bokeh = disc * (0.8 + 0.45 * rim);
  // In focus: hot core + soft glow.
  float dot_ = exp(-2.2 * dc * dc) * 1.4 + exp(-1.8 * dc) * 0.1;
  float shape = mix(dot_, bokeh, smoothstep(0.8, 3.5, vCoc));
  outColor = vec4(vCol * shape, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tComp;
uniform sampler2D tBokeh;
uniform sampler2D tBloom;
uniform float uBloom, uExposure;
${HASH}
${LINEAR_TO_SRGB}
${GRAIN_DITHER}
void main() {
  vec3 c = texture(tComp, vUv).rgb + texture(tBokeh, vUv).rgb + texture(tBloom, vUv).rgb * uBloom;
  c *= uExposure;
  // Hue-preserving soft shoulder.
  float peak = max(c.r, max(c.g, c.b));
  float m = peak < 0.7 ? peak : 0.7 + 0.3 * (1.0 - exp(-(peak - 0.7) / 0.3));
  c *= m / max(peak, 1e-5);
  c = mix(c, vec3(m), clamp((peak - 1.2) * 0.1, 0.0, 0.4));
  // Gentle vignette.
  vec2 q = vUv - 0.5;
  c *= 1.0 - 0.9 * dot(q, q);
  c *= mix(0.45, 1.0, smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y));
  outColor = vec4(grainDither(linearToSrgb(c)), 1.0);
}
`;

// =============================================================================
// Renderer
// =============================================================================
export class ServerBokehRenderer implements LoopRenderer {
  private targets = new TargetCache();
  private bloom = new Bloom(6);
  private scene = new THREE.Scene();
  private ledScene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(VFOV, 16 / 9, 0.05, 100);
  private bg: FullscreenPass;
  private half: FullscreenPass;
  private gather: FullscreenPass;
  private composite: FullscreenPass;
  private final: FullscreenPass;
  private shared: Record<string, THREE.IUniform>;
  private ledUniforms: Record<string, THREE.IUniform>;
  private disposables: { dispose(): void }[] = [];
  private mipTarget: THREE.WebGLRenderTarget | null = null;

  constructor(cw: ServerColorway) {
    const v3 = (hex: string) => new THREE.Vector3(...hexToLinear(hex));
    const light = v3(cw.light);
    this.shared = {
      uFocus: { value: FOCUS },
      uKFar: { value: COC_K_FAR },
      uKNear: { value: COC_K_NEAR },
      uMaxCoc: { value: COC_MAX },
      uPx: { value: 1 },
      cLight: { value: light },
      cHaze: { value: light.clone().multiplyScalar(0.42) },
      cWhite: { value: new THREE.Vector3(0.8, 0.85, 1.0) },
    };

    // ---- racks
    const frontGeom = new THREE.PlaneGeometry(RACK_W, RACK_H);
    const sideGeom = new THREE.PlaneGeometry(1, RACK_H);
    this.disposables.push(frontGeom, sideGeom);
    const frontMats = RACK_TYPES.map((rt, ti) => {
      const m = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: RACK_VERT,
        fragmentShader: RACK_FRAG,
        uniforms: {
          ...this.shared,
          uSize: { value: new THREE.Vector2(RACK_W, RACK_H) },
          uSheen: { value: ti === 0 ? 1.0 : 0.8 },
          uSlots: {
            value: rt.slots.map((s) => new THREE.Vector4(s.type, s.part, s.height, s.seed)),
          },
        },
      });
      this.disposables.push(m);
      return m;
    });
    // Two rows facing each other across the aisle. The far row is the near row
    // rotated 180 degrees; both repeat every S along x.
    const rows = [new THREE.Group(), new THREE.Group()];
    rows[1].rotation.y = Math.PI;
    rows[1].position.set((RACK_FIRST + RACK_LAST + 1) * RACK_W, 0, AISLE);
    rows.forEach((row, ri) => {
      this.scene.add(row);
      row.updateMatrixWorld(true);
      for (let i = RACK_FIRST; i <= RACK_LAST; i++) {
        const t = ((i % PATTERN) + PATTERN) % PATTERN;
        const z = PATTERN_Z[t];
        const front = new THREE.Mesh(frontGeom, frontMats[t]);
        front.position.set(i * RACK_W + RACK_W / 2, RACK_BOTTOM + RACK_H / 2, z);
        front.frustumCulled = false;
        row.add(front);
        // Side panel on the camera-facing (+x) side where the next rack is recessed
        // (near row only — the far row's sides face away / are lost in the blur).
        const zNext = PATTERN_Z[(t + 1) % PATTERN];
        if (ri === 0 && z > zNext) {
          const depth = z - zNext;
          const m = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: RACK_VERT,
            fragmentShader: SIDE_FRAG,
            uniforms: { ...this.shared, uSize: { value: new THREE.Vector2(depth, RACK_H) } },
          });
          this.disposables.push(m);
          const side = new THREE.Mesh(sideGeom, m);
          side.scale.set(depth, 1, 1);
          side.rotation.y = Math.PI / 2; // faces +x
          side.position.set((i + 1) * RACK_W, RACK_BOTTOM + RACK_H / 2, zNext + depth / 2);
          side.frustumCulled = false;
          row.add(side);
        }
      }
    });

    // ---- LEDs (instanced sprites), placed with the same row transforms
    const pos: number[] = [];
    const led: number[] = [];
    const blink: number[] = [];
    const p = new THREE.Vector3();
    rows.forEach((row) => {
      for (let i = RACK_FIRST; i <= RACK_LAST; i++) {
        const t = ((i % PATTERN) + PATTERN) % PATTERN;
        for (const l of RACK_TYPES[t].leds) {
          p.set(i * RACK_W + l.u, RACK_BOTTOM + l.v, PATTERN_Z[t] + 0.002).applyMatrix4(row.matrixWorld);
          pos.push(p.x, p.y, p.z);
          led.push(l.radius, l.color, l.power, 0);
          blink.push(l.period, l.phase, l.duty);
        }
      }
    });
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
    );
    g.setAttribute("aPos", new THREE.InstancedBufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("aLed", new THREE.InstancedBufferAttribute(new Float32Array(led), 4));
    g.setAttribute("aBlink", new THREE.InstancedBufferAttribute(new Float32Array(blink), 3));
    g.instanceCount = pos.length / 3;
    this.ledUniforms = {
      ...this.shared,
      uRes: { value: new THREE.Vector2() },
      uFullRes: { value: new THREE.Vector2() },
      uFocalPx: { value: 1 },
      uFrame: { value: 0 },
      uBand: { value: 0 },
      uBandLo: { value: BAND_LO },
      uBandHi: { value: BAND_HI },
      uGain: { value: 6.0 },
      uFalloff: { value: 1.45 },
      cLed: { value: v3(cw.led) },
      cAlt: { value: v3(cw.ledAlt) },
      cBlue: { value: light.clone().multiplyScalar(1.6) },
    };
    const ledMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: LED_VERT,
      fragmentShader: LED_FRAG,
      uniforms: this.ledUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ledMesh = new THREE.Mesh(g, ledMat);
    ledMesh.frustumCulled = false;
    this.ledScene.add(ledMesh);
    this.disposables.push(g, ledMat);

    // ---- passes
    this.bg = new FullscreenPass(BG_FRAG, {
      cHaze: this.shared.cHaze,
      cLight: this.shared.cLight,
      uMaxCoc: this.shared.uMaxCoc,
      uPx: this.shared.uPx,
    });
    this.half = new FullscreenPass(HALF_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.gather = new FullscreenPass(GATHER_FRAG, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
    });
    this.composite = new FullscreenPass(COMPOSITE_FRAG, {
      tSharp: { value: null },
      tBlur: { value: null },
      uPx: this.shared.uPx,
    });
    this.final = new FullscreenPass(FINAL_FRAG, {
      tComp: { value: null },
      tBokeh: { value: null },
      tBloom: { value: null },
      uBloom: { value: 0.3 },
      uExposure: { value: 0.8 },
      uGrainFrame: { value: 0 },
      uGrain: { value: 0.02 },
    });
  }

  private getMipTarget(w: number, h: number) {
    if (!this.mipTarget || this.mipTarget.width !== w || this.mipTarget.height !== h) {
      this.mipTarget?.dispose();
      this.mipTarget = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: true,
        depthBuffer: false,
      });
    }
    return this.mipTarget;
  }

  render(gl: THREE.WebGLRenderer, frame: number, w: number, h: number) {
    const f = frame % LOOP;
    const phase = f / LOOP;
    const a = phase * Math.PI * 2;
    const px = h / 720;

    // Camera: drifts exactly DRIFT_PATTERNS * S per loop; focus breathes once.
    const cam = this.camera;
    cam.aspect = w / h;
    cam.fov = VFOV;
    cam.updateProjectionMatrix();
    cam.position.set(CAM_X0 - DRIFT_PATTERNS * S * phase, CAM_Y + 0.004 * Math.sin(a), CAM_Z);
    cam.rotation.order = "YXZ";
    cam.rotation.set(0.004 * Math.sin(a + 0.7), YAW, 0);
    cam.updateMatrixWorld(true);

    this.shared.uPx.value = px;
    this.shared.uFocus.value = FOCUS * (1 + 0.035 * Math.sin(a));
    const focalPx = (0.5 * h) / Math.tan(THREE.MathUtils.degToRad(VFOV) / 2);

    // 1) sharp scene: rgb + CoC
    const sceneRT = this.targets.get("scene", w, h, { depth: true });
    gl.setRenderTarget(sceneRT);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, false);
    this.bg.render(gl, sceneRT);
    gl.setRenderTarget(sceneRT);
    gl.render(this.scene, cam);

    // 2) half-res mip-mapped copy, 3) gather blur, 4) composite
    const hw = Math.max(1, Math.floor(w / 2));
    const hh = Math.max(1, Math.floor(h / 2));
    const mip = this.getMipTarget(hw, hh);
    this.half.uniforms.tSrc.value = sceneRT.texture;
    this.half.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.half.render(gl, mip);
    const blurRT = this.targets.get("blur", hw, hh);
    this.gather.uniforms.tSrc.value = mip.texture;
    this.gather.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    this.gather.render(gl, blurRT);
    const compRT = this.targets.get("comp", w, h);
    this.composite.uniforms.tSharp.value = sceneRT.texture;
    this.composite.uniforms.tBlur.value = blurRT.texture;
    this.composite.render(gl, compRT);

    // 5) LEDs: small sprites at full res onto the composite, bokeh at 1/4 res.
    const lu = this.ledUniforms;
    lu.uFrame.value = f;
    lu.uFocalPx.value = focalPx;
    lu.uFullRes.value.set(w, h);
    lu.uRes.value.set(w, h);
    lu.uBand.value = 0;
    gl.setRenderTarget(compRT);
    gl.render(this.ledScene, cam);
    const qw = Math.max(1, Math.floor(w / 4));
    const qh = Math.max(1, Math.floor(h / 4));
    const bokehRT = this.targets.get("bokeh", qw, qh);
    gl.setRenderTarget(bokehRT);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, false, false);
    lu.uRes.value.set(qw, qh);
    lu.uBand.value = 1;
    gl.render(this.ledScene, cam);

    // 6) bloom + final
    const bloomTex = this.bloom.render(gl, compRT, 0.3);
    const fu = this.final.uniforms;
    fu.tComp.value = compRT.texture;
    fu.tBokeh.value = bokehRT.texture;
    fu.tBloom.value = bloomTex;
    fu.uGrainFrame.value = f;
    this.final.render(gl, null);
  }

  dispose() {
    this.targets.dispose();
    this.mipTarget?.dispose();
    this.bloom.dispose();
    [this.bg, this.half, this.gather, this.composite, this.final].forEach((p) => p.dispose());
    this.disposables.forEach((d) => d.dispose());
  }
}
