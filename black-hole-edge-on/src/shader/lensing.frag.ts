/**
 * Gravitational lensing fragment shader.
 *
 * One shader, two projects: every look-defining quantity (disc tilt, filament
 * anisotropy, colour ramp, arc weighting, bloom feed) is a uniform, so the
 * warm edge-on compositions here and the wider-tilt compositions of the
 * sibling black-hole project both run off this file.
 *
 * Physics: null geodesics are integrated in Cartesian coordinates for a
 * Schwarzschild metric in units where the Schwarzschild radius rs = 1.
 * With h2 the squared specific angular momentum (conserved), the orbit
 * equation d2u/dphi2 + u = (3/2) rs u^2 becomes
 *
 *     d2r/dl2 = -(3/2) rs h2 r / |r|^5
 *
 * which is what `accel()` returns. Integrating this - rather than faking the
 * arcs - is what produces the photon ring, the far side of the disc bending
 * up over the shadow, and the thin secondary crescent underneath it.
 *
 * Looping: `uTime` is frame / durationInFrames, so it runs 0 -> 1 across the
 * composition. Every time-varying term is exactly periodic in it. See
 * `filaments()` for how differential rotation is made to loop.
 */
export const LENSING_FRAG = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2  uRes;          // render target size in pixels
uniform float uTime;         // loop phase, 0 -> 1 over the whole composition

// -- camera ---------------------------------------------------------------
uniform float uTiltDeg;      // camera elevation above the disc plane
uniform float uCamDist;      // camera distance in rs
uniform float uZoom;         // inverse focal length; sets shadow size on screen

// -- disc -----------------------------------------------------------------
uniform float uDiscIn;       // inner edge radius (rs)
uniform float uDiscOut;      // outer edge radius (rs)
uniform float uAniso;        // radial filament frequency (log-radius)
uniform float uAngScale;     // angular noise scale; small => long combed strands
uniform float uSpinTurns;    // revolutions of the OUTER rim per loop
uniform float uSpinRef;      // radius at which uSpinTurns is measured
uniform float uSpinMax;      // cap on turns per loop at the inner edge
uniform float uOpacity;      // disc self-absorption
uniform float uBeaming;      // relativistic Doppler beaming amount
uniform float uShimmer;      // slow brightness shimmer along the arcs
uniform float uSecondary;    // extra weight on 2nd+ disc crossings (lower arc)

// -- highlights & sky -----------------------------------------------------
uniform float uPhotonRing;   // thin near-white ring at the shadow edge
uniform float uStars;        // starfield brightness
uniform float uHaze;         // faint haze bleeding out of the disc
uniform vec3  uHazeColor;
uniform vec3  uBackground;

// -- colour ramp: t = 0 outer rim -> t = 1 white hot inner edge ------------
uniform vec3  uRamp0;
uniform vec3  uRamp1;
uniform vec3  uRamp2;
uniform vec3  uRamp3;
uniform vec3  uRamp4;

uniform int   uSteps;        // geodesic integration steps
uniform float uExposure;

const float TAU  = 6.28318530718;
const float RS   = 1.0;      // Schwarzschild radius; horizon at r = RS
// 3*sqrt(3)/2 * rs. The integrator lands ~0.4% under this at the step size
// used below, so the ring is nudged to match the shadow edge as rendered.
const float BCRIT = 2.5893;

// ---------------------------------------------------------------- helpers
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

// Value noise, quintic interpolation.
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z);
}

/**
 * Disc texture, sampled on a cylinder.
 *
 * The angular coordinate enters only through cos/sin, so the field is exactly
 * TAU-periodic in \`a\` by construction - the property the loop depends on.
 * \`uAngScale\` is kept small and \`uAniso\` large, which stretches the noise
 * hard along the orbital direction and gives the combed, hair-like strands.
 * Radius enters as log(r), so filaments pack tightly at the inner edge and
 * spread apart toward the rim.
 */
float fbmCyl(float a, float lr) {
  float sum = 0.0;
  float amp = 0.55;
  float fr  = 1.0;
  for (int i = 0; i < 4; i++) {
    vec3 q = vec3(cos(a) * uAngScale * fr, sin(a) * uAngScale * fr, lr * fr);
    sum += amp * vnoise(q);
    amp *= 0.5;
    fr  *= 2.03;
  }
  return sum;
}

