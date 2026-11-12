// WebGL 2 fragment shader that synthesises a blurred holographic / prismatic
// light-leak field: dispersive rainbow ribbons, violet & warm glows, soft
// shadow bands and white specular hot-spots drifting over a mauve base.
//
// uMode 0 = flat, screen-aligned camera (Version 1 - matches the reference)
// uMode 1 = low-angle perspective tracking shot across the foil (Version 2)

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform int   uMode;
uniform vec4  uCamA;   // flat: pan.x, pan.y, rotation, zoom | persp: cam.x, cam.y, height, yaw
uniform vec4  uCamB;   // persp: pitch, roll, focal, fogDensity

out vec4 outColor;

const float CELL = 0.62;
const float TAU = 6.28318530718;

// ---- hashes (sin-free, stable on every GPU / SwiftShader) ----
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec4 hash42(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

// Smooth visible-light spectrum: 0 = red ... 1 = violet
vec3 spectrum(float x) {
  x = clamp(x, 0.0, 1.0);
  vec4 z = (vec4(x) - vec4(0.17, 1.0, 0.42, 0.79)) / vec4(0.27, 0.14, 0.17, 0.19);
  vec4 e = exp(-z * z);
  return vec3(e.x + 0.6 * e.y, 0.8 * e.z, e.w) * 1.2;
}

struct Field { vec3 light; float dark; float white; };

Field evalField(vec2 uv, float t) {
  Field F;
  F.light = vec3(0.0);
  F.dark = 0.0;
  F.white = 0.0;

  // gentle domain warp: refractions are never perfectly straight
  vec2 w = vec2(vnoise(uv * 2.1 + vec2(t * 0.21, 3.7)), vnoise(uv * 2.1 + vec2(8.3, -t * 0.19))) - 0.5;
  uv += w * 0.075;

  vec2 baseCell = floor(uv / CELL);
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 cell = baseCell + vec2(float(dx), float(dy));
      for (int k = 0; k < 4; k++) {
        vec2 sd = cell + vec2(float(k) * 17.13, float(k) * 3.71);
        vec4 h0 = hash42(sd);
        float T = 1.1 + 1.9 * h0.x;              // lifetime of one ribbon (s)
        float lt = t / T + h0.y;
        float g = floor(lt);
        float ph = lt - g;                        // 0..1 life phase
        vec4 h1 = hash42(sd + g * vec2(7.31, 13.17));
        vec2 c = (cell + 0.18 + 0.64 * h1.xy) * CELL + (h1.zw - 0.5) * 0.55 * (ph - 0.5);
        vec2 q0 = uv - c;
        float d2 = dot(q0, q0);
        bool isBlob = (k == 3 && h0.z < 0.38);
        // cheap cull: blobs are small; ribbons/glows never reach beyond 0.62
        if (d2 > (isBlob ? 0.06 : 0.385)) continue;

        vec4 h2 = hash42(sd + g * vec2(29.7, 3.3) + 11.0);
        vec4 h3 = hash42(sd + g * vec2(5.1, 41.9) + 23.0);
        float life = sin(3.14159265 * ph);
        life *= life;

        float a = h2.x * TAU + (h2.y - 0.5) * 1.4 * (ph - 0.5) * T;
        float ca = cos(a);
        float sa = sin(a);
        vec2 q = vec2(ca * q0.x + sa * q0.y, -sa * q0.x + ca * q0.y);

        if (isBlob) {
          // white specular hot-spot / bokeh blob
          float rad = 0.045 + 0.07 * h2.w;
          vec2 e = q / vec2(rad * (1.0 + 0.6 * h2.z), rad);
          float d = length(e);
          float edge = mix(0.75, 0.22, h3.z); // some blobs crisp, some soft
          float blob = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, d);
          F.white += blob * life * (0.75 + 0.6 * h3.w);
          float rim = (d - 1.05) * 3.5;
          F.light += spectrum(clamp((d - 0.7) * 1.2, 0.0, 1.0)) * exp(-rim * rim) * life * 0.25;
          continue;
        }

        float kind = h3.y;
        float curv = (h2.z - 0.5) * 1.9;
        float wid = 0.07 + 0.13 * h2.w * h2.w;     // <= 0.24 incl. glows: keeps cull seam-free
        float L = 0.11 + 0.19 * h3.x;
        if (kind > 0.62) wid *= 1.2;                     // broad glows & shadows
        float across = q.y + curv * q.x * q.x;
        float x = across / wid;
        float qa = q.x / L;
        float I = exp(-(x * x * 0.75 + qa * qa)) * life;
        if (I < 0.002) continue;

        if (kind < 0.62) {
          float dir = h3.z < 0.5 ? 1.0 : -1.0;
          float hx = 0.2 + 0.55 * h1.w + dir * x * 0.24;
          F.light += spectrum(hx) * I * (0.85 + 0.7 * h3.w);
        } else if (kind < 0.75) {
          F.light += vec3(0.30, 0.16, 1.0) * I * (0.7 + 0.4 * h3.w);   // violet-blue
        } else if (kind < 0.83) {
          F.light += vec3(1.0, 0.38, 0.12) * I * (0.7 + 0.4 * h3.w);   // warm amber-red
        } else {
          F.dark += I * 1.1;                                            // shadow band
        }
      }
    }
  }
  return F;
}

