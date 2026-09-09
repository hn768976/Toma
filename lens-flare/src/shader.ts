import { GHOST_COUNT } from "./ghosts";

export const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/**
 * One pass, everything analytic.
 *
 * Space: "aspect space" -- x in [0, aspect], y in [0, 1], y pointing DOWN, so
 * the top edge of frame is y = 0 and a source above the frame has y < 0. Every
 * size in here is therefore a fraction of frame HEIGHT, which is what makes a
 * 1080p preview and a 4K render look identical rather than merely similar.
 */
export const FRAG = `
precision highp float;

#define NGHOST ${GHOST_COUNT}

uniform vec2  uRes;
uniform float uAspect;
uniform vec2  uSrc;        // implied light source, aspect space (off-frame)
uniform float uEnv;        // master swell, 0..1
uniform float uGate;       // clip-edge fade, 0..1
uniform float uRoll;       // lens roll -- rotates the whole streak system
uniform float uSeed;

uniform vec3  uC0;
uniform vec3  uC1;
uniform vec3  uC2;
uniform vec3  uC3;
uniform vec3  uGhostA;
uniform vec3  uGhostB;
uniform vec3  uRing;

uniform vec4  uGhost[NGHOST];      // k, rad, shape, amp
uniform float uGhostTint[NGHOST];  // 0 -> A, 1 -> B

uniform float uChroma;     // channel separation, fraction of frame height
uniform float uGrain;
uniform float uRingAmt;

// Descending smoothstep. GLSL's smoothstep is undefined for edge0 >= edge1.
float fadeOut(float a, float b, float x) {
  return 1.0 - smoothstep(a, b, x);
}

// ---------------------------------------------------------------- palette

vec3 ramp(float x) {
  x = clamp(x, 0.0, 1.0);
  vec3 a = mix(uC0, uC1, smoothstep(0.0, 1.0, x / 0.34));
  vec3 b = mix(uC1, uC2, smoothstep(0.0, 1.0, (x - 0.34) / 0.33));
  vec3 c = mix(uC2, uC3, smoothstep(0.0, 1.0, (x - 0.67) / 0.33));
  vec3 r = mix(a, b, step(0.34, x));
  return mix(r, c, step(0.67, x));
}

// -------------------------------------------------------------- elements

// Inverse-square-ish lobe: ~1/(1+r^2) close in, steepening to ~1/r^4 far out,
// so the light dies off the way light does instead of the way a linear
// gradient does.
float lobe(float d, float scale, float tail) {
  float r = d / scale;
  float r2 = r * r;
  return 1.0 / (1.0 + r2 * (1.0 + tail * r2));
}

// A soft ray fanning out from the source. Emerges out of the bloom rather than
// starting at a point, widens as it travels, and fades out along its length.
float ray(vec2 q, float a, float w, float len) {
  float ca = cos(a), sa = sin(a);
  float al =  q.x * ca + q.y * sa;
  float ac = -q.x * sa + q.y * ca;
  float alp = max(al, 0.0);
  float ww = w * (1.0 + 1.7 * alp);
  float a2 = ac * ac;
  // Core plus a much wider halo: a single gaussian reads as a drawn line, a
  // gaussian with shoulders reads as light through glass.
  float prof = 0.70 * exp(-a2 / (2.0 * ww * ww))
             + 0.30 * exp(-a2 / (2.0 * 30.0 * ww * ww));
  float emerge = smoothstep(0.0, 0.34, al);
  float fall = 1.0 / (1.0 + pow(alp / len, 2.6));
  return prof * emerge * fall;
}

// Ghost body. shape blends a round blob into a hexagon (aperture blades).
// Brighter toward the rim, as a real reflection of the iris is.
float blob(vec2 p, vec2 g, float rad, float shape) {
  vec2 v = p - g;
  float r = length(v) + 1e-7;
  float ang = atan(v.y, v.x + 1e-7);
  // Distance to a hexagonal edge, normalised so a hexagon and a circle of the
  // same "rad" cover about the same area.
  float hex = mix(1.0, cos(mod(ang, 1.0471976) - 0.5235988), 0.80);
  float ur = r / rad;
  float rr = mix(r, r * 0.978 / hex, shape * smoothstep(0.0, 0.55, ur));
  float u = rr / rad;
  float body = fadeOut(0.20, 1.02, u);
  // Soft edge lift rather than a drawn outline -- a real ghost is a filled
  // reflection of the iris that happens to be a little hotter at the rim.
  float e = (u - 0.82) / 0.23;
  float rim = exp(-e * e) * fadeOut(0.96, 1.22, u);
  return body * 0.55 + rim * 0.26;
}

// ----------------------------------------------------------------- noise

float hash(vec2 v) {
  return fract(sin(dot(v, vec2(12.9898, 78.233))) * 43758.5453);
}

// ------------------------------------------------------------ tone / out

// Highlight shoulder: exactly linear below k, then rolls asymptotically to 1.
// C1-continuous at the join, so the hot part of the bloom goes to white
// without a flat clipped plateau and without touching the blacks.
float shoulder(float c) {
  const float k = 0.62;
  const float s = 0.40;
  return c < k ? c : 1.0 - s * exp(-(c - k) / s);
}

vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

// ------------------------------------------------------------------ main

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2(uv.x * uAspect, 1.0 - uv.y);

  vec2 axis = vec2(uAspect * 0.5, 0.5) - uSrc;
  vec2 adir = normalize(axis);

  vec3 col = vec3(0.0);

  // 1 -- bloom. Three lobes at different scales: a tight near-white one, the
  // main body, and a very broad low haze. Superimposing scales also spreads
  // the 8-bit quantisation steps around, which is half of the banding fix.
  float d = length(p - uSrc);
  float core = lobe(d, 0.145, 0.55);
  float mid  = lobe(d, 0.260, 0.45);
  float haze = lobe(d, 0.620, 0.16);

  col += ramp(0.02) * core * 1.65;
  col += ramp(0.34) * mid  * 0.62;
  col += ramp(0.86) * haze * 0.055;

  // 2 -- anamorphic streak, through the implied centre, rolling with the lens.
  vec2 q = p - uSrc;
  float cr = cos(uRoll), sr = sin(uRoll);
  vec2 qr = vec2(q.x * cr + q.y * sr, -q.x * sr + q.y * cr);

  float sy = 0.030;
  float band = exp(-(qr.y * qr.y) / (2.0 * sy * sy));
  band *= 1.0 / (1.0 + pow(abs(qr.x) / 1.30, 1.6));
  col += ramp(0.16) * band * 0.95;

  // the wider, much fainter halo that always sits around an anamorphic streak
  float band2 = exp(-(qr.y * qr.y) / (2.0 * 0.082 * 0.082));
  band2 *= 1.0 / (1.0 + pow(abs(qr.x) / 1.30, 2.0));
  col += ramp(0.52) * band2 * 0.11;

  // 3 -- diagonal rays. Angles are y-down, so positive fans down-right.
  float rr0 = uRoll * 0.75;
  col += ramp(0.26) * ray(qr, 0.60 + rr0, 0.0072, 0.72) * 0.038;
  col += ramp(0.32) * ray(qr, 0.85 + rr0, 0.0125, 0.64) * 0.058;
  col += ramp(0.44) * ray(qr, 1.07 + rr0, 0.0058, 0.70) * 0.024;
  col += ramp(0.38) * ray(qr, 1.32 + rr0, 0.0096, 0.56) * 0.030;

  // 4 -- ghosts, travelling along the axis as the source moves. Red and blue
  // are read at slightly different radii and slightly offset positions, which
  // puts a pink/green fringe on the rim. That fringe is the whole difference
  // between reading as glass and reading as a graphic.
  vec2 ce = adir * uChroma;
  float gEnv = pow(uEnv, 1.35);

  for (int i = 0; i < NGHOST; i++) {
    vec4 gp = uGhost[i];
    vec2 g = uSrc + axis * gp.x;
    float rad = gp.y;
    float sh = gp.z;
    vec3 tint = mix(uGhostA, uGhostB, uGhostTint[i]);
    vec3 sep = vec3(
      blob(p + ce, g, rad * 1.022, sh),
      blob(p,      g, rad,         sh),
      blob(p - ce, g, rad * 0.976, sh)
    );
    col += tint * sep * gp.w * 0.055 * gEnv;
  }

  // 5 -- iris ring: the only element in the piece with a defined edge, and
  // only present while the flare is in its brighter half.
  if (uRingAmt > 0.001) {
    vec2 rc = uSrc + axis * 1.34;
    vec2 v = (p - rc) / vec2(0.258, 0.208);
    float r = length(v);
    float rw = 0.014;
    float cs = 0.0055;
    float er = (r - 1.0 - cs) / rw;
    float eg = (r - 1.0) / rw;
    float eb = (r - 1.0 + cs) / rw;
    vec3 prof = vec3(exp(-er * er), exp(-eg * eg), exp(-eb * eb));
    // Partial arc, opening toward the lower right.
    float ang = atan(v.y, v.x + 1e-7);
    float arc = smoothstep(-2.05, -1.30, ang) * fadeOut(-0.50, 0.15, ang);
    col += uRing * prof * arc * 0.026 * uRingAmt;
  }

  // ------------------------------------------------------------- output

  col *= uEnv * uGate;

  // Pull the far field to a hard zero. Every lobe here has an infinite tail;
  // left alone, the "black" corners quantise to 1 or 2 and put a warm veil
  // over the buyer's shot the moment it is screen-blended.
  float lin = max(max(col.r, col.g), col.b);
  col *= smoothstep(0.0, 0.022, lin);

  col = vec3(shoulder(col.r), shoulder(col.g), shoulder(col.b));
  col = toSrgb(col);

  float lum = max(max(col.r, col.g), col.b);
  // Grain and dither are BOTH gated by local brightness. Grain over black
  // survives a screen blend as visible noise on someone else's footage, and
  // dither over black is the same problem in miniature.
  float lit = smoothstep(0.0, 0.020, lum);

  float g1 = hash(gl_FragCoord.xy + uSeed);
  col += (g1 - 0.5) * uGrain * lit;

  // Triangular-PDF dither, +/- ~1 LSB, to break banding in the wide falloffs
  // instead of raising the grain to do it.
  float d1 = hash(gl_FragCoord.xy * 1.37 + uSeed * 7.1);
  float d2 = hash(gl_FragCoord.yx * 2.11 - uSeed * 3.7);
  col += (d1 + d2 - 1.0) * (0.85 / 255.0) * lit;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;
