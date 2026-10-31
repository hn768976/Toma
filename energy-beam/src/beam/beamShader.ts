/**
 * Fragment shader for the pulsing energy beam.
 *
 * One pulse cycle (uPeriod = 1.125 s, measured from the reference) runs:
 *   0.00-0.06 s  bright flare burst at the base of the beam, wide white core
 *   0.06-0.25 s  flare decays, striated cyan beam emerges
 *   0.25-0.50 s  steady striated beam (many thin vertical light filaments)
 *   0.50-0.92 s  filaments die off one by one and shift to deep blue
 *   0.92-1.05 s  darkness
 *   1.05-1.125s  thin white pre-flash, leading into the next burst
 *
 * Colour is produced by an exponential tone map (1 - exp(-I * tint)), so the
 * palette of a version is fully described by four tint vectors.
 */
export const BEAM_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uPeriod;
uniform vec3 uTintBeam;   // tint of the striated beam
uniform vec3 uTintDeep;   // tint of dying filaments
uniform vec3 uTintCore;   // tint of the hot core / pre-flash
uniform vec3 uTintFlare;  // tint of the flare rays & glow

out vec4 outColor;

const int LINES = 30;
const float PI = 3.14159265359;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Periodic 1D noise around a circle (no seam at +-PI).
float angularNoise(float ang, float freq, float seed) {
  vec2 q = vec2(cos(ang), sin(ang)) * freq + seed;
  return noise(q);
}

void main() {
  // y in [-0.5, 0.5], x scaled by the same unit (aspect preserved).
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uTime;
  float cycle = floor(t / uPeriod);
  float ph = t - cycle * uPeriod; // phase in seconds

  // ---------- envelopes ----------
  float flare = ph < 0.05 ? 1.0 : exp(-(ph - 0.05) / 0.07);
  float preflash = smoothstep(uPeriod - 0.08, uPeriod - 0.045, ph);
  float beamOn = smoothstep(0.0, 0.07, ph) * (1.0 - smoothstep(0.9, 0.96, ph));
  float fill = smoothstep(0.02, 0.1, ph) * (1.0 - 0.6 * smoothstep(0.46, 0.58, ph) - 0.4 * smoothstep(0.6, 0.78, ph));
  float deep = smoothstep(0.5, 0.85, ph);
  float halfW = mix(0.1, 0.05, smoothstep(0.6, 0.88, ph));

  float ax = abs(p.x);
  vec3 energy = vec3(0.0);

  // ---------- striated filaments ----------
  float lines = 0.0;
  if (ax < 0.25) {
    for (int i = 0; i < LINES; i++) {
      float fi = float(i); // same filament layout every cycle
      float h1 = hash11(fi * 7.13 + 1.7);
      float h2 = hash11(fi * 3.71 + 9.2);
      float h3 = hash11(fi * 5.37 + 4.1);
      float h4 = hash11(fi * 9.91 + 2.3);
      // position: denser towards the centre; filament 0/1 are the bright edges
      float s = h1 * 2.0 - 1.0;
      if (i == 0) s = -0.97;
      if (i == 1) s = 0.9;
      float xi = sign(s) * pow(abs(s), 1.15) * halfW;
      xi += 0.003 * sin(t * 6.3 + h2 * 40.0) + 0.0015 * sin(t * 17.0 + h3 * 13.0);
      float death = mix(0.62, 0.93, h2);
      float life = 1.0 - smoothstep(death - 0.06, death, ph);
      float w = mix(0.0012, 0.005, h3 * h3) * mix(1.0, 0.65, deep);
      float amp = mix(0.6, 1.6, h4);
      if (i < 2) { w = 0.0018; amp = i == 0 ? 2.6 : 1.4; life *= 1.0 - smoothstep(0.42, 0.58, ph); }
      float dx = (p.x - xi) / w;
      float prof = exp(-dx * dx);
      // vertical streak texture + per-frame shimmer
      float streak = 0.6 + 0.4 * noise(vec2(h4 * 91.0, p.y * 2.2 - t * 0.9 * (0.5 + h1)));
      float flick = 0.8 + 0.2 * sin(t * 29.0 + h4 * 60.0);
      lines += prof * life * streak * flick * amp * (1.0 + 1.3 * smoothstep(0.4, 0.7, ph));
    }
  }

  // body fill between filaments
  float body = exp(-pow(ax / (halfW * 0.85), 4.0));
  float bodyTex = 0.7 + 0.3 * noise(vec2(p.x * 140.0, p.y * 1.5 - t * 0.7));
  float beamI = beamOn * (lines * 0.9 + fill * body * bodyTex * 1.1);

  // soft halo around the beam
  float halo = exp(-ax / 0.045) * 0.35 + exp(-ax * ax / (0.16 * 0.16)) * 0.08;
  beamI += beamOn * halo * (1.0 - smoothstep(0.4, 0.62, ph));

  vec3 beamTint = mix(uTintBeam, uTintDeep, deep);
  // bright filaments burn towards white
  energy += beamI * beamTint + uTintCore * max(beamI - 0.9, 0.0) * 0.6 * (1.0 - deep);

  // ---------- hot white core (flare + pre-flash) ----------
  float coreW = mix(0.028, 0.05, flare);
  float core = exp(-pow(ax / coreW, 2.6));
  float coreTex = 0.85 + 0.15 * noise(vec2(p.x * 220.0, p.y * 2.0 - t * 1.5));
  float coreI = core * coreTex * (flare * 5.0 + preflash * 4.0);
  energy += coreI * uTintCore;
  float coreGlow = exp(-ax / 0.04) * 0.9 + exp(-ax * ax / 0.02) * 0.25;
  energy += coreGlow * (flare * 1.4 + preflash * 0.9) * uTintFlare;

  // ---------- flare burst at the base ----------
  if (flare > 0.004) {
    vec2 o = vec2(0.0, -0.505);
    vec2 d = p - o;
    float r = length(d);
    float ang = atan(d.x, d.y); // 0 = straight up
    float sz = mix(0.45, 1.0, flare);
    // soft rays, re-seeded each burst so no two bursts look identical
    float rot = cycle * 0.37;
    float nFine = angularNoise(ang + rot, 7.0, 3.0 + cycle * 2.1);
    float nCoarse = angularNoise(ang - rot * 0.5, 2.5, 11.0 + cycle * 1.3);
    float rays = pow(nFine, 3.0) * 1.4 + pow(nCoarse, 2.0) * 0.8;
    // fan of rays strongest 30-70 degrees off vertical, fading towards the top
    rays *= smoothstep(0.1, 0.6, abs(ang)) * smoothstep(1.6, 1.0, abs(ang)) * 0.85 + 0.15;
    float rayFall = exp(-r / (0.4 * sz)) * smoothstep(0.75, 0.1, d.y);
    float glow = exp(-length(d * vec2(0.5, 1.2)) / (0.18 * sz));
    float wide = exp(-length(d * vec2(0.55, 1.6)) / (0.3 * sz));
    float hot = exp(-r / (0.035 * sz));
    float flareI = (rays * rayFall * 1.1 + glow * 1.3 + wide * 0.5) * flare;
    energy += flareI * uTintFlare + hot * flare * 3.0 * uTintCore;
  }

  vec3 col = 1.0 - exp(-energy);
  // ordered-free dither to prevent banding after H.264 compression
  float dither = (hash21(gl_FragCoord.xy + fract(t) * 91.0) - 0.5) / 255.0;
  col = clamp(col + dither, 0.0, 1.0);
  outColor = vec4(col, 1.0);
}
`;
