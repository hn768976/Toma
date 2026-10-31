/**
 * Swimming-pool floor seen through moving water — WebGL 2 fragment shader.
 *
 * Layers (all procedural, all a pure function of time):
 *  1. A square-tile mosaic with light grout lines on the pool floor.
 *  2. Refraction: the floor lookup is displaced by an animated water-surface
 *     slope field, which makes the grid lines wobble like the reference.
 *  3. Caustics: a net of thin bright lines (ridged 3-D noise), gathered
 *     into drifting patches by a low-frequency mask.
 *
 * Camera modes
 *  - uCamMode = 0: straight top-down view (matches the reference framing).
 *    The screen maps onto uGrid tiles (62 x 41 measured from the reference).
 *  - uCamMode = 1: tilted perspective camera gliding forward over the pool
 *    while slowly yawing, with Fresnel sky reflection and depth fade.
 */
export const POOL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform float uCamMode;     // 0 = top-down, 1 = tilted perspective
uniform vec2  uGrid;        // tiles across / down the frame in top-down mode
uniform vec3  uCamPos;      // perspective camera position (tile units)
uniform float uCamYaw;      // radians
uniform float uCamPitch;    // radians below the horizon
uniform float uCamFov;      // vertical field of view, radians
uniform vec3  uTileColor;
uniform vec3  uGroutColor;
uniform vec3  uCausticColor;
uniform vec3  uSkyColor;

out vec4 outColor;

// ---------------------------------------------------------------- noise ---
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 3-D gradient noise in [-1, 1].
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(hash33(i + vec3(0, 0, 0)), f - vec3(0, 0, 0));
  float n100 = dot(hash33(i + vec3(1, 0, 0)), f - vec3(1, 0, 0));
  float n010 = dot(hash33(i + vec3(0, 1, 0)), f - vec3(0, 1, 0));
  float n110 = dot(hash33(i + vec3(1, 1, 0)), f - vec3(1, 1, 0));
  float n001 = dot(hash33(i + vec3(0, 0, 1)), f - vec3(0, 0, 1));
  float n101 = dot(hash33(i + vec3(1, 0, 1)), f - vec3(1, 0, 1));
  float n011 = dot(hash33(i + vec3(0, 1, 1)), f - vec3(0, 1, 1));
  float n111 = dot(hash33(i + vec3(1, 1, 1)), f - vec3(1, 1, 1));
  return 1.6 * mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z);
}

// ------------------------------------------------------------ water ------
// Refraction offset of the floor seen through the moving surface.
vec2 refractOffset(vec2 w, float t) {
  vec3 a = vec3(w * 0.42, t * 0.75);
  vec3 b = vec3(w * 1.10 + 13.7, t * 1.10);
  vec2 o;
  o.x = 0.60 * gnoise(a) + 0.26 * gnoise(b) + 0.16 * gnoise(vec3(w * 2.6, t * 1.6) + 3.1);
  o.y = 0.60 * gnoise(a + 41.3) + 0.26 * gnoise(b + 17.9) + 0.16 * gnoise(vec3(w * 2.6, t * 1.6) + 9.4);
  return o * 0.31;
}

// Net of thin bright caustic lines, gathered into drifting patches.
float caustics(vec2 w, float t) {
  vec2 warp = vec2(gnoise(vec3(w * 0.35, t * 0.4)), gnoise(vec3(w * 0.35 + 7.0, t * 0.4)));
  vec2 cw = w + warp * 0.9;
  float r1 = 1.0 - abs(gnoise(vec3(cw * 0.95, t * 1.05)));
  float r2 = 1.0 - abs(gnoise(vec3(cw * 1.90 + 5.3, t * 1.35)));
  float net = pow(r1, 9.0) * 0.85 + pow(r2, 11.0) * 0.55;

  // Patch mask: caustics bunch up in irregular blotches.
  float m = 0.60 * gnoise(vec3(w * 0.15, t * 0.20 + 2.0))
          + 0.40 * gnoise(vec3(w * 0.33 + 4.0, t * 0.28));
  float mask = smoothstep(-0.30, 0.55, m);
  // Soft light haze inside the patches + the sharp net on top.
  return net * (0.15 + 0.85 * mask) * 0.50 + 0.06 * mask * (0.6 + 0.4 * r1);
}

// Tile mosaic: 0 inside a tile, 1 on the grout lines (anti-aliased).
float grout(vec2 w) {
  vec2 g = abs(fract(w) - 0.5);           // 0.5 at tile edges
  vec2 aa = fwidth(w) * 0.9;
  float halfW = 0.055;                     // grout half-width in tiles
  vec2 line = smoothstep(0.5 - halfW - aa, 0.5 - halfW + aa, g);
  return max(line.x, line.y);
}

// Shade the floor at world position w (tile units).
vec3 floorColor(vec2 w, float t) {
  vec2 rw = w + refractOffset(w, t);
  float gl = grout(rw);

  // Subtle per-tile tint variation (real mosaic tiles are never identical).
  float tileVar = hash12(floor(rw) + 0.5) - 0.5;
  vec3 tile = uTileColor * (1.0 + 0.035 * tileVar);
  vec3 col = mix(tile, uGroutColor, gl * 0.78);

  // Slow, large-scale light variation through the water.
  float shade = gnoise(vec3(w * 0.05, t * 0.08 + 11.0));
  col *= 1.0 + 0.035 * shade;

  float c = caustics(w, t);
  col = mix(col, uCausticColor, clamp(c * 1.25, 0.0, 1.0));
  return col;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float t = uTime;
  vec3 col;

  if (uCamMode < 0.5) {
    // Top-down: map the frame straight onto the floor.
    vec2 q = frag / uResolution;
    vec2 w = vec2(q.x, 1.0 - q.y) * uGrid;
    col = floorColor(w, t);
  } else {
    // Tilted perspective camera above the water.
    vec2 s = (frag - 0.5 * uResolution) / uResolution.y;
    float cy = cos(uCamYaw), sy = sin(uCamYaw);
    float cp = cos(uCamPitch), sp = sin(uCamPitch);
    vec3 fwd = vec3(sy * cp, cy * cp, -sp);   // z up, looking down
    vec3 right = normalize(vec3(cy, -sy, 0.0));
    vec3 up = cross(right, fwd);
    float f = 0.5 / tan(0.5 * uCamFov);
    vec3 rd = normalize(s.x * right + s.y * up + f * fwd);

    // Intersect the floor plane z = 0 (camera is above it).
    float dist = -uCamPos.z / rd.z;
    vec2 w = uCamPos.xy + rd.xy * dist;
    col = floorColor(w, t);

    // Water depth: distant floor fades into deeper blue.
    float fog = 1.0 - exp(-max(dist - 18.0, 0.0) * 0.012);
    col = mix(col, uTileColor * vec3(0.55, 0.78, 0.9), fog * 0.55);

    // Fresnel reflection of the sky off the surface at grazing angles,
    // broken up by the same ripples.
    float cosI = clamp(-rd.z, 0.0, 1.0);
    float fres = 0.02 + 0.98 * pow(1.0 - cosI, 5.0);
    float ripple = 0.5 + 0.5 * gnoise(vec3(w * vec2(0.6, 0.25), t * 0.9));
    col = mix(col, uSkyColor, clamp(fres * (0.7 + 0.6 * ripple), 0.0, 0.6));
  }

  // Tiny dither to keep gradients clean after H.264 encoding.
  col += (hash12(frag + fract(t) * 57.3) - 0.5) / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
