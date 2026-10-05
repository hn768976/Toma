import { COMMON_GLSL } from "./common";

// Black-hole look. Units: Schwarzschild radius r_s = 1 (photon sphere 1.5,
// ISCO 3). Each camera ray is integrated through the Schwarzschild metric
// using the standard Binet-equivalent acceleration a = -1.5 h^2 x / r^5
// (h = |x × v|), velocity-Verlet with a step proportional to r. Rays that
// cross r = 1 are captured (black); rays that escape sample a procedural sky
// in their *bent* direction, so stars and haze are lensed too. The accretion
// disc is a thin emissive/absorbing volume sampled wherever a step segment
// crosses its plane: a thin gaussian layer whose column emission and
// opacity follow the viewing angle. Shot 3 adds a thick cloud deck over the
// outer disc (DECK == 1): a flowing fbm heightfield found along the same bent
// rays, which occludes the direct view of the far disc so that only the
// lensed arc rises above the horizon.
//
// Compile-time quality: MAX_STEPS, OCTAVES, DECK_STEPS, DECK_BISECT (see shots.ts).

export const BLACKHOLE_FRAG = /* glsl */ `
${COMMON_GLSL}

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uPhase;          // 0..1 over the 600-frame loop
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanHalf;        // tan(fovY/2)
uniform vec2 uShift;           // lens shift in NDC (moves the hole in frame)
uniform float uStepScale;

// disc
uniform float uRin;
uniform float uRout;
uniform float uThick;          // gaussian half-thickness / r
uniform float uThickFlat;      // 0 = H grows with r (cone), 1 = flat deck of height uThick * uThickR
uniform float uThickR;
float discH(float r) { return uThick * mix(r, uThickR, uThickFlat); }
uniform float uDiscBright;
uniform float uAbsorb;
uniform float uFallPow;
uniform vec2 uStreakFreq;      // (radial, angular) noise frequency
uniform float uStreakSharp;
uniform float uStreakMix;      // 0 = smooth cloudy disc, 1 = all filaments
uniform float uCloudFreq;
uniform float uInnerTurns;     // turns per loop at r = uRin (Kepler falloff)
uniform float uDoppler;
uniform vec3 uColHot;
uniform vec3 uColMid;
uniform vec3 uColOuter;
// cloud deck (DECK == 1)
uniform float uDeckTop;        // mean deck height above the disc plane
uniform float uDeckAmp;        // billow height
uniform float uDeckR0;         // deck starts (rises) beyond this radius
uniform float uDeckFreq;
uniform float uDeckFog;        // depth fade distance toward the horizon
uniform float uDeckGlow;
uniform vec3 uDeckCol;
uniform vec3 uDeckColHi;
uniform vec3 uDeckFogCol;
uniform float uDofDist;        // camera distance of the soft foreground blur
uniform float uDofAmt;

// dusty outer streams
uniform float uDust;
uniform float uDustAz;
uniform float uDustWidth;
uniform float uDustThick;
uniform vec3 uDustCol;

// photon ring / haze / sky
uniform float uRing;
uniform vec3 uHazeCol;
uniform float uHazeGlow;
uniform float uHazeRadius;
uniform vec3 uBgCol;
uniform vec3 uBgTop;
uniform float uBandStr;        // faint galactic haze band across the sky
uniform vec3 uBandNormal;
uniform vec3 uBandCol;
uniform float uRingTop;        // 0 = uniform photon ring, 1 = only its upper half
uniform float uStarDensity;
uniform float uStarBright;
uniform float uSeed;
uniform float uPixAngle;       // radians per pixel (vertical)
uniform float uSkyLens;        // 1 = fully lensed sky, <1 tames star smearing

// ---------------------------------------------------------------------------

float streakNoise(float r, float ang, float y, float fpR) {
  // Concentric filaments: ridged noise with high radial frequency and low
  // angular frequency on a circle (so the pattern is periodic in angle).
  float ca = cos(ang), sa = sin(ang);
  vec3 q = vec3(r * uStreakFreq.x, ca * uStreakFreq.y, sa * uStreakFreq.y);
  float fil = ridgedLod(q, OCTAVES, fpR * uStreakFreq.x);
  fil = pow(fil, uStreakSharp) * 2.4;
  // Clouds: low anisotropy, includes height so the thick disc billows.
  vec3 c = vec3(r * uCloudFreq, ca * uCloudFreq * 3.0 + y * uCloudFreq * 2.0, sa * uCloudFreq * 3.0);
  float cl = fbmLod(c + 31.7, OCTAVES - 1, fpR * uCloudFreq);
  cl = smoothstep(0.2, 0.8, cl);
  return mix(cl * 1.3, fil, uStreakMix) * (0.45 + 1.1 * cl);
}

// Seamless flow: Keplerian angular velocity per radius, crossfading two
// time phases (t and t - 1 loop) with variance-preserving weights. At t = 0
// only phase A is seen, at t -> 1 only phase B, and B(1) == A(0).
float flowNoise(float r, float phi, float y, float fpR) {
  float omega = uInnerTurns * TAU * pow(uRin / max(r, uRin * 0.5), 1.5);
  float t = uPhase;
  float nA = streakNoise(r, phi - omega * t, y, fpR);
  float nB = streakNoise(r, phi - omega * (t - 1.0), y, fpR);
  float w = t;
  float n = mix(nA, nB, w);
  float mean = 0.5;
  return max(mean + (n - mean) / sqrt((1.0 - w) * (1.0 - w) + w * w), 0.0);
}

// Returns emission (rgb) and extinction (a) per unit length at point p.
vec4 discField(vec3 p, vec3 rd, float fp) {
  float r = length(p.xz);
  float H = discH(r);
  float vy = p.y / H;
  float vert = exp(-vy * vy);

  float inner = smoothstep(uRin * 0.93, uRin * 1.07, r);
  float outer = 1.0 - smoothstep(uRout * 0.55, uRout, r);
  float prof = inner * outer * pow(uRin / r, uFallPow);

  float phi = atan(p.z, p.x);
  vec3 em = vec3(0.0);
  float ext = 0.0;

  if (prof * vert > 1e-4) {
    float n = flowNoise(r, phi, p.y / max(H, 1e-3), fp);
    float dens = prof * vert * n;

    // temperature ramp: white-hot at the inner edge
    float temp = clamp(pow(uRin / r, 0.7), 0.0, 1.0);
    vec3 col = temp > 0.5 ? mix(uColMid, uColHot, smoothstep(0.55, 0.92, temp))
                          : mix(uColOuter, uColMid, smoothstep(0.12, 0.5, temp));
    // white-hot inner rim
    col += uColHot * 2.5 * exp(-(r - uRin) / (0.08 * uRin)) * step(uRin, r);

    // relativistic beaming (strength scaled for art direction)
    vec3 vdir = normalize(vec3(-p.z, 0.0, p.x));
    float beta = uDoppler * sqrt(0.5 / max(r - 1.0, 0.6));
    float cosT = dot(vdir, -rd);
    float gamma = inversesqrt(1.0 - beta * beta);
    float D = 1.0 / (gamma * (1.0 - beta * cosT));
    float beam = D * D * D;
    float grav = sqrt(max(1.0 - 1.0 / r, 0.0));

    em += col * dens * beam * grav * uDiscBright;
    ext += dens * uAbsorb;
  }

  if (uDust > 0.0) {
    // Dusty outer streams: cloudy, trailing spiral lobes centred on uDustAz.
    float rr = r / uRout;
    float lobe = smoothstep(0.5, 0.85, rr) * (1.0 - smoothstep(1.1, 1.9, rr));
    float spiralAz = uDustAz - 0.25 * log(max(rr, 0.1));
    float da = atan(sin(phi - spiralAz), cos(phi - spiralAz));
    float am = exp(-da * da / (uDustWidth * uDustWidth));
    float Hd = uDustThick * r;
    float dv = exp(-(p.y * p.y) / (Hd * Hd));
    float m = lobe * am * dv;
    if (m > 1e-3) {
      float omega = 0.5 * uInnerTurns * TAU * pow(uRin / r, 1.5);
      float t = uPhase;
      vec3 qa = vec3(r * 0.35, cos(phi - omega * t) * 2.2 + p.y * 0.4, sin(phi - omega * t) * 2.2);
      vec3 qb = vec3(r * 0.35, cos(phi - omega * (t - 1.0)) * 2.2 + p.y * 0.4, sin(phi - omega * (t - 1.0)) * 2.2);
      float fa = fbmLod(qa, OCTAVES, fp * 0.35);
      float fb = fbmLod(qb, OCTAVES, fp * 0.35);
      float f = mix(fa, fb, t);
      f = 0.5 + (f - 0.5) / sqrt((1.0 - t) * (1.0 - t) + t * t);
      float d = m * smoothstep(0.22, 0.85, f);
      em += uDustCol * d * uDust;
      ext += d * uAbsorb * 0.6;
    }
  }
  return vec4(em, ext);
}

#if DECK == 1
// Deck billows co-rotate with the disc (Keplerian), crossfading two time
// phases exactly like flowNoise so the loop is seamless.
float deckNoise1(vec2 xz, float r, float ang, float fp, int octs) {
  vec2 q = vec2(cos(ang), sin(ang)) * r;
  vec3 c = vec3(q.x * uDeckFreq, q.y * uDeckFreq, r * uDeckFreq * 0.7);
  return fbmLod(c, octs, fp * uDeckFreq);
}
float deckNoise(vec3 p, float fp, int octs) {
  float r = length(p.xz);
  float phi = atan(p.z, p.x);
  float omega = uInnerTurns * TAU * pow(uRin / max(r, uRin), 1.5);
  float t = uPhase;
  float a = deckNoise1(p.xz, r, phi - omega * t, fp, octs);
  float b = deckNoise1(p.xz, r, phi - omega * (t - 1.0), fp, octs);
  float n = mix(a, b, t);
  return 0.5 + (n - 0.5) / sqrt((1.0 - t) * (1.0 - t) + t * t);
}
// The deck covers the outer disc on the camera's side only: it hides the
// direct view of the far disc at the horizon, while the lensed arc (rays
// arriving from above, after swinging round the hole) stays clear.
uniform vec3 uDeckSide;
float deckRise(vec3 p) {
  float r = length(p.xz);
  float side = smoothstep(-0.15, 0.35, dot(p.xz / max(r, 1e-3), uDeckSide.xz));
  return smoothstep(uDeckR0, uDeckR0 + 3.0, r) * side;
}
// octs: the surface is found with DECK_GEOM_OCT octaves; the full OCTAVES
// only feed the shading normal (a normal map on the coarse billows).
float deckG(vec3 p, float fp, int octs) {
  if (p.y < 0.0 || p.y > uDeckTop + 0.5 * uDeckAmp) return 1.0;   // only ever hit from above
  float rise = deckRise(p);
  if (rise <= 0.0) return 1.0;                  // no deck here
  // billows flatten with distance so far, grazing crossings are smooth
  float ampF = 1.0 / (1.0 + 2.0 * length(p - uCamPos) / uDeckFog);
  float top = (uDeckTop + uDeckAmp * ampF * (deckNoise(p, fp, octs) - 0.5)) * rise;
  return p.y - top;
}
#endif

vec3 sky(vec3 d) {
  // haze gradient
  vec3 col = mix(uBgCol, uBgTop, smoothstep(-0.6, 0.8, d.y));
  float neb = fbmLod(d * 3.0 + uSeed, 4, 0.0);
  col *= 0.55 + 0.9 * neb;
  if (uBandStr > 0.0) {
    float bd = dot(d, uBandNormal);
    float band = exp(-bd * bd / 0.02) * (0.4 + 1.2 * fbmLod(d * 6.0 + 3.1, 4, 0.0));
    float lane = 1.0 - 0.6 * exp(-pow(bd + 0.06, 2.0) / 0.0015);
    col += uBandCol * uBandStr * band * lane;
  }

  // stars: one candidate per cell on a direction grid, two layers.
  for (int L = 0; L < 2; L++) {
    float K = L == 0 ? 90.0 : 32.0;
    vec3 g = d * K;
    ivec3 cell = ivec3(floor(g));
    vec3 h = hash33i(cell + ivec3(int(uSeed) * 7 + L * 1000));
    if (h.z < uStarDensity * (L == 0 ? 1.0 : 0.35)) {
      vec3 sp = (vec3(cell) + 0.25 + 0.5 * h) / K;
      vec3 sd = normalize(sp);
      float ang = length(cross(d, sd));
      // star radius never below ~1.2 px so it cannot sparkle; flux conserved
      float baseR = (L == 0 ? 0.0005 : 0.0009);
      float rad = max(baseR, uPixAngle * 0.75);
      float flux = baseR * baseR / (rad * rad);
      float b = exp(-ang * ang / (rad * rad)) * flux;
      float mag = pow(hash13i(cell + ivec3(77, 5, 3)), 6.0) * 3.0 + 0.15;
      vec3 tint = mix(vec3(1.0, 0.85, 0.75), vec3(0.8, 0.9, 1.0), hash13i(cell + ivec3(3, 9, 1)));
      col += tint * b * mag * uStarBright * (L == 0 ? 1.0 : 2.5);
    }
  }
  return col;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec3 rd = normalize(uCamFwd
    + (ndc.x - uShift.x) * uTanHalf * aspect * uCamRight
    + (ndc.y - uShift.y) * uTanHalf * uCamUp);

  vec3 pos = uCamPos;
  vec3 vel = rd;
  vec3 hv = cross(pos, vel);
  float h2 = dot(hv, hv);
  float b = sqrt(h2);                       // impact parameter

  vec3 col = vec3(0.0);
  float T = 1.0;                            // transmittance
  float s = 0.0;                            // path length (for footprint)
  int crossings = 0;
  bool captured = false;

#if DECK == 1
  // ---- cloud deck pre-pass. The deck is near the camera where bending is
  // weak, so it is found along the straight camera ray: march to the first
  // heightfield crossing, refine by bisection, shade, and skip the geodesic.
  if (rd.y < 0.0) {
    float deckMax = uDeckTop + 0.5 * uDeckAmp;     // noise in [0,1] -> top +- amp/2
    float t0 = max((uCamPos.y - deckMax) / -rd.y, 0.0);
    float t1 = min(uCamPos.y / -rd.y, t0 + uDeckFog * 4.0);
    float tPrev = t0;
    float ta = t0, tb = t0;
    bool hitD = false;
    for (int k = 1; k <= DECK_STEPS; k++) {
      float tk = mix(t0, t1, pow(float(k) / float(DECK_STEPS), 1.7));
      if (deckG(uCamPos + rd * tk, tk * uPixAngle * 4.0, DECK_GEOM_OCT) <= 0.0) {
        ta = tPrev; tb = tk; hitD = true; break;
      }
      tPrev = tk;
    }
    if (hitD) {
      for (int k = 0; k < DECK_BISECT; k++) {
        float tm = 0.5 * (ta + tb);
        if (deckG(uCamPos + rd * tm, tm * uPixAngle * 4.0, DECK_GEOM_OCT) > 0.0) ta = tm; else tb = tm;
      }
      float sq = 0.5 * (ta + tb);
      vec3 q = uCamPos + rd * sq;
      float inc = max(abs(rd.y), 0.05);
      float fp = sq * uPixAngle / inc;
      if (uDofDist > 0.0) fp = max(fp, uDofAmt * max(1.0 - sq / uDofDist, 0.0));
      // normal from finite differences (step never below the footprint)
      float e = max(0.04, fp * 0.5);
      float g0 = deckG(q, fp, OCTAVES);
      float gx = deckG(q + vec3(e, 0.0, 0.0), fp, OCTAVES);
      float gz = deckG(q + vec3(0.0, 0.0, e), fp, OCTAVES);
      vec3 N = normalize(vec3(-(gx - g0) / e, 1.0, -(gz - g0) / e));
      float rq = length(q.xz);
      vec3 L = normalize(vec3(-q.x, 0.6 * rq, -q.z));       // lit by the inner disc
      float diff = clamp(dot(N, L), 0.0, 1.0);
      float hgt = clamp((q.y / max(deckRise(q), 1e-3) - uDeckTop) / uDeckAmp + 0.5, 0.0, 1.0);
      float glow = uDeckGlow * pow(uRin * 1.8 / rq, 1.2);
      float lit = clamp(diff * diff * (0.2 + 1.2 * hgt), 0.0, 1.5);
      vec3 dc = mix(uDeckCol, uDeckColHi, clamp(lit, 0.0, 1.0)) * glow * (0.06 + 2.2 * pow(lit, 1.5));
      // haze in front of the deck, then depth fade toward the horizon
      float hz = uHazeGlow * exp(-length(q) / uHazeRadius) * sq * 0.1;
      dc += uHazeCol * hz;
      float fog = 1.0 - exp(-sq / uDeckFog);
      dc = mix(dc, uDeckFogCol, fog * 0.8);
      // cloud tops at the deck's inner edge face the white-hot inner disc:
      // a blazing strip along the horizon under the arc
      float edge = exp(-max(rq - uDeckR0, 0.0) / 3.5) * smoothstep(0.3, 0.9, 1.0 - exp(-sq / uDeckFog));
      dc += uDeckColHi * uDeckGlow * 6.0 * edge * (0.4 + hgt) * (0.4 + diff);
      // horizon strip: cloud tops at grazing view toward the hot inner disc
      float graze = pow(1.0 - exp(-sq / (uDeckFog * 0.7)), 4.0);
      float toward = pow(max(dot(normalize(-q.xz), normalize(rd.xz)), 0.0), 8.0);
      dc += uDeckColHi * uDeckGlow * 2.0 * graze * (0.3 + toward) * (0.5 + hgt);
      fragColor = vec4(dc, 1.0);
      return;
    }
  }
#endif

  // Everything interesting (disc, dust, strong bending) lives inside the
  // bounding sphere; outside it rays travel straight.
  float boundR = (uDust > 0.0 ? uRout * 2.7 : uRout * 1.1) + 1.0;
  bool inside = true;
  if (dot(pos, pos) > boundR * boundR) {
    float bq = dot(pos, rd);
    float cq = dot(pos, pos) - boundR * boundR;
    float disc = bq * bq - cq;
    if (disc <= 0.0 || bq > 0.0) {
      inside = false;
    } else {
      float tEnter = -bq - sqrt(disc);
      pos += rd * tEnter;
      s = tEnter;
    }
  }



  for (int i = 0; i < MAX_STEPS; i++) {
    if (!inside) break;
    float r = length(pos);
    // small steps near the photon sphere, growing quickly in the weak field
    float dt = uStepScale * r * clamp((r - 1.0) / 1.5, 0.12, 1.0) * (1.0 + max(r - 4.0, 0.0) * 0.22);
    float r5 = r * r * r * r * r;
    vec3 acc = -1.5 * h2 * pos / r5;
    vec3 p1 = pos + vel * dt + 0.5 * acc * dt * dt;
    float r1 = length(p1);
    vec3 acc1 = -1.5 * h2 * p1 / (r1 * r1 * r1 * r1 * r1);
    vec3 v1 = vel + 0.5 * (acc + acc1) * dt;

    // ---- volume haze glow concentrated around the hole
    if (uHazeGlow > 0.0) {
      float rm = 0.5 * (r + r1);
      col += T * uHazeCol * uHazeGlow * exp(-rm / uHazeRadius) * dt / (1.0 + 0.15 * rm);
    }



    // ---- disc: thin gaussian layer, one evaluation where the segment
    // crosses y = 0. Column emission/opacity grow as 1/|sin(incidence)|
    // (clamped), like a thin optically-thin layer seen obliquely.
    if (pos.y * p1.y <= 0.0 && T > 0.003) {
      float tc = pos.y / (pos.y - p1.y + 1e-9);
      vec3 q = mix(pos, p1, tc);
      float rq = length(q.xz);
      if (rq > uRin * 0.85 && rq < (uDust > 0.0 ? uRout * 2.6 : uRout * 1.05)) {
        vec3 nv = normalize(vel);
        float inc = max(abs(nv.y), 0.08);
        float sq = s + tc * dt;
        // higher-order (lensed) images are squeezed: widen their footprint
        float fp = sq * uPixAngle / inc * (1.0 + 3.0 * float(crossings));
        vec4 f = discField(vec3(q.x, 0.0, q.z), nv, fp);
        float colH = discH(rq) * 1.77 / inc;   // gaussian column length
        // third and later images (rays that wound round the hole) are dimmer
        float order = crossings >= 2 ? 0.0 : (crossings == 1 ? 0.45 : 1.0);
        col += T * f.rgb * colH * order;
        T *= exp(-f.a * colH);
      }
      crossings++;
    }

    s += dt;
    pos = p1;
    vel = v1;
    if (r1 < 1.0) { captured = true; break; }
    if (r1 > boundR && dot(pos, vel) > 0.0) break;
    if (T < 0.003) break;
  }

  vec3 vdir = normalize(vel);
  if (!captured) col += T * sky(normalize(mix(rd, vdir, uSkyLens)));

  // Thin photon ring: rays with impact parameter near the critical value
  // sqrt(27)/2 skim the photon sphere. Width never under ~1 px.
  float bc = 2.598076;
  float pixB = length(uCamPos) * uPixAngle;
  float w = max(0.018, pixB * 1.2);
  float ring = exp(-abs(b - bc) / w) * (0.6 + 0.4 * smoothstep(bc, bc - 0.3, b));
  float upness = clamp((ndc.y - uShift.y) / max(abs(ndc.y - uShift.y) + abs((ndc.x - uShift.x) * aspect), 1e-3), -1.0, 1.0);
  ring *= mix(1.0, smoothstep(-0.6, 0.6, upness), uRingTop);
  col += uRing * uColHot * ring;

  fragColor = vec4(col, 1.0);
}
`;
