// Look 1 — Nebula Lens. One full-screen fragment shader with point-mass
// lensing: every pixel's ray is deflected by θE²/r toward the hole before the
// (tiled, drifting) nebula and star field are sampled.
import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { LOOP } from "../lib/constants";
import { GLSL_HEADER, HASH, NOISE } from "../lib/glsl";
import { GLStage, type GLFactory } from "../lib/three/GLStage";
import { FullscreenPass, halfFloatTarget, makeFinalPass, srgb as col } from "../lib/three/pipeline";
import type { NebulaPalette } from "../versions";

const FRAG =
  GLSL_HEADER +
  HASH +
  NOISE +
  /* glsl */ `
uniform vec2 uRes;
uniform float uT;          // loop phase, frame / 600
uniform vec2 uHole;        // hole centre, uv
uniform float uRs;         // shadow radius (frame heights)
uniform float uEin;        // Einstein radius / shadow radius
uniform vec3 cDeep, cTeal, cPlum, cMauve, cCream, cRing;
uniform int uSS;           // star supersamples per axis
in vec2 vUv;
out vec4 outColor;

const float TAU = 6.28318530718;
const float TILE = 2.0;          // background tile period along the drift (frame heights)
const int   F = 3;               // noise lattice cells per tile at octave 0
const vec2  BAND = vec2(0.9285, -0.3714); // drift / dust-band direction (upper-left → lower-right)

// periodic fbm over (x along drift, y across); x period = F·2^k cells per octave
float fbm(vec2 p, int oct, uint seed) {
  float s = 0.0, a = 0.5, n = 0.0;
  int per = F;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * pnoise2(p, ivec2(per, 4096), seed + uint(i) * 101u);
    n += a;
    p = p * 2.0 + vec2(0.0, 17.13);
    per *= 2;
    a *= 0.5;
  }
  return s / n;
}

// Background in source-plane coords s (frame heights, relative to the hole).
vec3 nebula(vec2 s) {
  vec2 nrm = vec2(-BAND.y, BAND.x);
  float u = dot(s, BAND) + TILE * uT;       // slides exactly one tile per loop
  float v = dot(s, nrm);
  vec2 p = vec2(u * float(F) / TILE, v * float(F) / TILE);
  // slow internal evolution: an offset that travels once round a circle
  vec2 tc = 0.55 * vec2(cos(TAU * uT), sin(TAU * uT));

  vec2 w = vec2(fbm(p + tc, 3, 11u), fbm(p + vec2(3.1, 7.7) - tc, 3, 23u));
  vec2 pw = p + 0.9 * w;

  float haze = fbm(pw * 0.5 + vec2(0.0, 3.0), 4, 37u);
  float streak = fbm(vec2(pw.x * 0.5, pw.y * 1.4) + vec2(0.0, 9.0) + 0.3 * tc, 4, 53u);
  float dust = fbm(pw * 1.0 + vec2(0.0, 5.0) + 0.5 * tc.yx, 5, 71u);

  vec3 c = cDeep;
  // teal-grey haze
  c = mix(c, cTeal, 0.55 * smoothstep(-0.25, 0.55, haze));
  // plum / mauve swathes, stronger away from the dust band
  float off = smoothstep(0.18, 0.75, abs(v + 0.12 * w.x));
  float pl = smoothstep(-0.05, 0.45, streak) * off;
  c = mix(c, cPlum, 0.85 * pl);
  c = mix(c, cMauve, 0.55 * smoothstep(0.25, 0.65, streak) * off);
  // bright dust band, meandering, clumpy
  float meander = 0.10 * w.y;
  float band = exp(-pow((v - meander) / 0.13, 2.0));
  float clump = smoothstep(-0.05, 0.55, dust + 0.25 * w.x);
  float d = band * clump;
  c = mix(c, cTeal * 1.15, 0.35 * band);
  c = mix(c, cCream, 0.92 * d);
  c += cCream * 0.18 * d * d;
  return c;
}

// Stars in source plane. footprint: source-plane size of one pixel.
float starLayer(vec2 s, float cell, float prob, float sigma, float glow, float footprint, uint seed) {
  vec2 nrm = vec2(-BAND.y, BAND.x);
  float u = dot(s, BAND) + TILE * uT;
  float v = dot(s, nrm);
  vec2 g = vec2(u, v) / cell;
  ivec2 c0 = ivec2(floor(g));
  int perU = int(TILE / cell + 0.5);
  float sig = sqrt(sigma * sigma + 0.25 * footprint * footprint);
  float energy = (sigma * sigma) / (sig * sig);
  float acc = 0.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    ivec2 c = c0 + ivec2(i, j);
    ivec2 cw = ivec2(((c.x % perU) + perU) % perU, c.y);
    vec3 h = hash32(cw, seed);
    if (h.z > prob) continue;
    vec2 pos = vec2(c) + 0.15 + 0.7 * h.xy;
    vec2 dv = (g - pos) * cell;
    float d2 = dot(dv, dv);
    float b = pow(h.z / prob, 3.0);        // a few bright, many faint
    float bright = mix(0.25, 1.6, b);
    acc += bright * energy * exp(-0.5 * d2 / (sig * sig));
    if (glow > 0.0) acc += 0.35 * bright * b * exp(-sqrt(d2) / glow);
  }
  return acc;
}

void main() {
  float pix = 1.0 / uRes.y;                         // one pixel, frame heights
  vec2 hole = uHole * vec2(uRes.x / uRes.y, 1.0);
  vec2 frag = gl_FragCoord.xy / uRes.y;
  vec2 th = frag - hole;
  float r = length(th);
  float rs = uRs;
  float re = uEin * rs;

  // lens map θ → β (point mass), plus a gentle swirl that wraps the clouds
  float k = 1.0 - re * re / max(r * r, 1e-6);
  vec2 beta = th * k;
  float sw = 0.85 * (rs * rs) / max(r * r, rs * rs);
  float cs = cos(sw), sn = sin(sw);
  beta = mat2(cs, sn, -sn, cs) * beta;

  vec3 c = nebula(beta);

  // stars, supersampled: the lens magnifies/demagnifies the pixel footprint
  float lamR = 1.0 + re * re / max(r * r, 1e-6);
  float lamT = abs(k);
  float foot = pix * max(lamR, lamT);
  float st = 0.0;
  float inv = 1.0 / float(uSS);
  for (int j = 0; j < 4; j++) {
    if (j >= uSS) break;
    for (int i = 0; i < 4; i++) {
      if (i >= uSS) break;
      vec2 o = (vec2(float(i), float(j)) + 0.5) * inv - 0.5;
      vec2 t2 = th + o * pix;
      float r2 = length(t2);
      float k2 = 1.0 - re * re / max(r2 * r2, 1e-6);
      vec2 b2 = t2 * k2;
      float sw2 = 0.85 * (rs * rs) / max(r2 * r2, rs * rs);
      float c2 = cos(sw2), s2 = sin(sw2);
      b2 = mat2(c2, s2, -s2, c2) * b2;
      float footS = foot / float(uSS);
      st += starLayer(b2, 0.03125, 0.42, 0.0011, 0.0, footS, 101u);
      st += starLayer(b2, 0.0625, 0.20, 0.0017, 0.006, footS, 211u);
    }
  }
  st *= inv * inv;
  c += vec3(1.0, 0.97, 0.92) * st;

  // inside the Einstein ring we see the faint, inverted second image
  float inner = 1.0 - smoothstep(re * 0.9, re * 1.05, r);
  c *= mix(1.0, 0.7, inner);

  // photon ring: thin, beamed brighter on one side
  float phi = atan(th.y, th.x);
  float beam = 0.5 + 0.5 * cos(phi - 2.55);
  float rp = rs * 1.03;
  float wr = max(0.0028, pix * 1.2);
  float ring = exp(-pow((r - rp) / wr, 2.0));
  float halo = exp(-max(r - rp, 0.0) / 0.018) * smoothstep(rs * 0.98, rp, r);
  c += cRing * (ring * (0.55 + 1.1 * beam) + halo * (0.10 + 0.22 * beam));

  // shadow: perfectly black inside, antialiased edge
  float shadow = smoothstep(rs - 0.75 * pix, rs + 0.75 * pix, r);
  c *= shadow;
  outColor = vec4(c, 1.0);
}
`;