/**
 * Differential rotation that loops exactly.
 *
 * Keplerian shear wants angular velocity ~ r^-3/2, but an arbitrary real
 * number of turns per loop cannot return the field to its start. Instead the
 * turn count is split into the integer band it falls in and the fraction
 * between bands: both neighbouring bands advance by a whole number of turns
 * over the loop, so each is exactly periodic, and the fraction blends between
 * them. Because the strands are stretched so far along the orbit, blending two
 * copies a fraction of a turn apart is visually free - a rotated near-ring
 * still looks like the same near-ring.
 */
float filaments(float r, float phi) {
  // Keplerian shear, capped so the innermost ring does not strobe: past a
  // point the extra turns read as flicker rather than speed.
  float turns = min(uSpinTurns * pow(uSpinRef / r, 1.5), uSpinMax);
  float n0 = floor(turns);
  float f  = turns - n0;
  float w  = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // smootherstep

  float lr = uAniso * log(r);
  float a0 = phi + TAU * n0 * uTime;
  float a1 = phi + TAU * (n0 + 1.0) * uTime;

  // smootherstep is flat at both ends, so over a good part of the disc one of
  // the two bands contributes nothing measurable. Skipping its four octaves
  // there costs no image quality and a useful slice of the frame time.
  if (w < 0.015) return fbmCyl(a0, lr);
  if (w > 0.985) return fbmCyl(a1, lr);

  return mix(fbmCyl(a0, lr), fbmCyl(a1, lr), w);
}

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(uRamp0, uRamp1, smoothstep(0.00, 0.30, t));
  c = mix(c, uRamp2, smoothstep(0.28, 0.56, t));
  c = mix(c, uRamp3, smoothstep(0.54, 0.80, t));
  c = mix(c, uRamp4, smoothstep(0.78, 1.00, t));
  return c;
}

// Emission of the disc where a geodesic punches through the plane y = 0.
vec3 discSample(vec3 hit, vec3 dir, int crossing, out float density) {
  density = 0.0;
  float r = length(hit.xz);
  if (r < uDiscIn || r > uDiscOut) return vec3(0.0);

  float phi = atan(hit.z, hit.x);
  float x   = (r - uDiscIn) / (uDiscOut - uDiscIn);

  // Radial brightness: steep, so the inner edge reads as white hot.
  float radial = pow(uDiscIn / r, 1.75);
  float inner  = smoothstep(0.0, 0.05, x);
  float outer  = 1.0 - smoothstep(0.26, 0.86, x);

  // Combed filaments, shaped into bright strands with dark lanes between.
  float n  = filaments(r, phi);
  float st = smoothstep(0.34, 0.80, n);
  float fil = mix(0.10, 1.0, st * st);

  // Doppler beaming: the side of the disc rotating toward us is brighter.
  vec3 vhat = normalize(cross(vec3(0.0, 1.0, 0.0), hit));
  float beta = uBeaming * sqrt(1.5 / r);
  float dop  = 1.0 + beta * dot(normalize(dir), vhat) * 3.0;
  dop = max(dop, 0.05);

  // Slow shimmer. Integer frequencies in uTime keep it periodic.
  float shim = 1.0
    + uShimmer * 0.6 * sin(TAU * uTime + phi * 3.0)
    + uShimmer * 0.4 * sin(TAU * 2.0 * uTime - phi * 5.0 + 1.7);

  // Secondary and higher images are the thin arcs hugging the shadow; the
  // reference wants the lower one tighter and hotter than the direct image.
  float order = crossing == 0 ? 1.0 : uSecondary;

  float amp = radial * inner * outer * fil * dop * shim * order;
  density = clamp(radial * inner * outer * fil, 0.0, 4.0);

  // Temperature tracks radius, with the beaming nudging it hotter.
  float t = clamp(pow(uDiscIn / r, 0.55) * (0.86 + 0.3 * (dop - 1.0)), 0.0, 1.0);
  return ramp(t) * amp;
}

