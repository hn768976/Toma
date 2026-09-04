import { useMemo } from "react";
import { AdditiveBlending, ShaderMaterial, Vector3 } from "three";
import { c3, type Theme } from "../theme";

/**
 * The bright point where the brain meets the plane's glow, and the rays that
 * fan out of it when it ignites. Rendered as one camera-facing billboard with
 * the star drawn procedurally, so it stays sharp at any output resolution.
 */

const vertexShader = /* glsl */ `
precision highp float;
uniform vec3 uCenter;
uniform float uSize;
varying vec2 vQuad;
void main() {
  vQuad = position.xy;
  vec4 mv = modelViewMatrix * vec4(uCenter, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uCoreOpacity;
uniform float uBurst;
uniform float uRayLen;
uniform float uTime;
varying vec2 vQuad;

void main() {
  float r = length(vQuad);
  if (r > 1.0) discard;
  float ang = atan(vQuad.y, vQuad.x);

  // Two interleaved fans give an uneven, non-mechanical star.
  float rays = pow(abs(sin(ang * 4.0 + 0.6)), 14.0) * 0.55
             + pow(abs(sin(ang * 7.0 + 2.3)), 28.0) * 0.45;
  float reach = max(uRayLen, 1e-3);
  float radial = exp(-(r / reach) * 2.6) * (1.0 - smoothstep(0.55, 1.0, r / reach));

  float breathe = 0.9 + 0.1 * sin(uTime * 1.7);
  float core = exp(-r * r * 130.0) * 2.0 * breathe;
  float glow = exp(-r * r * 11.0) * 0.42;

  vec3 col = uColor * ((core + glow) * uCoreOpacity + rays * radial * uBurst * 2.2);
  col *= 1.0 - smoothstep(0.9, 1.0, r);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export const Contact: React.FC<{
  theme: Theme;
  center: Vector3;
  /** Billboard radius, in world units. */
  size: number;
  coreOpacity: number;
  burst: number;
  rayLength: number;
  time: number;
}> = ({ theme, center, size, coreOpacity, burst, rayLength, time }) => {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms: {
          uCenter: { value: new Vector3() },
          uSize: { value: 1 },
          uColor: { value: c3(theme.contact).clone() },
          uCoreOpacity: { value: 0 },
          uBurst: { value: 0 },
          uRayLen: { value: 0.4 },
          uTime: { value: 0 },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme.id],
  );

  const u = material.uniforms;
  u.uCenter.value.copy(center);
  u.uSize.value = size;
  u.uCoreOpacity.value = coreOpacity;
  u.uBurst.value = burst;
  u.uRayLen.value = rayLength;
  u.uTime.value = time;

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};
