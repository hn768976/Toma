import { GRAIN_GLSL, VALUE_NOISE_GLSL } from "../lib/glsl";

// Paper plane: map texture times procedural paper (fibres, stains, creases).
export const paperVertex = /* glsl */ `
in vec3 position;
in vec2 uv;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 uUvMin;
uniform vec2 uUvMax;
uniform vec2 uPaperOrigin;
uniform float uViewWidth;
out vec2 vUv;
out vec2 vPaper;
void main() {
  vUv = mix(uUvMin, uUvMax, uv);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPaper = (world.xy - uPaperOrigin) / uViewWidth;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const paperFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec2 vPaper;
uniform sampler2D uMap;
uniform vec4 uCreases[4]; // xy = unit normal, z = offset, w = strength
out vec4 outColor;
${VALUE_NOISE_GLSL}
void main() {
  vec3 c = texture(uMap, vUv).rgb;
  vec2 p = vPaper;
  float px = max(fwidth(p.x), fwidth(p.y));

  // fine paper fibres, faded out where they would alias
  float fibreFade = 1.0 - smoothstep(0.12, 0.45, 420.0 * px);
  float fib = vnoise(p * vec2(420.0, 95.0)) * 0.6 + vnoise(p * vec2(160.0, 700.0) + 5.0) * 0.4;
  float paper = 1.0 + (fib - 0.5) * 0.10 * fibreFade;
  // medium grain that survives at preview size
  paper *= 1.0 + (vnoise(p * 140.0 + 3.0) - 0.5) * 0.05 * (1.0 - smoothstep(0.2, 0.6, 140.0 * px));

  // soft stains: broad tea-coloured blotches with darker rims
  float st = vfbm(p * 2.2 + vec2(7.3, 1.1));
  float stain = smoothstep(0.48, 0.7, st);
  float rim = smoothstep(0.50, 0.53, st) * (1.0 - smoothstep(0.53, 0.58, st));
  vec3 tint = mix(vec3(1.0), vec3(0.84, 0.72, 0.58), stain * 0.8);
  tint *= 1.0 - rim * 0.06;
  // a few lighter worn patches
  float worn = smoothstep(0.62, 0.8, vfbm(p * 3.1 + vec2(-4.0, 9.0)));
  tint = mix(tint, tint * vec3(1.06, 1.05, 1.03), worn * 0.6);

  // creases: thin dark fold with a lit edge beside it
  for (int i = 0; i < 4; i++) {
    vec4 cr = uCreases[i];
    float d = dot(p, cr.xy) - cr.z;
    float w = 0.0016 + 0.0006 * vnoise(vec2(dot(p, vec2(-cr.y, cr.x)) * 40.0, float(i)));
    float fold = exp(-pow(d / w, 2.0));
    float lit = exp(-pow((d - 2.2 * w) / (1.6 * w), 2.0));
    tint *= 1.0 - fold * 0.16 * cr.w;
    tint *= 1.0 + lit * 0.05 * cr.w;
  }
  // dust specks and fine scratches printed into the paper
  float speck = smoothstep(0.82, 0.95, vnoise(p * 900.0)) * (1.0 - smoothstep(0.2, 0.5, 900.0 * px));
  speck += smoothstep(0.9, 0.99, vnoise(p * 380.0 + 13.0)) * (1.0 - smoothstep(0.2, 0.5, 380.0 * px));
  vec2 sp = mat2(0.8, -0.6, 0.6, 0.8) * p;
  float scratch = smoothstep(0.985, 1.0, vnoise(vec2(sp.x * 6.0, sp.y * 1400.0))) * smoothstep(0.55, 0.8, vnoise(sp * 9.0));
  scratch *= 1.0 - smoothstep(0.3, 0.8, 1400.0 * px);
  vec3 outc = c * paper * tint;
  outc = mix(outc, vec3(0.95, 0.88, 0.76), clamp(speck * 0.55 + scratch * 0.5, 0.0, 0.8));
  outColor = vec4(outc, 1.0);
}
`;

// Final pass: tilt-shift depth of field, warm light, vignette, exposure
// breathing, grain and dither.
export const postVertex = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const postFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform vec3 uFwd;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec2 uTanHalf;
uniform float uFocusDepth;
uniform vec4 uBand; // near band edge, far band edge, bottom of frame, top of frame (relative depth)
uniform vec2 uMaxBlur; // near, far (pixels)
uniform float uExposure;
uniform float uGrainFrame;
uniform float uGrainAmount;
out vec4 outColor;
${GRAIN_GLSL}

float relDepth(vec2 uv) {
  vec2 ndc = uv * 2.0 - 1.0;
  vec3 d = uFwd + uRight * ndc.x * uTanHalf.x + uUp * ndc.y * uTanHalf.y;
  float z = -uCamPos.z / d.z;
  return z / uFocusDepth - 1.0;
}

void main() {
  float rel = relDepth(vUv);
  float blur;
  if (rel > 0.0) {
    float t = smoothstep(uBand.y, uBand.w, rel);
    blur = uMaxBlur.y * pow(t, 1.3);
  } else {
    float t = smoothstep(-uBand.x, -uBand.z, -rel);
    blur = uMaxBlur.x * t;
  }
  // softer toward the left and right edges as well
  blur = max(blur, uMaxBlur.x * 0.8 * smoothstep(0.35, 0.5, abs(vUv.x - 0.5)));
  vec3 col;
  if (blur < 0.6) {
    col = texture(uScene, vUv).rgb;
  } else {
    const int N = 48;
    vec3 sum = vec3(0.0);
    float lod = log2(max(1.0, blur * 0.26));
    for (int i = 0; i < N; i++) {
      float r = blur * sqrt((float(i) + 0.5) / float(N));
      float a = float(i) * 2.39996323;
      vec2 o = vec2(cos(a), sin(a)) * r / uResolution;
      sum += textureLod(uScene, vUv + o, lod).rgb;
    }
    col = sum / float(N);
  }

  // warm light from the upper left
  vec2 q = vUv - 0.5;
  float light = dot(q, normalize(vec2(-1.0, 0.75)));
  col *= 1.0 + 0.03 * light;
  col *= mix(vec3(1.0), vec3(1.04, 1.0, 0.93), clamp(light + 0.3, 0.0, 1.0));

  float v = length(q * vec2(1.0, 0.82)) * 1.55;
  // soft bloom on the bright paper
  vec3 bloom = textureLod(uScene, vUv, 5.0).rgb;
  col += max(bloom - 0.55, 0.0) * 0.45;

  // heavy vignette toward a muted brown
  // darker toward the top (far side) and the left, as in the print
  // mostly a top-down falloff: dark far edge, bright foreground
  float vig = smoothstep(0.3, 1.15, v * 0.75 + max(q.y + 0.1, 0.0) * 0.9 + max(-q.x, 0.0) * 0.2);
  col *= mix(vec3(1.0), vec3(0.3, 0.2, 0.16), pow(vig, 1.25) * 0.95);

  // slight sepia grade
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  // faded print: lifted, desaturated blacks
  col = mix(col, lum * vec3(1.1, 0.94, 0.84), 0.18);
  col = col * 0.88 + vec3(0.085, 0.06, 0.06);
  // warm amber cast of an aged print
  col *= vec3(1.03, 0.99, 0.95);
  col *= uExposure;

  // print grain and dither
  float g = grainNoise(gl_FragCoord.xy, uGrainFrame);
  col += g * uGrainAmount * (0.35 + 0.65 * lum);
  col += ditherRGB(gl_FragCoord.xy, uGrainFrame);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