vec3 shade(vec2 uv, float t) {
  Field F = evalField(uv, t);
  float n = fbm(uv * 0.9 + vec2(t * 0.05, -t * 0.03));
  vec3 base = mix(vec3(0.20, 0.16, 0.19), vec3(0.62, 0.54, 0.59), smoothstep(0.2, 0.8, n));
  base *= 1.0 - 0.62 * clamp(F.dark, 0.0, 1.0);
  vec3 light = 1.0 - exp(-F.light * 1.6);          // soft-clip the additive light
  vec3 col = 1.0 - (1.0 - base) * (1.0 - light);    // screen blend
  col = mix(col, vec3(1.0, 0.97, 0.95), clamp(F.white, 0.0, 1.0) * 0.92);
  return col;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;   // y in [-0.5, 0.5]
  float t = uTime;
  vec3 col;

  if (uMode == 0) {
    float r = uCamA.z;
    vec2 pr = vec2(cos(r) * p.x - sin(r) * p.y, sin(r) * p.x + cos(r) * p.y);
    vec2 uv = pr / uCamA.w + uCamA.xy;
    col = shade(uv, t);
  } else {
    // Perspective camera gliding low over an infinite holographic sheet (z = 0).
    float pitch = uCamB.x;
    float roll = uCamB.y;
    float focal = uCamB.z;
    vec2 pr = vec2(cos(roll) * p.x - sin(roll) * p.y, sin(roll) * p.x + cos(roll) * p.y);
    float yaw = uCamA.w;
    vec3 fwd = vec3(sin(yaw) * cos(pitch), cos(yaw) * cos(pitch), -sin(pitch));
    vec3 right = normalize(vec3(cos(yaw), -sin(yaw), 0.0));
    vec3 up = cross(right, fwd);
    vec3 dir = normalize(fwd * focal + right * pr.x + up * pr.y);
    vec3 cam = vec3(uCamA.x, uCamA.y, uCamA.z);
    vec3 haze = vec3(0.47, 0.41, 0.47);
    if (dir.z > -0.0005) {
      col = haze;
    } else {
      float s = -cam.z / dir.z;
      vec2 uv = (cam.xy + dir.xy * s) * 0.55;
      col = shade(uv, t);
      float fog = 1.0 - exp(-max(s - 0.6, 0.0) * uCamB.w);
      col = mix(col, haze, clamp(fog, 0.0, 0.92));
    }
  }

  // subtle lens vignette
  float v = smoothstep(1.25, 0.35, length(p * vec2(0.9, 1.25)));
  col *= mix(0.72, 1.0, v);

  // triangular dither to avoid banding in the soft gradients
  float dth = hash12(gl_FragCoord.xy + fract(t) * 91.7) + hash12(gl_FragCoord.yx * 1.37 + 4.1) - 1.0;
  col += dth / 255.0;

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
