// Background gradient, sun flare and dither — all generated in a shader.
//
// The dither is the important part. Eight of the ten looks are large smooth
// gradients and several are dark; dark gradients band badly in 8-bit H.264.
// A +/-1/255 ordered dither applied before tonemapping breaks the plateaus up
// so the encoder has something to work with.

import React, { useMemo } from "react";
import * as THREE from "three";
import type { LookSpec } from "./data/types";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform vec3 uInner;
uniform vec3 uOuter;
uniform vec3 uMid;
uniform float uMidStop;
uniform int uKind;          // 0 radial, 1 vertical, 2 flat
uniform vec2 uCentre;
uniform float uFalloff;
uniform float uDither;
uniform float uAspect;

uniform int uFlareOn;
uniform vec2 uFlareAt;
uniform float uFlareRadius;
uniform float uFlareIntensity;
uniform vec3 uFlareColour;
uniform float uFlareStreak;

// 4x4 Bayer matrix, returns [-0.5, 0.5].
float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = y * 4 + x;
  float v = 0.0;
  if (i == 0)  v =  0.0; else if (i == 1)  v =  8.0;
  else if (i == 2)  v =  2.0; else if (i == 3)  v = 10.0;
  else if (i == 4)  v = 12.0; else if (i == 5)  v =  4.0;
  else if (i == 6)  v = 14.0; else if (i == 7)  v =  6.0;
  else if (i == 8)  v =  3.0; else if (i == 9)  v = 11.0;
  else if (i == 10) v =  1.0; else if (i == 11) v =  9.0;
  else if (i == 12) v = 15.0; else if (i == 13) v =  7.0;
  else if (i == 14) v = 13.0; else v =  5.0;
  return v / 16.0 - 0.5;
}

void main() {
  vec3 col;

  if (uKind == 2) {
    col = uInner;
  } else if (uKind == 1) {
    // Two-tone vertical ramp with an optional mid stop, so look 10 can run
    // amber -> brown -> blue rather than a straight two-colour lerp.
    float t = 1.0 - vUv.y;
    if (t < uMidStop) {
      col = mix(uInner, uMid, smoothstep(0.0, uMidStop, t));
    } else {
      col = mix(uMid, uOuter, smoothstep(uMidStop, 1.0, t));
    }
  } else {
    vec2 d = vUv - uCentre;
    d.x *= uAspect;
    float r = length(d) * uFalloff;
    col = mix(uInner, uOuter, clamp(r, 0.0, 1.0));
  }

  if (uFlareOn == 1) {
    vec2 fd = vUv - uFlareAt;
    fd.x *= uAspect;
    float d = length(fd);
    // Two lobes: a tight core and a wide falloff, which reads as an
    // atmospheric bloom rather than a hard disc.
    float core = exp(-pow(d / (uFlareRadius * 0.35), 2.0));
    float halo = exp(-pow(d / uFlareRadius, 1.5));
    float flare = core * 0.7 + halo * 0.45;

    if (uFlareStreak > 0.0) {
      float sx = abs(fd.x);
      float sy = abs(fd.y);
      float streak = exp(-pow(sy / (uFlareRadius * 0.06), 2.0))
                   * exp(-pow(sx / (uFlareRadius * uFlareStreak), 2.0));
      flare += streak * 0.3;
    }
    col += uFlareColour * flare * uFlareIntensity;
  }

  // Dither before the tonemapper sees it.
  col += bayer(gl_FragCoord.xy) * (uDither / 255.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

export const Background: React.FC<{
  look: LookSpec;
  /** World depth to park the plane at. */
  z: number;
  width: number;
  height: number;
}> = ({ look, z, width, height }) => {
  const uniforms = useMemo(() => {
    const bg = look.background;
    const kind = bg.kind === "radial" ? 0 : bg.kind === "vertical" ? 1 : 2;
    return {
      uInner: { value: new THREE.Color(bg.inner) },
      uOuter: { value: new THREE.Color(bg.outer) },
      uMid: { value: new THREE.Color(bg.mid ?? bg.outer) },
      uMidStop: { value: bg.midStop ?? 0.5 },
      uKind: { value: kind },
      uCentre: { value: new THREE.Vector2(...(bg.centre ?? [0.5, 0.5])) },
      uFalloff: { value: bg.falloff ?? 1.4 },
      uDither: { value: bg.dither ?? 1 },
      uAspect: { value: 16 / 9 },
      uFlareOn: { value: look.flare ? 1 : 0 },
      uFlareAt: { value: new THREE.Vector2(...(look.flare?.at ?? [0.5, 0.5])) },
      uFlareRadius: { value: look.flare?.radius ?? 0.2 },
      uFlareIntensity: { value: look.flare?.intensity ?? 0 },
      uFlareColour: { value: new THREE.Color(look.flare?.colour ?? "#ffffff") },
      uFlareStreak: { value: look.flare?.streak ?? 0 },
    };
  }, [look]);

  return (
    <mesh position={[0, 0, z]} renderOrder={-1000}>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};
