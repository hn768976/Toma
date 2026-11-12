// GLSL sources for the contour-maze renderer.
//
// The scene is a field of thin, glowing "contour walls": every iso-line of a
// slowly morphing scalar field F(x, y, t) is extruded into a vertical ribbon.
// Pass 1 bakes F into a float texture, pass 2 ray-marches the ribbons from a
// perspective camera, passes 3-5 build a two-level bloom, pass 6 tone-maps.

export const MAX_STREAKS = 32;
export const MAX_STOPS = 8;

// Analytic field, shared by the bake pass and the hit refinement.
const FIELD_GLSL = /* glsl */ `
uniform float uTime;
uniform float uProgress;

float gauss(vec2 q, vec2 c, float s) {
  vec2 d = q - c;
  return exp(-dot(d, d) / (s * s));
}

float fieldF(vec2 p) {
  float t = uTime;
  float pr = uProgress;
  // Gentle domain warp keeps every contour organic and flowing.
  vec2 w = vec2(
    sin(p.y * 1.10 + t * 0.30) + 0.6 * sin(p.x * 1.70 - p.y * 0.60 + t * 0.23),
    sin(p.x * 0.90 - t * 0.26) + 0.6 * sin(p.y * 1.50 + p.x * 0.70 + t * 0.19)
  );
  vec2 q = p + 0.12 * w;
  // Second, finer warp: makes the terrain contours fold and meander.
  vec2 w2 = vec2(
    sin(q.y * 3.3 + 1.7 * sin(q.x * 1.9 + t * 0.21) + t * 0.27),
    sin(q.x * 3.1 - 1.5 * sin(q.y * 2.3 - t * 0.18) - t * 0.24)
  );

  // Island frame: the centre stays put; the shape bends from a compact blob
  // into a hook / S over the first half of the shot (uProgress is eased).
  vec2 c = mix(vec2(0.0, 0.05), vec2(-0.03, 0.02), pr);
  float ang = mix(1.30, 1.45, pr);
  float stretch = mix(1.0, 1.25, pr);
  vec2 d = q - c;
  vec2 dr = vec2(cos(ang) * d.x + sin(ang) * d.y, -sin(ang) * d.x + cos(ang) * d.y);
  dr.x /= stretch;
  dr.y *= mix(1.0, 1.15, pr);
  // Bend the island (arms curl) with a low-frequency warp in its own frame.
  dr += mix(0.08, 0.17, pr) * vec2(sin(dr.y * 3.1 + 0.7 + t * 0.2), sin(dr.x * 2.7 - 0.4 - t * 0.17));
  float r = length(dr);
  float th = atan(dr.y, dr.x);

  // Lobed island outline: r = R0 * (1 + wig(theta)).
  const float R0 = 0.52;
  float wig = 0.16 * sin(2.0 * th - 0.4 + t * 0.11)
            + 0.24 * sin(3.0 * th + 0.8 + t * 0.15)
            + 0.13 * sin(5.0 * th - 1.1 - t * 0.21)
            + 0.08 * sin(8.0 * th + 2.3 + t * 0.27);
  // Effective radius: offset curves of the island whose wiggles relax with distance.
  float relax = exp(-max(r - R0, 0.0) / 1.4);
  float reff = r - R0 * wig * relax;

  // Outside: offset contours of the island that relax into long waves. The
  // terraces start wide and become denser over the shot.
  float slopeOut = mix(0.36, 0.58, pr);
  float outer = 1.0 - slopeOut * (reff - R0);
  float waves = 0.20 * sin(q.x * 1.35 + q.y * 0.55 + 0.6 + t * 0.10)
              + 0.14 * sin(-q.x * 0.75 + q.y * 1.70 - 1.3 - t * 0.08)
              + 0.05 * sin(q.x * 2.60 - q.y * 2.20 + 2.2 + t * 0.13);
  outer += 0.75 * waves * smoothstep(0.65, 1.5, reff);
  // Meanders (U-turn fingers) grow with distance from the island.
  outer += mix(0.08, 0.12, pr) * dot(w2, vec2(0.8, 0.6)) * smoothstep(0.58, 1.0, reff);

  // Inside: nested, scaled copies of the island outline (normalised radius
  // rn = 1 on the outline, 0 at the centre) that wind into a spiral core.
  float rn = clamp(r / (R0 * (1.0 + wig)), 0.0, 1.2);
  float spiralMask = 1.0 - smoothstep(0.22, 0.5, rn);
  float spiral = sin(th - rn * 17.0 + t * 0.5);
  float inside = 1.02 + 0.25 * (1.0 - rn) + 0.045 * spiral * spiralMask;

  // Step at the island edge -> the white outline wall.
  float k = smoothstep(R0 + 0.02, R0 - 0.02, reff);
  float base = mix(outer, inside, k);
  return base;
}
`;

