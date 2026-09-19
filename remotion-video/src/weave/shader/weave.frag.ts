/**
 * Procedural plain-weave fabric, rendered per frame on the GPU.
 *
 * The model is built the way real cloth is: two sets of threads (warp running
 * vertically, weft horizontally) laid on a dark ground, each thread a cylinder
 * with its own twist, slub (thickness drift) and shade. At every crossing the
 * parity of the cell decides which of the two passes over the other, which is
 * what a plain weave actually is -- so the checkerboard emerges from the model
 * instead of being drawn. Threads are composited by height, z-buffer style, so
 * the over/under relationship, the shadow the top thread casts into the dip
 * beside it, and the dark ground showing through the gaps all fall out for free.
 *
 * Nothing here is sampled from the reference clips; the references only supplied
 * the measurements (thread pitch, contrast, luminance, step cadence) that the
 * presets are tuned to.
 */
export const weaveFragmentShader = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

// ---- framing -------------------------------------------------------------
uniform vec2  uAspect;        // (1, height/width) so cells stay square
uniform float uThreads;       // warp threads across the frame width
uniform float uPixelScale;    // one output pixel, in cell units (for AA/SSAA)

// ---- per-state (the "boil") ---------------------------------------------
uniform vec2  uJitter;        // offset into the cloth, in cell units
uniform float uSeed;          // reseeds fuzz + grain for this state
uniform float uStateExposure; // tiny per-state exposure drift

// ---- cloth ---------------------------------------------------------------
uniform float uThreadWidth;   // thread coverage of its cell, 0..1
uniform float uWeftWidth;     // weft coverage (uneven weaves differ per axis)
uniform float uTwistAmp;      // twist bump depth
uniform float uTwistFreq;     // twist bumps per cell along a thread
uniform float uSlub;          // per-thread thickness drift
uniform float uWander;        // waviness of the thread paths
uniform float uWanderScale;   // frequency of that waviness, in 1/cells
uniform float uThreadShade;   // per-thread brightness spread
uniform float uFuzz;          // fibre fuzz on the thread surface
uniform float uFuzzScale;     // fuzz frequency
uniform float uParityBias;    // how far the over-thread sits above the under

// ---- look ---------------------------------------------------------------
uniform vec3  uWarpColor;
uniform vec3  uWeftColor;
uniform vec3  uGroundColor;   // what shows through the gaps
uniform vec2  uLightDir;      // normalised, in cell space
uniform float uLightHeight;   // z of the light vector
uniform float uAmbient;
uniform float uDiffuse;
uniform float uSpecular;
uniform float uShininess;
uniform float uOcclusion;     // darkening of the under-thread
uniform float uAxisContrast;  // how much thread direction drives brightness
uniform float uRelief;        // normal z: low = domed threads, high = flat
uniform float uExposure;
uniform float uContrast;
uniform float uLift;          // black lift, keeps the whites from crushing
// Ref B's fill light falls off down the frame: its row means run 192 at the top
// to 163 at the bottom while local contrast *rises* (sigma 43 -> 56), which is
// what a light raking from above does -- less fill reaching the lower cloth, so
// it goes both darker and harder. Ramping the ambient term reproduces both at
// once, where a plain brightness gradient would only darken.
uniform float uAmbientRamp;

// ---- global illumination shaping ---------------------------------------
uniform vec2  uBloomCenter;
uniform float uBloomRadius;
uniform float uBloomStrength;
uniform float uVignette;
uniform float uStreakStrength; // vertical light streaking (Ref A has this)
uniform float uStreakScale;
uniform float uMottle;        // broad cloth unevenness
uniform float uMottleScale;   // its frequency, in 1/cells
uniform float uGrain;
uniform float uSupersample;    // 1.0 = off, 2.0 = 2x2 rotated grid

// -------------------------------------------------------------------------
// hashes / noise
// -------------------------------------------------------------------------
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  // Rotating and offsetting the domain each octave is what keeps the value-noise
  // lattice from reading as axis-aligned plaid banding across the frame.
  const mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += amp * valueNoise(p);
    norm += amp;
    amp *= 0.5;
    p = rot * p * 2.03 + 19.17;
  }
  return sum / max(norm, 1e-5);
}

// -------------------------------------------------------------------------
// one thread layer
//
// 'across'  position across the thread, in cell units, 0 at its centre
// 'along'   position along the thread, in cell units
// 'id'      which thread this is, for per-thread randomisation
// -------------------------------------------------------------------------
struct Thread {
  float cover;  // 0..1 coverage, antialiased at the edges
  float height; // surface height, for compositing against the other set
  float shade;  // per-thread base brightness
  vec2  slope;  // surface gradient (across, along) for the normal
};

