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

// rgb = radiance, a = keep-clear mask: 1 where no light may appear, covering
// both the horizon and the gap that isolates it. The composite masks bloom by it.
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
const float R_IN   = 5.0;       // motes start well clear of the shadow
const float R_OUT  = 30.0;      // runs well past every frame edge
const float B_CRIT = 2.59808;   // 3*sqrt(3)*M

// Nothing is allowed to touch the black disc. Emission fades out below this
// impact parameter, which is a circle in screen space concentric with the
// shadow, so the clear gap is guaranteed by construction rather than by hoping
// the geometry cooperates -- strongly lensed images would otherwise wrap right
// up against the horizon.
const float GAP_IN  = 3.05;
const float GAP_OUT = 4.90;

// ------------------------------------------------------------------ haze ---
// The reference's broad luminous field is in the scene, not painted on top:
// the dust lanes stay dark and crisp against it, which bloom would veil. So the
// disc carries a genuine volumetric envelope, integrated along the ray.
const float HAZE_H0 = 1.60;     // slab half-thickness at the inner edge
const float HAZE_HR = 0.135;    // flare per unit radius
const float HAZE_K  = 0.0115;   // overall strength
const float HAZE_R2 = 0.0075;   // radial falloff

// ------------------------------------------------------------------ march --
const int   MAX_STEPS = 320;
const int   MAX_HITS  = 2;

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
// ------------------------------------------------------------------ motes ---
// Dust motes on a polar grid, one per cell, jittered in position, size and
// brightness. Each radial row completes a WHOLE number of turns over the loop,
// so the field returns exactly to its start; neighbouring rows take different
// counts, which is the differential rotation. Because the motes are discrete,
// the row boundaries are invisible -- no cross-fading, and so no ghosting.
const float LOG2_RIN = 2.3219281;   // log2(R_IN), R_IN = 5
const float MOTE_U = 832.0;    // cells around the disc
const float MOTE_V = 9.64;     // radial rows per unit log2(r)

float rowTurns(float lr2c) {
  return max(1.0, floor(0.6 + 3.2 * exp2((LOG2_RIN - lr2c) * 1.1) + 0.5));
}

// kR / kT are the local foreshortening of the disc's radial and tangential
// directions, taken from the ray's own tangent at the crossing. A single global
// aspect cannot work: the plane is seen at a different grazing angle across the
// frame, so motes that are round near the hole streak into radial spokes
// further out.
const float MOTE_ASPECT = 9.51;   // (ln2 * MOTE_U) / (TAU * MOTE_V)

// Large-scale clumping field, evaluated on the cell grid itself so the clusters
// ride along with the motes and wrap exactly with it.
float clusterAt(vec2 cell) {
  return fbm(vec2(cell.x * (1.0 / 32.0), cell.y * 0.30), MOTE_U / 32.0);
}

