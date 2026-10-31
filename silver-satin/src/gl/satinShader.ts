import { NOISE_GLSL } from "./noise.glsl";

/**
 * Flowing silver satin.
 *
 * A heightfield made of warped travelling folds, broad billows and localised
 * fine ripples, shaded with a satin studio environment (big overhead softbox,
 * cool key light, navy bounce) plus cavity / occlusion darkening.
 *
 * Two cameras share the same cloth:
 *  - uCamMode = 0: near top-down view with a gentle drift (matches reference)
 *  - uCamMode = 1: low-angle perspective camera that dollies forward while
 *                  orbiting and rolling slightly (alternative version)
 */
export const SATIN_FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uProgress;
uniform float uCamMode;

uniform vec3 uDeep;     // deepest crevices (warm near-black)
uniform vec3 uShadow;   // navy shadow
uniform vec3 uMid;      // steel-blue mid tone
uniform vec3 uLight;    // pale silver
uniform vec3 uSheen;    // brightest highlight (slightly warm white)

${NOISE_GLSL}

// Cloth fold profile: broad rounded crests, tight crease valleys.
float fold(float x) {
  float sn = sin(x);
  return sqrt(sn * sn + 0.09) * 2.0 - 1.0;
}

float satin(vec2 p, float t, float lod) {
  // fold orientation slowly turns from horizontal to a gentle diagonal
  float ang = 0.05 + 0.30 * smoothstep(3.0, 12.0, t);
  p = rot2(ang) * p;
  // gentle, low-frequency warp (keeps folds long and continuous)
  vec2 w = vec2(snoise(vec2(p.x * 0.22, p.y * 0.35) + vec2(0.0, t * 0.07)),
                snoise(vec2(p.x * 0.22, p.y * 0.35) + vec2(7.3, 2.1) - vec2(t * 0.05, 0.0)));
  vec2 q = p + vec2(0.35, 0.45) * w;
  float h = 0.0;
  // primary long horizontal folds travelling across the cloth
  h += 0.58 * fold(q.y * 1.02 + 0.13 * q.x - t * 0.26
                  + 1.1 * snoise(vec2(q.x * 0.24, q.y * 0.40) + vec2(t * 0.06, 0.0)));
  // secondary folds at a slight angle, faster
  h += 0.17 * fold(q.y * 1.8 - 0.28 * q.x - t * 0.42
                  + 0.8 * snoise(vec2(q.x * 0.35, q.y * 0.55) - t * 0.05 + 3.0));
  // broad billows
  h += 0.38 * snoise(vec2(q.x * 0.30, q.y * 0.55) + vec2(t * 0.05, -t * 0.09));
  // fine horizontal ripples in some regions of the cloth
  float m = smoothstep(0.0, 0.65, snoise(vec2(q.x * 0.35, q.y * 0.5) + vec2(-t * 0.06, 4.0)));
  h += lod * 0.07 * m * fold(q.y * 5.5 + 0.3 * q.x + 2.0 * snoise(q * 0.9 + t * 0.1) - t * 0.7);
  return h;
}

vec3 environment(vec3 R) {
  vec3 Lsoft = normalize(vec3(-0.15, 0.45, 0.88));
  vec3 Lkey  = normalize(vec3(-0.60, 0.35, 0.72));
  vec3 Lrim  = normalize(vec3( 0.70, -0.20, 0.68));
  float d = dot(R, Lsoft);
  vec3 c = mix(uShadow, uMid, smoothstep(-0.05, 0.62, d));
  c = mix(c, uLight, smoothstep(0.72, 0.93, d));
  c = mix(c, uSheen, smoothstep(0.90, 0.99, d));
  c += uSheen * 0.45 * pow(max(dot(R, Lkey), 0.0), 10.0);
  c += uSheen * 0.60 * pow(max(dot(R, Lsoft), 0.0), 90.0);
  c += uMid * 0.35 * pow(max(dot(R, Lrim), 0.0), 6.0);
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;
  float t = uTime;
  float P = uProgress;
  float ease = P * P * (3.0 - 2.0 * P);

  vec2 p;
  vec3 V;
  float eps = 0.004;
  float lod = 1.0;
  float fog = 0.0;
  const float AMP = 0.35;   // world-space height of the cloth relief

  if (uCamMode < 0.5) {
    // --- V1: near top-down camera, gentle drift ---------------------------
    float zoom = 3.4;
    p = rot2(-0.04 + 0.05 * ease) * uv * zoom + vec2(0.35 * t * 0.1, -0.15 * ease);
    V = vec3(0.0, 0.0, 1.0);
  } else {
    // --- V2: low-angle perspective dolly + orbit + slight roll -------------
    float yaw   = mix(-0.55, 0.35, ease);
    float pitch = mix(0.74, 0.60, ease);         // radians below the horizon
    float roll  = mix(0.06, -0.05, ease);
    vec3 target = vec3(mix(-0.6, 1.4, ease), mix(0.0, 3.2, ease), 0.0);
    float dist  = mix(4.6, 3.4, ease);
    vec3 fwd = vec3(sin(yaw) * cos(pitch), cos(yaw) * cos(pitch), -sin(pitch));
    vec3 ro = target - fwd * dist;
    vec3 right = normalize(cross(fwd, vec3(0.0, 0.0, 1.0)));
    vec3 up = cross(right, fwd);
    vec2 suv = rot2(roll) * uv;
    vec3 rd = normalize(fwd * 1.35 + suv.x * right + suv.y * up);
    // intersect the cloth's base plane, then refine onto the displaced surface
    float tp = -ro.z / rd.z;
    p = ro.xy + rd.xy * tp;
    // damped fixed-point refinement (stable even at grazing angles)
    float tBase = tp;
    for (int i = 0; i < 3; i++) {
      float z = 0.16 * satin(p, t, 0.0);
      tp = mix(tp, (z - ro.z) / rd.z, 0.6);
      p = ro.xy + rd.xy * tp;
    }
    tp = mix(tp, tBase, smoothstep(5.0, 8.0, tBase));
    p = ro.xy + rd.xy * tp;
    V = -rd;
    // pixel footprint grows with distance: widen the normal filter, fade ripples
    float footprint = tp / (1.35 * uRes.y);
    eps = max(0.004, footprint * 2.5);
    lod = 1.0 - smoothstep(3.0, 6.0, tp);
    fog = smoothstep(4.5, 9.5, tp);
  }

  float h  = satin(p, t, lod);
  float hx = satin(p + vec2(eps, 0.0), t, lod);
  float hy = satin(p + vec2(0.0, eps), t, lod);
  vec2 grad = vec2(hx - h, hy - h) / eps;
  vec3 N = normalize(vec3(-grad * AMP * 0.92, 1.0));
  vec3 R = reflect(-V, N);

  vec3 col = environment(R);
  // satin sheen: broad diffuse term keeps the cloth luminous
  float diff = clamp(dot(N, normalize(vec3(-0.3, 0.4, 0.86))), 0.0, 1.0);
  col *= 0.70 + 0.38 * diff;

  // cavity / occlusion in the valleys of the folds
  float occ = smoothstep(-1.05, 0.35, h);
  col = mix(uDeep, col, 0.60 + 0.40 * occ);

  // perspective: far cloth falls off into navy shadow
  col = mix(col, uShadow * 0.45, fog);

  // gentle vignette (reference has darker corners)
  vec2 s = frag / uRes;
  float vig = smoothstep(1.15, 0.30, length((s - 0.5) * vec2(1.2, 1.0)));
  col *= mix(0.62, 1.0, vig);

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