Thread evalThread(float across, float along, float id, float baseWidth, float seed) {
  Thread t;

  // Thickness drifts slowly along the thread (slub) and varies thread to
  // thread, so no two threads read as identical.
  float slubNoise = fbm(vec2(along * 0.22, id * 7.31 + seed), 3) - 0.5;
  float perThread = hash11(id * 1.7 + seed * 3.1) - 0.5;
  float halfWidth = 0.5 * baseWidth * (1.0 + uSlub * (slubNoise * 1.6 + perThread * 0.8));
  halfWidth = clamp(halfWidth, 0.04, 0.72);

  // Twist: a spun thread has periodic bulges running along it.
  float twistPhase = hash11(id * 3.77 + seed * 5.3) * 6.2831853;
  float twistArg = along * uTwistFreq * 6.2831853 + twistPhase;
  float twist = sin(twistArg);
  halfWidth *= 1.0 + uTwistAmp * 0.35 * twist;

  float a = abs(across);

  // Antialiased coverage. The edge softness tracks the pixel footprint so the
  // weave neither shimmers at 1080p nor goes plasticky-sharp at 4K.
  float edge = max(uPixelScale * 0.9, 0.012);
  t.cover = 1.0 - smoothstep(halfWidth - edge, halfWidth + edge, a);

  // Cylindrical cross-section.
  float x = clamp(across / max(halfWidth, 1e-4), -1.0, 1.0);
  float profile = sqrt(max(0.0, 1.0 - x * x));
  t.height = profile * halfWidth * 2.0;

  // Surface gradient: across the thread from the cylinder, along it from twist.
  // -x/profile is the true gradient of a circular cross-section, but it runs to
  // infinity at the thread's edge, which shades a hard rim onto every cell and
  // shows up as a one-cell signal competing with the weave's two-cell one.
  // Clamping the denominator keeps the crown honest and the rim finite.
  float dAcross = -x / max(profile, 0.3);
  dAcross = clamp(dAcross, -3.0, 3.0);
  float dAlong = uTwistAmp * uTwistFreq * 6.2831853 * cos(twistArg) * 0.5;
  t.slope = vec2(dAcross, dAlong);

  t.shade = 1.0 + uThreadShade * (hash11(id * 11.13 + seed * 2.7) - 0.5) * 2.0;
  return t;
}

// -------------------------------------------------------------------------
// shade one thread surface
// -------------------------------------------------------------------------
vec3 shadeThread(vec2 slope, vec3 tint, float shade, vec3 l, vec2 axis, float ambient) {
  // uRelief is the normal's z term: small values leave each thread strongly
  // domed, which shades the middle of a cell differently from its edges and so
  // muddies the two-cell checkerboard; large values flatten the crowns and let
  // the alternation come through cleanly, as it does in a tight weave.
  vec3 n = normalize(vec3(-slope.x, -slope.y, uRelief));
  float ndl = max(dot(n, l), 0.0);

  // A cylinder lit across its axis is much brighter than the same cylinder lit
  // along it: integrated over the surface the response goes as
  // sqrt(1 - (l.a)^2). Warp and weft sit at right angles, so under a raking
  // light the two sets land at different brightnesses -- and that, rather than
  // any drawn pattern, is what makes a plain weave read as a checkerboard.
  float along = dot(l, vec3(axis, 0.0));
  float axisResponse = sqrt(max(0.0, 1.0 - along * along));
  float k = mix(1.0, axisResponse, uAxisContrast);

  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, h), 0.0), uShininess);
  return tint * shade * (ambient + uDiffuse * ndl * k) + vec3(uSpecular * spec * k);
}

