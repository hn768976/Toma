import React, { useMemo } from "react";
import * as THREE from "three";
import { buildFilamentGeometry, type FilamentData } from "./filaments";
import { WOBBLE_GLSL } from "./shared-glsl";
import type { Palette } from "./palettes";

const vertexShader = /* glsl */ `
${WOBBLE_GLSL}

attribute vec3 aNext;
attribute float aSide;
attribute float aAlong;
attribute float aBright;
attribute float aFilament;

uniform vec2 uResolution;
uniform float uWidthPx;

varying float vSide;
varying float vAlong;
varying float vBright;

void main() {
  vec3 offsetHere = filamentWobble(aFilament, aAlong);
  vec3 p = position + offsetHere;
  vec3 pNext = aNext + offsetHere;

  vec4 viewPos = modelViewMatrix * vec4(p, 1.0);
  vec4 viewNext = modelViewMatrix * vec4(pNext, 1.0);

  // The ribbon is widened in *view* space rather than in screen space.
  // Screen-space widening needs a perspective divide, and any vertex that
  // falls behind the camera flips the sign of w — which threw long
  // straight streaks across the frame whenever a filament swept past the
  // lens. Working in view space has no divide, so GL's own near-plane
  // clipping handles those segments correctly.
  vec3 tangent = viewNext.xyz - viewPos.xyz;
  tangent = length(tangent) > 1e-6 ? normalize(tangent) : vec3(1.0, 0.0, 0.0);

  // Perpendicular to both the strand and the eye ray: the ribbon always
  // presents its full width to the camera.
  vec3 eye = normalize(-viewPos.xyz);
  vec3 normal = cross(tangent, eye);
  normal = length(normal) > 1e-6 ? normalize(normal) : vec3(0.0, 1.0, 0.0);

  // World units per pixel at this depth. projectionMatrix[1][1] is
  // 1/tan(fov/2), so this is exact for the current camera.
  float depth = max(-viewPos.z, 0.05);
  float worldPerPixel = (2.0 * depth) / (projectionMatrix[1][1] * uResolution.y);

  // Strands taper as they run out, the way a dendrite thins toward its tip.
  float taper = 1.0 - 0.48 * aAlong;
  float halfWidth = uWidthPx * 0.5 * taper * worldPerPixel;

  viewPos.xyz += normal * halfWidth * aSide;
  gl_Position = projectionMatrix * viewPos;

  vSide = aSide;
  vAlong = aAlong;
  vBright = aBright;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uColorInner;
uniform vec3 uColorOuter;
uniform float uIntensity;
uniform float uPulseTime;

varying float vSide;
varying float vAlong;
varying float vBright;

void main() {
  // Across the ribbon: a tight bright core with a soft bleed around it.
  // Two gaussians is what sells these as *glowing* filaments rather than
  // as flat strips.
  float d = abs(vSide);
  float core = exp(-d * d * 13.0);
  float bleed = exp(-d * d * 2.1) * 0.34;
  float profile = core + bleed;

  // Along the filament: hidden inside the core's blowout, fading out well
  // before the far tip so nothing ends on a hard stop.
  float head = smoothstep(0.0, 0.05, vAlong);
  float tail = 1.0 - smoothstep(0.72, 1.0, vAlong);

  // Energy travelling outward from the core.
  float pulse = 0.82 + 0.18 * sin(uPulseTime * 1.6 - vAlong * 7.0 + vBright * 9.0);

  vec3 color = mix(uColorInner, uColorOuter, smoothstep(0.0, 0.72, vAlong));
  float alpha = profile * head * tail * vBright * pulse * uIntensity;

  gl_FragColor = vec4(color * alpha, 1.0);
}
`;

type Props = {
  data: FilamentData;
  palette: Palette;
  width: number;
  height: number;
  pixelScale: number;
  widthPx: number;
  time: number;
  wobble: number;
  intensity: number;
};

export const FilamentLines: React.FC<Props> = ({
  data,
  palette,
  width,
  height,
  pixelScale,
  widthPx,
  time,
  wobble,
  intensity,
}) => {
  const geometry = useMemo(() => buildFilamentGeometry(data), [data]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uResolution: { value: new THREE.Vector2(width, height) },
          uWidthPx: { value: widthPx * pixelScale },
          uColorInner: { value: new THREE.Color() },
          uColorOuter: { value: new THREE.Color() },
          uIntensity: { value: intensity },
          uPulseTime: { value: 0 },
          uTime: { value: 0 },
          uWobble: { value: wobble },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    // Built once; every frame-varying value is written below instead of
    // rebuilding (and recompiling) the material.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Remotion drives time, so uniforms are pushed on each React render
  // rather than from a useFrame loop.
  const u = material.uniforms;
  u.uResolution.value.set(width, height);
  u.uWidthPx.value = widthPx * pixelScale;
  u.uColorInner.value.setRGB(...palette.filamentInner);
  u.uColorOuter.value.setRGB(...palette.filamentOuter);
  u.uIntensity.value = intensity;
  u.uPulseTime.value = time;
  u.uTime.value = time;
  u.uWobble.value = wobble;

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />;
};
