import { GLSL_COMMON } from "./common";

/**
 * "Caustic Bloom" - defocused light caustics converging on a drifting cusp.
 *
 * Polar coordinates are taken around a focus point that drifts on a closed
 * Lissajous path. An angular harmonic series generates the ray lobes, and an
 * angular warp bends them into the fold/cusp shape. Everything is built from
 * low-frequency terms, so the softness is intrinsic rather than a blur pass -
 * which is both cheaper and cleaner than blurring after the fact.
 *
 * As with the silk shader, all temporal frequencies are integers, so the loop
 * closes exactly.
 */
export const CAUSTIC_BLOOM_FRAG = /* glsl */ `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform float uPhase;       // 0 -> 1 across the loop
uniform vec2  uResolution;
uniform vec3  uWarm;        // dominant warm pole
uniform vec3  uCool;        // dominant cool pole
uniform vec3  uGlow;        // caustic highlight colour
uniform float uSeed;
uniform float uWarmBias;    // pushes the warm/cool split; 0.5 = balanced
uniform float uStreak;      // strength of the sweeping specular streak

${GLSL_COMMON}

void main(void) {
  vec2 uv = vTextureCoord;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.0;

  float ph = uPhase;
  float a1 = TAU * ph;

  // Focus drifts on a closed path, sitting right of centre like the reference.
  vec2 focus = vec2(0.30, 0.04)
    + vec2(0.20 * cos(a1 + uSeed), 0.14 * sin(a1 + uSeed * 0.7))
    + vec2(0.08 * cos(2.0 * a1 + 1.1), 0.07 * sin(3.0 * a1 + 0.4));

  vec2 q = p - focus;
  float r = length(q);
  float th = atan(q.y, q.x);

  // Angular warp: bends the straight ray fan into a folded caustic. Ramped in
  // with r so the cusp itself stays tight while the outer field swirls.
  float bend = smoothstep(0.0, 1.5, r);
  th += bend * (0.62 * sin(2.0 * th + a1 + uSeed)
              + 0.26 * sin(3.0 * th - 2.0 * a1));

  // Angular harmonics with a radial phase term. The radial term is what turns
  // a flat starburst into folded light sheets: each lobe shears as it travels
  // outward, so the rays read as creased surfaces rather than spokes.
  float rays =
      0.60 * cos(2.0 * th + 1.30 * r + a1)
    + 0.38 * cos(3.0 * th - 0.95 * r - a1 + 1.7 + uSeed)
    + 0.24 * cos(5.0 * th + 1.70 * r + 2.0 * a1 + 0.4)
    + 0.13 * cos(7.0 * th - 2.20 * r - 2.0 * a1 + 2.2)
    // Fine striation, held to the mid and outer field so it does not crowd
    // the cusp. This is the detail that stops the lobes reading as plain
    // airbrush gradients.
    + 0.07 * cos(11.0 * th + 2.9 * r + 3.0 * a1 + uSeed) * smoothstep(0.25, 1.0, r);

  // Rays intensify toward the focus. The constant term is deliberately large
  // so there is no singularity at r = 0 - a real caustic cusp is a soft fold,
  // not a point light.
  float conv = 1.0 / (0.70 + r * 0.75);
  float falloff = mix(0.65, 1.0, exp(-r * 0.35));

  // atan() is undefined at the origin and every angular harmonic collapses
  // there, which shows up as a hard pinwheel pixel. Fading the angular term
  // out below r = 0.4 removes it and leaves the smooth fold we actually want.
  float rayMask = smoothstep(0.0, 0.40, r);

  float caustic = rays * conv * falloff * rayMask;

  // Broad warm/cool split on a slowly rotating axis, with a secondary ripple
  // so the terminator between the two poles is not a straight line.
  vec2 gdir = vec2(cos(a1 * 1.0 + 2.25 + uSeed), sin(a1 * 1.0 + 2.25 + uSeed));
  float g = dot(p, gdir) * 0.62 + uWarmBias;
  g += 0.26 * sin(dot(p, vec2(-gdir.y, gdir.x)) * 1.85 + 2.0 * a1);
  g += 0.14 * sin(dot(p, gdir) * 3.1 - a1);
  g += 0.09 * sin(dot(p, vec2(-gdir.y, gdir.x)) * 4.3 + 3.0 * a1 + uSeed);
  g = clamp(g, 0.0, 1.0);

  vec3 warm = toLinear(uWarm);
  vec3 cool = toLinear(uCool);
  vec3 glow = toLinear(uGlow);

  vec3 col = mix(warm, cool, smoothstep(0.08, 0.92, g));

  // Caustic drives exposure rather than being added flat - keeps the hue of
  // the underlying gradient instead of washing everything toward white.
  float lum = 0.5 + 0.5 * caustic;
  col *= 0.52 + 0.94 * lum;

  // Only the strongest lobes bloom out toward the highlight colour.
  col += glow * pow(max(caustic, 0.0), 3.0) * 0.20;

  // Soft focal swell. Kept low: the reference brightens around the cusp, it
  // does not put a hotspot there.
  float core = exp(-r * r * 4.5);
  col += glow * core * 0.13;

  // Thin specular streak sweeping through the cusp, gated by a periodic
  // envelope so it flares and fades rather than sitting there constantly.
  float sa = a1 * 2.0 + 0.9 + uSeed;
  vec2 sdir = vec2(cos(sa), sin(sa));
  float perp = abs(dot(q, vec2(-sdir.y, sdir.x)));
  float along = max(0.0, dot(normalize(q + 1e-5), sdir));
  float env = smoothstep(0.45, 0.98, sin(TAU * 2.0 * ph + uSeed) * 0.5 + 0.5);
  float streak = exp(-perp * perp * 150.0) * exp(-r * 0.95) * along * env;

  // Slight chromatic split on the streak - reads as real lens dispersion.
  col.r += glow.r * streak * uStreak * 1.10;
  col.g += glow.g * streak * uStreak * 0.92;
  col.b += glow.b * streak * uStreak * 1.18;

  // Very light corner falloff. The references are essentially full-bleed, so
  // this is only enough to stop the frame edges reading flat.
  vec2 vq = (uv - 0.5) * vec2(aspect * 0.72, 1.0);
  col *= mix(0.80, 1.0, smoothstep(1.35, 0.30, length(vq)));

  col = tonemap(col * 1.00);
  col = toGamma(col);
  col = dither(col, gl_FragCoord.xy, uPhase);

  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