export const NebulaLens: React.FC<NebulaPalette> = (p) => {
  const factory = useCallback<GLFactory>(
    (gl, pw, ph) => {
      const target = halfFloatTarget(pw, ph);
      const scene = new FullscreenPass(FRAG, {
        uRes: { value: new THREE.Vector2(pw, ph) },
        uT: { value: 0 },
        uHole: { value: new THREE.Vector2(p.holeX, p.holeY) },
        uRs: { value: p.holeRadius },
        uEin: { value: 1.6 },
        cDeep: { value: col(p.deep) },
        cTeal: { value: col(p.teal) },
        cPlum: { value: col(p.plum) },
        cMauve: { value: col(p.mauve) },
        cCream: { value: col(p.cream) },
        cRing: { value: col(p.ring) },
        // 3×3 star samples at ≤1080p, 2×2 above (a 4K pixel is already small).
        uSS: { value: ph > 1300 ? 2 : 3 },
      });
      const final = makeFinalPass();
      final.uniforms.uSrc.value = target.texture;
      final.uniforms.uRes.value.set(pw, ph);
      return {
        render: (f) => {
          scene.uniforms.uT.value = f / LOOP;
          scene.render(gl, target);
          final.uniforms.uFrame.value = f;
          final.render(gl, null);
        },
        dispose: () => {
          scene.dispose();
          final.dispose();
          target.dispose();
        },
      };
    },
    [p],
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <GLStage factory={factory} />
    </AbsoluteFill>
  );
};
