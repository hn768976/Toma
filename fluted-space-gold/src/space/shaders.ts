import { HASH_GLSL, SIMPLEX_GLSL } from "../shared/glsl";

/** Instanced star quads: a round point when still, a capsule streak when moving. */
export const STAR_VERT = /* glsl */ `
attribute vec4 aStar;   // xyz, w = 1 for far (sky) stars
attribute vec4 aProps;  // size (px @720p), brightness, phase, -
attribute vec3 aColor;
uniform vec2 uRes;
uniform float uPxScale;     // uRes.y / 720
uniform float uTravelMod;   // travel mod (2*HALF)
uniform float uHalf;
uniform float uStreak;      // streak length in world units
uniform float uWarp;        // 0..1 warp amount
varying vec3 vColor;
varying vec2 vLocal;
varying float vLen;
varying float vRad;
varying float vBright;

void main() {
  bool far = aStar.w > 0.5;
  vec3 rel;
  vec3 prev;
  float fade = 1.0;
  float dist = 1.0;
  if (far) {
    rel = aStar.xyz * 1.0e6;
    prev = rel;
  } else {
    // camera moves along -z, so stars move +z relative to it
    float z = mod(aStar.z + uTravelMod + uHalf, 2.0 * uHalf) - uHalf;
    rel = vec3(aStar.xy, z);
    prev = rel - vec3(0.0, 0.0, uStreak);
    dist = length(rel);
    fade = smoothstep(uHalf, uHalf * 0.8, dist) * smoothstep(2.0, 8.0, dist);
  }
  vec3 vN = (viewMatrix * vec4(rel, 1.0)).xyz;
  vec3 vP = (viewMatrix * vec4(prev, 1.0)).xyz;
  float nz = -0.5;
  if ((vN.z > nz && vP.z > nz) || fade <= 0.0) {
    gl_Position = vec4(4.0, 4.0, 4.0, 1.0);
    return;
  }
  if (vN.z > nz) vN = mix(vP, vN, (nz - vP.z) / (vN.z - vP.z));
  if (vP.z > nz) vP = mix(vN, vP, (nz - vN.z) / (vP.z - vN.z));
  vec4 cN = projectionMatrix * vec4(vN, 1.0);
  vec4 cP = projectionMatrix * vec4(vP, 1.0);
  vec2 sN = (cN.xy / cN.w * 0.5 + 0.5) * uRes;
  vec2 sP = (cP.xy / cP.w * 0.5 + 0.5) * uRes;
  vec2 dir = sN - sP;
  float len = min(length(dir), uRes.y * 0.6);
  vec2 ax = len > 1e-4 ? normalize(dir) : vec2(1.0, 0.0);
  sP = sN - ax * len;
  vec2 pe = vec2(-ax.y, ax.x);

  float rad0 = aProps.x * uPxScale * 0.55;
  float rad = max(rad0, 0.62);               // never thinner than ~1 px: no shimmer
  float b = aProps.y * fade * (rad0 * rad0) / (rad * rad);
  if (!far) b *= clamp(180.0 / dist, 1.0, 2.6);
  // a long streak spreads the same light along its length, but stays visible
  b *= mix(1.0, 0.8, smoothstep(2.0, 60.0, len / uPxScale));
  rad *= 1.0 + 0.6 * smoothstep(2.0, 30.0, len / uPxScale);
  if (far) b *= 1.0 - 0.75 * uWarp;

  float ext = rad * 3.2;
  float along = position.x < 0.0 ? -ext : len + ext;
  vec2 px = sP + ax * along + pe * position.y * ext;
  vLocal = vec2(along, position.y * ext);
  vLen = len;
  vRad = rad;
  vBright = b;
  vColor = mix(aColor, vec3(1.0, 0.94, 0.82), 0.6 * smoothstep(2.0, 20.0, len / uPxScale));
  gl_Position = vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const STAR_FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying vec2 vLocal;
varying float vLen;
varying float vRad;
varying float vBright;
void main() {
  float t = clamp(vLocal.x, 0.0, vLen);
  vec2 d = vec2(vLocal.x - t, vLocal.y);
  float r2 = dot(d, d) / (vRad * vRad);
  float core = exp(-r2 * 0.8);
  float tail = vLen > 1.0 ? mix(0.15, 1.0, pow(t / vLen, 0.8)) : 1.0;
  gl_FragColor = vec4(vColor * vBright * core * tail, 1.0);
}
`;

/** Post pass: Milky Way glow, the Sun and the Alpha Centauri stars, tonemap, grain, dither. */
export const POST_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uPxScale;
uniform float uFrame;
uniform vec2 uTanHalf;     // tan(fov/2) * aspect, tan(fov/2)
uniform mat3 uCamRot;
uniform vec3 uBandNormal;
uniform float uWarp;
uniform vec3 uBody[4];      // x px, y px (GL origin), core radius px
uniform vec3 uBodyCore[4];
uniform vec3 uBodyGlow[4];
uniform vec4 uBodyParams[4]; // intensity, glow size (radii), granulation, visible

${HASH_GLSL}
${SIMPLEX_GLSL}

float fbm3(vec3 p) {
  return 0.55 * snoise3(p) + 0.28 * snoise3(p * 2.03 + 7.1) + 0.17 * snoise3(p * 4.1 + 2.3);
}

