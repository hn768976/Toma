// Main scene pass: gravitational lensing around a Schwarzschild black hole.
//
// Units: rs = 1 (M = 0.5). Horizon r = 1, photon sphere r = 1.5, critical
// impact parameter b = 3*sqrt(3)*M = 2.598 — the apparent edge of the shadow.
//
// Rather than marching a 3D deflection field, each ray is integrated in its own
// orbital plane using the null-geodesic orbit equation u'' + u = 3M u² (u = 1/r),
// which is exact for photons in Schwarzschild and costs a handful of scalar ops
// per step. The disc plane is crossed at exactly two known values of phi per
// turn, so crossings are found analytically instead of by sampling.
//
// Every time-varying term is periodic in uT (the normalised loop position in
// [0,1)), so the loop closes by construction rather than by tuning.

export const SCENE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

// rgb = radiance, a = horizon mask (1 where the ray fell through the horizon).
out vec4 fragColor;

uniform vec2  uRes;      // render resolution in px
uniform float uT;        // normalised loop time, [0,1)
uniform vec2  uCenter;   // horizon centre, fraction of (width, height-from-top)
uniform int   uPalette;  // 0 = mono, 1 = gold, 2 = blue
uniform int   uSS;       // supersample factor per axis away from the shadow edge
uniform float uGain;     // HDR encode factor for the 8-bit fallback path

const float PI  = 3.14159265359;
const float TAU = 6.28318530718;

// ---------------------------------------------------------------- camera ---
const float CAM_DIST = 34.0;
const float CAM_ELEV = 0.105;   // rad above the disc plane (~6 deg, near edge-on)
const float CAM_ROLL = 0.36;    // rad, tilts the disc lower-left -> upper-right
const float FOV_Y    = 0.44;    // full vertical field of view, rad

// ------------------------------------------------------------------ disc ---
const float R_IN   = 3.0;       // ISCO = 6M
const float R_OUT  = 26.0;      // runs well past every frame edge
const float B_CRIT = 2.59808;   // 3*sqrt(3)*M

// ------------------------------------------------------------------ haze ---
// The reference's broad luminous field is in the scene, not painted on top:
// the dust lanes stay dark and crisp against it, which bloom would veil. So the
// disc carries a genuine volumetric envelope, integrated along the ray.
const float HAZE_H0 = 0.95;     // slab half-thickness at the inner edge
const float HAZE_HR = 0.105;    // flare per unit radius
const float HAZE_K  = 0.056;    // overall strength
const float HAZE_R2 = 0.0105;   // radial falloff

// ------------------------------------------------------------------ march --
const int   MAX_STEPS = 320;
const int   MAX_HITS  = 3;

// ------------------------------------------------------------------- noise --
float hash21(vec2 p) {
  p = fract(p * vec2(127.331, 311.727));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Value noise whose x axis wraps with period P, so an angular coordinate can be
// advanced by whole turns and land exactly back on itself.
float pnoise(vec2 p, float P) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, P);
  float x1 = mod(i.x + 1.0, P);
  float a = hash21(vec2(x0, i.y));
  float b = hash21(vec2(x1, i.y));
  float c = hash21(vec2(x0, i.y + 1.0));
  float d = hash21(vec2(x1, i.y + 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, float P) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 3; i++) {
    s += a * pnoise(p, P);
    n += a;
    p = p * 2.0 + vec2(0.0, 19.7);
    P *= 2.0;
    a *= 0.5;
  }
  return s / n;
}

// Five octaves at high persistence: the fine detail keeps real weight, which
// is what makes the lanes read as torn, granular dust instead of a soft smudge.
const float DUST_NORM = 1.0 / 2.3928;

float fbmRough(vec2 p, float P) {
  float s = pnoise(p, P);
  p = p * 2.0 + vec2(0.0, 19.7); P *= 2.0;
  s += 0.62 * pnoise(p, P);
  p = p * 2.0 + vec2(0.0, 11.3); P *= 2.0;
  s += 0.3844 * pnoise(p, P);
  p = p * 2.0 + vec2(0.0, 27.1); P *= 2.0;
  s += 0.2383 * pnoise(p, P);
  p = p * 2.0 + vec2(0.0, 5.9); P *= 2.0;
  s += 0.1478 * pnoise(p, P);
  return s * DUST_NORM;
}

