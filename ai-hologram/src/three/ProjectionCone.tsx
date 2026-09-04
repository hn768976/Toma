import { useMemo } from "react";
import * as THREE from "three";
import { hexToRgb } from "../lib/color";
import type { Palette } from "../palettes";

/**
 * The faint projection cone standing between the core and the card. Fades out
 * with height and brightens at the silhouette, so it reads as volume rather
 * than as a piece of geometry.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewDir;

void main() {
  float rim = 1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir)));
  float up = 1.0 - smoothstep(0.05, 1.0, vUv.y);
  float amount = pow(rim, 1.6) * up * uAlpha;
  gl_FragColor = vec4(uColor * amount, 1.0);
}
`;

export const ProjectionCone: React.FC<{ palette: Palette; alpha: number; height: number }> = ({
  palette,
  alpha,
  height,
}) => {
  const material = useMemo(() => {
    const c = hexToRgb(palette.core);
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uColor: { value: new THREE.Vector3(c.r * 0.8, c.g * 0.86, c.b) },
        uAlpha: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquation: THREE.AddEquation,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
  }, [palette]);

  material.uniforms.uAlpha.value = alpha;

  return (
    <mesh material={material} position={[0, height / 2 + 0.1, 0]} renderOrder={8} frustumCulled={false}>
      <cylinderGeometry args={[2.5, 0.3, height, 72, 1, true]} />
    </mesh>
  );
};
