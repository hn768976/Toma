// The backdrop, drawn inside the scene rather than as a CSS layer.
//
// It has to be in the scene for two reasons: the depth-of-field pass
// blurs whatever is in the framebuffer, and it can only do that cleanly
// if the framebuffer is opaque -- blurring a transparent canvas bleeds the
// clear colour into every silhouette. Putting the gradient on a far
// back-facing sphere also gives the arch something coherent to reflect.

import React, { useMemo } from "react";
import { BackSide, Color, ShaderMaterial } from "three";
import { Backdrop } from "../materials/palette";

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform float uGlow;
varying vec3 vDir;

void main() {
  float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 color = mix(uBottom, uTop, pow(t, 0.85));
  // A soft pool of light behind and above the subject, so the backdrop
  // has the falloff of a lit cyclorama instead of a flat ramp.
  float pool = pow(clamp(dot(normalize(vDir), normalize(vec3(-0.25, 0.42, 1.0))), 0.0, 1.0), 2.4);
  color += uTop * pool * uGlow;
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const SceneBackdrop: React.FC<{ backdrop: Backdrop; glow?: number }> = ({
  backdrop,
  glow = 0.28,
}) => {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        side: BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new Color() },
          uBottom: { value: new Color() },
          uGlow: { value: 0.28 },
        },
      }),
    [],
  );
  (material.uniforms.uTop.value as Color).set(backdrop.top);
  (material.uniforms.uBottom.value as Color).set(backdrop.bottom);
  material.uniforms.uGlow.value = glow;

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[18, 32, 24]} />
    </mesh>
  );
};
