import * as THREE from "three";
import { hexToLinear } from "../../lib/color";
import { HASH } from "../../lib/glsl";

export const MAX_NEURONS = 96;

/**
 * Glossy silver-grey neuron shading with a soft rim light, no colour.
 * Growth: vertices collapse onto their tube axis until their growth time.
 * Flash: per-neuron emissive pulse (uniform array) falling off with the
 * distance from the soma. Kind-specific flashes for anatomy (terminals).
 */
export const neuronMaterial = (opts: { silver: string; translucentSoma?: boolean }) => {
  const [r, g, b] = hexToLinear(opts.silver);
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uSilver: { value: new THREE.Vector3(r, g, b) },
      uTime: { value: 1e6 },
      uFlash: { value: new Float32Array(MAX_NEURONS) },
      uTerminalFlash: { value: 0 },
      uFade: { value: 1 },
      uSomaAlpha: { value: 1 },
      uSomaScale: { value: 1 },
      uDim: { value: 1 },
      uFibre: { value: 1 },
      uViewportH: { value: 2160 },
    },
    vertexShader: /* glsl */ `
precision highp float;
in vec3 position;
in vec3 normal;
in vec3 aCenter;
in vec4 aInfo;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform float uTime;
uniform float uFlash[${MAX_NEURONS}];
uniform float uTerminalFlash;
uniform float uSomaScale;
uniform float uViewportH;
out float vThin;
out vec3 vN;
out vec3 vV;
out float vGlow;
out float vKind;
out vec3 vLocal;
void main() {
  float grow = smoothstep(aInfo.z, aInfo.z + 0.35, uTime);
  vec3 p = aCenter + (position - aCenter) * grow;
  // Not yet grown: sit on the axis just behind the growth front.
  if (uTime < aInfo.z) p = aCenter;
  if (aInfo.w < 0.5 || aInfo.w > 4.5) p = aCenter + (p - aCenter) * uSomaScale;
  vLocal = position - aCenter;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // Fibres thinner than ~0.6 device px are widened to that and dimmed by
  // the same factor, so they read as fine, continuous lines at any size.
  vThin = 1.0;
  if (aInfo.w > 0.5 && aInfo.w < 4.5) {
    vec4 mc = modelViewMatrix * vec4(aCenter, 1.0);
    float r = length(p - aCenter);
    float rpx = r * projectionMatrix[1][1] * 0.5 * uViewportH / max(1e-4, -mc.z);
    if (rpx > 1e-6 && rpx < 0.6) {
      float k = 0.6 / rpx;
      mv = mc + (mv - mc) * k;
      vThin = rpx / 0.6;
    }
  }
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  int id = int(aInfo.x + 0.5);
  vGlow = uFlash[id] * exp(-aInfo.y / 0.12) * (aInfo.w < 0.5 ? 1.0 : 0.6);
  if (aInfo.w > 3.5 && aInfo.w < 4.5) vGlow += uTerminalFlash;
  vKind = aInfo.w;
  gl_Position = projectionMatrix * mv;
}
`,
    fragmentShader: /* glsl */ `
precision highp float;
uniform vec3 uSilver;
uniform float uFade;
uniform float uSomaAlpha;
uniform float uDim;
uniform float uFibre;
in vec3 vN;
in vec3 vV;
in float vGlow;
in float vThin;
in float vKind;
in vec3 vLocal;
out vec4 outColor;
${HASH}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  if (!gl_FrontFacing) N = -N;
  float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
  vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
  vec3 L2 = normalize(vec3(0.6, -0.3, 0.4));
  float diff = max(dot(N, L), 0.0);
  float diff2 = max(dot(N, L2), 0.0);
  float rim = pow(1.0 - ndv, 2.2);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 48.0);
  float spec2 = pow(max(dot(N, normalize(L2 + V)), 0.0), 24.0);
  // Subtle inner shade: the centre of a body reads darker than its rim.
  vec3 col = uSilver * (0.16 + 0.5 * diff + 0.14 * diff2) * mix(0.6, 1.0, rim);
  col += uSilver * rim * 0.85;
  col += vec3(spec * 0.3 + spec2 * 0.12);
  bool isSoma = vKind < 0.5;
  bool isNucleus = vKind > 4.5;
  if (isNucleus) col *= 1.25;
  if (vKind > 2.5 && vKind < 3.5) col *= 1.4; // myelin reads lighter than the bare axon
  if (!isSoma && !isNucleus) col *= uFibre;
  col *= uDim;
  col += vec3(vGlow);
  col *= vThin;
  float a = isSoma ? mix(uSomaAlpha, 1.0, rim) : 1.0;
  outColor = vec4(col * uFade * a, a * uFade);
}
`,
  });
};

/** Additive glow sprites (signals, sparkles). Size in composition px at 4K. */
export const sparkMaterial = (px: number) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { uPx: { value: px }, uViewH: { value: 2160 } },
    transparent: true,
    // Sparks ride inside the fibres, so they must not be hidden by them.
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
precision highp float;
in vec3 position;
in vec2 aSpark; // intensity, size (4K px at 1 world unit distance)
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uPx;
out float vI;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = aSpark.y / max(0.05, -mv.z);
  gl_PointSize = max(2.0, size * uPx);
  vI = aSpark.x * min(1.0, size * uPx / 2.0);
}
`,
    fragmentShader: /* glsl */ `
precision highp float;
in float vI;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 >= 1.0) discard;
  // Hot core plus a soft halo that reaches exactly zero at the edge.
  float halo = (1.0 - r2) * (1.0 - r2);
  float core = exp(-r2 * 28.0);
  float v = vI * (0.35 * halo * halo + 1.4 * core);
  outColor = vec4(vec3(v), 1.0); // AdditiveBlending is SRC_ALPHA, ONE
}
`,
  });

/** Dynamic point buffer for sparks: write positions/intensities per frame. */
export class SparkBuffer {
  geo = new THREE.BufferGeometry();
  pos: Float32Array;
  attr: Float32Array;
  n = 0;
  constructor(public max: number) {
    this.pos = new Float32Array(max * 3);
    this.attr = new Float32Array(max * 2);
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("aSpark", new THREE.BufferAttribute(this.attr, 2));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  }
  reset() {
    this.n = 0;
  }
  push(p: [number, number, number], intensity: number, size: number) {
    if (this.n >= this.max || intensity <= 0) return;
    this.pos.set(p, this.n * 3);
    this.attr[this.n * 2] = intensity;
    this.attr[this.n * 2 + 1] = size;
    this.n++;
  }
  commit() {
    (this.geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("aSpark") as THREE.BufferAttribute).needsUpdate = true;
    this.geo.setDrawRange(0, this.n);
  }
}