// -------------------------------------------------------------------------
// the weave at one point in cell space
//
// A plain weave reads as a checkerboard for a physical reason: at every
// crossing one thread passes over the other, and because the two sets run at
// right angles a single raking light shades them differently. So the
// checkerboard is not drawn -- it falls out of shading two perpendicular
// cylinders and letting cell parity decide which one is on top.
// -------------------------------------------------------------------------
vec3 weaveAt(vec2 cell, float seed) {
  // The cloth is never perfectly rectilinear: bend the whole sampling grid
  // with low-frequency noise so rows and columns drift the way real threads do.
  // Keep this frequency high enough that the waviness lives at thread scale:
  // low-frequency wander sweeps whole regions of the grid together and reads as
  // soft banding across the frame rather than as irregular cloth.
  vec2 wander = vec2(
    fbm(cell * uWanderScale + vec2(seed * 1.7, 0.0), 3) - 0.5,
    fbm(cell * uWanderScale + vec2(0.0, seed * 2.3 + 11.0), 3) - 0.5
  );
  vec2 p = cell + wander * uWander;

  vec2 idx = floor(p);
  vec2 f = fract(p) - 0.5;

  // Plain weave: cell parity decides who passes over whom.
  bool warpOnTop = mod(idx.x + idx.y, 2.0) < 0.5;

  Thread warp = evalThread(f.x, p.y, idx.x, uThreadWidth, seed);
  Thread weft = evalThread(f.y, p.x, idx.y, uWeftWidth, seed + 37.0);

  // Thread-local gradients, rotated into screen space. The warp runs vertically,
  // so its across-gradient is in x; the weft runs horizontally, so its swaps.
  vec2 warpSlope = vec2(warp.slope.x, warp.slope.y);
  vec2 weftSlope = vec2(weft.slope.y, weft.slope.x);

  // Fibre fuzz: fine hairs lifting off the surface, perturbing both the shade
  // and the normal. This is most of what stops the weave looking like a grid.
  float fuzz = fbm(p * uFuzzScale + vec2(seed * 13.7, seed * 5.1), 4) - 0.5;
  float fuzzHi = valueNoise(p * uFuzzScale * 3.1 + vec2(seed * 3.3, seed * 9.7)) - 0.5;
  vec2 fuzzSlope = vec2(fuzz, fuzzHi) * uFuzz * 6.0;
  float fuzzShade = 1.0 + uFuzz * (fuzz * 1.1 + fuzzHi * 0.5);

  vec3 l = normalize(vec3(uLightDir, uLightHeight));

  // Fill light thins out down the frame (see uAmbientRamp).
  float ambient = uAmbient * (1.0 + uAmbientRamp * (1.0 - 2.0 * vUv.y));

  // The warp runs vertically, the weft horizontally.
  vec3 warpColor = shadeThread(warpSlope + fuzzSlope, uWarpColor, warp.shade * fuzzShade, l, vec2(0.0, 1.0), ambient);
  vec3 weftColor = shadeThread(weftSlope + fuzzSlope, uWeftColor, weft.shade * fuzzShade, l, vec2(1.0, 0.0), ambient);

  // The thread passing over is crimped higher, so it catches more light; the one
  // tucked underneath sits in the other's shadow.
  float overGain = 1.0 + uParityBias;
  float underGain = 1.0 - uOcclusion;

  // Composite back to front: ground, then the under thread where it shows
  // through, then the over thread on top. Straight layering -- no height test --
  // because parity has already settled which is which.
  vec3 col = uGroundColor * ambient;
  if (warpOnTop) {
    col = mix(col, weftColor * underGain, clamp(weft.cover, 0.0, 1.0));
    col = mix(col, warpColor * overGain, clamp(warp.cover, 0.0, 1.0));
  } else {
    col = mix(col, warpColor * underGain, clamp(warp.cover, 0.0, 1.0));
    col = mix(col, weftColor * overGain, clamp(weft.cover, 0.0, 1.0));
  }
  return col;
}

void main() {
  // Cell space, aspect-corrected so threads are square, offset by the
  // per-state jitter that makes each held still a different piece of cloth.
  vec2 cell = (vUv * uAspect) * uThreads + uJitter;

  vec3 col;

  if (uSupersample > 1.5) {
    // 2x2 rotated grid: cheaper than 4x4 and kills the worst of the moire that
    // a ~9px thread pitch would otherwise throw at 1080p.
    float s = uPixelScale * 0.25;
    col  = weaveAt(cell + vec2( s,  3.0 * s), uSeed);
    col += weaveAt(cell + vec2( 3.0 * s, -s), uSeed);
    col += weaveAt(cell + vec2(-s, -3.0 * s), uSeed);
    col += weaveAt(cell + vec2(-3.0 * s,  s), uSeed);
    col *= 0.25;
  } else {
    col = weaveAt(cell, uSeed);
  }

  // ---- global illumination shaping -------------------------------------
  vec2 q = vUv - uBloomCenter;
  q.y *= uAspect.y;
  float r = length(q) / max(uBloomRadius, 1e-4);

  // Broad soft light sitting over the cloth.
  float bloom = exp(-r * r * 1.4);
  col *= 1.0 + uBloomStrength * bloom;

  // Vignette, measured from frame centre rather than the bloom centre.
  vec2 vc = vUv - 0.5;
  vc.y *= uAspect.y;
  float vig = 1.0 - uVignette * dot(vc, vc) * 2.2;  // negative uVignette brightens the edges
  col *= clamp(vig, 0.0, 2.0);

  // Mottle: real cloth is never evenly dense. Broad, slow variation in how
  // tightly it is woven and how it takes the light is most of what separates a
  // photograph of fabric from a rendered grid.
  float mottle = fbm(vUv * uAspect * uMottleScale + vec2(uSeed * 2.9, uSeed * 7.1), 4) - 0.5;
  float mottleFine = fbm(vUv * uAspect * uMottleScale * 3.7 + vec2(uSeed * 4.3, 21.0), 3) - 0.5;
  col *= 1.0 + uMottle * (mottle * 1.5 + mottleFine * 0.7);

  // Vertical streaking: in Ref A the light rakes down the cloth, leaving soft
  // columns of shade. Driven off x only, so it reads as lighting not texture.
  float streak = fbm(vec2(vUv.x * uStreakScale, uSeed * 0.7), 4) - 0.5;
  float streakFine = valueNoise(vec2(vUv.x * uStreakScale * 4.3, uSeed * 1.9)) - 0.5;
  col *= 1.0 + uStreakStrength * (streak * 1.4 + streakFine * 0.6);

  // ---- grade ----------------------------------------------------------
  col *= uExposure * uStateExposure;
  col = (col - 0.5) * uContrast + 0.5;
  col = col * (1.0 - uLift) + uLift;

  // Fine grain, reseeded per state so it flickers with the boil.
  float g = hash12(vUv * vec2(1873.0, 1051.0) + uSeed * 91.7) - 0.5;
  col += g * uGrain;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
