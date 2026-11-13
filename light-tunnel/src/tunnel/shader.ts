/**
 * Light-tunnel fragment shader (GLSL ES 3.00 / WebGL 2).
 * Everything is procedural and a pure function of uTime, so any frame can
 * be rendered independently (required by Remotion's parallel rendering).
 */
export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec3  uCore;   // hottest light (ring cores, sparkles)
uniform vec3  uMid;    // main glow colour
uniform vec3  uDeep;   // deep glow / ray haze
uniform vec3  uHazeA;  // volumetric haze 1
uniform vec3  uHazeB;  // volumetric haze 2 (accent)
uniform float uSS;     // 2 = 2-tap supersampling, 1 = single sample
out vec4 outColor;

#define TAU 6.28318530718

float h11(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453123); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x),
             mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

// Thin radial light rays. M = rays per turn, w = core width (screen units).
vec3 rays(float a, float r, float lr, float t, float M, float rot, float seed, float w, float px) {
  float fa = (a / TAU + rot) * M;
  float cell = floor(fa);
  float cid = mod(cell, M);
  float off = (h11(cid * 1.31 + seed) - 0.5) * 0.55;
  float d = abs(fract(fa) - 0.5 - off) * (TAU / M) * r;   // perpendicular distance
  float ww = max(w, px * 0.75);
  float core = exp(-d * d / (ww * ww)) * (w / ww);
  float glow = exp(-d / (ww * 9.0)) * 0.3;
  // smooth flicker per ray + light pulses travelling outward along it
  float fl = vnoise(vec2(cid * 3.7 + seed, t * 2.6));
  fl = pow(fl, 2.2) * 1.8;
  float pulse = 0.2 + 0.8 * smoothstep(0.35, 0.8, vnoise(vec2(cid * 1.9 + seed * 3.0, lr * 4.5 - t * 2.2)));
  float on = step(0.28, h11(cid * 7.13 + seed * 2.0));
  return vec3(core, glow, 0.0) * fl * pulse * on;
}

// One ring of light: radius rr, half-width w.
float ringLine(float r, float rr, float w, float px) {
  float ww = max(w, px * 0.7);
  float d = r - rr;
  return exp(-d * d / (ww * ww)) * (w / ww);
}

