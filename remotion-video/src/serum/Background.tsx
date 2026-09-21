/**
 * Shader background.
 *
 * Generated rather than loaded, so a colourway is a data row and not an image.
 * The gradient carries a small ordered-hash dither: large smooth pastel ramps
 * across a 4K frame are close to the worst case for 8-bit H.264, and the
 * dither breaks the quantisation plateaus before they reach the encoder. The
 * grain pass after tonemapping does the rest.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { halfHeightAt, halfWidthAt } from './build';
import type { BackgroundSpec } from './types';

export const BACKGROUND_Z = -16;

const MODE_INDEX: Record<BackgroundSpec['mode'], number> = {
  vertical: 0,
  radial: 1,
  edgeCool: 2,
  flat: 3,
  none: 3,
};

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uAccentColor;
uniform float uAccent;
uniform int uMode;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 color;
  if (uMode == 0) {
    // Vertical gradient, lighter at the top.
    color = mix(uBottom, uTop, vUv.y);
  } else if (uMode == 1) {
    // Flat field with a gentle radial lift behind the hero.
    vec2 d = vUv - vec2(0.5, 0.54);
    d.x *= 1.4;
    float lift = 1.0 - smoothstep(0.0, 0.62, length(d));
    color = mix(uBottom, uTop, vUv.y);
    color = mix(color, uAccentColor, lift * uAccent);
  } else if (uMode == 2) {
    // Near-white, very slightly cooler towards the edges.
    vec2 d = vUv - 0.5;
    d.x *= 1.3;
    float edge = smoothstep(0.24, 0.72, length(d));
    color = mix(uTop, uBottom, vUv.y);
    color = mix(color, uAccentColor, edge * uAccent);
  } else {
    color = mix(uBottom, uTop, vUv.y);
  }

  // +/- 1 LSB of dither, applied in linear space before tonemapping.
  float d = (hash12(gl_FragCoord.xy) - 0.5) * (2.0 / 255.0);
  gl_FragColor = vec4(color + d, 1.0);
}
`;

export const Background: React.FC<{ spec: BackgroundSpec; matte: boolean }> = ({ spec, matte }) => {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Vector3(...spec.top) },
      uBottom: { value: new THREE.Vector3(...spec.bottom) },
      uAccentColor: { value: new THREE.Vector3(...spec.accentColor) },
      uAccent: { value: spec.accent },
      uMode: { value: MODE_INDEX[spec.mode] },
    }),
    [spec],
  );

  const width = halfWidthAt(BACKGROUND_Z) * 2.2;
  const height = halfHeightAt(BACKGROUND_Z) * 2.2;

  if (spec.mode === 'none' && !matte) return null;

  // The matte half of look 5 is pure white, with no gradient and no dither --
  // a key needs flat 255,255,255 behind flat 0,0,0 shapes.
  if (matte) {
    return (
      <mesh position={[0, 0, BACKGROUND_Z]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    );
  }

  return (
    <mesh position={[0, 0, BACKGROUND_Z]}>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        toneMapped={false}
      />
    </mesh>
  );
};
