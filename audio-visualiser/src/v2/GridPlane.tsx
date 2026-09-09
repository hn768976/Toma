import React, {useMemo} from 'react';
import * as THREE from 'three';

const vertexShader = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Screen-space-derivative grid. Deriving line width from fwidth is what keeps
 * the far lines from turning into moire: they thin and dissolve instead of
 * aliasing, which is exactly the "far dissolving" end of the depth cue.
 */
const fragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uMinor;
uniform vec3 uMajor;
uniform vec3 uCam;
uniform float uCell;
uniform float uMajorEvery;
uniform float uFadeStart;
uniform float uFadeEnd;

varying vec3 vWorld;

float gridAlpha(vec2 p, float cell, float thickness) {
  vec2 c = p / cell;
  vec2 d = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), 1e-6);
  return 1.0 - clamp(min(d.x, d.y) / thickness, 0.0, 1.0);
}

void main() {
  vec2 p = vWorld.xz;
  float dist = length(vWorld - uCam);

  float minor = gridAlpha(p, uCell, 1.0);
  float major = gridAlpha(p, uCell * uMajorEvery, 1.5);

  // Fades to black well before any horizon: no sky, no visible edge.
  float far = 1.0 - smoothstep(uFadeStart, uFadeEnd, dist);
  // Lines closest to the camera lose a little contrast rather than gaining it,
  // standing in for a shallow depth of field.
  float near = mix(0.72, 1.0, smoothstep(0.7, 7.0, dist));

  float a = clamp(minor * 0.62 + major * 0.95, 0.0, 1.0) * far * near;
  if (a < 0.0025) {
    discard;
  }
  gl_FragColor = vec4(mix(uMinor, uMajor, clamp(major, 0.0, 1.0)), a);
}
`;

export const GridPlane: React.FC<{
  cameraPosition: [number, number, number];
  renderOrder: number;
}> = ({cameraPosition, renderOrder}) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          // three converts these to linear working space on construction, which
          // is what the sRGB output pass expects back.
          uMinor: {value: new THREE.Color('#2a6ba8')},
          uMajor: {value: new THREE.Color('#3d90d6')},
          uCam: {value: new THREE.Vector3()},
          uCell: {value: 0.5},
          uMajorEvery: {value: 4.0},
          uFadeStart: {value: 10.0},
          uFadeEnd: {value: 30.0},
        },
      }),
    [],
  );

  material.uniforms.uCam.value.set(...cameraPosition);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 24]}
      renderOrder={renderOrder}
    >
      <planeGeometry args={[400, 400]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};
