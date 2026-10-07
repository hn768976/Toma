// Shared GLSL snippets (GLSL ES 3.00, used with RawShaderMaterial + THREE.GLSL3).

export const HEADER = /* glsl */ `
precision highp float;
precision highp int;
`;

// Integer hashes. hash11u matches hashU() in random.ts.
export const HASH = /* glsl */ `
uint hashu(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float hash11u(uint x) { return float(hashu(x)) / 4294967296.0; }
float hash2u(uint a, uint b) { return hash11u(a * 0x9E3779B9u ^ hashu(b + 0x632BE5ABu)); }
float hash3u(uint a, uint b, uint c) { return hash11u(hashu(a * 0x9E3779B9u ^ b) ^ (c * 0x85EBCA6Bu)); }
`;

export const FULLSCREEN_VERT = /* glsl */ `${HEADER}
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
