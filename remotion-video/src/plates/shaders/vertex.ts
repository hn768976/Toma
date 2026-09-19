/**
 * Shared vertex shader for every plate.
 *
 * The plates are all full-frame procedural fragment shaders, so the vertex
 * stage only has to push a single quad through Pixi's standard mesh matrices
 * and hand the fragment stage a 0..1 UV.
 */
export const VERTEX_SRC = /* glsl */ `#version 300 es
in vec2 aPosition;
in vec2 aUV;

out vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}
`;
