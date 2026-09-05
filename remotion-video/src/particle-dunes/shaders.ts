import { DUNE_FIELD_GLSL, DUNE_AMPLITUDE, FIELD_PERIOD } from "./field";
import {
  AMBIENT,
  COC_MAX_PX_4K,
  DIFFUSE,
  FUZZ_EXPONENT,
  FUZZ_HEIGHT,
  G_FAR,
  G_NEAR,
  GRAIN_PX_4K,
  GRAZE_COMPENSATION,
  LIGHT_EXPONENT,
  OCCLUDER_SINK,
  OVERDRIVE,
  REF_DEPTH,
  RIM_STRENGTH,
  SHIMMER_AMOUNT,
  SHIMMER_CYCLES,
  SHIMMER_FRACTION,
  WRAP_FADE,
} from "./constants";

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/**
 * Cheap screen-space hash, used as film grain. Also acts as a dither: the
 * troughs sit only a few 8-bit levels above black, which is exactly where
 * H.264 likes to band, and a little noise there breaks the contours up.
 */
const GRAIN_GLSL = /* glsl */ `
uniform float uGrainSeed;
uniform float uGrainAmount;
float dunesGrain(vec2 fragXY) {
  vec3 p = vec3(fragXY, uGrainSeed);
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453) - 0.5;
}
`;

const COMMON = /* glsl */ `
#define DUNES_PERIOD ${f(FIELD_PERIOD)}
#define DUNES_G_NEAR ${f(G_NEAR)}
#define DUNES_G_FAR ${f(G_FAR)}
#define DUNES_TAU 6.283185307179586
`;

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------
export const PARTICLE_VERTEX = /* glsl */ `
precision highp float;

${COMMON}
${DUNE_FIELD_GLSL}

uniform float uT;          // loop phase, 0..1
uniform float uPixel;      // physical pixels per 4K pixel
uniform vec3  uLightDir;
uniform float uFocusDist;
uniform float uCocK;
uniform float uFogStart;
uniform float uFogEnd;
uniform vec3  uColShadow;
uniform vec3  uColMid;
uniform vec3  uColLit;
uniform float uExposure;

attribute vec4 aRand;

varying vec3 vColor;
varying float vSharp;

void main() {
  // Ground distance ahead of the camera, wrapped into one field period. The
  // camera advances exactly DUNES_PERIOD over the loop, so every particle
  // wraps exactly once and lands on identical terrain.
  float g0 = -position.z;
  float g = DUNES_G_NEAR + mod(g0 - DUNES_G_NEAR - DUNES_PERIOD * uT, DUNES_PERIOD);

  // World z is fixed for the life of a particle: the camera moves past it,
  // and the wrap shifts it by a whole period, which the field cannot tell
  // apart. Only the drifting layers of the field animate underneath it.
  vec2 world = vec2(position.x, -g0);

  const float EPS = 0.035;
  float h  = dunesHeight(world, uT);
  float hx = dunesHeight(world + vec2(EPS, 0.0), uT);
  float hz = dunesHeight(world + vec2(0.0, EPS), uT);
  vec3 n = normalize(vec3(-(hx - h) / EPS, 1.0, -(hz - h) / EPS));

  // A soft fuzzy skin rather than a hard shell: grains stack above the
  // surface, packed toward it, thinning out at the top.
  float fuzz = ${f(FUZZ_HEIGHT)} * pow(aRand.x, ${f(FUZZ_EXPONENT)});
  vec4 mv = modelViewMatrix * vec4(position.x, h + fuzz, -g, 1.0);
  float depth = max(-mv.z, 0.001);
  gl_Position = projectionMatrix * mv;

  // --- size and depth of field ---
  // Per-particle circle of confusion, straight from the thin-lens relation.
  // Each grain becomes its own soft disc, so the blur varies continuously
  // with depth instead of stepping between layers.
  float ideal = ${f(GRAIN_PX_4K)} * ${f(REF_DEPTH)} / depth * (0.86 + 0.28 * aRand.y);
  float coc = min(uCocK * abs(1.0 / depth - 1.0 / uFocusDist), ${f(COC_MAX_PX_4K)});
  float want = sqrt(ideal * ideal + coc * coc) * uPixel;
  float size = max(want, 1.0);
  gl_PointSize = size;

  // 1 when the grain is resolved, falling to 0 as its disc opens up.
  vSharp = clamp((ideal * uPixel) / size, 0.0, 1.0);

  // Spreading a grain over a wider disc must not brighten it: hold its total
  // light constant so defocused crests go soft, not blotchy. The same factor
  // supplies the inverse-square falloff, because 'ideal' already scales as
  // 1/depth -- and it corrects for the 1px floor the rasteriser imposes.
  float energy = (ideal * uPixel) * (ideal * uPixel) / (size * size);

  // Cancel the edge-on pile-up (see GRAZE_COMPENSATION).
  vec3 nView = normalize(normalMatrix * n);
  float ndotv = abs(dot(nView, normalize(-mv.xyz)));
  energy *= mix(1.0, clamp(ndotv, 0.10, 1.0), ${f(GRAZE_COMPENSATION)});

  // --- shading ---
  float lam = max(dot(n, uLightDir), 0.0);
  float shade = ${f(AMBIENT)} + ${f(DIFFUSE)} * pow(lam, ${f(LIGHT_EXPONENT)});

  // Bright rim along the sharpest lit ridges: high ground, facing the light.
  float hn = clamp(h / ${f(DUNE_AMPLITUDE)} * 0.5 + 0.5, 0.0, 1.0);
  shade += ${f(RIM_STRENGTH)} * smoothstep(0.42, 0.95, hn) * pow(lam, 2.0);

  // Grains standing proud of the surface catch more light -- this is what
  // gives the skin its velvet sheen instead of reading as a flat plane. Only
  // where grains are actually resolved, though: once a grain is a wide bokeh
  // disc, per-grain brightness differences stop reading as texture and start
  // reading as a handful of stray bright blobs floating over the blur.
  float perGrain = mix(0.70, 1.34, aRand.x);
  // A small fraction shimmer, on staggered cycles that close over the loop.
  float shimmering = step(aRand.w, ${f(SHIMMER_FRACTION)});
  perGrain *= 1.0 + shimmering * ${f(SHIMMER_AMOUNT)}
    * sin(DUNES_TAU * (${f(SHIMMER_CYCLES)} * uT + aRand.z));
  shade *= mix(1.0, perGrain, vSharp);

  float s = clamp(shade, 0.0, 1.0);
  vec3 col = s < 0.5
    ? mix(uColShadow, uColMid, s * 2.0)
    : mix(uColMid, uColLit, (s - 0.5) * 2.0);
  // Anything past full brightness pushes toward clipping, so the hottest
  // crests blow out rather than flattening at the top of the ramp.
  col *= 1.0 + max(shade - 1.0, 0.0) * ${f(OVERDRIVE)};

  // The far field falls into darkness long before the geometry ends, so there
  // is no horizon and no visible edge to the world.
  float fade = 1.0 - smoothstep(uFogStart, uFogEnd, depth);
  // Fade both wrap seams so nothing pops as it crosses.
  fade *= smoothstep(DUNES_G_NEAR, DUNES_G_NEAR + ${f(WRAP_FADE)}, g);
  fade *= 1.0 - smoothstep(DUNES_G_FAR - ${f(WRAP_FADE)}, DUNES_G_FAR, g);

  vColor = col * energy * fade * uExposure;
}
`;

