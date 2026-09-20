/**
 * Gradient backdrop dome.
 *
 * Used by the two looks that have no walls - the fogged void of look 2 and
 * the open field of look 4. An inside-out sphere rather than a plane, so
 * there is no corner or edge anywhere in frame and the background falls off
 * evenly in every direction.
 *
 * The gradient is dithered at source. These are the largest smooth ramps in
 * the project and they are exactly what an 8-bit encode turns into rings; the
 * post chain dithers again before the encode, but starting clean costs
 * nothing.
 */

import React, { useEffect, useMemo } from "react";
import * as THREE from "three";

const vertexShader = /* glsl */ `
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform float uLowY;
uniform float uHighY;
varying vec3 vWorldPosition;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  // Mapped to explicit world heights rather than a fraction of the dome
  // radius: the dome is far larger than the framed area, so a radius-relative
  // ramp puts almost none of the gradient on screen.
  float mixAmount = smoothstep(uLowY, uHighY, vWorldPosition.y);
  vec3 color = mix(uBottom, uTop, mixAmount);

  // Sub-LSB dither so the ramp never quantises into bands, even before the
  // post chain gets to it.
  float n = hash12(gl_FragCoord.xy) - 0.5;
  color += n * (1.0 / 255.0);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const GradientBackdrop: React.FC<{
  /** Colour at and above `highY`. */
  top: string;
  /** Colour at and below `lowY`. */
  bottom: string;
  radius?: number;
  /** World height where the ramp starts. */
  lowY?: number;
  /** World height where it finishes. A wide span means no visible horizon. */
  highY?: number;
}> = ({ top, bottom, radius = 70, lowY = -4, highY = 7 }) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color(top) },
          uBottom: { value: new THREE.Color(bottom) },
          uLowY: { value: lowY },
          uHighY: { value: highY },
        },
      }),
    [top, bottom, lowY, highY],
  );
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material} renderOrder={-10}>
      <sphereGeometry args={[radius, 64, 48]} />
    </mesh>
  );
};
