/**
 * The displaced surface, shared by the line pass and the glow pass.
 *
 * The cloth is a plane tilted away from the camera. Its intrinsic coordinates
 * are `s` (across, world units) and `d` (away from camera, world units); the
 * displacement is applied along the plane normal, so nothing is squashed by
 * the tilt.
 *
 * LOOPING: every time-dependent term is a function of cos(uPhase) / sin(uPhase)
 * with uPhase = 2*PI*frame/durationInFrames, so frame 0 and frame N are
 * bit-identical. Three octaves each ride their own circle in the noise's 4th
 * dimension *and* orbit the sample position, so crests migrate across the
 * cloth instead of pulsing in place.
 */
export const SURFACE = /* glsl */ `
uniform float uPhase;        // 2*PI * t
uniform vec3  uPlaneD;       // unit vector: away-from-camera direction of the plane
uniform vec3  uPlaneN;       // unit vector: plane normal (displacement axis)
uniform float uDepthNear;    // plane coordinate of the near edge
uniform float uDepthFar;     // plane coordinate of the far edge
uniform float uSpanNear;     // width of the plane at the near edge
uniform float uSpanFar;      // width of the plane at the far edge
uniform float uAmp;          // displacement amplitude, world units
uniform float uAniso;        // < 1 stretches the folds along the cloth's s axis
uniform vec3  uOctFreq;      // spatial frequency per octave
uniform vec3  uOctAmp;       // relative amplitude per octave
uniform vec3  uOctDrift;     // how far each octave's field orbits over one loop
uniform vec3  uOctTime;      // radius of each octave's circle in the 4th dimension

// Plane coordinates for a UV sample. uv.y == 0 is the far edge, 1 the near edge.
vec2 planeCoords(vec2 uv) {
  float d = mix(uDepthFar, uDepthNear, uv.y);
  float halfSpan = 0.5 * mix(uSpanFar, uSpanNear, uv.y);
  return vec2((uv.x - 0.5) * 2.0 * halfSpan, d);
}

float foldHeight(vec2 sd) {
  vec2 q = vec2(sd.x * uAniso, sd.y);
  float h = 0.0;

  // Octave 1 — the broad rolling folds.
  float c1 = cos(uPhase);
  float s1 = sin(uPhase);
  vec2 o1 = vec2(c1 * 0.35, s1) * uOctDrift.x;
  h += snoise4(vec4((q + o1) * uOctFreq.x, uOctTime.x * c1, uOctTime.x * s1)) * uOctAmp.x;

  // Octave 2 — secondary creases, drifting on its own phase.
  float c2 = cos(uPhase + 2.399);
  float s2 = sin(uPhase + 2.399);
  vec2 o2 = vec2(c2 * 0.35, s2) * uOctDrift.y;
  h += snoise4(vec4((q + o2) * uOctFreq.y + 17.3, uOctTime.y * c2, uOctTime.y * s2)) * uOctAmp.y;

  // Octave 3 — fine ripple that keeps the crest filaments from looking CG-clean.
  float c3 = cos(uPhase + 4.712);
  float s3 = sin(uPhase + 4.712);
  vec2 o3 = vec2(c3 * 0.35, s3) * uOctDrift.z;
  h += snoise4(vec4((q + o3) * uOctFreq.z + 41.7, uOctTime.z * c3, uOctTime.z * s3)) * uOctAmp.z;

  return h * uAmp;
}

vec3 surfacePos(vec2 uv) {
  vec2 sd = planeCoords(uv);
  vec3 base = vec3(sd.x, 0.0, 0.0) + uPlaneD * sd.y;
  return base + uPlaneN * foldHeight(sd);
}
`;
