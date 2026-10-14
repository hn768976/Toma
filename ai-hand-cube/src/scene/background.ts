// Full-screen background drawn first into the main target (so the glass cube
// transmits it). Deep base colour with a soft glow behind the cube.
import * as THREE from "three";

export const buildBackground = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uBase: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uGlowPos: { value: new THREE.Vector2(0.5, 0.5) },
      uGlowRadius: { value: 0.55 },
      uGlowStrength: { value: 1 },
      uAspect: { value: 16 / 9 },
    },
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 0.99999, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uBase;
      uniform vec3 uGlow;
      uniform vec2 uGlowPos;
      uniform float uGlowRadius;
      uniform float uGlowStrength;
      uniform float uAspect;
      in vec2 vUv;
      out vec4 outColor;
      void main() {
        vec2 d = vUv - uGlowPos;
        d.x *= uAspect;
        d.y *= 1.25;
        float r = length(d) / uGlowRadius;
        // smooth, wide falloff (two gaussians) - no hard ring anywhere
        float glow = 0.6 * exp(-r * r * 2.0) + 0.4 * exp(-r * r * 0.45);
        // slightly darker toward the bottom/top edges
        float vert = 1.0 - 0.45 * pow(abs(vUv.y - 0.5) * 2.0, 1.5);
        vec3 c = uBase * vert + uGlow * glow * uGlowStrength;
        outColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.userData.skipDepthPrepass = true;
  return { mesh, material };
};
