// GLSL for "Ink Diffusion".
//
// The whole clip is one fragment shader — 2D, no geometry, no camera.
//
// Method
// ------
// A true Navier-Stokes solver would need ping-pong textures carrying state
// between frames, which Remotion cannot do: frames render out of order across
// threads, so anything that depends on the previous frame renders wrong.
// Instead the density field is reconstructed from the frame number alone.
//
// The advection equation with a source term
//
//     drho/dt + (v . grad) rho = S(x, t)
//
// has the exact characteristic solution
//
//     rho(x, t) = integral over s in [0, t] of S(X(s; x, t), s) ds
//
// where X(s; x, t) is the trajectory that arrives at x at time t, traced
// backwards. So every pixel walks its own parcel of fluid backwards through
// the (analytic, time-varying) velocity field and adds up the dye it picked up
// along the way. No state, no textures, no ordering assumptions — frame N is a
// pure function of N — and because the flow map folds and stretches, the dye
// comes out as filaments rather than blobs.
//
// Diffusion is folded into the source term: dye deposited `age` seconds ago is
// sampled as a Gaussian widened to sqrt(sigma0^2 + 2*D*age) with its amplitude
// scaled to conserve mass, which is the exact solution for a diffusing point
// source. Older dye therefore reads as soft haze while fresh dye stays sharp.
//
// The step count grows with the frame number, so late frames cost more than
// early ones — see README for the measured numbers.

