import { useMemo } from "react";
import * as THREE from "three";

// Full-screen gradient drawn inside WebGL (additive light trails must sit on
// an opaque backdrop, not a transparent canvas).
export const Background: React.FC<{ glow: [number, number]; strength: number }> = ({
  glow,
  strength,
}) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uGlow: { value: new THREE.Vector2(0.9, 0.9) },
          uStrength: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec2 uGlow;
          uniform float uStrength;
          varying vec2 vUv;
          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
          }
          void main() {
            vec2 uv = vUv;
            vec3 deep = vec3(0.01, 0.015, 0.05);
            vec3 navy = vec3(0.07, 0.1, 0.25);
            vec3 col = mix(deep, navy, smoothstep(0.1, 1.3, uv.x * 0.6 + uv.y * 0.7));
            vec2 d = (uv - uGlow) * vec2(1.777, 1.0);
            float g = exp(-dot(d, d) * 3.5);
            col += vec3(0.12, 0.2, 0.5) * g * uStrength;
            // Dither against banding in the smooth gradient.
            col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [],
  );
  material.uniforms.uGlow.value.set(glow[0], glow[1]);
  material.uniforms.uStrength.value = strength;
  return (
    <mesh renderOrder={-1} frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};
