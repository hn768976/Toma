import * as THREE from "three";
import { HASH, SIMPLEX } from "../gl/glsl";
import { FullscreenQuad, Post, fullscreenMaterial } from "../gl/post";
import type { LookFactory } from "../gl/Stage";
import { phaseOf } from "../rng";

export type PixelBurstPalette = {
  core: string; // centre burst
  a: string; // primary sparkle / ring tint (cyan | gold)
  b: string; // secondary (magenta | amber)
  c: string; // cloud tint (teal | warm white)
  dark: string; // background / unlit cells
  cloudDeep: string; // dark cloud tint
  cols?: number; // dot-grid columns across the frame (default 220)
};

// Grid: 220 columns across the frame at any resolution (the spec value; the
// reference clip measures ~84 - set `cols` on a version row to change it).
const COLS = 220;
// The underlying pattern is drawn at a fixed resolution that does not depend
// on the output size, so 720p and 4K show the same image.
const PAT_W = 880;
const PAT_H = 495;

// Pattern: centre glow, square rings, clouds. Linear HDR.
const PATTERN_FRAG = /* glsl */ `
${SIMPLEX}
uniform float uT;          // loop phase [0,1)
uniform vec3 uCore, uA, uB, uC, uDark, uDeep;
varying vec2 vUv;
const float TAU = 6.28318530718;
const float BEATS = 12.0;  // ring beats per loop (one every 50 frames)

float fbm(vec2 p, vec2 tc) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * snoise(vec4(p, tc));
    p = p * 2.03 + vec2(1.7, -3.1);
    tc *= 1.0; // time circle radius fixed per octave (whole cycles)
    a *= 0.5;
  }
  return s;
}

void main() {
  vec2 q = (vUv - 0.5) * vec2(16.0 / 9.0, 1.0);
  float th = uT * TAU;
  float beat = fract(uT * BEATS);
  float pulse = 1.0 + 0.45 * exp(-beat * 7.0);

  // --- drifting noise clouds (time sampled on a circle -> loops) ---
  vec2 tc = 0.55 * vec2(cos(th), sin(th));
  vec2 drift = 0.06 * vec2(cos(th), sin(th));
  float n1 = fbm(q * 3.0 + drift, tc);
  // mirrored (kaleidoscope-like) colour blobs around the core
  float n2 = fbm(abs(q) * 2.4 - drift + vec2(5.2, 1.3), tc + vec2(3.0, -2.0));
  float n3 = fbm(q * 4.5 + vec2(-2.7, 4.1) + drift.yx, tc * 1.0 + vec2(-1.0, 5.0));

  // --- centre burst, square (Chebyshev) falloff, ragged cloudy edge ---
  float dC = max(abs(q.x) * 0.8, abs(q.y)) * (1.0 + 0.45 * n1);
  float r = length(q);
  float core = 10.0 * exp(-dC / 0.075) + 0.6 * exp(-dC / 0.18);
  float diag = exp(-abs(abs(q.x) * 0.62 - abs(q.y)) / 0.022) * exp(-r / 0.35);
  float cross_ = exp(-abs(q.y) / 0.012) * exp(-abs(q.x) / 0.35) + 0.5 * exp(-abs(q.x) / 0.012) * exp(-abs(q.y) / 0.2);
  float burst = (core + 2.4 * diag + 1.3 * cross_) * pulse;

  // --- square frames expanding outward on the beat: soft glowing bands.
  // The vertical sides run the full frame height; the horizontals are fainter.
  vec3 ringCol = vec3(0.0);
  float brk = 0.55 + 0.45 * smoothstep(-0.3, 0.3, n3);
  for (int k = 0; k < 3; k++) {
    float age = (beat + float(k)) / 3.0;      // each frame lives 3 beats
    float R = 0.07 + 0.55 * pow(age, 0.8);
    float w = 0.014 + 0.01 * age;
    float vx = exp(-pow((abs(q.x) * 0.58 - R) / w, 2.0));
    float hy = exp(-pow((abs(q.y) - R) / w, 2.0)) * step(abs(q.x) * 0.58, R + w);
    float ring = (vx + 0.3 * hy) * smoothstep(0.2, 0.4, R) * pow(1.0 - age, 0.7) * 1.6 * brk;
    vec3 tint = mix(uB, uCore, 0.6);
    ringCol += ring * tint;
  }

  float near = smoothstep(0.03, 0.14, dC) * smoothstep(0.55, 0.15, dC); // around the core
  float outer = smoothstep(0.18, 0.55, dC);
  float dark = smoothstep(-0.4, 0.2, n1 + 0.5 * n3);  // dark gaps between clouds
  vec3 col = uDark;
  // pastel patches round the core: magenta, cyan, and their lavender mix
  float pm = smoothstep(0.0, 0.5, n2);
  float pc = smoothstep(0.0, 0.5, -n2);
  col += uB * pm * (1.3 * near + 0.3 * outer);
  col += uA * pc * (0.9 * near + 0.2 * outer);
  col += uDeep * 0.8 * smoothstep(0.3, 0.0, abs(n2)) * near;
  // teal / deep clouds in the outer field
  col += uC * smoothstep(-0.3, 0.55, n3) * (0.08 + 0.4 * outer);
  col += uB * smoothstep(0.2, 0.6, n3 * n1 + 0.2) * 0.3 * outer;
  col += uDeep * smoothstep(-0.2, 0.4, -n1) * (0.12 * near + 0.04 * outer);
  col *= mix(0.35, 1.0, dark);

  col += uCore * burst + ringCol;
  gl_FragColor = vec4(col, 1.0);
}
`;