export const FIELD_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float uDomain;
${FIELD_GLSL}
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * uDomain;
  outColor = vec4(fieldF(p), 0.0, 0.0, 1.0);
}`;

export const SCENE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uField;
uniform float uDomain;
uniform vec2 uRes;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanHalfFov;
uniform float uDelta;
uniform float uRimR;
uniform float uStep;
uniform vec3 uPalCol[${MAX_STOPS}];
uniform float uPalPos[${MAX_STOPS}];
uniform int uPalCount;
uniform vec3 uStreakCol;
uniform vec4 uStreaks[${MAX_STREAKS}];
uniform int uStreakCount;
uniform vec2 uStreakCenter;
uniform vec3 uFogCol;
uniform float uFogStart;
uniform float uFloorLo;
uniform float uFloorHi;
uniform vec3 uLightDir;
${FIELD_GLSL}

const float HMAX = 0.58;

float sampleF(vec2 p) {
  return texture(uField, p / (2.0 * uDomain) + 0.5).r;
}

vec2 gradT(vec2 p) {
  float e = 2.0 * uDomain / float(textureSize(uField, 0).x);
  return vec2(sampleF(p + vec2(e, 0.0)) - sampleF(p - vec2(e, 0.0)),
              sampleF(p + vec2(0.0, e)) - sampleF(p - vec2(0.0, e))) / (2.0 * e);
}

vec3 palette(float v) {
  vec3 c = uPalCol[0];
  for (int i = 1; i < ${MAX_STOPS}; i++) {
    if (i >= uPalCount) break;
    float a = clamp((v - uPalPos[i - 1]) / max(uPalPos[i] - uPalPos[i - 1], 1e-4), 0.0, 1.0);
    c = mix(c, uPalCol[i], a);
  }
  return c;
}

float wallH(float v) {
  // Outer terrain walls are tall, the island outline is tallest, and the
  // maze walls inside the island are low so its blue floor shows through.
  return 0.42 - 0.05 * smoothstep(1.1, 1.16, v);
}

float streakAmt(float lvl, vec2 p) {
  float s = 0.0;
  float th = -1000.0;
  for (int i = 0; i < ${MAX_STREAKS}; i++) {
    if (i >= uStreakCount) break;
    vec4 k = uStreaks[i];
    if (abs(k.x - lvl) > 0.5) continue;
    if (th < -999.0) {
      vec2 d = p - uStreakCenter;
      th = atan(d.y, d.x);
    }
    float da = abs(mod(th - k.y + 3.14159265, 6.2831853) - 3.14159265);
    s = max(s, k.w * (1.0 - smoothstep(k.z * 0.55, k.z, da)));
  }
  return s;
}

// Rim tops glow in the next-lighter palette colour (orange walls -> yellow rims).
vec3 rimColor(float b, float s) {
  // Terrain rims: next-lighter colour (orange -> yellow). Island rims: own colour.
  vec3 c = palette(b > 1.0 ? b - 0.04 : min(b + 0.12, 1.03)) * 2.7;
  if (b > 1.15) c = mix(palette(b), vec3(1.0), 0.45) * 2.4; // maze: white-blue neon
  return mix(c, uStreakCol * 4.0, s);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec3 rd = normalize(uCamFwd + ndc.x * uTanHalfFov * aspect * uCamRight + ndc.y * uTanHalfFov * uCamUp);
  vec3 ro = uCamPos;
  float pixK = 2.0 * uTanHalfFov / uRes.y; // world size of one pixel per unit distance

  vec3 col = vec3(0.0);
  float T = 1.0;
  float tHit = 0.0;
  bool hit = false;

  float tTop = (HMAX - ro.z) / rd.z;
  float tBot = -ro.z / rd.z;
  float horiz = (tBot - tTop) * length(rd.xy);
  int n = int(clamp(ceil(horiz / uStep), 6.0, 160.0));
  float dt = (tBot - tTop) / float(n);
  float hl = length(rd.xy);

  float t0 = tTop;
  float F0 = sampleF((ro + rd * t0).xy);
  float L0 = floor(F0 / uDelta);

  for (int i = 1; i <= 160; i++) {
    if (i > n) break;
    float t1 = tTop + dt * float(i);
    float F1 = sampleF((ro + rd * t1).xy);
    float L1 = floor(F1 / uDelta);
    if (L1 != L0) {
      float dir = sign(L1 - L0);
      int cnt = min(int(abs(L1 - L0)), 4);
      float slope = (F1 - F0) / dt;
      for (int j = 0; j < 4; j++) {
        if (j >= cnt) break;
        float lvl = dir > 0.0 ? L0 + 1.0 + float(j) : L0 - float(j);
        float b = lvl * uDelta;
        float tc = mix(t0, t1, clamp((b - F0) / (F1 - F0), 0.0, 1.0));
        float h = wallH(b);
        float aa = pixK * tc;
        float e = ro.z + rd.z * tc - h;
        if (e < 4.0 * (uRimR + aa) / max(hl, 0.2)) {
          // One secant refinement step for crisp, smooth rims.
          float Fc = sampleF((ro + rd * tc).xy);
          tc = clamp(tc - (Fc - b) / slope, t0 - dt, t1 + dt);
          e = ro.z + rd.z * tc - h;
        }
        vec3 pc = ro + rd * tc;
        if (e <= 0.0) {
          // Ray hits the wall face (or the front of its glowing rim tube).
          vec3 base = palette(b);
          float s = streakAmt(lvl, pc.xy);
          float hz = clamp(pc.z / h, 0.0, 1.0);
          vec2 g = gradT(pc.xy);
          vec3 nrm = normalize(vec3(g, 0.0) + 1e-6);
          if (dot(nrm, rd) > 0.0) nrm = -nrm;
          float lam = 0.75 + 0.25 * max(dot(nrm, uLightDir), 0.0);
          float glow = pow(hz, 1.6);
          vec3 face = base * (0.12 + 0.90 * glow) * lam;
          face = mix(face, uStreakCol * (0.3 + 1.9 * glow), s * 0.85 * glow * glow);
          float rimAmt = 1.0 - smoothstep(uRimR * 0.7, uRimR * 1.8 + aa, -e * hl);
          col += T * mix(face, rimColor(b, s), rimAmt);
          T = 0.0;
          tHit = tc;
          hit = true;
          break;
        } else {
          // Ray grazes over the top: partial coverage by the rim tube.
          float cov = 1.0 - smoothstep(uRimR - aa, uRimR + aa, e * hl);
          if (cov > 0.002) {
            float s = streakAmt(lvl, pc.xy);
            col += T * cov * rimColor(b, s);
            T *= 1.0 - cov;
          }
        }
      }
      if (hit) break;
    }
    t0 = t1;
    F0 = F1;
    L0 = L1;
  }

  if (!hit) {
    vec3 pf = ro + rd * tBot;
    float F = sampleF(pf.xy);
    float lv = floor(F / uDelta) * uDelta;
    vec2 g = gradT(pf.xy);
    float fr = fract(F / uDelta);
    float d = min(fr, 1.0 - fr) * uDelta / max(length(g), 1e-3);
    float ao = smoothstep(0.0, 0.10, d);
    float bright = mix(uFloorLo, uFloorHi, smoothstep(1.0, 1.12, lv));
    col += T * palette(lv) * bright * (0.4 + 0.6 * ao);
    tHit = tBot;
  }

  // Atmospheric falloff into the distance.
  float fog = 1.0 - exp(-max(tHit - uFogStart, 0.0) * 0.45);
  col = mix(col, uFogCol, fog);
  outColor = vec4(col, 1.0);
}`;

