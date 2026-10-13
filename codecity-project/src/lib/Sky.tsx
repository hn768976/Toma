import React, { useMemo } from "react";
import * as THREE from "three";
import { skyUniforms } from "../kit/buildings";
import { GLSL_SKY, SkyParams } from "./glsl";

// Sky dome that follows the camera position (set in the look's update).
export const makeSky = (k: SkyParams) =>
  new THREE.ShaderMaterial({
    uniforms: skyUniforms(k),
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_SKY}
      varying vec3 vDir;
      void main() { gl_FragColor = vec4(skyCol(normalize(vDir)), 1.0); }`,
    side: THREE.BackSide,
    depthWrite: false,
  });

export const SkyDome = React.forwardRef<THREE.Mesh, { sky: SkyParams; radius: number }>(
  ({ sky, radius }, ref) => {
    const mat = useMemo(() => makeSky(sky), [sky]);
    return (
      <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[radius, 64, 32]} />
      </mesh>
    );
  },
);