// Same two-layer construction as rotLayer, on the rough noise.
float rotLayerRough(float u, float v, float t, float turns, float P) {
  float n0 = floor(turns);
  float s0 = fract(n0 * t);
  float s1 = fract((n0 + 1.0) * t);
  float a = fbmRough(vec2((u - s0) * P, v), P);
  float b = fbmRough(vec2((u - s1) * P, v), P);
  float w = smoothstep(0.14, 0.86, turns - n0);
  float m = mix(a, b, w) - 0.5;
  return 0.5 + m * inversesqrt((1.0 - w) * (1.0 - w) + w * w);
}

const float LOG2_RIN = 1.5849625;     // log2(R_IN), R_IN = 3

// Turns completed over one loop at radius r. Compressed Keplerian shear:
// fast inner material, ~1.2 turns at the outer edge over the 30s loop.
// lr2 is log2(r), shared with everything else that needs it.
float turnsAt(float lr2) {
  return 1.2 + 2.9 * exp2((LOG2_RIN - lr2) * 1.05);
}

// One rotating noise layer. The phase is split across the two integer turn
// counts bracketing turns and cross-faded by a time-independent weight: each
// layer returns exactly to its start after a whole number of turns, while the
// blend still reads as continuous differential rotation.
float rotLayer(float u, float v, float t, float turns, float P) {
  float n0 = floor(turns);
  // The pattern is periodic in u with period 1, so whole turns can be dropped
  // from the phase without changing a pixel. Doing so keeps the noise
  // coordinate small, which is what makes t = 1 land bit-exactly on t = 0
  // instead of a rounding error away from it.
  float s0 = fract(n0 * t);
  float s1 = fract((n0 + 1.0) * t);
  float a = fbm(vec2((u - s0) * P, v), P);
  float b = fbm(vec2((u - s1) * P, v), P);
  // Renormalise the contrast the blend would otherwise wash out, or the band
  // boundaries read as concentric rings.
  float w = smoothstep(0.14, 0.86, turns - n0);
  float m = mix(a, b, w) - 0.5;
  return 0.5 + m * inversesqrt((1.0 - w) * (1.0 - w) + w * w);
}

// Bright material: fine filaments stretched along the direction of travel.
float material(float ang, float lr2, float turns, float t) {
  return rotLayer(ang / TAU, lr2 * 6.40, t, turns, 62.0);
}

// Dust lanes: coarser, higher contrast, sheared into arms and drifting slower
// than the material so the striations shear over the loop.
// The lanes are carved out of the same turbulence that shapes the material,
// which is what gives them torn edges instead of smooth bands. Passing the
// material noise back in buys that raggedness for free.
float dust(float ang, float r, float lr2, float turns, float t, float mat) {
  float d = rotLayerRough(ang / TAU + lr2 * 0.30, lr2 * 2.45, t, turns * 0.55, 6.0);
  float outer = smoothstep(R_IN, R_IN + 3.0, r);
  // The lanes are carved by the same turbulence that shapes the material, which
  // is what tears their edges instead of leaving smooth bands.
  d = d + (mat - 0.5) * (0.62 + 0.55 * outer);
  return smoothstep(0.625 - 0.045 * outer, 0.330 - 0.045 * outer, d) * (0.60 + 0.40 * outer);
}

// ---------------------------------------------------------------- palette ---
vec3 ramp(float x) {
  x = clamp(x, 0.0, 1.0);
  // Mono: near-white core through greys, no tint anywhere.
  vec3 c0 = vec3(1.000), c1 = vec3(0.900), c2 = vec3(0.740), c3 = vec3(0.550);
  if (uPalette == 1) {
    c0 = vec3(1.000, 1.000, 0.980);
    c1 = vec3(1.000, 0.824, 0.478);   // #ffd27a
    c2 = vec3(0.910, 0.537, 0.165);   // #e8892a
    c3 = vec3(0.478, 0.184, 0.063);   // #7a2f10
  } else if (uPalette == 2) {
    c0 = vec3(1.000, 1.000, 1.000);
    c1 = vec3(0.659, 0.910, 1.000);   // #a8e8ff
    c2 = vec3(0.165, 0.498, 0.910);   // #2a7fe8
    c3 = vec3(0.051, 0.165, 0.420);   // #0d2a6b
  }
  // Branchless: the segment selects itself. Per-pixel branching is by far the
  // most expensive thing this shader can do on a software rasteriser.
  vec3 a = mix(c0, c1, clamp(x * 3.846, 0.0, 1.0));
  vec3 b = mix(c1, c2, clamp((x - 0.26) * 2.941, 0.0, 1.0));
  vec3 c = mix(c2, c3, clamp((x - 0.60) * 2.500, 0.0, 1.0));
  return mix(mix(a, b, step(0.26, x)), c, step(0.60, x));
}

