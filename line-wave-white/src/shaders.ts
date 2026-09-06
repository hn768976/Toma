import {
  HEIGHT_AMPLITUDE,
  HEIGHT_WAVES,
  SWAY_WAVES,
  wavesToGlsl,
} from "./waves";
import { PLANE_HALF_WIDTH, Z_FAR, Z_NEAR } from "./constants";

const f = (n: number) => n.toFixed(6);

/**
 * Each stroke segment is drawn as a quad expanded in *screen space*, not in
 * world space: both endpoints are projected first, then pushed apart along the
 * screen-space normal by a fixed number of device pixels. That keeps every
 * stroke a constant hairline at every depth instead of collapsing to nothing
 * at the far edge, and it is what makes sub-pixel handling possible — below
 * uMinHalfWidth the shader stops thinning the stroke and fades its alpha
 * instead. A stroke that flickers on and off between frames is far worse than
 * one that is simply faint.
 *
 * The wave components are baked in as literals, so this compiles down to a
 * straight-line unrolled expression with no uniform array reads per vertex.
 */
export const VERTEX_SHADER = /* glsl */ `
precision highp float;

// Base quad corner: x = which side (-1 / +1), y = which end (0 / 1).
attribute vec2 aCorner;
// Per-segment: x = line position across the plane (0..1),
//              y = row position into depth (0..1, 0 = nearest).
attribute vec2 iSegment;
// Per-segment noise: x = alpha jitter, y = accent lottery.
attribute vec2 iRandom;

uniform float uTime;          // loop phase, 0..1
uniform vec2 uResolution;     // drawing buffer size, device px
uniform float uPixelScale;    // device px per composition px
uniform float uRowStep;       // 1 / (ROW_COUNT - 1)
uniform float uLineWidth;     // composition px
uniform float uMinHalfWidth;  // device px
uniform float uNearSoftness;  // composition px
uniform float uBaseAlpha;

uniform vec3 uColorFar;
uniform vec3 uColorMid;
uniform vec3 uColorDark;
uniform vec3 uColorAccent;

varying float vOffsetPx;   // signed distance from the centreline, device px
varying float vHalfPx;
varying float vFeatherPx;
varying vec3 vColor;
varying float vAlpha;

// Vertical displacement of the surface. p = (x, z) on the base plane.
float heightField(vec2 p, float t) {
  return ${wavesToGlsl(HEIGHT_WAVES)};
}

// Sideways displacement, in X.
float swayField(vec2 p, float t) {
  return ${wavesToGlsl(SWAY_WAVES)};
}

// Position of sample (u, v) on the displaced surface. Both fields are sampled
// at the *undisplaced* x, so sway stays a clean function of the base grid and
// neighbouring lines can never fold through one another.
vec3 surface(float u, float v, float t) {
  float x = (u - 0.5) * ${f(PLANE_HALF_WIDTH * 2)};
  float z = mix(${f(Z_NEAR)}, ${f(Z_FAR)}, v);
  vec2 p = vec2(x, z);
  return vec3(x + swayField(p, t), heightField(p, t), z);
}

vec2 toScreen(vec4 clip) {
  return clip.xy / clip.w * uResolution * 0.5;
}

void main() {
  float u = iSegment.x;
  float v0 = iSegment.y;
  float v1 = min(v0 + uRowStep, 1.0);

  vec3 world0 = surface(u, v0, uTime);
  vec3 world1 = surface(u, v1, uTime);

  vec4 clip0 = projectionMatrix * modelViewMatrix * vec4(world0, 1.0);
  vec4 clip1 = projectionMatrix * modelViewMatrix * vec4(world1, 1.0);

  vec2 screen0 = toScreen(clip0);
  vec2 screen1 = toScreen(clip1);

  vec2 along = screen1 - screen0;
  float alongLength = length(along);
  vec2 dir = alongLength > 1e-4 ? along / alongLength : vec2(0.0, 1.0);
  vec2 normal = vec2(-dir.y, dir.x);

  // Hairline width, in device pixels.
  float halfPx = uLineWidth * 0.5 * uPixelScale;
  float subPixelFade = 1.0;
  if (halfPx < uMinHalfWidth) {
    subPixelFade = halfPx / uMinHalfWidth;
    halfPx = uMinHalfWidth;
  }

  // Depth of field. Only the strokes nearest the camera soften, and only a
  // little; the mid band is sharp and the far edge is already dissolving by
  // density, which is a far better way to lose it than blur.
  float softPx = uNearSoftness * uPixelScale * smoothstep(0.16, 0.0, v0);

  // Expand far enough that the feather has room to fall off inside the quad.
  float expandPx = halfPx + softPx + 1.0;
  float offsetPx = aCorner.x * expandPx;

  vec4 clip = mix(clip0, clip1, aCorner.y);
  vec2 screen = mix(screen0, screen1, aCorner.y)
    + normal * offsetPx
    // Overlap consecutive segments by half a pixel so the joins of a polyline
    // do not show as a dotted line where it bends.
    + dir * (aCorner.y * 2.0 - 1.0) * 0.5;

  clip.xy = screen / (uResolution * 0.5) * clip.w;
  gl_Position = clip;

  // --- Colour -----------------------------------------------------------
  //
  // A depth ramp, near-white at the far edge, plus a crest term. The dark
  // ridges in the picture are not painted here: they come from strokes packing
  // together where a crest turns edge-on.
  float depth = v0;
  float crest = smoothstep(0.1, 0.75, world0.y / ${f(HEIGHT_AMPLITUDE)} * 0.5 + 0.5);
  float body = smoothstep(1.0, 0.18, depth);

  vec3 color = mix(uColorFar, uColorMid, body);
  color = mix(color, uColorDark, crest * 0.8 * body);
  // A handful of stronger strokes on the leading crest give the wave its edge.
  color = mix(color, uColorAccent, step(iRandom.y, 0.07) * crest * body);
  vColor = color;

  float alpha = uBaseAlpha;
  // Dissolve into the white rather than terminating on a line.
  alpha *= smoothstep(1.0, 0.66, depth);
  // The very nearest strokes are out of focus, so they are also weaker.
  alpha *= mix(0.55, 1.0, smoothstep(0.0, 0.16, depth));
  alpha *= 0.66 + 0.68 * iRandom.x;
  alpha *= subPixelFade;

  vOffsetPx = offsetPx;
  vHalfPx = halfPx;
  vFeatherPx = 1.0 + softPx * 2.0;
  vAlpha = alpha;
}
`;

/**
 * Coverage-based anti-aliasing across the width of the stroke. `vFeatherPx`
 * widens with the depth-of-field term, which both softens the near strokes and
 * lowers their peak opacity — a cheap stand-in for a bokeh pass that costs
 * nothing and cannot bloom the white.
 */
export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying float vOffsetPx;
varying float vHalfPx;
varying float vFeatherPx;
varying vec3 vColor;
varying float vAlpha;

void main() {
  float distancePx = abs(vOffsetPx);
  float coverage = clamp((vHalfPx - distancePx) / vFeatherPx + 0.5, 0.0, 1.0);
  if (coverage <= 0.0) {
    discard;
  }
  gl_FragColor = vec4(vColor, vAlpha * coverage);
}
`;
