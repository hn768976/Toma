// GLSL for the two element renderers.
//
// Both share a common prologue: the recycling offset, the depth-bucket
// cross-fade, the near/far fades, the colour ramp and the shimmer are all
// computed identically so a dot and a dash at the same depth agree exactly.
//
// Everything writes premultiplied alpha and the materials blend with
// ONE/ONE, so a layer's canvas holds a genuine additive accumulation that
// CSS `plus-lighter` can then composite onto the layer beneath it.

const COMMON = /* glsl */ `
uniform float uTravel;
uniform float uZTotal;
uniform vec4  uSlab;        // nearEdge, nearFeather, farEdge, farFeather
uniform float uPixelScale;  // device px per reference px
uniform float uFrame;
uniform vec3  uColNear;
uniform vec3  uColMid;
uniform vec3  uColFar;
uniform vec3  uTintColor;
uniform float uTintAmount;
uniform float uColorDepth;
uniform float uNearFade;
uniform vec2  uFog;         // start, end
uniform float uIntensity;
uniform float uAtten;
uniform float uAttenBase;
uniform float uSizeMax;

const float TAU = 6.2831853;
const float MIN_PX = 1.35;

// Distance in front of the camera, after the loop's recycling offset.
float depthAt(float z0) {
  return mod(z0 + uTravel, uZTotal);
}

// Membership of this layer's depth bucket. The ramps at a shared edge are
// complementary between neighbouring buckets, so an element dissolves from
// one blur radius into the next at constant total brightness.
float layerAlpha(float d) {
  float lo = uSlab.y > 0.0
    ? smoothstep(uSlab.x - uSlab.y, uSlab.x + uSlab.y, d)
    : step(uSlab.x, d);
  float hi = uSlab.w > 0.0
    ? 1.0 - smoothstep(uSlab.z - uSlab.w, uSlab.z + uSlab.w, d)
    : step(d, uSlab.z);
  return lo * hi;
}

// Fade out as elements sweep past the camera, fade in at the far end. This
// is what hides the recycling seam.
float depthFade(float d) {
  return smoothstep(0.0, uNearFade, d) * (1.0 - smoothstep(uFog.x, uFog.y, d));
}

vec3 rampColor(float d, float tintAmt) {
  float t = clamp(d / uColorDepth, 0.0, 1.0);
  vec3 c = t < 0.5
    ? mix(uColNear, uColMid, t * 2.0)
    : mix(uColMid, uColFar, (t - 0.5) * 2.0);
  return mix(c, uTintColor, tintAmt * uTintAmount);
}

float shimmerAt(vec2 sh, float period) {
  return 1.0 + sh.x * sin(TAU * (uFrame / period + sh.y));
}
`;

export const DOT_VERTEX = /* glsl */ `
${COMMON}

attribute float aSize;
attribute float aBright;
attribute vec2  aShim;
attribute float aPeriod;
attribute float aTint;

varying vec3  vColor;
varying float vAlpha;

void main() {
  float d = depthAt(position.z);
  vec4 mv = modelViewMatrix * vec4(position.xy, -d, 1.0);
  gl_Position = projectionMatrix * mv;

  float alpha = layerAlpha(d)
              * depthFade(d)
              * aBright
              * shimmerAt(aShim, aPeriod)
              * uIntensity;

  float dist = max(-mv.z, 0.5);
  float want = aSize * uPixelScale * (uAtten / dist + uAttenBase);
  want = min(want, uSizeMax * uPixelScale);
  float actual = max(want, MIN_PX);

  // Sub-pixel elements are clamped up to MIN_PX and dimmed by the area
  // ratio, so the 1080p preview reads like a downsampled 4K frame instead
  // of dropping the faintest points.
  alpha *= (want * want) / (actual * actual);
  gl_PointSize = actual;

  if (alpha < 0.0035 || gl_Position.w <= 0.0) {
    gl_PointSize = 0.0;
    alpha = 0.0;
  }

  vAlpha = alpha;
  vColor = rampColor(d, aTint) * alpha;
}
`;

export const DOT_FRAGMENT = /* glsl */ `
precision highp float;

varying vec3  vColor;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float f = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
  float a = f * f;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(vColor * a, vAlpha * a);
}
`;

