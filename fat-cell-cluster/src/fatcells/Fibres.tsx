/**
 * Connective strands, for the dark look.
 *
 * Pale, low-opacity tubes crossing the frame at several depths — some in front
 * of the cluster and strongly blurred by the depth of field, some behind it
 * and sharper. Paths are generated once at build time; here they only sway,
 * on their own integer-frequency closed paths.
 */

import React, { useMemo } from "react";
import * as THREE from "three";
import { FibreInstance } from "./build";
import { driftAt } from "./motion";

const vertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewPos;
void main(){
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vViewPos;
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vViewPos);
  // Brightest where the tube turns away from the eye, so the strands read as
  // translucent fibre rather than as solid rods.
  float edge = pow(1.0 - abs(dot(N, V)), 1.4);
  float a = uOpacity * (0.25 + 0.95 * edge);
  gl_FragColor = vec4(uColor * (0.6 + 0.7 * edge), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const Fibres: React.FC<{
  fibres: FibreInstance[];
  t: number;
  color: string;
}> = ({ fibres, t, color }) => {
  const materials = useMemo(
    () =>
      fibres.map(
        (f) =>
          new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            uniforms: {
              uColor: { value: new THREE.Color(color) },
              uOpacity: { value: f.opacity },
            },
          }),
      ),
    [fibres, color],
  );

  return (
    <group>
      {fibres.map((f, i) => {
        const d = driftAt(f.drift, t);
        return (
          <mesh
            key={i}
            geometry={f.geometry}
            material={materials[i]}
            position={[f.position[0] + d[0], f.position[1] + d[1], f.position[2] + d[2]]}
            renderOrder={1}
          />
        );
      })}
    </group>
  );
};