export const BRIGHT_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uTexel; // source texel size
uniform float uThreshold;
void main() {
  // 4 bilinear taps = 4x4 box downsample.
  vec3 c = texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb
         + texture(uSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
         + texture(uSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb
         + texture(uSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold + 0.8, l);
  outColor = vec4(c * k, 1.0);
}`;

export const DOWN_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uTexel;
void main() {
  vec3 c = texture(uSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb
         + texture(uSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
         + texture(uSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb
         + texture(uSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  outColor = vec4(c * 0.25, 1.0);
}`;

export const BLUR_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uDir; // texel-sized step along one axis
void main() {
  // 13-tap gaussian folded into 7 bilinear fetches.
  vec3 c = texture(uSrc, vUv).rgb * 0.1964825501511404;
  c += texture(uSrc, vUv + uDir * 1.411764705882353).rgb * 0.2969069646728344;
  c += texture(uSrc, vUv - uDir * 1.411764705882353).rgb * 0.2969069646728344;
  c += texture(uSrc, vUv + uDir * 3.2941176470588234).rgb * 0.09447039785044732;
  c += texture(uSrc, vUv - uDir * 3.2941176470588234).rgb * 0.09447039785044732;
  c += texture(uSrc, vUv + uDir * 5.176470588235294).rgb * 0.010381362401148057;
  c += texture(uSrc, vUv - uDir * 5.176470588235294).rgb * 0.010381362401148057;
  outColor = vec4(c, 1.0);
}`;

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform float uBloomA;
uniform float uBloomB;
uniform float uExposure;
uniform float uVignette;

// Hue-preserving extended Reinhard on the max channel, with a gentle
// roll towards white only for very hot values (keeps saturated neon hues).
vec3 tonemap(vec3 x) {
  float m = max(max(x.r, x.g), max(x.b, 1e-5));
  const float W = 3.2;
  float tm = m * (1.0 + m / (W * W)) / (1.0 + m);
  vec3 c = x * (tm / m);
  return clamp(mix(c, vec3(tm), smoothstep(1.2, 4.0, m) * 0.35), 0.0, 1.0);
}
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 c = texture(uScene, vUv).rgb;
  c += uBloomA * texture(uBloom1, vUv).rgb + uBloomB * texture(uBloom2, vUv).rgb;
  vec2 v = vUv - 0.5;
  c *= 1.0 - uVignette * dot(v, v) * 1.6;
  c = tonemap(c * uExposure);
  // Saturation lift (linear light) towards the reference's vivid neon look.
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(lum), c, 1.28), 0.0, 1.0);
  // Tiny ordered dither to avoid banding in the dark gradients after H.264.
  float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  outColor = vec4(toSrgb(c) + d / 255.0, 1.0);
}`;
