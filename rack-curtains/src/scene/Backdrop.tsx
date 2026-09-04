import React, { useMemo } from "react";
import * as THREE from "three";
import { hexToRgb, type Palette } from "../palette";

// A large plane behind everything, carrying the deep-to-lit blue gradient.
// Doing this in the scene rather than in CSS keeps the additive panels
// compositing against real colour instead of a transparent framebuffer.
const backdropVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const backdropFragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uDeep;
  uniform vec3 uLit;
  varying vec2 vUv;

  void main() {
    // Light pools toward the upper middle, where the shafts come down.
    vec2 p = (vUv - vec2(0.5, 0.62)) * vec2(1.35, 1.0);
    float pool = exp(-dot(p, p) * 3.1);
    float lift = pow(clamp(vUv.y, 0.0, 1.0), 1.4) * 0.55;
    gl_FragColor = vec4(mix(uDeep, uLit, clamp(pool * 0.95 + lift, 0.0, 1.0)), 1.0);
  }
`;

export const Backdrop: React.FC<{ palette: Palette }> = ({ palette }) => {
  const uniforms = useMemo(
    () => ({
      uDeep: { value: new THREE.Vector3(...hexToRgb(palette.bgDeep)) },
      uLit: { value: new THREE.Vector3(...hexToRgb(palette.bgLit)) },
    }),
    [palette.bgDeep, palette.bgLit],
  );

  return (
    <mesh position={[0, 0, -58]} renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[260, 150]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={backdropVertexShader}
        fragmentShader={backdropFragmentShader}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};
