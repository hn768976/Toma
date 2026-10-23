import { GLSL_COMMON } from "./common";

/**
 * Composition 1: deep, dark open ocean lit by a light source just outside the
 * top-right corner. Volumetric rays fan out towards the lower left, breathe in
 * brightness, and suspended particles ("marine snow") drift through them.
 *
 * Coordinates: p is in "frame units" with y in [0, 1] (bottom to top) and x in
 * [0, aspect]. uCam moves a virtual camera over that plane (offset, zoom, roll)
 * so a second version can use camera movement without changing the scene.
 */
export const DEEP_RAYS_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;

uniform vec4 uCam;          // xy: offset, z: zoom, w: roll (radians)
uniform vec2 uLightPos;     // light source in frame units
uniform float uPulse;       // global light intensity multiplier (animated in JS)

uniform vec3 uColDeep;      // darkest water
uniform vec3 uColWater;     // lit water body
uniform vec3 uColRay;       // ray highlight
uniform vec3 uColCore;      // hot core near the source

out vec4 outColor;

${GLSL_COMMON}

// Maps a screen position to scene coordinates. depth < 1 means further away
// (less parallax), depth > 1 nearer (more parallax).
vec2 cameraToScene(vec2 p, float aspect, float depth) {
  vec2 center = vec2(0.5 * aspect, 0.5);
  vec2 q = p - center;
  float zoom = pow(uCam.z, depth);
  q = rotate2(q, uCam.w * depth) / zoom;
  return q + center + uCam.xy * depth;
}

// The ray fan points left and slightly down (~ -150 degrees).
const float FAN_DIR = -2.62;

// Angle around the light measured from the fan's centre line. The atan()
// seam (+-PI) then points away from the fan, so it never shows on screen,
// even when the camera brings the light source into frame.
float fanAngle(vec2 v) {
  vec2 r = rotate2(v, -FAN_DIR);
  return atan(r.y, r.x);
}

// Brightness of the volumetric ray fan at scene position p.
float rayField(vec2 p, float t) {
  vec2 v = p - uLightPos;
  float d = length(v);
  float a = fanAngle(v);

  // Rays only exist within the fan.
  float fan = exp(-a * a / (2.0 * 0.36 * 0.36));

  // Broad soft beams, medium beams and a few sharp streaks, all evolving.
  float broad = noise2(vec2(a * 6.0, t * 0.22));
  float medium = noise2(vec2(a * 15.0 + 3.1, t * 0.36));
  float fine = noise2(vec2(a * 38.0 + 11.7, t * 0.5));
  float streak = pow(noise2(vec2(a * 85.0 + 5.3, t * 0.3)), 9.0);

  // Beams lose definition with distance (they scatter into haze).
  float definition = exp(-d * 0.55);
  float beams = 0.5 * broad + 0.35 * medium + 0.15 * fine;
  beams = mix(0.55, beams, 0.3 + 0.6 * definition);
  beams = pow(beams, 1.6) * 2.0 + streak * 0.6 * definition;

  // Slow travelling density variation along the beams.
  float along = 0.75 + 0.5 * noise2(vec2(a * 6.0, d * 2.2 - t * 0.12));

  float falloff = exp(-d * 1.55);
  return beams * along * fan * falloff;
}

// Soft drifting haze, streaked along the ray direction.
float haze(vec2 p, float t) {
  vec2 v = p - uLightPos;
  float d = length(v);
  float a = fanAngle(v);
  // Fade the streaks out well before the angle seam behind the light.
  float streaks = fbm(vec2(a * 5.0 + t * 0.015, d * 1.6 - t * 0.04), 4);
  streaks *= smoothstep(2.9, 2.0, abs(a));
  // Cloudy, slowly rolling particulate density.
  float clouds = fbm(p * 2.2 + vec2(t * 0.035, -t * 0.02), 4);
  return (streaks * 0.6 + clouds * 0.7) * exp(-d * 1.1);
}

// One layer of suspended particles.
float particles(vec2 p, float t, float density, float size, vec2 drift, float seed) {
  vec2 q = p * density + drift * t + seed;
  vec2 cell = floor(q);
  float h = hash12(cell + seed * 3.7);
  if (h < 0.55) return 0.0;
  // Keep each particle inside its cell so only one cell needs evaluating.
  vec2 o = 0.25 + 0.5 * hash22(cell + seed);
  // Gentle individual wobble.
  o += 0.12 * vec2(sin(t * (0.4 + h) + h * 40.0), cos(t * (0.3 + o.x) + o.y * 30.0));
  float r = length(q - (cell + o));
  float s = size * (0.6 + 0.8 * hash11(h * 91.0));
  float twinkle = 0.65 + 0.35 * sin(t * (1.0 + 2.0 * o.y) + h * 60.0);
  float sum = smoothstep(s, s * 0.25, r) * twinkle * (h - 0.55) * 2.2;
  return sum;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 screen = vec2(uv.x * aspect, uv.y);
  float t = uTime;

  vec2 p = cameraToScene(screen, aspect, 1.0);

  float rays = rayField(p, t);
  float hz = haze(p, t);
  vec2 lv = p - uLightPos;
  float ld = length(lv);
  float glow = exp(-ld * 3.0) * 1.45 + exp(-ld * 1.25) * 0.4;

  float light = (rays * 0.7 + hz * 0.5 + glow * 0.85) * uPulse;

  // Particles are lit by the light passing through them.
  float illum = 0.12 + light * 1.4;
  float pt = 0.0;
  pt += particles(cameraToScene(screen, aspect, 0.65), t, 34.0, 0.07, vec2(0.10, 0.16), 1.0) * 0.5;
  pt += particles(cameraToScene(screen, aspect, 1.0), t, 22.0, 0.065, vec2(0.08, 0.12), 7.0) * 0.8;
  pt += particles(cameraToScene(screen, aspect, 1.45), t, 13.0, 0.06, vec2(0.05, 0.08), 13.0) * 1.0;
  pt *= illum * 0.22;

  // Colour ramp: deep -> water -> ray -> core.
  vec3 col = uColDeep;
  col = mix(col, uColWater, smoothstep(0.0, 0.55, light));
  col = mix(col, uColRay, smoothstep(0.45, 1.25, light));
  col = mix(col, uColCore, smoothstep(1.1, 2.2, light));
  col += uColRay * pt;

  // Ambient falloff into black away from the light (lower-left darkness).
  float ambient = smoothstep(2.1, 0.5, ld);
  col *= mix(0.15, 1.0, ambient);
  // The reference's lower edge sinks to black.
  col *= smoothstep(-0.05, 0.6, screen.y + 0.25 * (screen.x / aspect - 0.5));

  col += dither(gl_FragCoord.xy);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