export const PARTICLE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vSharp;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  // In focus the grains read as short upright rods, the way the reference
  // does; as they defocus the bokeh relaxes back to a round disc.
  d.y *= mix(1.0, 0.80, vSharp);
  float r2 = dot(d, d);
  // Gaussian, offset so it reaches zero at the sprite edge -- no square
  // corners, no hard cut. exp(-0.25 * 11.0) is the value at r = 0.5.
  float a = max(exp(-r2 * 11.0) - 0.0639, 0.0);
  gl_FragColor = vec4(vColor * a, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Occluder shell
// ---------------------------------------------------------------------------
// A solid surface in the background colour that writes depth but no colour of
// its own. It is what makes near crests genuinely hide the dunes behind them
// instead of letting the far field add straight through them.
export const OCCLUDER_VERTEX = /* glsl */ `
precision highp float;

${COMMON}
${DUNE_FIELD_GLSL}

uniform float uT;
uniform vec3  uLightDir;
uniform float uFogStart;
uniform float uFogEnd;
uniform vec3  uColShadow;
uniform vec3  uColMid;
uniform vec3  uColLit;
uniform float uBaseStrength;

varying vec3 vBase;

void main() {
  float g = -position.z;
  // Camera-static lattice, so the terrain slides through it as the camera
  // travels: the world z here does move, unlike a particle's.
  float worldZ = -DUNES_PERIOD * uT - g;
  vec2 world = vec2(position.x, worldZ);

  const float EPS = 0.035;
  float h  = dunesHeight(world, uT);
  float hx = dunesHeight(world + vec2(EPS, 0.0), uT);
  float hz = dunesHeight(world + vec2(0.0, EPS), uT);
  vec3 n = normalize(vec3(-(hx - h) / EPS, 1.0, -(hz - h) / EPS));

  vec4 mv = modelViewMatrix * vec4(position.x, h - ${f(OCCLUDER_SINK)}, -g, 1.0);
  gl_Position = projectionMatrix * mv;

  // Same light and ramp as the grains, so the shell reads as the packed base
  // of the same material rather than a separate surface underneath it.
  float lam = max(dot(n, uLightDir), 0.0);
  // Deliberately flatter than the grains: the shell is a fill that keeps the
  // dunes from reading as floating dust, so it must not out-contrast the
  // layer it is filling behind.
  float shade = clamp(
    ${f(AMBIENT)} + ${f(DIFFUSE)} * pow(lam, ${f(LIGHT_EXPONENT)}), 0.0, 1.0
  ) * 0.78;
  vec3 col = shade < 0.5
    ? mix(uColShadow, uColMid, shade * 2.0)
    : mix(uColMid, uColLit, (shade - 0.5) * 2.0);

  float depth = max(-mv.z, 0.001);
  float fade = 1.0 - smoothstep(uFogStart, uFogEnd, depth);
  vBase = col * fade * uBaseStrength;
}
`;

export const OCCLUDER_FRAGMENT = /* glsl */ `
precision highp float;
${GRAIN_GLSL}
uniform vec3 uBackground;
varying vec3 vBase;
void main() {
  gl_FragColor = vec4(
    uBackground + vBase + dunesGrain(gl_FragCoord.xy) * uGrainAmount, 1.0
  );
}
`;

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------
// Drawn first, behind everything, carrying the same grain as the occluder so
// the dither is uniform across the frame rather than stopping at the skyline.
export const BACKGROUND_VERTEX = /* glsl */ `
precision highp float;
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BACKGROUND_FRAGMENT = /* glsl */ `
precision highp float;
${GRAIN_GLSL}
uniform vec3 uBackground;
void main() {
  gl_FragColor = vec4(uBackground + dunesGrain(gl_FragCoord.xy) * uGrainAmount, 1.0);
}
`;
