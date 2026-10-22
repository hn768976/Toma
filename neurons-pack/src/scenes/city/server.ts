// A generic graphite tower server: rounded case, front vent field, a small
// status screen and LED dots. No logo or brand detailing.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { hexToLinear } from "../../lib/color";

export const SERVER = { w: 8, h: 23, d: 11 };

export const makeServer = (c: { case: string; screen: string; led: string }) => {
  const geo = new RoundedBoxGeometry(SERVER.w, SERVER.h, SERVER.d, 5, 0.55);
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uCase: { value: new THREE.Vector3(...hexToLinear(c.case)) },
      uScreen: { value: new THREE.Vector3(...hexToLinear(c.screen)) },
      uLed: { value: new THREE.Vector3(...hexToLinear(c.led)) },
      uSize: { value: new THREE.Vector3(SERVER.w, SERVER.h, SERVER.d) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
precision highp float;
in vec3 position;
in vec3 normal;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
out vec3 vP;
out vec3 vN;
out vec3 vVN;
out vec3 vV;
void main() {
  vP = position;
  vN = normal;
  vVN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
precision highp float;
uniform vec3 uCase;
uniform vec3 uScreen;
uniform vec3 uLed;
uniform vec3 uSize;
uniform float uTime;
in vec3 vP;
in vec3 vN;
in vec3 vVN;
in vec3 vV;
out vec4 outColor;
float box(vec2 p, vec2 c, vec2 h) { vec2 q = abs(p - c) - h; return max(q.x, q.y); }
float cov(float d) { float a = fwidth(d) * 0.8 + 1e-5; return 1.0 - smoothstep(-a, a, d); }
void main() {
  vec3 N = normalize(vVN);
  vec3 V = normalize(vV);
  vec3 L = normalize(vec3(-0.4, 0.8, 0.6));
  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, normalize(L + V)), 0.0), 40.0);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 col = uCase * (0.6 + 0.9 * diff) + vec3(0.12) * spec + uCase * rim * 0.6;
  vec3 hs = uSize * 0.5;
  vec3 emit = vec3(0.0);
  if (vN.z > 0.9) {
    // Front panel (x across, y up), in case units.
    vec2 p = vP.xy;
    float inset = cov(box(p, vec2(0.0, 0.0), vec2(hs.x - 0.9, hs.y - 0.9)));
    col *= mix(1.0, 0.8, inset);
    // Status screen near the top.
    float scr = cov(box(p, vec2(0.0, hs.y - 3.3), vec2(2.6, 1.3)));
    vec3 glass = vec3(0.012, 0.02, 0.035);
    float rows = step(0.55, fract((p.y - (hs.y - 3.3)) * 1.6 + 0.2)) * step(abs(p.x + 0.4), 1.7 - 0.6 * step(0.5, fract(p.y * 0.8)));
    col = mix(col, glass + uScreen * rows * 0.35, scr);
    emit += uScreen * rows * scr * 0.25;
    // Bezel ring around the screen.
    col += vec3(0.05) * cov(abs(box(p, vec2(0.0, hs.y - 3.3), vec2(2.75, 1.45))) - 0.06);
    // LED dots.
    for (int i = 0; i < 3; i++) {
      vec2 c = vec2(-1.2 + float(i) * 0.9, hs.y - 5.4);
      float l = cov(length(p - c) - 0.17);
      vec3 lc = uScreen;
      if (i != 1) continue;
      col = mix(col, lc, l);
      emit += lc * l * 0.6;
    }
    // Two drive-bay grooves.
    for (int i = 0; i < 2; i++) {
      float y = hs.y - 7.0 - float(i) * 1.1;
      col *= 1.0 - 0.45 * cov(box(p, vec2(0.0, y), vec2(2.9, 0.07)));
    }
    // Perforated vent field on the lower front.
    vec2 g = p / 0.42;
    vec2 cell = fract(g) - 0.5;
    float holes = cov(length(cell) - 0.18) * cov(box(p, vec2(0.0, -2.6), vec2(3.2, 6.6)));
    col = mix(col, col * 0.25, holes);
    col += vec3(0.02) * cov(box(p, vec2(0.0, -2.6), vec2(3.2, 6.6)));
  } else if (abs(vN.x) > 0.9) {
    // Side vent lines.
    float lines = cov(abs(fract(vP.y * 1.25) - 0.5) - 0.12) * cov(box(vP.zy, vec2(0.0, -4.0), vec2(hs.z - 2.0, 4.0)));
    col *= 1.0 - 0.35 * lines;
  }
  outColor = vec4(col + emit, 1.0);
}`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
};