float starfield(vec3 d) {
  float s = 0.0;
  for (int k = 0; k < 2; k++) {
    float sc = 110.0 + 74.0 * float(k);
    vec3 g   = d * sc;
    vec3 id  = floor(g);
    vec3 fr  = fract(g) - 0.5;
    float h  = hash13(id + float(k) * 37.1);
    float on = step(0.9915, h);
    float b  = fract(h * 731.7);
    s += on * exp(-dot(fr, fr) * 62.0) * (0.25 + 0.75 * b * b);
  }
  return s;
}

vec3 accel(vec3 pos, float h2) {
  float r2 = dot(pos, pos);
  return -1.5 * RS * h2 * pos / (r2 * r2 * sqrt(r2));
}

// Trace one geodesic and return its radiance.
vec3 trace(vec3 ro, vec3 rd, vec2 screen) {
  vec3 pos = ro;
  vec3 dir = rd;

  vec3 hvec = cross(pos, dir);
  float h2  = dot(hvec, hvec);
  float b   = sqrt(h2);              // impact parameter (|rd| == 1)

  vec3  col   = vec3(0.0);
  float trans = 1.0;
  int   cross_ = 0;
  bool  captured = false;
  bool  escaped  = false;

  for (int i = 0; i < 512; i++) {
    if (i >= uSteps) break;

    float r = length(pos);
    if (r < RS * 1.02) { captured = true; break; }
    if (r > 90.0 && dot(pos, dir) > 0.0) { escaped = true; break; }

    // Big steps far away, small steps where the bending happens.
    float dt = clamp(0.08 * r, 0.016, 1.6);

    // Drift-kick-drift leapfrog. Second order for the cost of one force
    // evaluation, which puts the measured shadow within 0.4% of the analytic
    // 3*sqrt(3)/2 rs; plain Euler needs ~2x the steps for the same error.
    vec3 mid  = pos + dir * (dt * 0.5);
    vec3 nDir = dir + accel(mid, h2) * dt;
    vec3 nPos = mid + nDir * (dt * 0.5);

    // Plane crossing => the ray punched through the disc.
    if (pos.y * nPos.y < 0.0 && trans > 0.004) {
      float u   = pos.y / (pos.y - nPos.y);
      vec3  hit = mix(pos, nPos, u);
      float dens;
      vec3  e = discSample(hit, normalize(nDir), cross_, dens);
      col   += trans * e;
      trans *= exp(-uOpacity * dens);
      cross_++;
    }

    pos = nPos;
    dir = nDir;
  }

  // Sky behind everything the disc did not absorb.
  if (!captured) {
    vec3 d = normalize(dir);
    col += trans * uStars * starfield(d) * vec3(1.0);
    col += trans * uBackground;
  }

  // Photon ring: a very thin, near-white rim sitting just outside the shadow,
  // brightest where it meets the disc plane (screen left and right).
  if (!captured) {
    float w    = 0.055;
    float ring = exp(-pow((b - (BCRIT + w * 0.75)) / w, 2.0));
    vec2  sp   = normalize(screen + vec2(1e-6));
    float lobe = 0.22 + 0.78 * pow(abs(sp.x), 3.0);
    col += trans * uPhotonRing * ring * lobe * vec3(1.0, 0.94, 0.90);
  }

  return col;
}

void main() {
  vec2 frag = gl_FragCoord.xy;

  float e = radians(uTiltDeg);
  vec3 ro = uCamDist * vec3(0.0, sin(e), cos(e));
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);

  vec3 sum = vec3(0.0);
  for (int sy = 0; sy < AA; sy++) {
    for (int sx = 0; sx < AA; sx++) {
      vec2 off = (vec2(float(sx), float(sy)) + 0.5) / float(AA);
      vec2 p   = (frag + off - 0.5 * uRes) / uRes.y;
      vec3 rd  = normalize(fw + uZoom * (p.x * rt + p.y * up));
      sum += trace(ro, rd, p);
    }
  }
  vec3 col = sum / float(AA * AA);

  // Faint haze bleeding out of the disc: the void here picks up its colour.
  vec2 p = (frag - 0.5 * uRes) / uRes.y;
  float band = exp(-pow(p.y / 0.16, 2.0));
  float wide = exp(-dot(p, p) / 0.30);
  col += uHaze * uHazeColor * band * (0.35 + 0.65 * wide);

  fragColor = vec4(col * uExposure, 1.0);
}
`;
