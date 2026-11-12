import * as THREE from "three";
import type { BuildFn } from "../lib/useThreeScene";
import { rng, lerp, smoothstep } from "../lib/useThreeScene";
import {
  buildChartAtlas,
  buildGlyphAtlas,
  glyphAdvance,
  GLYPHS,
  GLYPH_CELL_H,
  GLYPH_CELL_W,
  KIND_ID,
  type ChartColors,
} from "./atlas";
import type { FinanceRig } from "./cameraRigs";

export type FinancePalette = {
  name: string;
  bgCenter: string;
  bgEdge: string;
  inkDark: string;
  inkMid: string;
  inkLight: string;
  streakDark: string;
  streakLight: string;
  chart: ChartColors;
};

/* ------------------------------------------------------------------ */
/* GLSL                                                                 */
/* ------------------------------------------------------------------ */
const GLSL_HASH = /* glsl */ `
float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float h31(vec3 p) { return h21(p.xy + vec2(p.z * 37.17, p.z * 11.31)); }
`;

/** Shared vertex logic: life envelope, glitch, depth-of-field expansion. */
const GLSL_SPRITE_COMMON = /* glsl */ `
uniform float uTime;
uniform float uFrame;
uniform float uFocus;
uniform float uBlurK;     // CoC in px per unit of |1 - focus/depth|
uniform float uMaxCoc;    // px
uniform float uFocalPx;   // px per world unit at depth 1
uniform float uBurst;
uniform float uDolly;     // global time offset for nothing (reserved)

// returns envelope (0 hidden .. 1 fully visible) and glitch amount
vec2 lifeEnvelope(float birth, float death, float seed) {
  float inT = clamp((uTime - birth) / 0.32, 0.0, 1.0);
  float outT = clamp((death - uTime) / 0.26, 0.0, 1.0);
  float env = min(inT, outT);
  // flicker while appearing / disappearing
  float fl = step(0.35, h21(vec2(seed * 17.0, floor(uFrame))));
  float g = 1.0 - env;
  float burstHit = uBurst * step(0.55, h21(vec2(seed * 5.0, floor(uFrame / 2.0))));
  g = max(g, burstHit);
  float vis = env * mix(1.0, fl, smoothstep(0.0, 0.6, 1.0 - env));
  vis *= 1.0 - burstHit * 0.6 * step(0.5, h21(vec2(seed, uFrame)));
  return vec2(vis, g);
}
`;

const POISSON = /* glsl */ `
const vec2 POISSON[8] = vec2[8](
  vec2(-0.613, 0.617), vec2(0.170, -0.040), vec2(-0.299, -0.792), vec2(0.645, 0.493),
  vec2(-0.651, -0.146), vec2(0.421, -0.781), vec2(-0.0, 0.95), vec2(0.93, -0.18)
);
`;

