import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Palette } from "./palette";

const VERT = /* glsl */ `
varying vec2 vScreen;
void main() {
  vScreen = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

/**
 * No horizon line: one soft vertical falloff that darkens to near-black in the
 * far distance, plus a low, wide pool of light on the near floor. The floor
 * plane is translucent, so this gradient is also what the floor sits on.
 */
const FRAG = /* glsl */ `
precision highp float;
uniform vec3 near;
uniform vec3 far;
varying vec2 vScreen;

void main() {
  vec3 c = mix(near, far, smoothstep(0.0, 0.9, vScreen.y));
  float pool = exp(-pow((vScreen.y - 0.30) * 3.0, 2.0)) *
               exp(-pow((vScreen.x - 0.5) * 1.4, 2.0));
  c += near * pool * 0.35;
  gl_FragColor = vec4(c, 1.0);
}
`;

export const Backdrop: React.FC<{ palette: Palette }> = ({ palette }) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          near: { value: new THREE.Color(palette.bgNear) },
          far: { value: new THREE.Color(palette.bgFar) },
        },
      }),
    [palette],
  );
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material} renderOrder={-100} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};
