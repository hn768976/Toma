// Shared GLSL (ES 3.0). Integer hashes so every thread computes identical bits.

export const GLSL_HASH = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float h1(uint a) { return float(pcg(a)) * (1.0 / 4294967295.0); }
float h2(uint a, uint b) { return h1(a ^ pcg(b + 0x9e3779b9u)); }
float h3(uint a, uint b, uint c) { return h1(a ^ pcg(b ^ pcg(c + 0x85ebca6bu))); }
`;

/**
 * Depth-of-field helpers used directly inside materials (no screen-space DoF
 * pass): each surface knows its own circle of confusion, from either a
 * screen-space horizontal band (tilt-shift style, Look 1) or view depth
 * (thin-lens, Looks 2 & 3). uDof = (mode, a, b, c) in (x, y, z, w):
 *   mode 0: band  — a = band centre (0..1 screen y), b = half width, c = ramp
 *   mode 1: depth — a = focus distance, b = aperture (blur per 1/z), c = unused
 * uDofMax = max blur radius in output pixels at 2160p (scaled by uPxScale).
 */
export const GLSL_DOF = /* glsl */ `
uniform vec4 uDof;
uniform float uDofMax;
uniform float uDofMin;
uniform vec2 uRes;
uniform float uPxScale;
float cocPx(float viewZ) {
  float b;
  if (uDof.x < 0.5) {
    float y = gl_FragCoord.y / uRes.y;
    b = smoothstep(uDof.z, uDof.z + uDof.w, abs(y - uDof.y));
    b = b * b;
  } else {
    b = abs(1.0 / max(viewZ, 0.01) - 1.0 / uDof.y) * uDof.z;
  }
  return (uDofMin + min(b, 1.0) * uDofMax) * uPxScale;
}
`;

/**
 * Blurred texture lookup: 12 taps on a Vogel disc of radius r screen pixels,
 * mapped into uv with the screen-space derivatives, each tap filtered with
 * gradients scaled to the tap spacing (keeps mipmaps + anisotropy).
 */
export const GLSL_BLUR_SAMPLE = /* glsl */ `
// Early-out probe: one coarse lookup covering the whole blur footprint.
float blurProbe(sampler2D tex, vec2 uv, float r) {
  vec2 ts = vec2(textureSize(tex, 0));
  vec2 dx = dFdx(uv) * ts, dy = dFdy(uv) * ts;
  float lod = log2(max(max(length(dx), length(dy)) * max(r, 1.0) * 2.0, 1.0));
  return textureLod(tex, uv, lod).a;
}
vec4 blurTex(sampler2D tex, vec2 uv, float r) {
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  // sharp: one anisotropic, mipmapped lookup
  if (r < 0.6) return textureGrad(tex, uv, dx, dy);
  // blurred: 12 isotropic taps on a Vogel disc, LOD matched to tap spacing
  vec2 ts = vec2(textureSize(tex, 0));
  float foot = max(length(dx * ts), length(dy * ts));
  float lod = log2(max(foot * max(1.0, r * 0.55), 1.0));
  vec4 acc = vec4(0.0);
  const int N = 12;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float rr = sqrt(fi / float(N)) * r;
    float a = fi * 2.39996323;
    vec2 o = vec2(cos(a), sin(a)) * rr;
    acc += textureLod(tex, uv + dx * o.x + dy * o.y, lod);
  }
  return acc / float(N);
}
`;
