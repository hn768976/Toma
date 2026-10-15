// GLSL shared by every final pass: grain and dither as fixed formulas of
// pixel position and (frame mod composition length). Never Math.random().
export const FINISH_GLSL = /* glsl */ `
float fhash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// c: display-referred colour (0..1). px: pixel coordinate. f: frame mod length.
// grain: relative grain amplitude (0.015 = 1.5%).
vec3 finishColor(vec3 c, vec2 px, float f, float grain) {
  vec2 o = vec2(mod(f * 37.0, 251.0), mod(f * 61.0, 241.0));
  float g = fhash12(floor(px) + o * 7.123) * 2.0 - 1.0;
  // 1.5 % grain, relative in the lights; in the darks it keeps a floor of
  // ~0.5 % of full scale so the dither survives H.264 on slow dark gradients
  c += g * grain * max(c, vec3(0.35));
  // triangular-PDF dither, +-1/255
  float d1 = fhash12(floor(px) * 1.37 + o + 11.0);
  float d2 = fhash12(floor(px) * 0.73 + o.yx + 47.0);
  c += (d1 + d2 - 1.0) / 255.0;
  return c;
}
`;
