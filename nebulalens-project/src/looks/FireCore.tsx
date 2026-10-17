// Look 4 — Fire Core. Full-screen shader in polar / log-radius coordinates:
// tendrils are periodic noise filaments stretched along the radius; the
// pattern flows outward by exactly one log-radius period per loop.
import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { LOOP } from "../lib/constants";
import { GLSL_HEADER, HASH, NOISE } from "../lib/glsl";
import { GLStage, type GLFactory } from "../lib/three/GLStage";
import { FullscreenPass, halfFloatTarget, makeFinalPass, srgb } from "../lib/three/pipeline";
import type { FireCorePalette } from "../versions";

const FRAG =
  GLSL_HEADER +
  HASH +
  NOISE +
  /* glsl */ `
uniform vec2 uRes;
uniform float uT;
uniform vec3 cHot, cCool, cCore, cHaze;
in vec2 vUv;
out vec4 outColor;

const float TAU = 6.28318530718;
const vec2 CORE = vec2(0.5, 0.51);   // uv, y up: just above centre
const float PS = 3.2;                // log-radius period that flows out per loop

// Log-radius coordinate with k lattice cells per period PS; it advances by
// exactly k cells (one whole period) over the loop: the outward flow.
float flowY(float s, int k) { return (s - PS * uT) / PS * float(k); }

// One filament layer. na: cells around the circle, ns: cells per PS of
// log-radius (few: the filaments are long streaks along the radius).
// Returns (edge-lit tendril, soft glow).
vec2 tendrils(float a, float s, int na, int ns, float w, uint seed, float twist) {
  // gentle sideways waviness (low frequency)
  float wx = pnoise3(vec3(a * float(na / 4), flowY(s, ns), uT * 3.0), ivec3(na / 4, ns, 3), seed + 7u);
  float X = a * float(na) + twist * wx + 0.35 * s;
  // flicker: the z axis is a time circle of 2 cells
  float n = pnoise3(vec3(X, flowY(s, ns) + 0.37, uT * 2.0 + 0.3), ivec3(na, ns, 2), seed);
  float an = abs(n);
  float fw = max(fwidth(n), 1e-4);
  float wid = max(0.33 * w, fw);
  float edge = exp(-pow((an - w) / wid, 2.0));          // bright rims at |n| = w
  float fill = 0.45 * smoothstep(w + wid, w - wid, an);  // dimmer inside
  float glow = exp(-an / (3.0 * w));
  // patchy: only some angles / radii carry tendrils at any moment
  float m = pnoise3(vec3(a * float(na / 4), flowY(s, max(ns, 2)) * 0.5 + 1.7, uT * 2.0), ivec3(na / 4, max(ns, 2) / 2, 2), seed + 31u);
  float mask = smoothstep(0.02, 0.45, m);
  // flame break-up along the tendril
  float fl = pnoise3(vec3(a * float(na) * 0.5, flowY(s, ns * 4), uT * 2.0 + 0.6), ivec3(na / 2, ns * 4, 2), seed + 57u);
  float flame = 0.25 + 1.2 * smoothstep(-0.25, 0.5, fl);
  return vec2((edge + fill) * mask * flame, glow * mask);
}

// Ragged flame licks: ridged periodic noise, stretched along the radius and
// warped, cut into separate clumps by a low-frequency mask.
float flames(float a, float s, uint seed) {
  float wx = pnoise3(vec3(a * 12.0, flowY(s, 3), uT * 2.0), ivec3(12, 3, 2), seed + 3u);
  float wy = pnoise3(vec3(a * 12.0 + 5.0, flowY(s, 3), uT * 2.0 + 0.5), ivec3(12, 3, 2), seed + 5u);
  float X = a * 36.0 + 1.6 * wx;
  float Y = flowY(s, 3) + 0.35 * wy;
  float R = 0.0, amp = 0.55, norm = 0.0;
  int fa = 36, fs = 3;
  vec3 P = vec3(X, Y, uT * 2.0);
  for (int k = 0; k < 3; k++) {
    float n = pnoise3(P, ivec3(fa, fs, 2), seed + uint(k) * 17u);
    float rg = 1.0 - abs(n);
    R += amp * pow(rg, 5.0);
    norm += amp;
    P = vec3(P.x * 2.0, P.y * 2.0, P.z) + vec3(0.0, 0.31, 0.0);
    fa *= 2;
    fs *= 2;
    amp *= 0.5;
  }
  R /= norm;
  float M = pnoise3(vec3(a * 10.0, flowY(s, 2) + 0.7, uT * 2.0 + 0.2), ivec3(10, 2, 2), seed + 29u);
  float mask = smoothstep(-0.04, 0.42, M);
  float fw = max(fwidth(R), 1e-4);
  return smoothstep(0.42 - fw, 0.8 + fw, R) * mask;
}

// Embers: sparse sparks flowing outward with the fire.
float sparks(float a, float s, float r) {
  vec2 g = vec2(a * 260.0, flowY(s, 60));
  ivec2 c = ivec2(floor(g));
  ivec2 cw = ivec2(((c.x % 260) + 260) % 260, ((c.y % 60) + 60) % 60);
  vec3 h = hash32(cw, 313u);
  if (h.z > 0.025) return 0.0;
  vec2 f = fract(g) - (0.2 + 0.6 * h.xy);
  float d = length(f * vec2(1.7, 0.75));   // short radial speed streaks
  return smoothstep(0.32, 0.0, d) * (0.4 + 0.6 * h.z / 0.025) * smoothstep(0.03, 0.06, r) * smoothstep(0.75, 0.2, r);
}

void main() {
  vec2 q = (gl_FragCoord.xy - CORE * uRes) / uRes.y;
  float r = length(q);
  float s = log(max(r, 1e-4));
  float a = atan(q.y, q.x) / TAU + 0.5;     // 0..1 round the core

  float pulse = 1.0 + 0.08 * sin(TAU * 2.0 * uT);

  float fl = flames(a, s, 11u) + 0.7 * flames(a + 0.5, s + 0.9, 61u);
  vec2 fine = tendrils(a + 0.37, s, 60, 4, 0.12, 23u, 0.7);
  vec2 hair = tendrils(a + 0.71, s, 120, 8, 0.08, 41u, 0.5);

  // brightness rises toward the core; flames start a little outside it
  float near = smoothstep(0.015, 0.08, r);
  float fall = 1.0 / (1.0 + pow(r / 0.45, 1.2));
  float e = near * fall * (1.1 * fl + 1.3 * fine.x + 0.9 * hair.x * smoothstep(0.6, 0.05, r));
  float g = near * fall * (0.5 * fine.y + 0.25 * hair.y);
  e += 3.0 * sparks(a, s, r);

  // core: white-hot point, yellow gaussian halo, thin spiky radial rays
  float halo = exp(-r / 0.036) * 3.4 + exp(-r * r / (2.0 * 0.02 * 0.02)) * 1.5;
  float ra = pnoise2(vec2(a * 140.0, uT * 4.0), ivec2(140, 4), 77u);
  float rays = pow(max(ra, 0.0), 5.0) * exp(-r / 0.16) * 7.0 * smoothstep(0.004, 0.025, r);
  float core = halo * pulse;

  // haze: faint dark tint between the flames
  float hz = 0.5 + 0.5 * pnoise3(vec3(a * 6.0, (s - PS * uT) / PS * 2.0, uT * 2.0), ivec3(6, 2, 2), 91u);
  vec3 c = cHaze * (0.45 + 1.1 * hz) * (0.45 + 0.55 * smoothstep(1.1, 0.1, r));

  // one intensity → colour ramp: deep red → orange → white-hot
  float I = e + 0.35 * g + 0.8 * rays + core + 2.4 * exp(-r / 0.07) * pulse + 0.5 * exp(-r / 0.18) * pulse;
  vec3 ramp = cCool * smoothstep(0.0, 0.7, I);
  ramp = mix(ramp, cHot, smoothstep(0.35, 1.1, I));
  ramp = mix(ramp, mix(cHot, cCore, 0.55), smoothstep(1.3, 2.0, I));
  ramp = mix(ramp, cCore, smoothstep(2.2, 3.4, I));
  c += ramp;
  // dark vignette: the edges fall to near black
  c *= 1.0 - 0.55 * smoothstep(0.5, 1.05, r);
  outColor = vec4(c, 1.0);
}
`;

export const FireCore: React.FC<FireCorePalette> = (p) => {
  const factory = useCallback<GLFactory>(
    (gl, pw, ph) => {
      const target = halfFloatTarget(pw, ph);
      const scene = new FullscreenPass(FRAG, {
        uRes: { value: new THREE.Vector2(pw, ph) },
        uT: { value: 0 },
        cHot: { value: srgb(p.tendrilHot) },
        cCool: { value: srgb(p.tendrilCool) },
        cCore: { value: srgb(p.core) },
        cHaze: { value: srgb(p.haze) },
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
