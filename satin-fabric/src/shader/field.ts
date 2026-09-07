/**
 * Shared GLSL: the satin height field.
 *
 * Everything here is an analytic function of position and of the loop
 * parameter t, and every term returns its own gradient alongside its value.
 * Two consequences matter:
 *
 *  - Normals are exact. They are not differences of a displacement texture,
 *    so they never stair-step, which on a specular surface would show up
 *    immediately as banded highlights.
 *  - The loop is exact. Every temporal phase is an integer multiple of
 *    2*pi*t, so the field at t = 1 is identical to the field at t = 0.
 *
 * Values are packed as vec3(value, d/dx, d/dy) throughout.
 */
export const FIELD_GLSL = /* glsl */ `
#define TAU 6.283185307179586
#define PI  3.141592653589793

// Fold axis runs upper-left to lower-right at 25 degrees; CROSS is
// perpendicular to it. The key light's azimuth is aimed roughly along CROSS:
// a key raking ALONG the folds barely changes N.L from crest to trough and
// the folds wash out entirely, which is the single easiest way to get this
// wrong.
const vec2 FOLD  = vec2(0.906308, -0.422618);
const vec2 CROSS = vec2(0.422618,  0.906308);

// A wave vector that runs mostly ACROSS the folds, so its crests are
// elongated ridges lying ALONG the fold axis. tilt shears it off the
// perpendicular; small values keep the ridges long.
vec2 kAcross(float freq, float tilt) {
  return freq * normalize(CROSS + tilt * FOLD);
}

// A wave vector running ALONG the folds. Used only at low frequency, to
// make the ridges swell and gather down their length instead of reading
// as infinite straight lines.
vec2 kAlong(float freq, float tilt) {
  return freq * normalize(FOLD + tilt * CROSS);
}

float tnh(float x) {
  x = clamp(x, -6.0, 6.0);
  float e = exp(2.0 * x);
  return (e - 1.0) / (e + 1.0);
}

// Smooth spatial amplitude envelope, value + gradient.
vec3 envelope(vec2 p, vec2 dir, float bias, float lo, float hi) {
  float u  = dot(p, dir) + bias;
  float th = tnh(u);
  return vec3(lo + (hi - lo) * (0.5 + 0.5 * th),
              (hi - lo) * 0.5 * (1.0 - th * th) * dir);
}

/**
 * One directional wave, accumulated into acc together with its gradient.
 *
 * The domain warp displaces position rather than phase, so a given warp
 * bends every frequency by the same distance and the folds stay coherent
 * across scales. That costs the Jacobian of the warp: gWx and gWy are the
 * gradients of the warp's x and y components.
 */
void addWave(inout vec3 acc, vec2 p, vec2 kv, float amp, float ph0,
             vec2 W, vec2 gWx, vec2 gWy, vec3 env, float tPhase) {
  float ph = dot(kv, p + W) + tPhase + ph0;
  float s  = sin(ph);
  float c  = cos(ph);
  vec2  dph = kv + vec2(kv.x * gWx.x + kv.y * gWy.x,
                        kv.x * gWx.y + kv.y * gWy.y);
  acc.x  += amp * env.x * s;
  acc.yz += amp * (env.yz * s + env.x * c * dph);
}

const vec2 ZERO2 = vec2(0.0);
const vec3 UNIT3 = vec3(1.0, 0.0, 0.0);

/**
 * Height field.
 *
 *  p      field-space position (frame height spans 2.0 units)
 *  t      loop parameter in [0,1)
 *  amp    global amplitude scale
 *  detail 0 disables the two finest fold octaves (vertex stage: they are
 *         below the tessellation limit and would only alias)
 *
 * Returns vec3(h, dh/dx, dh/dy).
 */
vec3 satinField(vec2 p, float t, float amp, float detail) {
  float T = TAU * t;

  // ---- domain warp -------------------------------------------------
  // Two independent low-frequency fields drive a positional offset. This
  // is what turns parallel corrugations into the curving, gathering folds
  // of draped cloth. Kept moderate: too much warp and the crest lines stop
  // being coherent, and the highlights break into disconnected glints.
  vec3 wx = vec3(0.0);
  vec3 wy = vec3(0.0);
  addWave(wx, p, kAcross(1.05,  2.30), 0.10175, 0.00, ZERO2, ZERO2, ZERO2, UNIT3,  T);
  addWave(wx, p, kAlong (1.70, -0.80), 0.06050, 1.97, ZERO2, ZERO2, ZERO2, UNIT3, -T);
  addWave(wx, p, kAcross(3.10,  0.55), 0.02090, 4.21, ZERO2, ZERO2, ZERO2, UNIT3,  T);
  addWave(wy, p, kAlong (1.35, -1.60), 0.09075, 2.55, ZERO2, ZERO2, ZERO2, UNIT3, -T);
  addWave(wy, p, kAcross(2.40,  1.00), 0.04675, 5.63, ZERO2, ZERO2, ZERO2, UNIT3,  T);
  addWave(wy, p, kAlong (3.60, -0.40), 0.01650, 0.84, ZERO2, ZERO2, ZERO2, UNIT3, -T);
  vec2 W   = vec2(wx.x, wy.x);
  vec2 gWx = wx.yz;
  vec2 gWy = wy.yz;

  // ---- fold amplitude across the frame -----------------------------
  // Broad, flatter folds up top; tighter gathered ones toward lower left.
  vec3 envBroad = envelope(p, vec2( 0.00,  0.85),  0.10, 0.72, 1.18);
  vec3 envTight = envelope(p, vec2(-0.95, -1.25),  0.05, 0.10, 1.00);
  vec3 envAlong = envelope(p, vec2(-0.55, -0.70),  0.00, 0.55, 1.15);

  // A very slight overall breathing of the fold amplitude.
  float breathe = 1.0 + 0.055 * cos(T);
  envBroad *= amp * breathe;
  envTight *= amp * breathe;
  envAlong *= amp * breathe;

  vec3 h = vec3(0.0);

  // Broad folds. The amplitude falls off steeply (roughly 1/f^3), so the
  // fundamental clearly dominates. That is what keeps a crest line coherent
  // across the frame and its highlight continuous; octaves of comparable
  // slope interfere and chop the ribbons into separate glints.
  addWave(h, p, kAcross( 5.50,  0.20), 0.068000, 0.31, W, gWx, gWy, envBroad,  T);
  addWave(h, p, kAcross( 8.91, -0.11), 0.015993, 2.74, W, gWx, gWy, envBroad, -T);
  addWave(h, p, kAcross(14.43,  0.07), 0.003765, 5.02, W, gWx, gWy, envBroad,  T);

  // A second, tighter fold group weighted toward the lower left, so the
  // fold pitch varies across the frame instead of reading as one comb.
  addWave(h, p, kAcross( 9.50,  0.07), 0.026000, 1.16, W, gWx, gWy, envTight, -T);
  addWave(h, p, kAcross(15.39, -0.15), 0.006114, 4.48, W, gWx, gWy, envTight,  T);

  // Ridge-length modulation: low frequency along the folds, so crests swell
  // and pinch instead of running edge to edge at constant height.
  addWave(h, p, kAlong ( 1.05,  0.18), 0.009000, 3.55, W, gWx, gWy, envAlong,  T);
  addWave(h, p, kAlong ( 1.71, -0.25), 0.004680, 0.62, W, gWx, gWy, envAlong, -T);

  if (detail > 0.5) {
    vec3 envFine = envBroad * 0.5;
    addWave(h, p, kAcross(30.00,  0.16), 0.00110, 5.71, W, gWx, gWy, envFine,  T);
    addWave(h, p, kAcross(41.00, -0.11), 0.00050, 1.83, W, gWx, gWy, envFine, -T);
  }

  return h;
}

// A cheap low-frequency scalar reused for roughness variation, so some
// folds catch more light than others. Uniform roughness reads as vinyl.
float roughnessNoise(vec2 p, float t) {
  float T = TAU * t;
  return sin(dot(kAcross(2.6, 0.8), p) + T) * 0.5
       + sin(dot(kAlong (1.9, 1.3), p) - T + 2.1) * 0.35
       + sin(dot(kAcross(4.7, -0.5), p) + T + 4.4) * 0.15;
}
`;
