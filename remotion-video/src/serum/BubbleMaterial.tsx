/**
 * Internal bubbles.
 *
 * The spheres in looks 1, 2, 5 and 6 contain small bubbles, built as real
 * nested spheres rather than a texture so the parent genuinely refracts them.
 *
 * What makes them read as bubbles rather than beads is the relative index of
 * refraction. Air inside a liquid has a relative IOR BELOW 1, which inverts
 * the lensing: instead of a bead's bright centre, you get a bright rim over a
 * darker, emptier middle. That inversion is what this shader draws directly --
 * a Fresnel term driving both colour and opacity -- rather than trying to coax
 * it out of a physical material, which at this size just renders a solid ball.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';

const vertexShader = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vViewDir;

void main() {
  vec4 localPosition = vec4(position, 1.0);
  vec3 localNormal = normal;
  #ifdef USE_INSTANCING
    localPosition = instanceMatrix * localPosition;
    localNormal = mat3(instanceMatrix) * localNormal;
  #endif
  vec4 worldPosition = modelMatrix * localPosition;
  vNormalW = normalize(mat3(modelMatrix) * localNormal);
  vViewDir = normalize(cameraPosition - worldPosition.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uRim;
uniform vec3 uCore;
uniform float uStrength;
uniform float uPower;
varying vec3 vNormalW;
varying vec3 vViewDir;

void main() {
  float ndv = abs(dot(normalize(vNormalW), normalize(vViewDir)));
  float rim = pow(1.0 - ndv, uPower);
  vec3 color = mix(uCore, uRim, rim);
  float alpha = clamp(rim * uStrength + 0.05, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
`;

export const BubbleMaterial: React.FC<{
  rim: string;
  core: string;
  strength: number;
  power?: number;
  /**
   * Draw the bubbles as opaque geometry. Needed where every sphere in the
   * frame is opaque (look 6): a transparent bubble sitting inside an opaque
   * sphere fails the depth test in the main pass and contributes nothing to
   * the transmission backdrop either, so it disappears entirely.
   */
  opaque?: boolean;
}> = ({ rim, core, strength, power = 2.2, opaque = false }) => {
  const uniforms = useMemo(
    () => ({
      uRim: { value: new THREE.Color(rim) },
      uCore: { value: new THREE.Color(core) },
      uStrength: { value: strength },
      uPower: { value: power },
    }),
    [rim, core, strength, power],
  );
  return (
    <shaderMaterial
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
      transparent={!opaque}
      depthWrite={opaque}
      toneMapped={false}
    />
  );
};
