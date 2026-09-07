import { FIELD_GLSL } from "./field";

/**
 * The plane is built directly in field units, so a vertex's object-space xy
 * is its field-space position and no extra mapping is needed. Displacement
 * is real geometry along z: the camera is locked and nearly head-on, so the
 * displacement contributes only a subtle parallax on the crests -- all of
 * the read comes from the normals, which the fragment stage recomputes
 * analytically at pixel resolution.
 */
export const VERTEX_GLSL = /* glsl */ `
precision highp float;

uniform mat4  projectionMatrix;
uniform mat4  modelViewMatrix;
uniform float uTime;
uniform float uAmp;

in vec3 position;

out vec2 vP;
out vec3 vPos;

${FIELD_GLSL}

void main() {
  vec2 p = position.xy;
  // detail = 0: the two finest octaves are finer than the tessellation and
  // would only alias here. The fragment stage adds them back per pixel.
  vec3 h = satinField(p, uTime, uAmp, 0.0);

  vec3 displaced = vec3(p, h.x);
  vP   = p;
  vPos = displaced;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

export const FRAGMENT_GLSL = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uAmp;
uniform vec3  uCamPos;

uniform vec3  uTrough;      // linear-light palette stops
uniform vec3  uBase;
uniform vec3  uHigh;

uniform vec3  uKeyDir;      // surface -> light
uniform float uKeyInt;
uniform vec3  uFillDir;
uniform float uFillInt;
uniform vec3  uFillTint;

uniform float uSpecInt;
uniform float uDiffuse;
uniform float uFillW;
uniform float uAmbient;
uniform float uWrap;
uniform float uBlack;
uniform float uContrast;
uniform float uShoulder;
uniform float uRough;
uniform float uRoughVar;
uniform float uAnisoRatio;
uniform float uFillTintMix;
uniform float uSheen;
uniform vec3  uSheenTint;

uniform float uWeave;
uniform float uGrain;
uniform float uVignette;
uniform vec2  uHalfExtent;  // visible frame half-size, in field units
uniform float uSeed;

in vec2 vP;
in vec3 vPos;

out vec4 fragColor;

${FIELD_GLSL}

/**
 * Anisotropic GGX normal distribution. at is the roughness along the
 * tangent (the fold axis), ab across it. Roughness smears the highlight in
 * the direction it applies to, so at > ab is what stretches the specular
 * into a long streak running down each crest. If the highlight comes out
 * round, the tangent is not wired to the fold axis.
 */
float ggxAniso(vec3 N, vec3 T, vec3 B, vec3 H, float at, float ab) {
  float ht = dot(H, T) / at;
  float hb = dot(H, B) / ab;
  float hn = dot(H, N);
  float d  = ht * ht + hb * hb + hn * hn;
  return 1.0 / (PI * at * ab * max(d * d, 1e-7));
}

float smithAniso(vec3 X, vec3 N, vec3 T, vec3 B, float at, float ab) {
  float xt = at * dot(X, T);
  float xb = ab * dot(X, B);
  float xn = dot(X, N);
  float l  = 0.5 * (-1.0 + sqrt(1.0 + (xt * xt + xb * xb) / max(xn * xn, 1e-7)));
  return 1.0 / (1.0 + max(l, 0.0));
}

float specular(vec3 N, vec3 V, vec3 L, vec3 T, vec3 B, float at, float ab) {
  float ndl = dot(N, L);
  float ndv = dot(N, V);
  if (ndl <= 0.0 || ndv <= 0.0) return 0.0;
  vec3  H = normalize(L + V);
  float D = ggxAniso(N, T, B, H, at, ab);
  float G = smithAniso(L, N, T, B, at, ab) * smithAniso(V, N, T, B, at, ab);
  float F = 0.045 + 0.955 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  return D * G * F * ndl / (4.0 * ndl * ndv);
}

// Three-stop palette ramp. Working through a ramp rather than accumulating
// raw radiance is what lets the graded stills land on the exact specified
// hex values at both ends of the range.
vec3 ramp(float x) {
  x = clamp(x, 0.0, 1.0);
  return x < 0.5 ? mix(uTrough, uBase, x * 2.0)
                 : mix(uBase, uHigh, (x - 0.5) * 2.0);
}

vec3 encodeSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92,
             1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
             step(0.0031308, c));
}

float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void main() {
  // --- surface ------------------------------------------------------
  vec3 h = satinField(vP, uTime, uAmp, 1.0);
  vec2 grad = h.yz;

  // Fabric weave: two thread directions at 45 degrees to the fold axis,
  // far below the fold scale. Barely there at 1080p, reads at 4K.
  vec2 w1 = normalize(FOLD + CROSS);
  vec2 w2 = normalize(FOLD - CROSS);
  float kw = 1256.0;
  // Attenuate the weave as it approaches the sampling limit, measured from
  // the actual screen-space footprint of a pixel. Undithered, this detail is
  // a moire generator at preview resolution; the attenuation is what keeps
  // the 1080p output clean. Measured: the weave is still present in the
  // spectrum at 1080p, at low amplitude -- "barely visible", not absent.
  float footprint = max(length(fwidth(vP)), 1e-6);
  float cyclesPerPixel = kw * footprint / TAU;
  float weave = uWeave * (1.0 - smoothstep(0.14, 0.34, cyclesPerPixel));
  grad += weave * cos(dot(w1 * kw, vP)) * w1;
  grad += weave * cos(dot(w2 * kw, vP)) * w2;

  vec3 N = normalize(vec3(-grad.x, -grad.y, 1.0));
  vec3 V = normalize(uCamPos - vPos);

  // Tangent follows the fold axis, projected into the tangent plane. If
  // this is wrong the highlight collapses to a round hotspot.
  vec3 t0 = vec3(FOLD, 0.0);
  vec3 T  = normalize(t0 - N * dot(N, t0));
  vec3 B  = cross(N, T);

  // --- roughness ----------------------------------------------------
  float rn    = roughnessNoise(vP, uTime);
  float rough = clamp(uRough + uRoughVar * rn, 0.06, 0.9);
  float at    = max(rough * uAnisoRatio, 0.02);
  float ab    = max(rough / uAnisoRatio, 0.012);

  // --- lights -------------------------------------------------------
  vec3 L1 = normalize(uKeyDir);
  vec3 L2 = normalize(uFillDir);

  // Wrapped diffuse. A hard N.L terminator under a grazing key tears the
  // folds into hard-edged shapes; wrapping models the soft falloff of a
  // broad source and keeps the shading continuous over each crest.
  float shape1 = clamp((dot(N, L1) + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  float shape2 = clamp((dot(N, L2) + uWrap) / (1.0 + uWrap), 0.0, 1.0);

  float spec1 = specular(N, V, L1, T, B, at, ab) * uKeyInt;
  float spec2 = specular(N, V, L2, T, B, at * 1.6, ab * 1.6) * uFillInt;

  // Fabric rim response: the folds glow faintly where they turn away.
  float ndv   = max(dot(N, V), 0.0);
  float sheen = pow(1.0 - ndv, 4.0) * (shape1 * 0.75 + shape2 * 0.25) * uSheen;

  // --- grade --------------------------------------------------------
  // The wrapped diffuse carries the broad fold shading; the specular adds
  // the bright streaks along the crests and drives the top of the range.
  float lum = uAmbient
            + uDiffuse * shape1 * uKeyInt
            + uFillW   * shape2 * uFillInt
            + (spec1 + spec2 * 0.6) * uSpecInt
            + sheen;

  // Levels, then contrast: put the darkest folds on the trough stop so the
  // palette's lower half is actually used rather than sitting on a pedestal.
  lum = max(lum - uBlack, 0.0) / (1.0 - uBlack);
  lum = pow(lum, uContrast);

  // Asymptotic shoulder -- rolls off toward 1.0 rather than clipping to a
  // flat plateau. No bloom: satin reflects, it does not glow.
  float k = uShoulder;
  if (lum > k) {
    lum = k + (1.0 - k) * (1.0 - exp(-(lum - k) / (1.0 - k)));
  }

  vec3 col = ramp(lum);
  col += uFillTint * (shape2 * uFillInt * uFillTintMix + spec2 * uSpecInt * 0.30);
  col += uSheenTint * sheen * 0.30;

  // --- output -------------------------------------------------------
  if (uVignette > 0.0) {
    // Framed from field-space position rather than a screen-space varying:
    // exact, and identical at 1080p and 4K.
    vec2 d = (vP / uHalfExtent) * vec2(0.5, 0.31);
    col *= 1.0 - uVignette * smoothstep(0.10, 0.62, dot(d, d));
  }

  vec3 outc = encodeSRGB(col);

  // Triangular-PDF dither. Huge near-black gradients are the worst case
  // H.264 has; this is what keeps the troughs from stepping.
  float r1 = hash12(gl_FragCoord.xy + uSeed);
  float r2 = hash12(gl_FragCoord.xy + uSeed + 91.7);
  outc += (r1 + r2 - 1.0) * uGrain;

  fragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
}
`;
