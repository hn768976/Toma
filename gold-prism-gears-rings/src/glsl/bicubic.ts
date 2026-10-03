// B-spline bicubic texture read from 4 bilinear taps (smooth upsampling of
// low-resolution buffers; no texel grid visible at 4K).
export const BICUBIC = /* glsl */ `
vec4 bsCubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}
vec4 textureBicubic(sampler2D tex, vec2 uv, vec2 texSize) {
  vec2 inv = 1.0 / texSize;
  uv = uv * texSize - 0.5;
  vec2 f = fract(uv);
  uv -= f;
  vec4 xc = bsCubic(f.x);
  vec4 yc = bsCubic(f.y);
  vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / s) * inv.xxyy;
  vec4 s0 = texture2D(tex, o.xz);
  vec4 s1 = texture2D(tex, o.yz);
  vec4 s2 = texture2D(tex, o.xw);
  vec4 s3 = texture2D(tex, o.yw);
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}
`;