// Dashes and streaks are screen-space capsules: both endpoints are
// projected, the quad is expanded around the resulting screen-space segment
// and the fragment shader evaluates a capsule SDF. Because the segment runs
// along the travel axis, perspective makes it radiate from the vanishing
// point and foreshorten correctly with depth.
export const CAPSULE_VERTEX = /* glsl */ `
${COMMON}

uniform vec2  uHalfRes;       // half the drawing buffer, device px
uniform float uWidthGain;
uniform float uMaxLenPx;      // screen-space length cap, reference px
uniform float uNearOnly;      // 1 => restrict to the near band
uniform vec2  uNearOnlyRange; // (from, to) depth of that restriction

attribute vec3  iPos;
attribute float iLen;
attribute float iWidth;
attribute float iBright;
attribute vec2  iShim;
attribute float iPeriod;
attribute float iTint;

varying vec3  vColor;
varying float vAlpha;
varying vec2  vS0;
varying vec2  vS1;
varying float vHalfW;

void main() {
  float d = depthAt(iPos.z);

  vec4 mv0 = modelViewMatrix * vec4(iPos.xy, -d, 1.0);
  vec4 mv1 = modelViewMatrix * vec4(iPos.xy, -d - iLen, 1.0);
  vec4 c0 = projectionMatrix * mv0;
  vec4 c1 = projectionMatrix * mv1;

  float alpha = layerAlpha(d)
              * depthFade(d)
              * iBright
              * shimmerAt(iShim, iPeriod)
              * uIntensity;
  alpha *= mix(1.0, smoothstep(uNearOnlyRange.x, uNearOnlyRange.y, d), uNearOnly);

  float dist = max(-mv0.z, 0.5);
  float want = iWidth * uPixelScale * (uAtten / dist + uAttenBase) * uWidthGain;
  want = min(want, uSizeMax * uPixelScale * uWidthGain);
  float actual = max(want, MIN_PX);
  alpha *= want / actual; // only one dimension is thin

  bool dead = alpha < 0.0035 || c0.w <= 0.001 || c1.w <= 0.001;

  vec2 s0 = c0.xy / c0.w * uHalfRes;
  vec2 s1 = c1.xy / c1.w * uHalfRes;
  vec2 delta = s1 - s0;
  float l = length(delta);

  // A fixed world-space length explodes into a frame-crossing streak once an
  // element is close to the camera, which reads as a hyperspace jump rather
  // than a data field. Cap the projected length instead, and pull the far
  // endpoint (and its w/z) back along the segment to match.
  float k = min(1.0, uMaxLenPx * uPixelScale / max(l, 1e-4));
  s1 = s0 + delta * k;
  float w1 = mix(c0.w, c1.w, k);
  float z1 = mix(c0.z, c1.z, k);
  delta = s1 - s0;
  l = length(delta);

  vec2 dir = l > 1e-4 ? delta / l : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  float halfW = 0.5 * actual;
  float t = position.x + 0.5;
  vec2 base = mix(s0, s1, t);
  vec2 sp = base
          + nrm * (position.y * 2.0 * halfW)
          + dir * ((t * 2.0 - 1.0) * halfW); // round caps need the overhang

  float w = mix(c0.w, w1, t);
  gl_Position = dead
    ? vec4(0.0, 0.0, 2.0, 1.0)
    : vec4(sp / uHalfRes * w, mix(c0.z, z1, t), w);

  vS0 = s0 + uHalfRes;
  vS1 = s1 + uHalfRes;
  vHalfW = halfW;
  vAlpha = dead ? 0.0 : alpha;
  vColor = rampColor(d, iTint) * vAlpha;
}
`;

export const CAPSULE_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uBead;

varying vec3  vColor;
varying float vAlpha;
varying vec2  vS0;
varying vec2  vS1;
varying float vHalfW;

void main() {
  vec2 ba = vS1 - vS0;
  vec2 pa = gl_FragCoord.xy - vS0;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  float dist = length(pa - ba * h);
  float f = clamp(1.0 - dist / max(vHalfW, 1e-4), 0.0, 1.0);
  float a = f * f;

  // The reference's bright streaks read as a fast run of beads rather than
  // a solid rod, so modulate along the length.
  if (uBead > 0.5) {
    a *= 0.58 + 0.42 * sin(h * length(ba) * 0.35);
  }

  if (a <= 0.0) discard;
  gl_FragColor = vec4(vColor * a, vAlpha * a);
}
`;