export const VERTEX_SHADER = `#version 300 es
precision highp float;
void main() {
  // Full-screen triangle, no attribute buffers needed.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const MAX_INJECTIONS = 5;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uSeconds;      // elapsed clip time, in seconds
uniform float uFrame;        // current frame, for grain only
uniform float uStepsSource;  // fractional steps across the injection window
uniform float uStepsAdvect;  // fractional steps across the settling tail
uniform float uSourceEnd;    // last moment any injection is still running
uniform vec2  uSeed;         // which patch of the noise field the tank sits in

uniform vec3  uBackground;
uniform vec3  uInkThin;
uniform vec3  uInkDense;
uniform vec3  uInkThin2;
uniform vec3  uInkDense2;
uniform float uAdditive;     // 1.0 = dye adds light, 0.0 = dye absorbs it
uniform float uOpacityGain;

uniform vec3  uOctaveAmp;
uniform float uFlowSpeed;
uniform float uFlowDecay;
uniform float uFlowFloor;
uniform float uDiffusion;
uniform float uDiffusionFade;
uniform float uSourceTexFreq;
uniform float uSourceTexAmp;
uniform float uGrain;
uniform float uVignette;

uniform int   uInjectionCount;
uniform vec4  uInjectionPos[${MAX_INJECTIONS}];  // xy = centre, z = start, w = duration
uniform vec4  uInjectionCfg[${MAX_INJECTIONS}];  // x = strength, y = sigma0, z = channel, w = jet

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

// Cheap 2D hash. Value noise wants a hash per lattice corner, and the curl
// field wants a noise evaluation per octave per integration step, so this is
// the hottest code in the shader by a wide margin.
float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// Value noise with an *analytic* gradient, quintic-smoothed so the gradient is
// continuous. Returning the derivative alongside the value is what makes curl
// noise affordable here: the alternative — finite-differencing the potential —
// costs three to four noise evaluations per octave instead of one.
// Returns vec3(value in [-0.5, 0.5], d/dx, d/dy).
vec3 vnoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = x - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  float k1 = b - a;
  float k2 = c - a;
  float k3 = a - b - c + d;

  float value = a + k1 * u.x + k2 * u.y + k3 * u.x * u.y - 0.5;
  vec2 grad = du * vec2(k1 + k3 * u.y, k2 + k3 * u.x);
  return vec3(value, grad);
}

// Octaves are rotated against each other so the axis-aligned lattice of the
// value noise never shows through as a grid.
const mat2 R1 = mat2( 0.93969, 0.34202, -0.34202, 0.93969);
const mat2 R2 = mat2( 0.62932, -0.77714, 0.77714, 0.62932);
const mat2 R3 = mat2(-0.10453, 0.99452, -0.99452, -0.10453);

// Gradient of one octave of the stream function, in world space.
// q = R * (p * freq) + drift  =>  d/dp = freq * R^T * dn/dq.
vec2 octaveGradient(vec2 p, mat2 rot, float freq, float amp, vec2 drift) {
  vec3 n = vnoise(rot * (p * freq) + drift);
  return amp * freq * (n.yz * rot);   // n.yz * rot == transpose(rot) * n.yz
}

// ---------------------------------------------------------------------------
// Velocity field
// ---------------------------------------------------------------------------

// Layered curl noise. Taking the curl of a scalar stream function makes the
// field divergence-free by construction, which is what produces rolling,
// folding motion instead of a smear. The field itself drifts slowly over the
// clip so the flow keeps evolving.
vec2 curlFlow(vec2 p, float s) {
  vec2 g = vec2(0.0);
  // Frequencies rise ~2.9x per octave while the stream-function amplitude
  // falls ~2.4x, so each octave contributes a similar amount of velocity but
  // at a finer scale. That flat-ish spectrum is what folds the dye into
  // threads instead of pushing it around as one smooth mass.
  g += octaveGradient(p, R1, 1.85, uOctaveAmp.x, vec2( 0.021, -0.014) * s + uSeed);
  g += octaveGradient(p, R2, 5.00, uOctaveAmp.y * 0.36, vec2(-0.038,  0.026) * s + uSeed * 2.7);
  g += octaveGradient(p, R3, 14.00, uOctaveAmp.z * 0.12, vec2( 0.055,  0.047) * s + uSeed * 6.3);

  // Strong while the ink is entering, weakening through the run so the motion
  // settles instead of churning forever. A small floor keeps a slow drift
  // alive in the final beat.
  float decay = uFlowFloor + (1.0 - uFlowFloor) * exp(-s / uFlowDecay);
  return vec2(g.y, -g.x) * uFlowSpeed * decay;
}

// Injection jets: while a source is fresh it pushes fluid radially outward,
// which is what makes the fronts billow rather than just stir in place.
vec2 jetFlow(vec2 p, float s) {
  vec2 v = vec2(0.0);
  for (int i = 0; i < ${MAX_INJECTIONS}; i++) {
    if (i >= uInjectionCount) break;
    vec4 pos = uInjectionPos[i];
    float age = s - pos.z;
    // Past ~3 time constants the jet has given all its momentum to the water;
    // skipping it here saves the whole term across the settling tail.
    if (age < 0.0 || age > 14.0) continue;
    // Gaussian bell of influence around the nozzle. The radius test comes
    // first: a compare is far cheaper than the two exponentials it skips, and
    // most steps of most trajectories are nowhere near a nozzle.
    const float reach = 0.145;
    vec2 d = p - pos.xy;
    float r2 = dot(d, d);
    if (r2 > 9.0 * reach * reach) continue;

    float r = sqrt(r2) + 1e-5;
    float spatial = exp(-r2 / (2.0 * reach * reach));
    float temporal = exp(-age / 4.2);
    v += (d / r) * uInjectionCfg[i].w * spatial * temporal;
  }
  return v;
}

vec2 velocity(vec2 p, float s) {
  vec2 v = curlFlow(p, s) + jetFlow(p, s);
  // Containment, so dye that wanders past the edge is drawn back rather than
  // lost — a macro tank has walls. The tank is shaped like the frame, so the
  // plume can run wider than it is tall instead of settling into a circle
  // inside a 16:9 shot. Run backwards this term expands rather than contracts,
  // which is why stepBack() below clamps: unbounded, it would carry far-out
  // trajectories off to infinity within the length of the clip.
  float r = length(p * vec2(0.6, 1.0));
  v -= p * max(0.0, r - 0.55) * 0.5;
  return v;
}

// Trajectories that escape the tank must not be allowed to run away: once a
// parcel is this far out it can never reach a nozzle again, and letting it
// diverge turns floor()/fract() inside the noise into NaN, which comes back
// as black pixels in the corners of the frame.
vec2 stepBack(vec2 p, float s, float ds) {
  return clamp(p - velocity(p, s) * ds, vec2(-3.0), vec2(3.0));
}

// ---------------------------------------------------------------------------
// Dye sources
// ---------------------------------------------------------------------------

// Dye deposited at position p at time s, aged by (t - s) seconds.
//
// smear is the step the parcel is about to take. Stretching the nozzle along
// that vector turns the discrete stamps into a continuous streak — otherwise
// the quadrature shows up as concentric bands inside the swirls. Doing it
// along the direction of travel rather than isotropically is what makes it
// affordable: the streak closes up at a fraction of the step count, while the
// nozzle stays sharp across the filament, which is the direction the eye
// actually reads detail in.
//
// x = channel 0, y = channel 1.
vec2 dyeSource(vec2 p, float s, float age, vec2 smear) {
  vec2 rho = vec2(0.0);

  // Direction of travel, shared by every injection at this step.
  float smear2 = dot(smear, smear);
  vec2 axis = smear2 > 1e-12 ? smear * inversesqrt(smear2) : vec2(1.0, 0.0);

  for (int i = 0; i < ${MAX_INJECTIONS}; i++) {
    if (i >= uInjectionCount) break;
    vec4 pos = uInjectionPos[i];
    vec4 cfg = uInjectionCfg[i];
    if (s < pos.z || s > pos.z + pos.w) continue;

    // Widen sigma with age: this is the exact solution for a Gaussian point
    // source spreading by diffusion. The step smear widens it further, but
    // only along the direction of travel.
    float sigma2 = cfg.y * cfg.y + 2.0 * uDiffusion * age;
    float along2 = sigma2 + smear2;

    // Cheap rejection before the transcendentals. Beyond ~5 sigma the deposit
    // is below a millionth of the peak, and skipping the exp() and the pow()
    // here is the difference between this loop costing more than the entire
    // curl-noise field and costing almost nothing.
    vec2 d = p - pos.xy;
    float dAlong = dot(d, axis);
    float dAcross = d.x * axis.y - d.y * axis.x;
    if (dAlong * dAlong > 25.0 * along2 || dAcross * dAcross > 25.0 * sigma2) continue;

    // Amplitude falls as the dye spreads. Strict mass conservation would use
    // an exponent of 1; a slightly softer fade keeps the older cores readable,
    // which is how ink actually looks through a tank rather than in a 2D slice.
    // The sqrt term keeps the smeared stamp carrying the same mass as the
    // round one it replaces.
    float amp = pow((cfg.y * cfg.y) / sigma2, uDiffusionFade) * sqrt(sigma2 / along2);
    float deposit = cfg.x * amp * exp(
      -0.5 * (dAlong * dAlong / along2 + dAcross * dAcross / sigma2));

    if (cfg.z < 0.5) {
      rho.x += deposit;
    } else {
      rho.y += deposit;
    }
  }

  // The nozzles are tiny and the trajectory spends most of its length nowhere
  // near one, so bail out before paying for the texture noise. This is the
  // single hottest branch in the shader.
  if (rho.x + rho.y < 1e-4) return vec2(0.0);

  // Texture stamped into the nozzle. This is the seed of the tendrils: the
  // flow map stretches these speckles into threads. Without it the sources
  // stay smooth Gaussians and the result reads as smoke, not ink. Each octave
  // is rotated off-axis — a freshly opened nozzle is only a couple of noise
  // cells wide, so an unrotated lattice would show through as a rectangle
  // instead of a blob.
  float n = vnoise(R2 * (p * uSourceTexFreq) + vec2(17.3, 5.1)).x
          + 0.52 * vnoise(R3 * (p * uSourceTexFreq * 2.6) + vec2(3.7, 21.9)).x
          + 0.27 * vnoise(R1 * (p * uSourceTexFreq * 6.7) + vec2(29.1, 13.4)).x;
  return rho * exp(uSourceTexAmp * n);
}

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------

// Walk this pixel's parcel of fluid backwards from now to t = 0, collecting
// dye. Steps are spaced by u^3 rather than uniformly in time so they bunch up
// at the start of the clip, where the flow is fastest and the sources are
// firing, and stretch out over the slow settling at the end. uSteps is
// fractional and the last step carries a partial weight, so the quadrature
// changes continuously from frame to frame and never pops.
vec2 integrateDensity(vec2 uv) {
  float t = uSeconds;
  if (t <= 0.0) return vec2(0.0);

  vec2 pos = uv;
  vec2 rho = vec2(0.0);
  float tSrc = min(t, uSourceEnd);

  // Phase B — the settling tail. Between the last injection and now there is
  // no dye to collect, only trajectory to unwind, so these steps skip the
  // source evaluation entirely. They are spaced by u^3 so they bunch up at
  // the fast, early end of the tail and stretch across the slow drift at the
  // end of the clip.
  if (t > uSourceEnd) {
    float span = t - uSourceEnd;
    float n = uStepsAdvect;
    int count = int(ceil(n));
    float du = 1.0 / n;
    for (int j = 0; j < 128; j++) {
      if (j >= count) break;
      float w = min(1.0, n - float(j));
      float u1 = 1.0 - float(j) * du;
      float u0 = u1 - w * du;
      float um = 0.5 * (u0 + u1);
      float s = uSourceEnd + span * um * um * um;
      float ds = span * (u1 * u1 * u1 - u0 * u0 * u0);
      pos = stepBack(pos, s, ds);
    }
  }

  // Phase A — the injection window, walked backwards with dye collected at
  // every step. Uniform spacing here: the window is short, the flow barely
  // decays across it, and an even spacing is what keeps the deposited streak
  // smooth. Step count scales with how much of the window has happened yet,
  // so the opening frames stay cheap.
  {
    float n = max(2.0, uStepsSource * (tSrc / uSourceEnd));
    int count = int(ceil(n));
    float dsStep = tSrc / n;
    for (int j = 0; j < 160; j++) {
      if (j >= count) break;
      float w = min(1.0, n - float(j));
      float s1 = tSrc - float(j) * dsStep;
      float s0 = s1 - w * dsStep;
      float s = 0.5 * (s0 + s1);
      float ds = s1 - s0;

      vec2 v = velocity(pos, s);
      rho += dyeSource(pos, s, t - s, 0.62 * v * ds) * ds;
      pos = clamp(pos - v * ds, vec2(-3.0), vec2(3.0));
    }
  }
  return rho;
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

void main() {
  // Aspect-corrected, origin at frame centre, y in [-0.5, 0.5].
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  vec2 rho = integrateDensity(uv);

  // Beer-Lambert: accumulated dye saturates into near-opaque cores rather than
  // clipping to a flat plateau.
  vec2 alpha = 1.0 - exp(-uOpacityGain * rho);

  vec3 col;
  if (uAdditive > 0.5) {
    // V2: two dye fields lighting up dark water. Where the fields overlap the
    // blue and the magenta sum into violet, which is the whole point of
    // carrying two fields instead of recolouring one.
    vec3 dyeA = mix(uInkThin, uInkDense, smoothstep(0.25, 0.95, alpha.x));
    vec3 dyeB = mix(uInkThin2, uInkDense2, smoothstep(0.25, 0.95, alpha.y));
    vec3 lit = dyeA * alpha.x * 1.35 + dyeB * alpha.y * 1.35;
    // Very slight bloom on the densest dye only.
    float core = max(alpha.x, alpha.y);
    lit += (dyeA * alpha.x + dyeB * alpha.y) * 0.18 * smoothstep(0.55, 1.0, core);
    // Filmic saturation so overlaps stay coloured instead of clipping to white.
    col = uBackground + (1.0 - exp(-lit));
  } else {
    // V1 / V3: dye laid over a light background with plain alpha behaviour.
    // No bloom, no glow.
    float a = 1.0 - exp(-uOpacityGain * (rho.x + rho.y));
    vec3 dye = mix(
      mix(uInkThin, uInkThin2, 0.5),
      mix(uInkDense, uInkDense2, 0.5),
      smoothstep(0.1, 0.85, a)
    );
    col = mix(uBackground, dye, a);
  }

  if (uVignette > 0.0) {
    float v = 1.0 - uVignette * smoothstep(0.32, 1.05, length(uv) * 1.08);
    col *= v;
  }

  // Grain doubles as a dither, which is what keeps the dark background of V2
  // and the pale field of V3 free of banding once they are encoded.
  float g = hash21(gl_FragCoord.xy + vec2(uFrame * 13.7, uFrame * 7.1)) - 0.5;
  col += g * uGrain;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