// -------------------------------------------------------------- starfield ---
// Cells are sized in angular units, so a star covers the same solid angle at
// 1080p and at 4K. Stars near the shadow are smeared into arcs for free: the
// deflected direction varies enormously from pixel to pixel there.
const float STAR_U = 1280.0;
const float STAR_V = 640.0;

vec3 starfield(vec3 dir, float t) {
  float u = atan(dir.z, dir.x) / TAU + 0.5;
  float v = acos(clamp(dir.y, -1.0, 1.0)) / PI;
  float gy = v * STAR_V;
  float row0 = floor(gy);
  float acc = 0.0;

  // Equal-area rings: each latitude row gets its own integer cell count,
  // proportional to sin(theta). A single u-grid degenerates at the poles, where
  // one cell spans a whole latitude circle and smears one star into a long arc
  // across the frame.
  for (int y = -1; y <= 1; y++) {
    float row = row0 + float(y);
    float sinT = sin(clamp((row + 0.5) / STAR_V, 0.0, 1.0) * PI);
    float ku = max(4.0, floor(STAR_U * sinT + 0.5));
    float gx = u * ku;
    float col0 = floor(gx);
    float fx = gx - col0;
    float fy = gy - row;
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 cell = vec2(mod(col0 + o.x, ku), row);
      float h = hash21(cell);
      if (h < 0.876) continue;                     // ~1200 stars inside the frame
      vec2 sp = vec2(hash21(cell + 7.1), hash21(cell + 19.3));
      float mag = hash21(cell + 3.7);
      float bri = mag * mag * mag * 4.6 + 0.10;
      // A handful twinkle on an integer-period cycle, so the flicker loops.
      float tw = step(0.80, hash21(cell + 41.9));
      float k = floor(1.0 + 3.0 * hash21(cell + 55.1));
      // fract() keeps the phase argument bit-identical at t = 0 and t = 1;
      // sin(TAU*k + x) is only periodic in exact arithmetic, not in floats.
      bri *= mix(1.0, 0.55 + 0.45 * sin(TAU * fract(k * t + mag)), tw);
      float rad = 0.075 + 0.055 * mag;
      float d = length(vec2(fx - o.x - sp.x, fy - sp.y));
      acc += bri * smoothstep(rad, rad * 0.15, d);
    }
  }
  return vec3(acc);
}

