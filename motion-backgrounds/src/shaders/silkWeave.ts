import { GLSL_COMMON } from "./common";

/**
 * "Silk Weave" - billowing satin drape.
 *
 * Height field = sum of directional travelling waves whose directions are
 * *clustered* around one dominant diagonal rather than spread evenly. That
 * clustering is what makes the result read as draped cloth (long parallel-ish
 * folds) instead of isotropic turbulence. A gentle single-stage domain warp
 * bends those folds without shattering them.
 *
 * Surface normals come from central differences of the height; two Blinn-Phong
 * lobes - one moderately tight for the ridge line, one very broad for the
 * sheen falloff either side of it - give the satin specular.
 *
 * Every temporal term is sin/cos of TAU * (integer) * uPhase, so the field is
 * exactly 1-periodic and the loop closes with no seam.
 */
export const SILK_WEAVE_FRAG = /* glsl */ `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform float uPhase;       // 0 -> 1 across the loop
uniform vec2  uResolution;  // render target size in px
uniform vec3  uDeep;        // shadow / trough colour
uniform vec3  uMid;         // body colour
uniform vec3  uBright;      // specular + core glow colour
uniform float uSeed;        // decorrelates the two colourways
uniform float uWeaveAmount; // strength of the diagonal screen
uniform float uVignette;    // 0 = none, 1 = heavy

${GLSL_COMMON}

// Dominant drape direction: folds run roughly top-left to bottom-right.
const float BASE_ANGLE = -0.62;

// Four octaves, directions clustered within about +/-0.5 rad of BASE_ANGLE.
float waveSum(vec2 p, float phase, float seed) {
  float h = 0.0;
  float amp = 1.0;
  float freq = 1.0;
  float norm = 0.0;

  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float ang = BASE_ANGLE + (fi - 2.0) * 0.46 + seed * 0.27;
    vec2 dir = vec2(cos(ang), sin(ang));
    float tw = 1.0 + mod(fi + seed, 2.0);        // integer: 1 or 2
    h += amp * sin(dot(p, dir) * freq * 1.55 + TAU * tw * phase + fi * 1.61 + seed);
    norm += amp;
    amp *= 0.57;
    freq *= 1.58;
  }
  return h / norm;
}

// Gentle domain warp - enough to make folds meander, not enough to break them.
vec2 warp(vec2 p, float phase, float seed) {
  float wx = waveSum(p * 0.55 + vec2(2.9, 1.4), phase, seed + 11.0);
  float wy = waveSum(p * 0.55 + vec2(-2.1, 4.7), phase, seed + 23.0);
  return p + 0.50 * vec2(wx, wy);
}

float height(vec2 p, float phase, float seed) {
  return waveSum(warp(p, phase, seed), phase, seed + 3.0);
}

void main(void) {
  vec2 uv = vTextureCoord;
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.45;

  float phase = uPhase;
  float h = height(p, phase, uSeed);

  // Normals. The gradient scale is deliberately modest: large scale means
  // chrome, small means cloth.
  float e = 0.008;
  float hx = height(p + vec2(e, 0.0), phase, uSeed) - height(p - vec2(e, 0.0), phase, uSeed);
  float hy = height(p + vec2(0.0, e), phase, uSeed) - height(p - vec2(0.0, e), phase, uSeed);
  vec3 n = normalize(vec3(-hx * 1.15, -hy * 1.15, e * 2.0));

  vec3 viewDir = vec3(0.0, 0.0, 1.0);

  // Key light, high and to the left.
  vec3 l1 = normalize(vec3(-0.40, 0.66, 0.64));
  vec3 h1 = normalize(l1 + viewDir);
  float ndh = max(dot(n, h1), 0.0);
  float ridge = pow(ndh, 44.0);   // the bright fold line
  float sheen = pow(ndh, 2.6);    // satin falloff either side of it

  // Weak counter-rim so the troughs keep some shape.
  vec3 l2 = normalize(vec3(0.62, -0.30, 0.72));
  float rim = pow(max(dot(n, normalize(l2 + viewDir)), 0.0), 9.0);

  vec3 deep = toLinear(uDeep);
  vec3 mid = toLinear(uMid);
  vec3 bright = toLinear(uBright);

  // Body ramp: most of the frame sits dark, opening up on the crests.
  float body = smoothstep(-0.80, 0.72, h);
  vec3 col = mix(deep, mid, body);

  // Soft core glow above centre - the references all have a clear hot spot
  // there with the cloth falling away into darkness around it.
  vec2 cq = (uv - vec2(0.50, 0.60)) * vec2(aspect, 1.0);
  float core = exp(-dot(cq, cq) * 2.2);
  col += mid * core * 0.62;
  col += bright * core * 0.12;

  col += bright * ridge * 0.52;
  col += bright * sheen * 0.19;
  col += bright * rim * 0.10;

  // Heavy elliptical vignette.
  vec2 vq = (uv - 0.5) * vec2(aspect * 0.80, 1.0);
  float vig = smoothstep(1.02, 0.12, length(vq));
  col *= mix(1.0, mix(0.05, 1.0, vig), uVignette);

  col = tonemap(col * 1.02);
  col = toGamma(col);

  // Fine 45-degree weave screen, in UV space so the pitch is identical at
  // 1080p and 4K. Luminance-gated: the weave only shows where light lands.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float screen = sin((uv.x * aspect + uv.y) * TAU * 215.0);
  col *= 1.0 + screen * uWeaveAmount * smoothstep(0.02, 0.45, lum);

  col = dither(col, gl_FragCoord.xy, uPhase);

  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
