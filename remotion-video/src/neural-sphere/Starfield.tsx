import React, { useMemo } from "react";
import * as THREE from "three";
import {
  STAR_ACCENT_RATIO,
  STAR_COUNT,
  STAR_FIELD_INNER_RADIUS,
  STAR_FIELD_OUTER_RADIUS,
  STAR_MAX_SIZE_PX,
  STAR_MIN_SIZE_PX,
} from "./constants";
import { mulberry32 } from "./random";
import type { Palette } from "./palettes";

const vertexShader = /* glsl */ `
attribute float aSize;
attribute float aAccent;
attribute float aPhase;
attribute float aTwinkleRate;

uniform float uTime;
uniform float uPixelScale;
uniform float uRefDistance;

varying float vAccent;
varying float vAlpha;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;

  vAccent = aAccent;
  vAlpha = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * aTwinkleRate + aPhase));

  float size = aSize * uPixelScale * (uRefDistance / max(-mv.z, 0.25));
  gl_PointSize = clamp(size, 1.0, 64.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform vec3 uColorAccent;
uniform float uIntensity;

varying float vAccent;
varying float vAlpha;

void main() {
  vec2 offset = gl_PointCoord - 0.5;
  float d = length(offset) * 2.0;
  if (d > 1.0) discard;

  float core = exp(-d * d * 7.0);
  float glow = exp(-d * d * 1.8) * 0.3;
  float alpha = (core + glow) * vAlpha * uIntensity;

  vec3 color = mix(uColor, uColorAccent, vAccent);
  color = mix(color, vec3(1.0), pow(core, 3.0) * 0.5);

  gl_FragColor = vec4(color * alpha, 1.0);
}
`;

type Props = {
  palette: Palette;
  pixelScale: number;
  time: number;
  intensity: number;
  refDistance: number;
};

/**
 * The sparse dust the neural structure floats in: a shell of points well
 * outside the filaments, so the slow camera push-in gives real parallax
 * against them.
 */
export const Starfield: React.FC<Props> = ({
  palette,
  pixelScale,
  time,
  intensity,
  refDistance,
}) => {
  const geometry = useMemo(() => {
    const position = new Float32Array(STAR_COUNT * 3);
    const size = new Float32Array(STAR_COUNT);
    const accent = new Float32Array(STAR_COUNT);
    const phase = new Float32Array(STAR_COUNT);
    const twinkleRate = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      const rand = mulberry32(i * 6271 + 3301);
      const z = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const planar = Math.sqrt(Math.max(0, 1 - z * z));
      const radius =
        STAR_FIELD_INNER_RADIUS +
        Math.pow(rand(), 0.55) * (STAR_FIELD_OUTER_RADIUS - STAR_FIELD_INNER_RADIUS);

      position[i * 3 + 0] = planar * Math.cos(phi) * radius;
      position[i * 3 + 1] = planar * Math.sin(phi) * radius;
      position[i * 3 + 2] = z * radius;

      size[i] = STAR_MIN_SIZE_PX + Math.pow(rand(), 2.8) * (STAR_MAX_SIZE_PX - STAR_MIN_SIZE_PX);
      accent[i] = rand() < STAR_ACCENT_RATIO ? 1 : 0;
      phase[i] = rand() * Math.PI * 2;
      twinkleRate[i] = 0.5 + rand() * 1.9;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aAccent", new THREE.BufferAttribute(accent, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aTwinkleRate", new THREE.BufferAttribute(twinkleRate, 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uPixelScale: { value: pixelScale },
          uRefDistance: { value: refDistance },
          uColor: { value: new THREE.Color() },
          uColorAccent: { value: new THREE.Color() },
          uIntensity: { value: intensity },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const u = material.uniforms;
  u.uTime.value = time;
  u.uPixelScale.value = pixelScale;
  u.uRefDistance.value = refDistance;
  u.uColor.value.setRGB(...palette.star);
  u.uColorAccent.value.setRGB(...palette.accent);
  u.uIntensity.value = intensity;

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />;
};
