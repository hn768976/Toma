/**
 * All three materials are hand-written emissive shaders — there is no lighting
 * model anywhere in this scene. Everything glows on its own and clips to white
 * when it is hot enough.
 *
 * Two conventions run through all of them:
 *
 * - `uBandNear` / `uBandFar` / `uBandFade` clip each fragment to the depth band
 *   its layer represents, with a smooth cross-fade at the seams. That is what
 *   turns four flat layers into a continuous depth-of-field ramp.
 * - Sizes that must look identical at 1080p and 4K are given in *composition*
 *   pixels and scaled by `uPxPerCompPx` inside the shader.
 */

/**
 * Shared: this layer's depth window and the atmospheric falloff.
 *
 * Both are functions of the fragment's *radial* distance from the camera —
 * `length(mv.xyz)`, not `-mv.z`. That matters: `field.ts` decides which band
 * a bar belongs to by radial distance, and at the corners of a 34-degree frame
 * the two measures differ by over 10%. Testing one against the other leaves
 * bars near a band boundary excluded from the layer that should have drawn
 * them, showing up as dimmed columns at the edges of frame.
 */
const BAND_GLSL = /* glsl */ `
uniform float uBandNear;
uniform float uBandFar;
uniform float uBandFade;

uniform float uFadeStart;
uniform float uFadeEnd;

/**
 * Atmospheric falloff. The grid has to dissolve into the void rather than end
 * on a line, otherwise the plane's real far edge shows up as a cut across the
 * top of frame.
 */
float distanceFade(float depth) {
  return 1.0 - smoothstep(uFadeStart, uFadeEnd, depth);
}

float bandWeight(float depth) {
  float w = smoothstep(uBandNear - uBandFade, uBandNear + uBandFade, depth);
  w *= 1.0 - smoothstep(uBandFar - uBandFade, uBandFar + uBandFade, depth);
  return w;
}
`;

export const BAR_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aHot;

varying vec3 vColor;
varying float vHot;
varying float vY;
varying float vDepth;

void main() {
  vColor = aColor;
  vHot = aHot;
  // The box geometry is pre-translated so local y runs 0 (base) to 1 (tip).
  vY = position.y;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vDepth = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const BAR_FRAG = /* glsl */ `
${BAND_GLSL}

uniform float uExposure;
/** 1 in the bloom pass, where only the glowing top of each bar contributes. */
uniform float uTipOnly;

varying vec3 vColor;
varying float vHot;
varying float vY;
varying float vDepth;

void main() {
  float w = bandWeight(vDepth);
  if (w < 0.004) discard;

  // Vertical gradient: dark at the base, full colour toward the tip. Kept
  // shallow — the reference bars carry real colour down most of their length
  // and only fall away close to the plane.
  float g = pow(clamp(vY, 0.0, 1.0), 1.05);
  vec3 c = vColor * (0.22 + 0.78 * g);

  // Bright cap. Hot bars push past 1.0 and clip to white, which is the point.
  // Keep the cap tight. Most of the white in the reference comes from the dot
  // sitting on the bar, not from the shaft — let the shaft hold its colour.
  float cap = smoothstep(0.9, 1.0, vY);
  c += mix(vColor, vec3(1.0), 0.45) * cap * (0.85 + vHot * 3.0);

  float fade = distanceFade(vDepth);
  if (fade < 0.002) discard;

  c *= mix(1.0, smoothstep(0.42, 1.0, vY), uTipOnly);

  gl_FragColor = vec4(c * uExposure * fade, 1.0);
  #include <colorspace_fragment>
  // Premultiplied output so the layer composites correctly over the ones below.
  gl_FragColor = vec4(gl_FragColor.rgb * w, w);
}
`;

export const DOT_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;

uniform float uWorldPerCompPx;
uniform float uMinPx;
uniform float uSizeScale;

varying vec3 vColor;
varying vec2 vLocal;
varying float vDepth;

void main() {
  vColor = aColor;
  vLocal = position.xy * 2.0;

  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float axisDepth = -mv.z;
  vDepth = length(mv.xyz);

  // World size, with a floor of uMinPx composition pixels so distant dots stay
  // resolvable instead of dissolving into sub-pixel shimmer. This one is keyed
  // to axis depth, because that is what the perspective divide uses.
  float floorSize = uMinPx * uWorldPerCompPx * axisDepth;
  float s = max(aSize * uSizeScale, floorSize);

  // Billboard: offset in view space, so the quad always faces the camera.
  mv.xy += position.xy * s * 2.0;
  gl_Position = projectionMatrix * mv;
}
`;

export const DOT_FRAG = /* glsl */ `
${BAND_GLSL}

uniform float uExposure;

varying vec3 vColor;
varying vec2 vLocal;
varying float vDepth;

void main() {
  float w = bandWeight(vDepth);
  if (w < 0.004) discard;

  float r = length(vLocal);
  if (r > 1.0) discard;

  float core = 1.0 - smoothstep(0.0, 0.46, r);
  float halo = 1.0 - smoothstep(0.0, 1.0, r);

  vec3 c = mix(vColor, vec3(1.0), 0.65) * core * 1.9 +
           vColor * halo * halo * 0.7;

  float fade = distanceFade(vDepth);
  if (fade < 0.002) discard;

  gl_FragColor = vec4(c * uExposure * fade, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * w, w);
}
`;

export const GRID_VERT = /* glsl */ `
varying vec2 vGrid;
varying float vDepth;

void main() {
  // The plane is authored in XY and rotated onto XZ, so local (x, y) maps to
  // world (x, -z). Undo that here so the lattice lines up with the bar bases.
  vGrid = vec2(position.x, -position.y);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const GRID_FRAG = /* glsl */ `
${BAND_GLSL}

uniform vec3 uFine;
uniform vec3 uBold;
uniform vec3 uBed;
uniform float uCell;
uniform float uBoldEvery;
uniform float uFineOpacity;
uniform float uBoldOpacity;
uniform float uBedOpacity;
uniform float uFineWidthPx;
uniform float uBoldWidthPx;
uniform float uPxPerCompPx;

varying vec2 vGrid;
varying float vDepth;

// Coverage of a lattice of unit-spaced lines through g, drawn widthPx
// device pixels wide. Screen-space derivatives keep the width constant no
// matter how steeply the plane recedes, which is what stops the far field
// from turning into moire.
float lattice(vec2 g, float widthPx) {
  vec2 d = abs(fract(g + 0.5) - 0.5) / max(fwidth(g), vec2(1e-6));
  float m = min(d.x, d.y);
  float half_ = widthPx * 0.5;
  return 1.0 - smoothstep(half_ - 0.5, half_ + 0.5, m);
}

void main() {
  float w = bandWeight(vDepth);
  if (w < 0.004) discard;

  // Brighter near the camera, gone before the far edge — that falloff is what
  // lets the plane dissolve into the void instead of ending on a hard line.
  float fade = distanceFade(vDepth);
  fade *= fade;
  if (fade < 0.002) discard;

  float fine = lattice(vGrid / uCell, uFineWidthPx * uPxPerCompPx);
  float bold = lattice(vGrid / (uCell * uBoldEvery), uBoldWidthPx * uPxPerCompPx);

  vec3 c = uFine * (fine * uFineOpacity) + uBold * (bold * uBoldOpacity);
  float a = max(fine * uFineOpacity, bold * uBoldOpacity);

  // Faint haze lying on the plane, so the void reads as depth rather than a cut.
  c += uBed * uBedOpacity;
  a = max(a, uBedOpacity * 0.85);

  a *= fade * w;
  c *= fade;

  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a);
}
`;
