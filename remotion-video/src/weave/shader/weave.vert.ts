/**
 * Vertex shader for the full-frame weave quad.
 *
 * Mirrors PixiJS v8's own mesh vertex contract: the WebGL mesh adaptor binds
 * `globalUniforms` (group 100) and the local uniforms (group 101) onto whatever
 * shader a Mesh carries, and in WebGL those arrive as plain uniforms rather
 * than a UBO -- so declaring them individually is correct here.
 */
export const weaveVertexShader = /* glsl */ `#version 300 es
precision highp float;

in vec2 aPosition;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

out vec2 vUv;

void main() {
  vUv = aPosition;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`;