vec3 body(int i, vec2 fc) {
  vec4 prm = uBodyParams[i];
  if (prm.w < 0.5) return vec3(0.0);
  vec3 b = uBody[i];
  float rPx = b.z;
  float rMin = 1.6 * uPxScale;
  float R = max(rPx, rMin);
  // point-like bodies keep a floor of brightness so they read as bright stars
  float flux = max((rPx * rPx) / (R * R), 0.12);
  vec2 dv = fc - b.xy;
  float d = length(dv) / R;
  float aa = max(1.0 / R, 0.11);
  float disc = 1.0 - smoothstep(1.0 - aa * 1.5, 1.0 + aa, d);
  float mu = sqrt(max(0.0, 1.0 - d * d));
  float limb = mix(1.0, 0.6 + 0.4 * mu, smoothstep(3.0, 12.0, rPx));
  float gran = 1.0;
  if (prm.z > 0.0 && rPx > 6.0) {
    gran += prm.z * 0.06 * snoise3(vec3(dv / R * 7.0, uFrame * 0.012));
  }
  // corona: angular noise flickers slowly (pure function of the frame)
  float ang = atan(dv.y, dv.x);
  vec3 q = vec3(cos(ang) * 2.2, sin(ang) * 2.2, uFrame * 0.018 + float(i) * 13.0);
  float flick = 0.9 + 0.2 * (0.5 + 0.5 * fbm3(q + vec3(0.0, 0.0, -d * 0.35)));
  float e = max(d - 1.0, 0.0);
  float inner = exp(-e * 3.0 / prm.y) * flick;
  float outer = 0.16 / (1.0 + e * e * 2.0 / (prm.y * prm.y));
  float halo = 0.006 / (1.0 + e * e * 0.6);
  vec3 rim = mix(uBodyCore[i], uBodyCore[i] * vec3(1.0, 0.93, 0.8), smoothstep(0.6, 1.0, d));
  vec3 col = rim * disc * limb * gran * 3.0;
  col += uBodyGlow[i] * (inner * 0.95 + outer + halo) * (1.0 - disc * 0.5);
  return col * prm.x * flux;
}

// Dense faint background: procedural stars fixed to sky directions (a 3D hash
// grid sampled by the view ray), so they rotate with the camera and never streak.
vec3 skyDust(vec3 dir, float pxAngle) {
  const float K = 260.0;
  vec3 g = dir * K;
  vec3 base = floor(g - 0.5);
  vec3 acc = vec3(0.0);
  float sig = max(pxAngle * K * 0.6, 0.05);
  for (int i = 0; i < 8; i++) {
    vec3 o = vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    vec3 c = base + o;
    uvec3 h = uvec3(ivec3(c) + ivec3(4096));
    float r = hash3(h);
    if (r > 0.16) continue;
    vec3 sp = c + vec3(hash3(h + 11u), hash3(h + 23u), hash3(h + 37u));
    // project the star onto the unit sphere (in grid units) and measure the angle
    vec3 sd = normalize(sp) * K;
    float dd = length(g - sd);
    float m = hash3(h + 51u);
    float b = 0.045 + 0.5 * m * m * m;
    vec3 tint = m > 0.85 ? vec3(0.8, 0.88, 1.0) : (m < 0.08 ? vec3(1.0, 0.85, 0.7) : vec3(1.0));
    acc += tint * b * exp(-dd * dd / (sig * sig));
  }
  return acc;
}

vec3 tonemap(vec3 c) {
  // linear below the knee, soft shoulder above; hot cores bleach to white
  float k = 0.62;
  vec3 hi = k + (1.0 - k) * (1.0 - exp(-(c - k) / (1.0 - k)));
  vec3 o = mix(c, hi, step(vec3(k), c));
  float m = max(c.r, max(c.g, c.b));
  o = mix(o, vec3(1.0), clamp((m - 1.2) * 0.35, 0.0, 0.85));
  return o;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / uRes;
  vec3 col = texture2D(tScene, uv).rgb;

  // faint Milky Way band (sky direction of this pixel)
  vec3 dir = normalize(uCamRot * normalize(vec3((uv * 2.0 - 1.0) * uTanHalf, -1.0)));
  float lat = dot(dir, uBandNormal);
  float band = exp(-lat * lat / 0.018);
  float patchy = 0.5 + 0.5 * fbm3(dir * 3.5);
  float dust = smoothstep(0.1, 0.6, fbm3(dir * 6.0 + 4.0)) * exp(-lat * lat / 0.003);
  col += vec3(0.62, 0.66, 0.78) * band * (0.012 + 0.03 * patchy) * (1.0 - 0.6 * dust);

  col += skyDust(dir, 2.0 * uTanHalf.y / uRes.y) * (0.6 + 0.4 * band) * (1.0 - 0.9 * uWarp);

  for (int i = 0; i < 4; i++) col += body(i, fc);

  col = tonemap(col);
  col += (pixelNoise(fc, uFrame, 41u) - 0.5) * 0.03;
  col = clamp(col, 0.0, 1.0);
  col = dither255(col, fc, uFrame);
  gl_FragColor = vec4(col, 1.0);
}
`;
