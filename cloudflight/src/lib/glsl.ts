/** GLSL shared by every shader composition. */

export const GLSL_HEADER = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler3D;
`;

export const FULLSCREEN_VERT = /* glsl */ `
in vec3 position;
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Integer hash (pcg3d) - identical on every GPU. */
export const GLSL_HASH = /* glsl */ `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash3(uvec3 v) { return vec3(pcg3d(v)) * (1.0 / 4294967296.0); }
`;

/**
 * Final pass helpers. Grain is a fixed formula of pixel position and
 * (looped) frame; the dither is a 64x64 blue noise tile, offset per frame by
 * an R2 sequence so its pattern never sits still.
 */
export const GLSL_FINISH = /* glsl */ `
uniform sampler2D uBlue;
uniform float uFrame;      // already wrapped to the loop length
uniform float uGrain;      // ~0.01

vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

float blueAt(vec2 fragCoord, float frame, float channel) {
  vec2 off = floor(fract(vec2(0.7548776662, 0.5698402910) * (frame + channel * 17.0)) * 64.0);
  return texelFetch(uBlue, ivec2(mod(floor(fragCoord) + off, 64.0)), 0).r;
}

// c: display-referred sRGB colour in 0..1
vec3 finishSrgb(vec3 c, vec2 fragCoord, float frame) {
  vec3 h = hash3(uvec3(uvec2(fragCoord), uint(frame) + 7919u));
  float n = (h.x + h.y) - 1.0;                    // triangular, -1..1
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float fade = smoothstep(0.0, 0.03, lum);
  c += n * uGrain * fade;
  vec3 d = vec3(blueAt(fragCoord, frame, 0.0), blueAt(fragCoord, frame, 1.0), blueAt(fragCoord, frame, 2.0));
  c += (d - 0.5) * (2.0 / 255.0);
  return clamp(c, 0.0, 1.0);
}
`;
