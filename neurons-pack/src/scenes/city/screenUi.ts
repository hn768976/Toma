// The invented app on the phone screen (clip 9): a light map view that
// gives way to a growing list of matches: avatar circles, grey text bars,
// small red hearts. Unbranded; drawn procedurally so it is crisp at 4K.
import * as THREE from "three";

export const screenUiMaterial = () =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { uT: { value: 0 }, uCount: { value: 0 }, uAspect: { value: 0.5 } },
    vertexShader: /* glsl */ `
precision highp float;
in vec3 position;
in vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
precision highp float;
uniform float uT;
uniform float uCount;
uniform float uAspect; // width / height
in vec2 vUv;
out vec4 outColor;
float box(vec2 p, vec2 c, vec2 h, float r) { vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float heart(vec2 p, float s) {
  p /= s;
  p.y = -p.y + 0.25;
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return (sqrt(dot(p - vec2(0.25, 0.75), p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0) * s;
  return sqrt(min(dot(p - vec2(0.0, 1.0), p - vec2(0.0, 1.0)), dot(p - 0.5 * max(p.x + p.y, 0.0), p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y) * s;
}
vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }
void main() {
  // Screen space in "points": x 0..1, y 0..1/aspect from the top.
  vec2 p = vec2(vUv.x, (1.0 - vUv.y) / uAspect);
  float H = 1.0 / uAspect;
  float px = fwidth(p.x) * 0.8 + 1e-5;
  #define COV(d) (1.0 - smoothstep(-px, px, (d)))
  vec3 bg = srgb(vec3(0.97, 0.97, 0.98));
  vec3 col = bg;
  vec3 grey = srgb(vec3(0.84, 0.85, 0.87));
  vec3 dark = srgb(vec3(0.22, 0.24, 0.28));
  vec3 red = srgb(vec3(1.0, 0.30, 0.37));
  // How much of the screen the map takes: all of it, then the top third.
  float mapH = mix(H, 0.62, smoothstep(4.0, 5.5, uT));
  if (p.y < mapH) {
    // Map view: pale blocks, white streets, a pin and a radius circle.
    vec2 m = p * 9.0 + vec2(0.3 * sin(p.y * 4.0), 0.0);
    vec2 g = abs(fract(m) - 0.5);
    float street = min(g.x, g.y);
    col = mix(srgb(vec3(0.91, 0.92, 0.89)), vec3(1.0), COV(0.05 - street / 9.0 * 9.0 * 0.11));
    float hw = abs(p.y - 0.35 * mapH - 0.15 * sin(p.x * 5.0));
    col = mix(col, srgb(vec3(0.62, 0.72, 0.86)), COV(hw - 0.018));
    vec2 c = vec2(0.5, mapH * 0.5);
    float ring = length(p - c);
    col = mix(col, srgb(vec3(1.0, 0.55, 0.6)), 0.18 * COV(ring - 0.32 * min(1.0, mapH)));
    col = mix(col, red, COV(abs(ring - 0.32 * min(1.0, mapH)) - 0.004));
    col = mix(col, red, COV(length(p - c) - 0.035));
    col = mix(col, vec3(1.0), COV(length(p - c) - 0.014));
  }
  // Status bar and header.
  col = mix(col, dark, COV(box(p, vec2(0.12, 0.045), vec2(0.05, 0.012), 0.012)));
  col = mix(col, dark, COV(box(p, vec2(0.86, 0.045), vec2(0.045, 0.012), 0.006)));
  // List of matches (newest on top).
  float listTop = mapH + 0.04;
  float rowH = 0.2;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float shown = clamp(uCount - fi, 0.0, 1.0);
    if (shown <= 0.0) break;
    float y = listTop + fi * rowH + rowH * 0.5;
    // Slide in from the right as each row arrives.
    float slide = (1.0 - smoothstep(0.0, 1.0, shown)) * 1.2;
    vec2 q = p - vec2(slide, 0.0);
    if (q.y > H) break;
    float card = box(q, vec2(0.5, y), vec2(0.45, rowH * 0.42), 0.04);
    col = mix(col, vec3(1.0), COV(card));
    float h = fract(sin((uCount - fi) * 12.9898) * 43758.5453);
    vec3 av = srgb(mix(vec3(0.62, 0.72, 0.95), vec3(0.98, 0.72, 0.62), h));
    col = mix(col, av, COV(length(q - vec2(0.16, y)) - 0.065));
    col = mix(col, srgb(vec3(1.0)), COV(length(q - vec2(0.16, y - 0.012)) - 0.022));
    col = mix(col, grey, COV(box(q, vec2(0.43, y - 0.03), vec2(0.17 - 0.05 * h, 0.018), 0.018)));
    col = mix(col, grey, COV(box(q, vec2(0.38, y + 0.025), vec2(0.12, 0.014), 0.014)));
    col = mix(col, red, COV(heart(q - vec2(0.84, y + 0.03), 0.06)));
  }
  outColor = vec4(col, 1.0);
}`,
  });

export const greenScreenMaterial = () =>
  // Exactly #00FF00: unlit, no fog, no tone mapping (linear 0,1,0 == sRGB 0,255,0).
  new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 1, 0), fog: false, toneMapped: false });