vec3 shade(vec2 frag) {
  float t = uTime;
  vec2 p = (frag - 0.5 * uRes) / uRes.y;
  float px = 1.0 / uRes.y;
  // gentle hand-held drift of the tunnel axis
  p -= vec2(0.014 * sin(t * 0.37) + 0.006 * sin(t * 0.91), 0.010 * sin(t * 0.29 + 1.0) + 0.005 * sin(t * 0.83 + 2.0));
  float r = length(p) + 1e-5;
  float a = atan(p.y, p.x);
  float lr = log(r);
  vec2 dir = p / r;
  float breathe = 1.0 + 0.035 * sin(t * 0.6) + 0.015 * sin(t * 1.7 + 1.0);
  float rs = r / breathe;

  vec3 col = vec3(0.0);
  float hole = smoothstep(0.075, 0.16, r);

  // --- volumetric haze (polar fbm streaming outward) -------------------------
  float lrT = lr * 1.6 - t * 0.35;
  float hz = fbm(dir * 2.2 + vec2(lrT, -lrT * 0.6) + vec2(t * 0.05, 0.0));
  float hz2 = fbm(dir * 3.4 - vec2(lrT * 0.8, lrT) + 9.0);
  float hzMask = smoothstep(0.12, 0.55, r);
  col += uHazeA * pow(hz, 3.6) * 0.8 * hzMask;
  col += uHazeB * pow(hz2, 4.0) * 1.8 * smoothstep(0.35, 0.95, r);

  // --- radial light rays -------------------------------------------------------
  float rayMask = smoothstep(0.11, 0.22, r);
  vec3 r1 = rays(a, r, lr, t, 96.0, t * 0.010, 1.0, 0.0011, px);
  vec3 r2 = rays(a, r, lr, t, 170.0, -t * 0.006 + 0.3, 7.0, 0.0008, px);
  vec3 r3 = rays(a, r, lr, t, 44.0, t * 0.004 + 0.1, 3.0, 0.0030, px);
  col += uCore * (r1.x * 0.45 + r2.x * 0.3) * rayMask;
  col += uMid * (r1.x * 0.7 + r2.x * 0.5 + r1.y + r2.y + r3.x * 0.6 + r3.y * 2.0) * rayMask * 1.1;
  // broad soft beams
  float beams = pow(vnoise(vec2((a / TAU + t * 0.004) * 26.0, t * 0.8)), 4.0);
  col += uDeep * beams * 1.3 * smoothstep(0.12, 0.4, r);

  // light filling the ring zone
  col += uMid * 0.22 * exp(-abs(r - 0.33) / 0.16) * (0.6 + 0.4 * beams);

  // --- central iris: segmented ring of light ticks ------------------------------
  float irisR = 0.172;
  float ticksN = 30.0;
  float ta = fract(a / TAU * ticksN + t * 0.06);
  float tick = smoothstep(0.3, 0.1, abs(ta - 0.5));
  float band = exp(-pow((rs - irisR) / 0.012, 2.0));
  float tickFl = 0.6 + 0.4 * vnoise(vec2(floor(a / TAU * ticksN + t * 0.06) * 2.1, t * 2.0));
  col += (uCore * 0.35 + uMid * 0.9) * tick * band * tickFl * 0.8;
  col += uMid * exp(-abs(rs - irisR) / 0.03) * 0.25;
  col += uMid * ringLine(rs, 0.142, 0.0016, px) * 0.9;
  col += uCore * ringLine(rs, 0.205, 0.0018, px) * 0.8;
  // inner dashed ring
  float dash = step(0.35, fract(a / TAU * 64.0 - t * 0.1));
  col += uMid * ringLine(rs, 0.226, 0.0012, px) * dash * 0.8;

  // --- main bright ring + companions --------------------------------------------
  float mainR = 0.375;
  float mainVar = 0.75 + 0.25 * vnoise(dir * 3.0 + t * 0.4);
  col += (uCore * 0.45 + uMid * 0.9) * ringLine(rs, mainR, 0.006, px) * 1.2 * mainVar;
  col += uMid * exp(-abs(rs - mainR) / 0.035) * 1.3 * mainVar;
  col += uDeep * exp(-abs(rs - mainR) / 0.1) * 0.35;
  col += uMid * ringLine(rs, 0.335, 0.0022, px) * 0.8 * (0.5 + 0.5 * vnoise(dir * 4.0 - t * 0.3));
  col += uMid * ringLine(rs, 0.41, 0.002, px) * 0.8 * (0.5 + 0.5 * vnoise(dir * 5.0 + 3.0 + t * 0.2));
  // sparkles riding on the main ring
  {
    float n = 46.0;
    float fa = a / TAU * n + t * 0.035;
    float id = floor(fa);
    float o = (h11(mod(id, n) * 3.3) - 0.5) * 0.6;
    float da = (fract(fa) - 0.5 - o) * TAU / n * r;
    float dr = rs - (mainR + (h11(mod(id, n) * 5.1) - 0.5) * 0.05);
    float sp = exp(-(da * da + dr * dr) / pow(max(0.0028, px * 1.2), 2.0));
    float tw = pow(vnoise(vec2(mod(id, n) * 4.1, t * 3.0)), 2.0) * step(0.35, h11(mod(id, n) * 9.7));
    col += uCore * sp * tw * 2.2;
    col += uMid * exp(-sqrt(da * da + dr * dr) / 0.012) * tw * 0.5;
  }

  // --- rings flying toward the camera (forward motion) --------------------------
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float s = t * 0.11 + fi / 8.0;
    float cyc = floor(s);
    float f = fract(s);
    float sd = h11(fi * 17.3 + cyc * 3.71);
    float sd2 = h11(fi * 5.1 + cyc * 9.13);
    float rr = 0.2 * exp(f * log(7.5));          // 0.2 -> 1.5
    float env = smoothstep(0.0, 0.2, f) * (1.0 - smoothstep(0.75, 1.0, f));
    float w = (0.0012 + 0.0035 * sd2) * (0.6 + rr);
    float d = rs - rr;
    float line = ringLine(rs, rr, w, px);
    float glow = exp(-abs(d) / (0.012 + 0.03 * rr)) * 0.35;
    // partial arcs: rings break up into bright arcs
    float arc = smoothstep(0.42, 0.7, vnoise(dir * (1.5 + 2.0 * sd) + vec2(sd * 40.0, cyc * 7.0) + t * 0.1));
    arc = mix(arc, 1.0, step(0.85, sd));
    float bright = 0.45 + 0.9 * sd;
    col += (uCore * line * 0.35 + uMid * line * 0.8 + uMid * glow * 1.3) * env * arc * bright;
    // dotted rings
    if (sd2 > 0.55) {
      float n = floor(40.0 + 60.0 * sd);
      float g = fract(a / TAU * n + sd * 3.0 + t * 0.02 * (sd - 0.5));
      float dd = (g - 0.5) * TAU / n * r;
      float dot2 = exp(-(dd * dd + d * d) / pow(max(w * 2.4, px), 2.0));
      col += (uCore * 0.6 + uMid * 0.6) * dot2 * env * arc * step(0.5, h11(floor(g * 0.0 + a / TAU * n) + sd)) * 0.9;
    }
  }

  // twinkling sparkles scattered along the rays
  {
    vec2 g = vec2((a / TAU + t * 0.006) * 72.0, lr * 7.0 - t * 0.9);
    vec2 id = floor(g);
    vec2 cid = vec2(mod(id.x, 72.0), id.y);
    vec2 o = vec2(h21(cid * 1.7), h21(cid * 2.9 + 4.0)) * 0.6 + 0.2;
    vec2 dd = (fract(g) - o) * vec2(TAU / 72.0 * r, r / 7.0);
    float on = step(0.55, h21(cid * 3.3 + 1.0));
    float tw = pow(vnoise(vec2(h21(cid) * 50.0, t * 2.5)), 2.0);
    float sz = max(0.0022, px * 1.2);
    float sp = exp(-dot(dd, dd) / (sz * sz));
    col += (uCore * 1.4 + uMid * 0.6) * sp * on * tw * smoothstep(0.15, 0.3, r);
  }
  col *= hole;
  // faint inner glow so the hole reads as depth, not a cut-out
  col += uDeep * 0.12 * smoothstep(0.03, 0.14, r) * (1.0 - hole);

  // vignette toward corners
  col *= mix(0.35, 1.0, smoothstep(1.1, 0.4, r));
  return col;
}

void main() {
  vec3 c;
  if (uSS > 1.5) {
    // 2-tap rotated-grid supersampling: smooth thin rays at 1080p
    c = 0.5 * (shade(gl_FragCoord.xy + vec2(0.25, -0.25)) + shade(gl_FragCoord.xy + vec2(-0.25, 0.25)));
  } else {
    c = shade(gl_FragCoord.xy);
  }
  // filmic shoulder: hot cores roll to white, glows stay saturated
  c = 1.0 - exp(-c * 1.55);
  c = pow(c, vec3(0.95));
  // dither to avoid banding in the dark gradients
  c += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(c, 1.0);
}
`;