// LED dot grid. Each cell takes the pattern colour at its centre, sampled
// three times with a small radial offset per channel (chromatic fringing).
const DOTS_FRAG = /* glsl */ `
${HASH}
uniform sampler2D tPattern;
uniform vec2 uRes;
uniform float uT;
uniform vec3 uCore, uA, uB, uC;
uniform float uCols;
varying vec2 vUv;
const float TAU = 6.28318530718;

// Lit tiles: seeded phase, whole number of flashes per loop (~2% lit at once).
vec3 sparkle(ivec2 ic, float centreDist) {
  float h1 = hashCell(ic, 23u), h2 = hashCell(ic, 37u), h3 = hashCell(ic, 53u);
  float k = 1.0 + floor(h2 * 3.0);
  float s = pow(max(cos(TAU * (k * uT + h1)), 0.0), 220.0);
  float amt = (0.8 + 1.2 * hashCell(ic, 71u)) * (0.6 + 0.6 * smoothstep(1.3, 0.2, centreDist));
  vec3 sc = h3 < 0.3 ? uA : h3 < 0.55 ? uB : h3 < 0.8 ? uC : uCore;
  return sc * s * amt;
}
// A handful of big star flares (~1 in 400 cells), slower.
vec3 bigStar(ivec2 ic) {
  if (hashCell(ic, 97u) > 0.0012) return vec3(0.0);
  float s = pow(max(cos(TAU * (uT + hashCell(ic, 101u))), 0.0), 6.0);
  return mix(uCore, uA, hashCell(ic, 103u) * 0.6) * s * 6.0;
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float cellPx = uRes.x / uCols;
  vec2 g = (px - 0.5 * uRes) / cellPx;          // grid space, origin at centre
  vec2 cid = floor(g);
  vec2 local = g - cid - 0.5;
  ivec2 ic = ivec2(cid);

  vec2 cuv = ((cid + 0.5) * cellPx + 0.5 * uRes) / uRes; // cell-centre UV
  vec2 dir = cuv - 0.5;
  vec2 off = normalize(dir + 1e-6) * 0.0012 * (0.4 + 1.6 * length(dir));
  vec3 col;
  col.r = texture2D(tPattern, cuv + off).r;
  col.g = texture2D(tPattern, cuv).g;
  col.b = texture2D(tPattern, cuv - off).b;

  // per-cell mosaic variation
  float h0 = hashCell(ic, 11u);
  col *= 0.3 + 1.4 * h0 * h0;  // per-tile on/off contrast

  // sparkle: seeded phase, whole number of flashes per loop (~3% lit at once)
  float centreDist = length((cid + 0.5) / vec2(uCols * 0.5, uCols * 0.5 * 9.0 / 16.0));
  vec3 spark = sparkle(ic, centreDist);
  col += spark;

  // cross flares from the few big stars, along the row and column
  vec3 star = bigStar(ic);
  col += star;
  vec3 flare = vec3(0.0);
  for (int k = 1; k <= 7; k++) {
    float fall = exp(-float(k) * 0.45) * 0.35;
    flare += fall * (bigStar(ic + ivec2(k, 0)) + bigStar(ic - ivec2(k, 0))
                   + bigStar(ic + ivec2(0, k)) + bigStar(ic - ivec2(0, k)));
  }
  float onRow = exp(-pow(local.y / 0.2, 2.0));
  float onCol = exp(-pow(local.x / 0.2, 2.0));
  col += flare * 0.5;

  // rounded dot with a small gap; filtered edge (cell is ~6px at 720p)
  float aa = 1.0 / cellPx;
  float d = sdRoundBox(local, vec2(0.40), 0.14);
  float mask = 1.0 - smoothstep(-aa, aa, d);
  vec3 outc = col * (mask + 0.06) + flare * 0.6 * max(onRow, onCol) * (1.0 - mask);
  gl_FragColor = vec4(outc, 1.0);
}
`;

const lin = (hex: string) => new THREE.Color(hex);

export const createPixelBurst =
  (pal: PixelBurstPalette): LookFactory =>
  (gl) => {
    const post = new Post(gl, { msaa: 0, depth: false, dof: false });
    const quad = new FullscreenQuad();
    const patternRT = new THREE.WebGLRenderTarget(PAT_W, PAT_H, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    const colors = {
      uCore: { value: lin(pal.core) },
      uA: { value: lin(pal.a) },
      uB: { value: lin(pal.b) },
      uC: { value: lin(pal.c) },
    };
    const patternMat = fullscreenMaterial(PATTERN_FRAG, {
      uT: { value: 0 },
      ...colors,
      uDark: { value: lin(pal.dark) },
      uDeep: { value: lin(pal.cloudDeep) },
    });
    const dotsMat = fullscreenMaterial(DOTS_FRAG, {
      tPattern: { value: patternRT.texture },
      uRes: { value: new THREE.Vector2(post.width, post.height) },
      uT: { value: 0 },
      uCols: { value: pal.cols ?? COLS },
      ...colors,
    });
    return {
      render(frame) {
        const t = phaseOf(frame);
        patternMat.uniforms.uT.value = t;
        dotsMat.uniforms.uT.value = t;
        quad.render(gl, patternMat, patternRT);
        quad.render(gl, dotsMat, post.sceneRT);
        post.finish(frame, {
          bloom: 1.4,
          threshold: 0.7,
          vignette: 0.2,
          knee: 0.5,
          exposure: 0.62,
          grain: 0.01,
          saturation: 1.5,
          bloomWeights: [1, 1, 1, 0.85, 0.6, 0.35, 0.18],
        });
      },
      dispose() {
        post.dispose();
        quad.dispose();
        patternRT.dispose();
        patternMat.dispose();
        dotsMat.dispose();
      },
    };
  };
