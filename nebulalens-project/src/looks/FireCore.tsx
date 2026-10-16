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
const vec2 CORE = vec2(0.5, 0.52);   // uv, y up: just above centre
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
  float fill = 0.16 * smoothstep(w + wid, w - wid, an);  // dimmer inside
  float glow = exp(-an / (3.0 * w));
  // patchy: only some angles / radii carry tendrils at any moment
  float m = pnoise3(vec3(a * float(na / 4), flowY(s, max(ns, 2)) * 0.5 + 1.7, uT * 2.0), ivec3(na / 4, max(ns, 2) / 2, 2), seed + 31u);
  float mask = smoothstep(0.0, 0.5, m);
  return vec2((edge + fill) * mask, glow * mask);
}

void main() {
  vec2 q = (gl_FragCoord.xy - CORE * uRes) / uRes.y;
  float r = length(q);
  float s = log(max(r, 1e-4));
  float a = atan(q.y, q.x) / TAU + 0.5;     // 0..1 round the core

  float pulse = 1.0 + 0.08 * sin(TAU * 2.0 * uT);

  vec2 big = tendrils(a, s, 24, 2, 0.11, 11u, 0.9);
  vec2 fine = tendrils(a + 0.37, s, 60, 4, 0.08, 23u, 0.7);
  vec2 hair = tendrils(a + 0.71, s, 120, 8, 0.06, 41u, 0.5);

  // brightness rises toward the core; filaments start a little outside it
  float near = smoothstep(0.02, 0.10, r);
  float fall = 1.0 / (1.0 + pow(r / 0.30, 1.4));
  float e = near * fall * (2.1 * big.x + 1.2 * fine.x + 0.55 * hair.x);
  float g = near * fall * (0.6 * big.y + 0.3 * fine.y);
  // outer wisps rushing past the camera stay visible at the edges
  e += smoothstep(0.35, 0.9, r) * 0.9 * big.x;

  // core: white-hot point, gaussian halo, thin radial rays
  float halo = exp(-r * r / (2.0 * 0.022 * 0.022)) * 2.6 + exp(-r / 0.075) * 0.9 + exp(-r / 0.28) * 0.18;
  float ra = pnoise2(vec2(a * 96.0, uT * 4.0), ivec2(96, 4), 77u);
  float rays = pow(max(ra, 0.0), 2.0) * exp(-r / 0.07) * 1.4 * smoothstep(0.004, 0.02, r);
  float core = halo * pulse;

  // haze: faint dark tint between the tendrils
  float hz = 0.5 + 0.5 * pnoise3(vec3(a * 6.0, (s - PS * uT) / PS * 2.0, uT * 2.0), ivec3(6, 2, 2), 91u);
  vec3 c = cHaze * (0.25 + 0.9 * hz) * smoothstep(1.1, 0.05, r);

  vec3 E = cCool * (1.0 * e + 0.55 * g) + cHot * (1.1 * e * e + 0.25 * g + 0.9 * rays) + cCore * core
         + cHot * 0.75 * exp(-r / 0.10) * pulse + cCool * 0.25 * exp(-r / 0.30);
  c += vec3(1.0) - exp(-E * 1.1);
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
