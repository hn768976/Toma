/**
 * Dust specks — instanced points on closed paths.
 *
 * Frequencies are integers drawn at build time, so every speck is exactly
 * where it started at t = 1 and the loop closes on them too.
 */

import React, { useMemo } from "react";
import * as THREE from "three";
import { SpeckField } from "./build";

const vertexShader = /* glsl */ `
attribute vec3 amp;
attribute vec3 freq;
attribute vec3 phase;
attribute float size;
uniform float uT;
uniform float uScale;
varying float vFade;
void main(){
  float T = 6.2831853 * uT;
  vec3 p = position + amp * sin(T * freq + phase);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vFade = clamp((mv.z + 40.0) / 40.0, 0.0, 1.0);
  gl_PointSize = size * uScale / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(d));
  gl_FragColor = vec4(uColor, a * uOpacity * vFade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const Specks: React.FC<{
  field: SpeckField;
  t: number;
  color: string;
  opacity: number;
  /** Point size in pixels at one world unit, scaled by the render height. */
  scale: number;
}> = ({ field, t, color, opacity, scale }) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const amp = new Float32Array(field.count * 3);
    const freq = new Float32Array(field.count * 3);
    const phase = new Float32Array(field.count * 3);
    for (let i = 0; i < field.count; i++) {
      for (let k = 0; k < 3; k++) {
        amp[i * 3 + k] = field.drift[i * 9 + k];
        freq[i * 3 + k] = field.drift[i * 9 + 3 + k];
        phase[i * 3 + k] = field.drift[i * 9 + 6 + k];
      }
    }
    g.setAttribute("position", new THREE.BufferAttribute(field.positions, 3));
    g.setAttribute("amp", new THREE.BufferAttribute(amp, 3));
    g.setAttribute("freq", new THREE.BufferAttribute(freq, 3));
    g.setAttribute("phase", new THREE.BufferAttribute(phase, 3));
    g.setAttribute("size", new THREE.BufferAttribute(field.sizes, 1));
    return g;
  }, [field]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uT: { value: 0 },
          uScale: { value: scale },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
        },
      }),
    [color, opacity, scale],
  );

  material.uniforms.uT.value = t;
  return <points geometry={geometry} material={material} />;
};
