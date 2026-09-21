/**
 * Shader-generated background — never an image.
 *
 * A gentle radial lift behind the cluster over a two-colour field. The
 * gradient is dithered before it leaves the shader: a smooth beige or grey
 * ramp across a 4K frame is exactly the case 8-bit H.264 bands worst, and
 * these palettes sit in the mid-tones where it shows most.
 */

import React, { useMemo } from "react";
import * as THREE from "three";
import { DITHER } from "./glsl";

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uCentre;
uniform vec3 uEdge;
uniform float uFalloff;
uniform vec2 uOffset;
varying vec2 vUv;

${DITHER}

void main(){
  vec2 p = (vUv - 0.5 - uOffset) * vec2(1.0, 0.72);
  float d = clamp(length(p) * 2.0 * uFalloff, 0.0, 1.0);
  // Smootherstep, so there is no visible ring where the lift ends.
  d = d * d * d * (d * (d * 6.0 - 15.0) + 10.0);
  vec3 c = mix(uCentre, uEdge, d);
  gl_FragColor = vec4(dither(c, gl_FragCoord.xy), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const Background: React.FC<{
  centre: string;
  edge: string;
  falloff: number;
  /** Where the lift sits, as a fraction of the frame away from centre. */
  offset?: [number, number];
  distance: number;
  fov: number;
  aspect: number;
}> = ({ centre, edge, falloff, offset = [0, 0], distance, fov, aspect }) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        depthWrite: false,
        uniforms: {
          uCentre: { value: new THREE.Color(centre) },
          uEdge: { value: new THREE.Color(edge) },
          uFalloff: { value: falloff },
          uOffset: { value: new THREE.Vector2(offset[0], offset[1]) },
        },
      }),
    [centre, edge, falloff, offset],
  );

  // Sized to overfill the frustum at its depth, so no frame edge can miss it.
  const height = 2 * distance * Math.tan((fov * Math.PI) / 360) * 1.25;
  return (
    <mesh position={[0, 0, -distance]} material={material} renderOrder={-1}>
      <planeGeometry args={[height * aspect, height]} />
    </mesh>
  );
};
