// GLSL ES 3.00 (WebGL 2) shaders for the particle wave.

// Full-screen background: four-corner gradient, a soft haze glow and a
// touch of dither so the smooth gradient doesn't band after h264.
export const BG_VERT = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const BG_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec3 uTL, uTR, uBL, uBR, uHaze;
uniform float uHazeStrength;
uniform float uAspect;
uniform float uSeed;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 top = mix(uTL, uTR, smoothstep(0.0, 1.0, vUv.x));
  vec3 bottom = mix(uBL, uBR, smoothstep(0.0, 1.0, vUv.x));
  vec3 col = mix(bottom, top, smoothstep(0.0, 1.0, vUv.y));
  // Soft haze bank sitting behind the upper-left of the wave.
  vec2 p = (vUv - vec2(0.22, 0.62)) * vec2(uAspect, 1.0);
  float haze = exp(-dot(p, p) * 1.6);
  col = mix(col, uHaze, haze * uHazeStrength);
  col += (hash(gl_FragCoord.xy + uSeed) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

// Particles: each vertex is one dot on the (x, z) grid. Height comes
// from a sum of travelling sine swells evaluated on the GPU. Depth of
// field is faked per point: the sprite grows with its circle of
// confusion while its brightness drops to conserve energy, so far dots
// melt into soft bright ribbons where the surface folds.
export const DOT_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aGrid;   // world x, z
in float aSeed;  // 0..1 per-dot random
uniform mat4 uView, uProj;
uniform float uPhase;       // 0..2pi over the loop
uniform float uViewportH;   // px
uniform float uFocus;       // focus distance (world)
uniform float uAperture;    // CoC scale (fraction of viewport height)
uniform float uDotWorld;    // in-focus dot diameter (world)
uniform float uMinPx, uMaxPx;
uniform vec2 uXRange, uZRange;
uniform vec3 uNear, uFar, uAccent;
uniform float uAccentMix;
uniform float uIntensity;
out vec3 vColor;
out float vAlpha;
out float vSoft;

float heightAt(vec2 p, float t) {
  float x = p.x, z = p.y;
  float h = 0.0;
  h += 2.8 * sin(0.040 * x + 0.200 * z + t + 0.3);
  h += 1.8 * sin(-0.080 * x + 0.290 * z + 2.0 * t + 1.7);
  h += 1.1 * sin(0.150 * x + 0.140 * z - t + 0.9);
  h += 0.55 * sin(0.110 * x + 0.430 * z + 3.0 * t + 2.4);
  h += 0.04 * x;
  return h;
}

void main() {
  float y = heightAt(aGrid, uPhase);
  vec4 view = uView * vec4(aGrid.x, y, aGrid.y, 1.0);
  float d = max(-view.z, 0.001);
  gl_Position = uProj * view;

  float projScale = uProj[1][1] * uViewportH * 0.5;
  float core = max(uDotWorld * projScale / d, uMinPx);
  float coc = uAperture * uViewportH * abs(d - uFocus) / d;
  float size = min(sqrt(core * core + coc * coc), uMaxPx);
  gl_PointSize = size;

  // Physically the energy would fall with area (core/size)^2; a gentler
  // falloff keeps the blurred far field glowing like the reference.
  float energy = pow(core / size, 1.15);
  // Fade the ragged edges of the grid and the far distance.
  float ex = smoothstep(uXRange.x, uXRange.x + 18.0, aGrid.x)
           * (1.0 - smoothstep(uXRange.y - 18.0, uXRange.y, aGrid.x));
  float ez = 1.0 - smoothstep(uZRange.y * 0.7, uZRange.y, aGrid.y);
  float en = smoothstep(uZRange.x, uZRange.x - 3.0, aGrid.y);
  float fade = ex * ez * en;

  float depthT = clamp((d - uFocus) / 70.0, 0.0, 1.0);
  float across = clamp((aGrid.x - uXRange.x) / (uXRange.y - uXRange.x), 0.0, 1.0);
  vec3 c = mix(uNear, uFar, depthT);
  c = mix(c, uAccent, uAccentMix * smoothstep(0.55, 0.0, across) * depthT);
  float twinkle = 0.85 + 0.15 * sin(uPhase * 3.0 + aSeed * 6.2831);

  vColor = c;
  vAlpha = uIntensity * fade * twinkle * energy;
  vSoft = clamp(1.0 - core / size, 0.0, 1.0);
}`;

export const DOT_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
in float vSoft;
out vec4 outColor;
void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  if (r > 1.0) discard;
  // Crisp round dot when in focus, soft bokeh disc when blurred.
  float edge = mix(0.35, 0.95, vSoft);
  float a = 1.0 - smoothstep(1.0 - edge, 1.0, r);
  a *= vAlpha;
  // Premultiplied, blended with "screen" (ONE, ONE_MINUS_SRC_COLOR).
  outColor = vec4(vColor * a, a);
}`;