const chartVert = /* glsl */ `
attribute vec3 aPos;
attribute vec2 aSize;
attribute vec4 aUV;
attribute vec4 aLife;   // birth, death, seed, kind
attribute float aAlpha;
varying vec2 vLocal;
varying vec4 vRect;
varying float vAlpha;
varying vec2 vCocUV;
varying float vLod;
varying float vReveal;
varying float vKind;
${GLSL_HASH}
${GLSL_SPRITE_COMMON}
void main() {
  float birth = aLife.x;
  float death = aLife.y;
  float seed = aLife.z;
  if (uTime < birth || uTime > death) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 env = lifeEnvelope(birth, death, seed);
  vec4 viewC = viewMatrix * vec4(aPos, 1.0);
  float depth = max(-viewC.z, 0.05);
  float cocPx = min(uBlurK * abs(1.0 - uFocus / depth), uMaxCoc);
  vec2 sizePx = aSize * uFocalPx / depth;
  vec2 m = (cocPx + 1.0) / max(sizePx, vec2(1.0));
  vec2 local = position.xy * (1.0 + 2.0 * m);
  // glitch: horizontal jitter + stretch
  float jit = (h21(vec2(seed * 3.1, uFrame)) - 0.5) * env.y;
  float stretch = 1.0 + env.y * 1.4 * h21(vec2(seed * 7.7, floor(uFrame / 2.0)));
  vec3 wp = aPos + vec3(local.x * aSize.x * stretch + jit * aSize.x * 0.8, local.y * aSize.y, 0.0);
  vLocal = local + 0.5;
  vRect = aUV;
  vAlpha = env.x * aAlpha * (1.0 - 0.45 * smoothstep(8.0, 17.0, depth));
  vCocUV = cocPx / max(sizePx, vec2(1.0));
  vLod = log2(max(cocPx / 2.5, 1.0));
  vReveal = smoothstep(birth, birth + 0.55, uTime);
  vKind = aLife.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const chartFrag = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vLocal;
varying vec4 vRect;
varying float vAlpha;
varying vec2 vCocUV;
varying float vLod;
varying float vReveal;
varying float vKind;
${POISSON}
vec4 samp(vec2 l) {
  if (l.x < 0.0 || l.y < 0.0 || l.x > 1.0 || l.y > 1.0) return vec4(0.0);
  return texture(uAtlas, mix(vRect.xy, vRect.zw, l), vLod);
}
void main() {
  vec4 acc = samp(vLocal);
  for (int i = 0; i < 8; i++) acc += samp(vLocal + POISSON[i] * vCocUV);
  acc /= 9.0;
  // build-on reveal by chart type
  float mask = 1.0;
  float k = vKind;
  float edge = 0.04;
  if (k < 0.5 || (k > 4.5 && k < 7.5)) {
    mask = smoothstep(vReveal * (1.0 + edge), vReveal * (1.0 + edge) - edge, vLocal.x);
  } else if (k < 2.5) {
    mask = smoothstep(vReveal * (1.0 + edge), vReveal * (1.0 + edge) - edge, vLocal.y);
  } else {
    vec2 c = vLocal - 0.5;
    float a = (atan(c.x, c.y) / 6.2831853) + 0.5;
    mask = smoothstep(vReveal * 1.02, vReveal * 1.02 - 0.02, a);
  }
  if (vReveal >= 1.0) mask = 1.0;
  float a = vAlpha * mask;
  gl_FragColor = acc * a; // premultiplied
}
`;

