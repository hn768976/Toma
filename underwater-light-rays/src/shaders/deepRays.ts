import { GLSL_COMMON } from "./common";

/**
 * Composition 1: deep, dark open ocean lit from just outside the top-right
 * corner. Broad, soft, near-parallel shafts slant steeply down to the left
 * (as sunlight from a distant source does underwater), the light breathes in
 * brightness, and faint suspended particles ("marine snow") drift through it.
 *
 * Coordinates: p is in "frame units" with y in [0, 1] (bottom to top) and x in
 * [0, aspect]. uCam moves a virtual camera over that plane (offset, zoom, roll)
 * so a second version can use camera movement without changing the scene.
 */
export const DEEP_RAYS_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uFrame;

uniform vec4 uCam;          // xy: offset, z: zoom, w: roll (radians)
uniform vec2 uLightPos;     // bright hotspot where the light enters, frame units
uniform vec2 uRaySource;    // distant virtual source the shafts radiate from
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

// Angle around the distant ray source, measured from the direction towards
// the middle of the frame. The atan() seam (+-PI) points away from the frame.
float shaftAngle(vec2 p) {
  vec2 toFrame = normalize(vec2(1.0, 0.55) - uRaySource);
  vec2 v = p - uRaySource;
  vec2 r = vec2(dot(v, toFrame), dot(v, vec2(-toFrame.y, toFrame.x)));
  return atan(r.y, r.x);
}

// Brightness of the volumetric shafts at scene position p.
float rayField(vec2 p, float t) {
  float a = shaftAngle(p);
  // Distance from the hotspot drives brightness; the shafts' pattern comes
  // from the distant source so they stay broad and nearly parallel.
  float d = length(p - uLightPos);

  // Broad soft shafts, medium shafts and a hint of fine structure.
  float broad = noise2(vec2(a * 16.0, t * 0.2));
  float medium = noise2(vec2(a * 42.0 + 3.1, t * 0.32));
  float fine = noise2(vec2(a * 110.0 + 11.7, t * 0.42));

  // Shafts lose definition with distance (they scatter into haze).
  float definition = exp(-d * 0.6);
  float beams = 0.55 * broad + 0.33 * medium + 0.12 * fine;
  beams = mix(0.5, beams, 0.35 + 0.65 * definition);
  beams = pow(beams, 2.0) * 2.7;

  // Slow travelling density variation along the shafts.
  float along = 0.75 + 0.5 * noise2(vec2(a * 12.0, d * 2.0 - t * 0.12));

  // Light spreads from the hotspot mostly down and to the left.
  vec2 rel = p - uLightPos;
  float side = smoothstep(0.35, -0.25, rel.x + 0.25 * rel.y);
  float falloff = exp(-d * 1.6) * mix(0.3, 1.0, side);
  return beams * along * falloff;
}

// A few thin, bright streaks radiating from the hotspot itself, fading out
// quickly. Measured in a frame rotated to point down-left so the atan() seam
// lies behind the light, where the streaks are masked out.
float hotspotStreaks(vec2 p, float t) {
  vec2 v = rotate2(p - uLightPos, 2.0);
  float a = atan(v.y, v.x);
  float d = length(v);
  float mask = exp(-a * a / (2.0 * 0.3 * 0.3));
  float s = pow(noise2(vec2(a * 60.0, t * 0.3)), 7.0) * 1.6
          + pow(noise2(vec2(a * 25.0 + 7.0, t * 0.22)), 3.0) * 0.6;
  return s * mask * exp(-d * 2.6);
}

// Soft drifting haze, streaked along the shafts, plus slowly rolling clouds.
float haze(vec2 p, float t) {
  float a = shaftAngle(p);
  float d = length(p - uLightPos);
  float streaks = fbm(vec2(a * 14.0 + t * 0.015, d * 1.6 - t * 0.04), 4);
  float clouds = fbm(p * 2.2 + vec2(t * 0.035, -t * 0.02), 4);
  return (streaks * 0.55 + clouds * 0.75) * exp(-d * 1.05);
}

// One layer of suspended particles.
float particles(vec2 p, float t, float density, float size, vec2 drift, float seed) {
  vec2 q = p * density + drift * t + seed;
  vec2 cell = floor(q);
  float h = hash12(cell + seed * 3.7);
  if (h < 0.72) return 0.0;
  // Keep each particle inside its cell so only one cell needs evaluating.
  vec2 o = 0.25 + 0.5 * hash22(cell + seed);
  // Gentle individual wobble.
  o += 0.12 * vec2(sin(t * (0.4 + h) + h * 40.0), cos(t * (0.3 + o.x) + o.y * 30.0));
  float r = length(q - (cell + o));
  float s = size * (0.6 + 0.8 * hash11(h * 91.0));
  float twinkle = 0.65 + 0.35 * sin(t * (1.0 + 2.0 * o.y) + h * 60.0);
  float sum = smoothstep(s, s * 0.2, r) * twinkle * (h - 0.72) * 3.5;
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
  float ld = length(p - uLightPos);
  float glow = exp(-ld * 3.6) * 1.35 + exp(-ld * 1.5) * 0.4;
  // Dim blue fog that keeps the far, unlit water from going fully black.
  float fog = 0.13 * smoothstep(-0.2, 1.1, p.y) * (0.65 + 0.7 * fbm(p * 1.4 + t * 0.02, 3));

  float light = (rays * 0.5 + hotspotStreaks(p, t) * 0.15 + hz * 0.4 + glow * 0.85 + fog) * uPulse;

  // Particles are lit by the light passing through them.
  float illum = 0.1 + light * 1.2;
  float pt = 0.0;
  pt += particles(cameraToScene(screen, aspect, 0.65), t, 40.0, 0.06, vec2(0.10, 0.16), 1.0) * 0.5;
  pt += particles(cameraToScene(screen, aspect, 1.0), t, 26.0, 0.05, vec2(0.08, 0.12), 7.0) * 0.7;
  pt += particles(cameraToScene(screen, aspect, 1.45), t, 16.0, 0.045, vec2(0.05, 0.08), 13.0) * 0.8;
  pt *= illum * 0.14;

  // Colour ramp: deep -> water -> ray -> core.
  vec3 col = uColDeep;
  col = mix(col, uColWater, smoothstep(0.0, 0.55, light));
  col = mix(col, uColRay, smoothstep(0.45, 1.25, light));
  col = mix(col, uColCore, smoothstep(1.05, 2.0, light));
  col += uColRay * pt;

  // Ambient falloff away from the light, and the reference's lower edge
  // sinking to black.
  float ambient = smoothstep(2.4, 0.5, ld);
  col *= mix(0.3, 1.0, ambient);
  col *= smoothstep(-0.05, 0.6, p.y + 0.25 * (p.x / aspect - 0.5));

  col += grain(gl_FragCoord.xy, uFrame);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
