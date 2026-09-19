import { Geometry, Mesh, Shader, type UniformData } from "pixi.js";

/**
 * Vertex shader for a single full-screen triangle.
 *
 * It writes clip space directly rather than going through Pixi's projection
 * matrices, so the quad always covers the viewport no matter the render size.
 * vUv is flipped to screen convention: (0,0) is the top-left corner.
 */
const FULLSCREEN_VERT = `#version 300 es
in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/** One oversized triangle covers the screen with fewer vertices than a quad. */
const fullscreenGeometry = () =>
  new Geometry({
    attributes: {
      aPosition: {
        buffer: new Float32Array([-1, -1, 3, -1, -1, 3]),
        format: "float32x2",
      },
    },
    indexBuffer: new Uint32Array([0, 1, 2]),
  });

export type UniformSpec = Record<string, UniformData>;

/**
 * Builds a full-screen Mesh driven by a custom fragment shader.
 * Returns the mesh plus the live uniform object to mutate each frame.
 */
export const createShaderMesh = <T extends UniformSpec>(
  fragment: string,
  uniforms: T,
) => {
  const shader = Shader.from({
    gl: { vertex: FULLSCREEN_VERT, fragment },
    resources: { u: { ...uniforms } },
  });

  const mesh = new Mesh({ geometry: fullscreenGeometry(), shader });

  return {
    mesh,
    uniforms: shader.resources.u.uniforms as {
      [K in keyof T]: T[K]["value"];
    },
  };
};

/** Shared GLSL helpers: deterministic hashes and easing. */
export const GLSL_COMMON = `
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float easeInOut(float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
}

float remap(float v, float a, float b) {
  return clamp((v - a) / (b - a), 0.0, 1.0);
}
`;