const glyphVert = /* glsl */ `
attribute vec3 aPos;      // label origin (left, baseline-ish)
attribute vec4 aGlyph;    // xOffsetEm, charCode (<0 digit), slot, sizeWorld
attribute vec4 aLife;     // birth, death, seed, rate
attribute vec4 aInk;      // rgb, alpha
varying vec2 vLocal;
varying vec4 vRect;
varying float vAlpha;
varying vec2 vCocUV;
varying float vLod;
varying vec3 vInk;
${GLSL_HASH}
${GLSL_SPRITE_COMMON}
void main() {
  float birth = aLife.x;
  float death = aLife.y;
  float seed = aLife.z;
  if (uTime < birth || uTime > death) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 env = lifeEnvelope(birth, death, seed);
  float size = aGlyph.w;
  float code = aGlyph.y;
  if (code < -0.5) {
    float rate = aLife.w;
    float tick = rate > 0.0 ? floor(uTime * rate + seed * 7.0) : 0.0;
    float r = h31(vec3(seed * 13.0 + aGlyph.z * 1.7, tick, aGlyph.z));
    code = code < -1.5 ? 1.0 + floor(r * 9.0) : floor(r * 10.0);
  }
  vec4 viewC = viewMatrix * vec4(aPos, 1.0);
  float depth = max(-viewC.z, 0.05);
  float cocPx = min(uBlurK * abs(1.0 - uFocus / depth), uMaxCoc);
  vec2 qsize = vec2(size * ${(GLYPH_CELL_W / GLYPH_CELL_H).toFixed(5)}, size);
  vec2 sizePx = qsize * uFocalPx / depth;
  vec2 m = (cocPx + 1.0) / max(sizePx, vec2(1.0));
  vec2 local = position.xy * (1.0 + 2.0 * m);
  float jit = (h21(vec2(seed * 3.1, uFrame)) - 0.5) * env.y;
  float stretch = 1.0 + env.y * 1.2 * h21(vec2(seed * 7.7, floor(uFrame / 2.0)));
  float x = (aGlyph.x * size + (local.x + 0.5) * qsize.x) * stretch + jit * size * 3.0;
  vec3 wp = aPos + vec3(x, (local.y + 0.5) * qsize.y, 0.0);
  float n = ${GLYPHS.length.toFixed(1)};
  vRect = vec4(code / n, 0.0, (code + 1.0) / n, 1.0);
  vLocal = local + 0.5;
  vAlpha = env.x * aInk.a * (1.0 - 0.45 * smoothstep(8.0, 17.0, depth));
  vInk = aInk.rgb;
  vCocUV = cocPx / max(sizePx, vec2(1.0));
  vLod = log2(max(cocPx / 2.5, 1.0));
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const glyphFrag = /* glsl */ `
uniform sampler2D uGlyphs;
varying vec2 vLocal;
varying vec4 vRect;
varying float vAlpha;
varying vec2 vCocUV;
varying float vLod;
varying vec3 vInk;
${POISSON}
float samp(vec2 l) {
  if (l.x < 0.0 || l.y < 0.0 || l.x > 1.0 || l.y > 1.0) return 0.0;
  return texture(uGlyphs, mix(vRect.xy, vRect.zw, l), vLod).a;
}
void main() {
  float a = samp(vLocal);
  for (int i = 0; i < 8; i++) a += samp(vLocal + POISSON[i] * vCocUV);
  a /= 9.0;
  a *= vAlpha;
  gl_FragColor = vec4(vInk * a, a);
}
`;

const fullscreenVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const backgroundFrag = /* glsl */ `
uniform vec3 uCenter;
uniform vec3 uEdge;
uniform float uAspect;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  float d = length(q * vec2(0.82, 1.0));
  vec3 c = mix(uCenter, uEdge, smoothstep(0.1, 1.0, d));
  // soft breathing hot-spot
  c += (uCenter - uEdge) * 0.08 * exp(-d * d * 9.0) * (0.85 + 0.15 * sin(uTime * 0.7));
  gl_FragColor = vec4(c, 1.0);
}
`;

const streakFrag = /* glsl */ `
uniform float uFrame;
uniform float uBurst;
uniform float uBands;
uniform vec3 uDark;
uniform vec3 uLight;
uniform float uPx;   // one pixel in uv.y
varying vec2 vUv;
${GLSL_HASH}
void main() {
  vec4 outc = vec4(0.0);
  // --- fine streak lines ---------------------------------------------
  float yb = vUv.y * uBands;
  float band = floor(yb);
  float tick = floor(uFrame / 3.0) + floor(h21(vec2(band, 3.0)) * 3.0);
  float hb = h21(vec2(band, tick));
  float thr = 0.72 - uBurst * 0.25;
  if (hb > thr) {
    float x0 = h21(vec2(band + 0.37, tick)) * 1.2 - 0.2;
    float len = 0.05 + 0.55 * pow(h21(vec2(band, tick + 2.7)), 2.0);
    float soft = 0.02 + 0.08 * h21(vec2(band, tick + 9.1));
    float inside = smoothstep(x0, x0 + soft, vUv.x) * smoothstep(x0 + len, x0 + len - soft, vUv.x);
    float sub = fract(yb);
    float thick = 0.12 + 0.75 * h21(vec2(band, tick + 4.4));
    float line = smoothstep(thick * 0.5 + 0.08, thick * 0.5 - 0.08, abs(sub - 0.5));
    // fine horizontal texture inside thick smears
    float tex = 0.6 + 0.4 * h21(vec2(floor(vUv.x * 300.0), band + tick));
    float a = inside * line * mix(0.08, 0.42, h21(vec2(band, tick + 7.0))) * tex;
    vec3 col = h21(vec2(band, tick + 5.0)) < 0.55 ? uDark : uLight;
    outc = vec4(col * a, a);
  }
  // --- broad translucent smear bands -----------------------------------
  float yb2 = vUv.y * uBands * 0.12;
  float b2 = floor(yb2);
  float t2 = floor(uFrame / 5.0);
  float hb2 = h21(vec2(b2 + 91.0, t2));
  if (hb2 > 0.8 - uBurst * 0.3) {
    float x0 = h21(vec2(b2, t2 + 1.0)) - 0.3;
    float len = 0.3 + 0.7 * h21(vec2(b2, t2 + 2.0));
    float inside = smoothstep(x0, x0 + 0.15, vUv.x) * smoothstep(x0 + len, x0 + len - 0.15, vUv.x);
    float v = fract(yb2);
    float prof = smoothstep(0.0, 0.3, v) * smoothstep(1.0, 0.7, v);
    float rows = 0.5 + 0.5 * h21(vec2(floor(vUv.y / (uPx * 2.0)), t2));
    float a = inside * prof * rows * 0.22;
    vec3 col = h21(vec2(b2, t2 + 3.0)) < 0.5 ? uDark : uLight;
    outc = outc + vec4(col * a, a) * (1.0 - outc.a);
  }
  gl_FragColor = outc;
}
`;

/* ------------------------------------------------------------------ */
/* Helpers                                                               */
/* ------------------------------------------------------------------ */
const srgb = (hex: string) => {
  const c = new THREE.Color();
  c.setStyle(hex, THREE.NoColorSpace as THREE.ColorSpace);
  return c;
};

type Spawn = { pos: THREE.Vector3; sizeH: number };

const PERCENTS = ["+8,464 %", "-9,876 %", "+5,878 %", "+2,433 %", "-0,240 %", "+8,741 %", "-7,873 %", "0,240 %"];

/* ------------------------------------------------------------------ */
/* Builder                                                              */
/* ------------------------------------------------------------------ */
export const makeFinanceBuilder =
  (palette: FinancePalette, rig: FinanceRig): BuildFn =>
  ({ renderer, width, height, pixelRatio, fps, durationInFrames }) => {
    const duration = durationInFrames / fps;
    const renderH = height * pixelRatio;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // shaders output display-referred sRGB
    renderer.autoClear = false;

    const camera = new THREE.PerspectiveCamera(rig.fov, width / height, 0.05, 200);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(rig.fov / 2));
    const focalPx = renderH / (2 * tanHalf);

    /* --------------------------- textures --------------------------- */
    const { canvas: atlasCanvas, sprites } = buildChartAtlas(palette.chart);
    const atlasTex = new THREE.CanvasTexture(atlasCanvas);
    atlasTex.colorSpace = THREE.NoColorSpace;
    atlasTex.premultiplyAlpha = true;
    atlasTex.generateMipmaps = true;
    atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
    atlasTex.magFilter = THREE.LinearFilter;
    atlasTex.anisotropy = 4;
    atlasTex.needsUpdate = true;

    const glyphCanvas = buildGlyphAtlas();
    const glyphTex = new THREE.CanvasTexture(glyphCanvas);
    glyphTex.colorSpace = THREE.NoColorSpace;
    glyphTex.generateMipmaps = true;
    glyphTex.minFilter = THREE.LinearMipmapLinearFilter;
    glyphTex.magFilter = THREE.LinearFilter;
    glyphTex.anisotropy = 4;
    glyphTex.needsUpdate = true;

    /* --------------------------- spawning --------------------------- */
    const camAt = (t: number) => {
      const c = camera.clone();
      rig.apply(c, t, duration);
      c.updateMatrixWorld(true);
      return c;
    };
    // cache camera transforms on a 0.1 s grid for spawning
    const camCache = new Map<number, THREE.PerspectiveCamera>();
    const camFor = (t: number) => {
      const k = Math.round(Math.max(-5, t) * 10);
      let c = camCache.get(k);
      if (!c) {
        c = camAt(k / 10);
        camCache.set(k, c);
      }
      return c;
    };

    const spawnAt = (t: number, r: () => number, dMin: number, dMax: number, spreadX = 1.12, spreadY = 1.08): Spawn => {
      const c = camFor(t);
      // depth distribution biased toward the mid-ground
      const u = r();
      const d = lerp(dMin, dMax, Math.pow(u, 1.6));
      const halfH = d * tanHalf;
      const halfW = halfH * (width / height);
      const sx = (r() * 2 - 1) * spreadX;
      const sy = (r() * 2 - 1) * spreadY;
      const local = new THREE.Vector3(sx * halfW, sy * halfH, -d);
      const pos = local.applyMatrix4(c.matrixWorld);
      return { pos, sizeH: 2 * halfH };
    };

    // glitch bursts (moments where many elements swap at once)
    const br = rng(rig.seed + 5);
    const bursts: number[] = [];
    for (let t = 0.9 + br() * 0.8; t < duration; t += 1.4 + br() * 1.6) bursts.push(t);
    const snapToBurst = (t: number, r: () => number) => {
      if (r() > 0.4) return t;
      let best = t;
      let bd = 1e9;
      for (const b of bursts) {
        const dd = Math.abs(b - t);
        if (dd < bd) {
          bd = dd;
          best = b;
        }
      }
      return bd < 0.9 ? best : t;
    };

    /* charts */
    const cr = rng(rig.seed);
    type ChartInst = { pos: THREE.Vector3; w: number; h: number; uv: number[]; birth: number; death: number; seed: number; kind: number; alpha: number };
    const charts: ChartInst[] = [];
    const chartRate = 26; // spawns per second
    for (let t = -4; t < duration; t += -Math.log(1 - cr() * 0.999) / chartRate) {
      const sp = sprites[Math.floor(cr() * sprites.length)];
      const s = spawnAt(t, cr, 3.2, 17);
      let frac: number; // screen-height fraction of the sprite height
      switch (sp.kind) {
        case "pie":
        case "donut":
          frac = 0.07 + cr() * 0.12;
          break;
        case "teal":
        case "mini":
          frac = 0.03 + cr() * 0.04;
          break;
        case "table":
          frac = 0.04 + cr() * 0.05;
          break;
        default:
          frac = 0.06 + cr() * 0.1;
      }
      const near = s.pos.distanceTo(camFor(t).position);
      if (near < 5) frac *= 1.6;
      const h = frac * s.sizeH * 0.95;
      const birth = snapToBurst(t, cr);
      const life = 1.1 + cr() * 2.6;
      const death = snapToBurst(birth + life, cr);
      if (death - birth < 0.6) continue;
      charts.push({
        pos: s.pos,
        w: h * sp.aspect,
        h,
        uv: sp.uv,
        birth,
        death,
        seed: cr() * 100,
        kind: KIND_ID[sp.kind],
        alpha: 0.72 + cr() * 0.2,
      });
    }

    /* number labels */
    const lr = rng(rig.seed + 99);
    type GlyphInst = { pos: THREE.Vector3; x: number; code: number; slot: number; size: number; birth: number; death: number; seed: number; rate: number; ink: THREE.Color; alpha: number };
    const glyphs: GlyphInst[] = [];
    const inkDark = srgb(palette.inkDark);
    const inkMid = srgb(palette.inkMid);
    const inkLight = srgb(palette.inkLight);
    const labelRate = 170; // spawns per second
    for (let t = -4; t < duration; t += -Math.log(1 - lr() * 0.999) / labelRate) {
      const tier = lr();
      // screen-height fraction for the glyph height
      let frac: number;
      let ink: THREE.Color;
      let alpha: number;
      let near = false;
      if (tier < 0.02) {
        // huge, defocused foreground numbers
        frac = 0.05 + lr() * 0.03;
        ink = inkMid;
        alpha = 0.75;
        near = true;
      } else if (tier < 0.08) {
        frac = 0.035 + lr() * 0.025;
        ink = inkDark;
        alpha = 0.9;
      } else if (tier < 0.24) {
        frac = 0.018 + lr() * 0.01;
        ink = lr() < 0.6 ? inkDark : inkMid;
        alpha = 0.85;
      } else {
        frac = 0.009 + lr() * 0.006;
        ink = lr() < 0.5 ? inkMid : inkLight;
        alpha = 0.8;
      }
      const s = near ? spawnAt(t, lr, 3.6, 5.0, 0.9, 0.9) : spawnAt(t, lr, 3.0, 17, 1.15, 1.1);
      const size = frac * s.sizeH;
      // label string template
      const pct = lr() < 0.3;
      let tpl: string;
      if (pct) {
        // the reference keeps repeating a small set of percentages
        tpl = PERCENTS[Math.floor(lr() * PERCENTS.length)];
      } else {
        const nd = 3 + Math.floor(lr() * 3);
        tpl = `${lr() < 0.45 ? "-" : ""}L${"D".repeat(nd - 1)},DDD`;
      }
      const birth = snapToBurst(t, lr);
      const life = 0.8 + lr() * 2.4;
      const death = snapToBurst(birth + life, lr);
      if (death - birth < 0.5) continue;
      const seed = lr() * 100;
      const rate = lr() < 0.25 ? 0 : 2 + lr() * 8;
      // centre the label on the spawn point
      let total = 0;
      for (const ch of tpl) total += glyphAdvance(ch === "D" || ch === "L" ? "0" : ch);
      let x = -total / 2;
      let slot = 0;
      for (const ch of tpl) {
        const adv = glyphAdvance(ch === "D" || ch === "L" ? "0" : ch);
        if (ch !== " ") {
          const code = ch === "D" ? -1 : ch === "L" ? -2 : GLYPHS.indexOf(ch);
          // glyph quad is 0.667em wide, centre it on its advance box
          glyphs.push({
            pos: s.pos,
            x: x + adv / 2 - (GLYPH_CELL_W / GLYPH_CELL_H) / 2,
            code,
            slot,
            size,
            birth,
            death,
            seed,
            rate,
            ink,
            alpha,
          });
        }
        x += adv;
        slot++;
      }
    }

    /* --------------------------- materials -------------------------- */
    const commonUniforms = {
      uTime: { value: 0 },
      uFrame: { value: 0 },
      uFocus: { value: rig.focus(0) },
      uBlurK: { value: rig.blurK * renderH },
      uMaxCoc: { value: rig.maxCoc * renderH },
      uFocalPx: { value: focalPx },
      uBurst: { value: 0 },
      uDolly: { value: 0 },
    };

    const quad = new THREE.PlaneGeometry(1, 1);

    // charts
    const chartGeo = new THREE.InstancedBufferGeometry();
    chartGeo.index = quad.index;
    chartGeo.setAttribute("position", quad.getAttribute("position"));
    chartGeo.setAttribute("uv", quad.getAttribute("uv"));
    // sort far -> near (by depth from the camera at birth) for nicer blending
    const startCam = camFor(0);
    charts.sort((a, b) => b.pos.distanceTo(startCam.position) - a.pos.distanceTo(startCam.position));
    const cPos = new Float32Array(charts.length * 3);
    const cSize = new Float32Array(charts.length * 2);
    const cUV = new Float32Array(charts.length * 4);
    const cLife = new Float32Array(charts.length * 4);
    const cAlpha = new Float32Array(charts.length);
    charts.forEach((c, i) => {
      cPos.set([c.pos.x, c.pos.y, c.pos.z], i * 3);
      cSize.set([c.w, c.h], i * 2);
      cUV.set(c.uv, i * 4);
      cLife.set([c.birth, c.death, c.seed, c.kind], i * 4);
      cAlpha[i] = c.alpha;
    });
    chartGeo.setAttribute("aPos", new THREE.InstancedBufferAttribute(cPos, 3));
    chartGeo.setAttribute("aSize", new THREE.InstancedBufferAttribute(cSize, 2));
    chartGeo.setAttribute("aUV", new THREE.InstancedBufferAttribute(cUV, 4));
    chartGeo.setAttribute("aLife", new THREE.InstancedBufferAttribute(cLife, 4));
    chartGeo.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(cAlpha, 1));
    chartGeo.instanceCount = charts.length;
    const chartMat = new THREE.ShaderMaterial({
      uniforms: { ...commonUniforms, uAtlas: { value: atlasTex } },
      vertexShader: chartVert,
      fragmentShader: chartFrag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const chartMesh = new THREE.Mesh(chartGeo, chartMat);
    chartMesh.frustumCulled = false;

    // glyphs
    const glyphGeo = new THREE.InstancedBufferGeometry();
    glyphGeo.index = quad.index;
    glyphGeo.setAttribute("position", quad.getAttribute("position"));
    glyphGeo.setAttribute("uv", quad.getAttribute("uv"));
    const gPos = new Float32Array(glyphs.length * 3);
    const gGlyph = new Float32Array(glyphs.length * 4);
    const gLife = new Float32Array(glyphs.length * 4);
    const gInk = new Float32Array(glyphs.length * 4);
    glyphs.forEach((g, i) => {
      gPos.set([g.pos.x, g.pos.y, g.pos.z], i * 3);
      gGlyph.set([g.x, g.code, g.slot, g.size], i * 4);
      gLife.set([g.birth, g.death, g.seed, g.rate], i * 4);
      gInk.set([g.ink.r, g.ink.g, g.ink.b, g.alpha], i * 4);
    });
    glyphGeo.setAttribute("aPos", new THREE.InstancedBufferAttribute(gPos, 3));
    glyphGeo.setAttribute("aGlyph", new THREE.InstancedBufferAttribute(gGlyph, 4));
    glyphGeo.setAttribute("aLife", new THREE.InstancedBufferAttribute(gLife, 4));
    glyphGeo.setAttribute("aInk", new THREE.InstancedBufferAttribute(gInk, 4));
    glyphGeo.instanceCount = glyphs.length;
    const glyphMat = new THREE.ShaderMaterial({
      uniforms: { ...commonUniforms, uGlyphs: { value: glyphTex } },
      vertexShader: glyphVert,
      fragmentShader: glyphFrag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const glyphMesh = new THREE.Mesh(glyphGeo, glyphMat);
    glyphMesh.frustumCulled = false;

    const scene = new THREE.Scene();
    scene.add(chartMesh);
    scene.add(glyphMesh);
    chartMesh.renderOrder = 1;
    glyphMesh.renderOrder = 2;

    // full-screen layers
    const fsGeo = new THREE.PlaneGeometry(2, 2);
    const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const bgMat = new THREE.ShaderMaterial({
      uniforms: {
        uCenter: { value: srgb(palette.bgCenter) },
        uEdge: { value: srgb(palette.bgEdge) },
        uAspect: { value: width / height },
        uTime: { value: 0 },
      },
      vertexShader: fullscreenVert,
      fragmentShader: backgroundFrag,
      depthTest: false,
      depthWrite: false,
    });
    const bgScene = new THREE.Scene();
    bgScene.add(new THREE.Mesh(fsGeo, bgMat));

    const streakMat = new THREE.ShaderMaterial({
      uniforms: {
        uFrame: { value: 0 },
        uBurst: { value: 0 },
        uBands: { value: 240 },
        uDark: { value: srgb(palette.streakDark) },
        uLight: { value: srgb(palette.streakLight) },
        uPx: { value: 1 / renderH },
      },
      vertexShader: fullscreenVert,
      fragmentShader: streakFrag,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const fgScene = new THREE.Scene();
    fgScene.add(new THREE.Mesh(fsGeo, streakMat));

    const render = (frame: number) => {
      const t = frame / fps;
      rig.apply(camera, t, duration);
      camera.updateMatrixWorld(true);

      let burst = 0;
      for (const b of bursts) {
        const d = t - b;
        if (d >= -0.07 && d < 0.3) burst = Math.max(burst, d < 0 ? 1 + d / 0.07 : 1 - smoothstep(0, 0.3, d));
      }
      commonUniforms.uTime.value = t;
      commonUniforms.uFrame.value = frame;
      commonUniforms.uFocus.value = rig.focus(t);
      commonUniforms.uBurst.value = burst;
      bgMat.uniforms.uTime.value = t;
      streakMat.uniforms.uFrame.value = frame;
      streakMat.uniforms.uBurst.value = burst;

      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(bgScene, orthoCam);
      renderer.render(scene, camera);
      renderer.render(fgScene, orthoCam);
    };

    return {
      render,
      dispose: () => {
        atlasTex.dispose();
        glyphTex.dispose();
        chartGeo.dispose();
        glyphGeo.dispose();
        chartMat.dispose();
        glyphMat.dispose();
        bgMat.dispose();
        streakMat.dispose();
        fsGeo.dispose();
        quad.dispose();
      },
    };
  };