// ------------------------------------------------------------------ trace ---
// Integrates one photon backwards from the camera. Returns radiance; shadow
// is 1 where the ray ended inside the horizon.
vec3 trace(vec3 ro, vec3 rd, out float shadow) {
  shadow = 0.0;
  vec3 col = vec3(0.0);
  float trans = 1.0;

  float r0 = length(ro);
  vec3 e1 = ro / r0;
  float radial = dot(rd, e1);
  vec3 perp = rd - e1 * radial;
  float pl = length(perp);
  if (pl < 1e-5) { shadow = 1.0; return col; }   // dead-on radial ray
  vec3 e2 = perp / pl;

  // Position on the orbit is r(phi) * (cos(phi) e1 + sin(phi) e2). Its y
  // component vanishes every pi radians starting here, so disc-plane crossings
  // are known in closed form instead of being hunted for.
  float phiCross = atan(-e1.y, e2.y);
  phiCross += ceil(-phiCross / PI) * PI;

  float u = 1.0 / r0;
  float du = -radial / (r0 * pl);   // du/dphi at phi = 0
  float phi = 0.0;
  float rmin = r0;
  int hits = 0;

  // cos/sin of phi, advanced by a small-angle rotation each step so the haze
  // can be sampled off the disc plane without a trig call per step. The disc
  // crossings and the exit direction still use exact cos/sin -- this drives
  // only the smooth envelope, where a little phase drift is invisible.
  float cf = 1.0, sf = 0.0;
  float hazeAcc = 0.0, hazeTemp = 0.0;
  float dustFront = 0.0;
  bool escaped = false;
  bool opaque = false;
  float outU = 1.0 / r0, outDu = 0.0, outPhi = 0.0;

  for (int i = 0; i < MAX_STEPS; i++) {
    // Fine steps close in where the 3M u² term bites, coarse ones far out.
    float dphi = clamp(0.030 / (u + 0.055), 0.018, 0.10);
    // On the way out, never let a step carry u past the escape threshold: it
    // would sail through zero into negative r and fake extra windings, which
    // shows up as spurious concentric rings of duplicated disc.
    if (du < 0.0) dphi = min(dphi, 0.30 * u / max(-du, 1e-5));

    // Midpoint step on u'' = -u + 3M u², M = 0.5.
    float a0 = -u + 1.5 * u * u;
    float uM = u + du * dphi * 0.5;
    float dM = du + a0 * dphi * 0.5;
    float aM = -uM + 1.5 * uM * uM;
    float un = u + dM * dphi;
    float dun = du + aM * dphi;
    float phin = phi + dphi;

    if (un >= 1.0) { shadow = 1.0; return vec3(0.0); }   // through the horizon
    if (un <= 0.0) { escaped = true; break; }            // numerically past infinity

    rmin = min(rmin, 1.0 / un);

    // Volumetric envelope: a flared, optically-thin slab of glowing material
    // around the disc plane. This is what fills the frame with the soft
    // luminous field the reference has, while leaving the dust lanes to cut
    // dark across it.
    {
      float rNow = 1.0 / un;
      float sy = cf * e1.y + sf * e2.y;          // y / r on the orbit
      float hh = HAZE_H0 + HAZE_HR * rNow;
      float q = rNow * sy / hh;
      float vert = 1.0 / (1.0 + q * q);
      vert *= vert;
      float hp = HAZE_K / (1.0 + rNow * rNow * HAZE_R2);
      float dl = rNow * dphi;
      float amt = trans * vert * hp * dl * step(R_IN * 0.75, rNow)
                * (1.0 - smoothstep(R_OUT * 0.30, R_OUT * 0.78, rNow));
      hazeAcc += amt;
      hazeTemp += amt * smoothstep(R_IN, R_OUT * 0.55, rNow);
    }

    if (phiCross < phin) {
      float f = (phiCross - phi) / dphi;
      float uc = mix(u, un, f);
      float rc = 1.0 / uc;
      float lr2 = log2(rc);
      float inner = smoothstep(R_IN, R_IN + 0.5, rc);
      float outer = 1.0 - smoothstep(R_OUT * 0.28, R_OUT * 0.68, rc);
      float prof = exp2((LOG2_RIN - lr2) * 1.55) * inner * outer;
      if (rc > R_IN && rc < R_OUT && hits < MAX_HITS && prof > 2e-5 && trans > 0.01) {
        hits++;
        float cp = cos(phiCross), sp = sin(phiCross);
        vec3 w = cp * e1 + sp * e2;            // unit vector to the crossing
        vec3 wp = -sp * e1 + cp * e2;          // unit, perpendicular, along travel
        float ang = atan(w.z, w.x);

        // Tangent at the crossing, for the Doppler shift and for how much slab
        // the ray actually traverses. w and wp are orthonormal, so the norm is
        // known without touching the components.
        float rp = -mix(du, dun, f) / (uc * uc);
        vec3 tang = (rp * w + rc * wp) * inversesqrt(rp * rp + rc * rc);

        // A flared slab of finite thickness, not a razor plane: a grazing ray
        // travels much further through the material, which is what makes an
        // edge-on disc read as thick and hot rather than as a wire.
        float halfH = 0.34 + 0.085 * rc;
        float path = clamp(halfH / max(abs(tang.y), 0.04), 0.30, 2.6);

        float turns = turnsAt(lr2);
        float mat = material(ang, lr2, turns, uT);
        float d = clamp((mat - 0.17) * 1.60, 0.0, 1.0);
        float dens = d * (0.6 + 0.4 * d);

        // Orbital direction at a point in the disc plane, unit by construction.
        vec3 vhat = vec3(-w.z, 0.0, w.x);
        float dv = 1.0 + 0.18 * dot(vhat, -tang);
        float dopp = dv * dv;

        float dustA = clamp(dust(ang, rc, lr2, turns, uT, mat), 0.0, 0.995);
        if (hits == 1) dustFront = dustA;   // the column nearest the camera

        float ordDim = (hits > 2) ? 0.38 : 1.0;
        float emis = prof * (0.14 + 1.15 * dens) * dopp * path * ordDim;
        float temp = smoothstep(R_IN, R_OUT * 0.55, rc);
        col += trans * emis * ramp(temp) * (1.0 - dustA) * 2.9;

        // The near side of the disc partly occludes the lensed arcs behind it.
        float opa = clamp(dens * prof * path * 2.6, 0.0, 0.90) * inner;
        trans *= (1.0 - opa) * (1.0 - dustA * 0.96);
      }
      phiCross += PI;
    }

    // Second-order rotation of (cos phi, sin phi) by dphi, renormalised.
    float hq = dphi * dphi * 0.5;
    float cd = 1.0 - hq;
    float sd = dphi * (1.0 - hq / 3.0);
    float ncf = cf * cd - sf * sd;
    float nsf = sf * cd + cf * sd;
    float rn = 1.5 - 0.5 * (ncf * ncf + nsf * nsf);
    cf = ncf * rn; sf = nsf * rn;

    u = un; du = dun; phi = phin;
    outU = u; outDu = du; outPhi = phi;

    if (trans < 0.004) { opaque = true; break; }

    // Past the disc and heading out: nothing left to bend it.
    if (u < 1.0 / (R_OUT * 1.25) && du < 0.0) { escaped = true; break; }
  }

  // Running out of steps means the ray is winding at the photon sphere. Those
  // pixels are the ring itself, so let them out rather than blacking them in.
  if (!escaped && !opaque && shadow < 0.5) escaped = true;

  // The envelope is added whether or not the ray escaped, but never for a ray
  // that fell through the horizon -- that path returns black above.
  hazeAcc *= 1.0 - 0.82 * dustFront;
  col += hazeAcc * ramp(hazeTemp / max(hazeAcc, 1e-6));

  if (escaped) {
    // Asymptotic exit direction in closed form. Far from the hole the orbit is
    // a straight line u = sin(phi - phi0)/b, so the sweep still owed to
    // infinity is pi - atan(u, du). Reading the direction off the last
    // integration step instead makes it jump wherever the step count changes
    // between neighbouring pixels, which tears the starfield into false arcs.
    float phiInf = outPhi + PI - atan(outU, outDu);
    vec3 dirOut = normalize(cos(phiInf) * e1 + sin(phiInf) * e2);
    col += trans * starfield(dirOut, uT) * 1.15;

    // Photon ring: rays grazing the photon sphere wind around it repeatedly and
    // come back out along the shadow's edge, brighter than anything else here.
    float ring = exp(-max(rmin - 1.502, 0.0) / 0.026);
    col += ring * ramp(0.0) * 21.0;
  }

  return col;
}