float motes(float ang, float lr2, float t, float kR, float kT) {
  float gv = lr2 * MOTE_V;
  float row0 = floor(gv);
  float u = ang / TAU + 0.5;
  float acc = 0.0;
  for (int j = -1; j <= 1; j++) {
    float row = row0 + float(j);
    float n = rowTurns((row + 0.5) / MOTE_V);
    // Whole turns can be dropped from the phase without moving a single mote,
    // and doing so keeps the coordinate small. Subtracting n*t outright loses
    // enough mantissa that t = 1 lands a rounding error away from t = 0 rather
    // than exactly on it, which breaks the loop.
    float gx = (u - fract(n * t)) * MOTE_U;
    float col0 = floor(gx);
    float fx = gx - col0;
    float fy = gv - row;
    for (int i = -1; i <= 1; i++) {
      vec2 cell = vec2(mod(col0 + float(i), MOTE_U), row);
      // Particles gather into big clumps with near-empty space between, rather
      // than spreading evenly over the disc.
      float dens = smoothstep(0.44, 0.62, clusterAt(cell));
      float h = hash21(cell);
      if (h > dens * 0.92) continue;
      vec2 sp = vec2(hash21(cell + 7.1), hash21(cell + 19.3));
      float sz = 0.26 + 0.20 * hash21(cell + 3.3);
      float br = 0.35 + 0.65 * hash21(cell + 11.7);
      float d = length(vec2((fx - float(i) - sp.x) * kT,
                            (fy - sp.y) * MOTE_ASPECT * kR));
      // Crisp: a flat core with only enough of a ramp to anti-alias the edge.
      // These are meant to read as hard little grains, not soft blobs.
      acc += br * (1.0 - smoothstep(sz * 0.62, sz, d));
    }
  }
  return acc;
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
vec3 trace(vec3 ro, vec3 rd, float gap, out float shadow) {
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
      float inner = smoothstep(R_IN, R_IN + 2.2, rc);
      float outer = 1.0 - smoothstep(R_OUT * 0.42, R_OUT, rc);
      float prof = exp2((LOG2_RIN - lr2) * 1.15) * inner * outer;
      if (rc > R_IN && rc < R_OUT && hits < MAX_HITS && prof > 2e-5 && trans > 0.01) {
        hits++;
        float cp = cos(phiCross), sp = sin(phiCross);
        vec3 w = cp * e1 + sp * e2;            // unit vector to the crossing
        vec3 wp = -sp * e1 + cp * e2;          // unit, perpendicular, along travel
        float ang = atan(w.z, w.x);

        float rp = -mix(du, dun, f) / (uc * uc);
        vec3 tang = (rp * w + rc * wp) * inversesqrt(rp * rp + rc * rc);

        // A grazing ray passes through more of the mote field.
        float halfH = 0.60 + 0.10 * rc;
        float path = clamp(halfH / max(abs(tang.y), 0.05), 0.35, 2.2);

        // Local foreshortening of the radial and tangential directions.
        vec3 vhat0 = vec3(-w.z, 0.0, w.x);
        float dwt = dot(w, tang);
        float dvt = dot(vhat0, tang);
        float kR = clamp(sqrt(max(1.0 - dwt * dwt, 0.0)), 0.02, 0.45);
        float kT = clamp(sqrt(max(1.0 - dvt * dvt, 0.0)), 0.62, 1.0);
        float m = motes(ang, lr2, uT, kR, kT);

        // Doppler: motes orbiting toward the camera are brighter. Subtle.
        float dv = 1.0 - 0.14 * dvt;
        float dopp = dv * dv;

        float temp = smoothstep(R_IN, R_OUT * 0.70, rc);
        col += trans * m * prof * dopp * path * gap * ramp(temp) * 5.2;
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
  int ss = (abs(bPix - B_CRIT) < 1.4) ? uSS : 1;

  vec3 sum = vec3(0.0);
  float edgeSum = 0.0;
  float n = 0.0;
  for (int sy = 0; sy < 2; sy++) {
    if (sy >= ss) break;
    for (int sx = 0; sx < 2; sx++) {
      if (sx >= ss) break;
      vec2 jitter = (vec2(float(sx), float(sy)) + 0.5) / float(ss);
      vec2 p = (base + jitter - centerPx) * invH;
      vec3 dir = normalize(fwd + rr * (p.x * tanHalf) + uu * (p.y * tanHalf));
      float b = CAM_DIST * length(p) * tanHalf
              / sqrt(1.0 + dot(p, p) * tanHalf * tanHalf);
      float gap = smoothstep(GAP_IN, GAP_OUT, b);
      float sh;
      sum += trace(camPos, dir, gap, sh);
      edgeSum += max(sh, 1.0 - smoothstep(B_CRIT + 0.10, B_CRIT + 1.60, b));
      n += 1.0;
    }
  }

  fragColor = vec4(sum / n * uGain, edgeSum / n);
}
`;
