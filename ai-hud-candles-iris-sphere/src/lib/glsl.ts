// Shared GLSL snippets. All randomness is an integer hash of
// (pixel / element id, frame) — fully deterministic.

export const HASH = /* glsl */ `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash33u(uvec3 v) { return vec3(pcg3d(v)) * (1.0 / 4294967296.0); }
float hash11(float x) { return hash33u(uvec3(uint(int(x) + 100000), 7u, 13u)).x; }
float hash21(vec2 p) { return hash33u(uvec3(uvec2(ivec2(floor(p)) + 100000), 29u)).x; }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; }
  return s;
}
`;

// Circle of confusion, as a fraction of frame height.
// uDof.x = focus distance, uDof.y = strength (CoC fraction at depth -> infinity),
// uDof.z = max CoC fraction.
export const DOF_UNIFORMS = /* glsl */ `
uniform vec3 uDof;
uniform vec2 uRes;
float cocFrac(float depth) {
  float c = uDof.y * abs(depth - uDof.x) / max(depth, 1e-3);
  return min(c, uDof.z);
}
`;

// Depth-of-field for textured surfaces: gathers a screen-space disk of the
// surface's own texture. Offsets are mapped from screen pixels to uv with
// the uv derivatives, so a tilted plane blurs correctly; every tap is
// prefiltered with textureGrad to the tap spacing, so 16 taps are smooth.
export const DOF_TEXTURE = /* glsl */ `
vec4 sampleBounded(sampler2D t, vec2 uv, vec2 gx, vec2 gy) {
  vec4 c = textureGrad(t, uv, gx, gy);
  vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return c * inb.x * inb.y;
}
vec4 dofTexture(sampler2D t, vec2 uv, float cocPx) {
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  if (cocPx < 0.6) return sampleBounded(t, uv, dx, dy);
  float k = max(1.0, cocPx * 0.45);
  vec2 gx = dx * k, gy = dy * k;
  vec4 acc = vec4(0.0);
  const int N = 16;
  for (int i = 0; i < N; i++) {
    float fi = float(i);
    float r = cocPx * sqrt((fi + 0.5) / float(N));
    float a = fi * 2.39996323;
    vec2 o = r * vec2(cos(a), sin(a));
    acc += sampleBounded(t, uv + dx * o.x + dy * o.y, gx, gy);
  }
  return acc / float(N);
}
`;
