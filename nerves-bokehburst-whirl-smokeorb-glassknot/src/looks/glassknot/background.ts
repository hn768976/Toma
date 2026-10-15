import * as THREE from "three";
import { HASH, SIMPLEX3 } from "../../lib/glsl";

/**
 * Procedural, pre-blurred cosmic backgrounds for the Glass Knot (no photos).
 * Rendered once into a half-float texture at setup; the knot sits in front of it.
 * Everything here is low-frequency on purpose: it stands in for a heavily
 * defocused background, so no DoF pass is needed behind the knot.
 */

export type BackgroundKind = "galaxy" | "nebula";

export type BackgroundColors = {
  kind: BackgroundKind;
  base: [number, number, number];
  a: [number, number, number];
  b: [number, number, number];
  core: [number, number, number];
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uAspect;
uniform float uKind;
uniform vec3 cBase, cA, cB, cCore;
varying vec2 vUv;
${SIMPLEX3}
${HASH}
#define TAU 6.28318530718

float fbm(vec2 p, float z) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * snoise(vec3(p, z));
    p = p * 2.02 + vec2(3.1, 1.7);
    a *= 0.5;
  }
  return s;
}

// defocused stars: soft discs with a slightly brighter rim
vec3 bokeh(vec2 p, float cells, float seed, float radMin, float radMax, float density, float gain) {
  vec3 acc = vec3(0.0);
  vec2 g = p * cells;
  vec2 id0 = floor(g);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = id0 + vec2(float(i), float(j));
      vec3 h = hash32(id + seed);
      if (h.z > density) continue;
      vec2 c = (id + 0.2 + 0.6 * hash22(id + seed + 7.0)) / cells;
      float rad = mix(radMin, radMax, h.x * h.x);
      float d = length(p - c) / rad;
      float disc = 1.0 - smoothstep(0.82, 1.0, d);
      float rim = smoothstep(0.55, 0.95, d) * disc;
      float hue = h.y;
      vec3 col = hue < 0.3 ? vec3(1.0, 0.55, 0.45) : hue < 0.55 ? vec3(0.65, 0.75, 1.0) : hue < 0.75 ? vec3(1.0, 0.8, 0.55) : vec3(0.95, 0.92, 1.0);
      float b = mix(0.25, 1.0, fract(h.z * 17.0 + h.x * 3.0));
      acc += col * (disc * 0.7 + rim * 0.5) * b * gain;
    }
  }
  return acc;
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec3 col = cBase;

  if (uKind < 0.5) {
    // tilted spiral galaxy, centred right of frame centre, blurred
    vec2 q = p - vec2(-0.25, 0.12);
    float ang = 0.35;
    q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q;
    q.y *= 2.6;                                   // inclination
    float r = length(q);
    float th = atan(q.y, q.x);
    float n = fbm(q * 2.2, 1.3);
    float arms = 0.5 + 0.5 * cos(2.0 * th - 5.5 * log(r + 0.02) + 1.6 * n);
    arms = pow(arms, 2.2);
    float disk = exp(-r / 0.55);
    float dust = smoothstep(-0.2, 0.5, fbm(q * 4.0, 7.7));
    col += cA * disk * (0.2 + 1.3 * arms) * (0.5 + 0.5 * dust) * 1.3;
    col += cB * exp(-r / 0.9) * 0.18;
    col += cCore * (exp(-r * r / 0.012) * 1.6 + exp(-r / 0.12) * 0.5);
    // faint diffuse glow band
    col += cA * exp(-abs(q.y) / 0.35) * exp(-abs(q.x) / 1.4) * 0.08;
  } else {
    // violet-pink nebula: fractal clouds
    float n1 = fbm(p * 1.6, 2.1);
    float n2 = fbm(p * 2.4 + vec2(n1 * 0.6, -n1 * 0.4), 5.3);
    float n3 = fbm(p * 1.1 + 3.0, 9.1);
    float cloudA = smoothstep(-0.35, 0.65, n1 + 0.25 * n2);
    float cloudB = smoothstep(-0.05, 0.75, n2 + 0.35 * n3 - 0.1 * length(p));
    col += cA * cloudA * 0.85;
    col += cB * cloudB * cloudA * 0.9;
    col += cCore * pow(cloudB * cloudA, 3.0) * 0.6;
  }

  // layers of bokeh stars (several sizes)
  col += bokeh(p, 7.0, 1.0, 0.014, 0.036, 0.35, 0.10);
  col += bokeh(p, 14.0, 13.0, 0.008, 0.020, 0.4, 0.10);
  col += bokeh(p, 26.0, 41.0, 0.004, 0.010, 0.45, 0.09);

  gl_FragColor = vec4(col, 1.0);
}
`;

export const renderBackground = (gl: THREE.WebGLRenderer, colors: BackgroundColors, w: number, h: number) => {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
  });
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uAspect: { value: w / h },
      uKind: { value: colors.kind === "galaxy" ? 0 : 1 },
      cBase: { value: new THREE.Vector3(...colors.base) },
      cA: { value: new THREE.Vector3(...colors.a) },
      cB: { value: new THREE.Vector3(...colors.b) },
      cCore: { value: new THREE.Vector3(...colors.core) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  gl.setRenderTarget(rt);
  gl.render(scene, cam);
  gl.setRenderTarget(null);
  mat.dispose();
  quad.geometry.dispose();
  return rt;
};
