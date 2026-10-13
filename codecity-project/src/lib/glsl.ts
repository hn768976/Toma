// Shared GLSL helpers. Lines are analytically anti-aliased with fwidth, never
// thinner than ~1.5 px (thinner lines get dimmer instead), and periodic line
// sets fade to their average coverage once they get denser than a few pixels,
// so nothing crawls or moires as the camera moves.
export const GLSL_LINES = /* glsl */ `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash31(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }

// Coverage of a line of half-width w (world units) at distance d.
float lineAt(float d, float w, float px) {
  float wEff = max(w, px * 0.75);
  float a = 1.0 - smoothstep(wEff - px * 0.5, wEff + px * 0.5, d);
  return a * (w / wEff);
}
// Periodic lines every s units along coordinate x, half-width w.
float gridLines(float x, float s, float w) {
  float px = max(fwidth(x), 1e-5);
  float d = abs(fract(x / s + 0.5) - 0.5) * s;
  float a = lineAt(d, w, px);
  float dens = smoothstep(2.5, 6.0, s / px);
  return mix(min(1.0, 2.0 * w / s), a, dens);
}
`;

// Sky colour by world view direction. Used by the sky dome and as the fog
// colour of solid geometry, so anything fully fogged vanishes into the sky.
export const GLSL_SKY = /* glsl */ `
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uGlow;
uniform vec3 uGlowDir;
uniform vec2 uGlowW; // horizontal, vertical angular width (rad)
uniform vec3 uGlow2; // optional second, lower and flatter glow (warm horizon band)
vec3 skyCol(vec3 d) {
  vec3 c = mix(uSkyHorizon, uSkyTop, smoothstep(-0.05, 0.55, d.y));
  vec3 g = normalize(uGlowDir);
  float az = atan(d.x, -d.z) - atan(g.x, -g.z);
  float el = asin(clamp(d.y, -1.0, 1.0)) - asin(clamp(g.y, -1.0, 1.0));
  float gx = az / uGlowW.x;
  float gy = el / uGlowW.y;
  c += uGlow * exp(-(gx * gx + gy * gy));
  float g2x = az / (uGlowW.x * 1.3);
  float g2y = (el + 0.03) / (uGlowW.y * 0.35);
  c += uGlow2 * exp(-(g2x * g2x + g2y * g2y));
  return c;
}
`;

export type SkyParams = {
  top: [number, number, number];
  horizon: [number, number, number];
  glow: [number, number, number];
  glowDir: [number, number, number];
  glowW: [number, number];
  glow2?: [number, number, number];
};