void main() {
  vec2 centerPx = vec2(uCenter.x * uRes.x, (1.0 - uCenter.y) * uRes.y);
  float invH = 1.0 / (0.5 * uRes.y);
  float tanHalf = tan(FOV_Y * 0.5);

  vec3 camPos = vec3(0.0, sin(CAM_ELEV), cos(CAM_ELEV)) * CAM_DIST;
  vec3 fwd = normalize(-camPos);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  float cr = cos(CAM_ROLL), sr = sin(CAM_ROLL);
  vec3 rr = right * cr + up * sr;
  vec3 uu = up * cr - right * sr;

  vec2 base = gl_FragCoord.xy - 0.5;
  vec2 pc = (base + 0.5 - centerPx) * invH;

  // Supersample only the band around the critical impact parameter, where the
  // horizon edge, the photon ring and the tightest arcs all live. Everywhere
  // else one ray per pixel is already smooth.
  float bPix = CAM_DIST * length(vec2(pc.x, pc.y)) * tanHalf
             / sqrt(1.0 + dot(pc, pc) * tanHalf * tanHalf);
  int ss = (abs(bPix - B_CRIT) < 1.1) ? uSS : 1;

  vec3 sum = vec3(0.0);
  float shadowSum = 0.0;
  float n = 0.0;
  for (int sy = 0; sy < 2; sy++) {
    if (sy >= ss) break;
    for (int sx = 0; sx < 2; sx++) {
      if (sx >= ss) break;
      vec2 jitter = (vec2(float(sx), float(sy)) + 0.5) / float(ss);
      vec2 p = (base + jitter - centerPx) * invH;
      vec3 dir = normalize(fwd + rr * (p.x * tanHalf) + uu * (p.y * tanHalf));
      float sh;
      sum += trace(camPos, dir, sh);
      shadowSum += sh;
      n += 1.0;
    }
  }

  fragColor = vec4(sum / n * uGain, shadowSum / n);
}
`;
