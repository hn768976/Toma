import { SIMPLEX_4D } from "./noise";
import { SURFACE } from "./surface";

/**
 * Every line is a screen-space ribbon: two vertices per sample, pushed apart
 * along the screen-space perpendicular of the line's tangent. WebGL cannot draw
 * lines wider than 1px, and a 1px line at a grazing angle drops below a pixel
 * and shimmers, so the ribbon exists to give the shader control of the width in
 * device pixels — and therefore of the antialiasing:
 *
 *   1. the ribbon never gets narrower than uMinPx, and the alpha pays for the
 *      extra width so the line keeps depositing the same amount of ink;
 *   2. where neighbouring lines converge below uSafePx apart on screen the
 *      ribbon is widened further, until each one overlaps several neighbours
 *      and the picket fence becomes continuous coverage;
 *   3. the fragment shader divides the profile by its own pixel footprint, so
 *      what reaches a pixel centre is the true covered fraction rather than a
 *      point sample of it.
 *
 * `position` carries (u, v, side) rather than a real position — the actual
 * vertex is evaluated analytically here.
 */
export const LINE_VERTEX = /* glsl */ `
${SIMPLEX_4D}
${SURFACE}

uniform vec2  uHalfRes;      // half the drawing buffer size, device px
uniform float uPixelScale;   // device px per composition px
uniform float uDeltaU;       // finite-difference step along a line
uniform float uDeltaV;       // finite-difference step across lines (== line pitch)

uniform float uWidthPx;      // ribbon width in composition px at the reference distance
uniform float uMinPx;        // antialiasing floor, DEVICE px (not composition px)
uniform float uRefDist;      // distance at which uWidthPx is exact
uniform float uWidthBoost;   // >1 for the glow pass
uniform float uAlphaScale;

uniform float uFocusDist;    // DOF: everything at this distance is sharp
uniform float uNearDist;     // DOF: distance of the nearest lines
uniform float uNearBlurPx;   // DOF: max near-field softening, composition px

uniform vec3  uLightDir;
uniform float uAmbient;
uniform float uDiffuse;
uniform float uDiffusePow;
uniform float uSpecAmount;
uniform float uSpecPow;
uniform float uRimAmount;
uniform float uRimPow;
uniform float uTroughDarken;
uniform float uSafePx;     // device px: line pitch that resolves without merging
uniform float uMergeK;     // overlap factor applied below uSafePx

uniform float uFadeStart;    // depth fade
uniform float uFadeEnd;

varying float vSide;         // -1 .. 1 across the ribbon
varying float vSoft;         // 0 = crisp, 1 = fully defocused
varying float vBright;       // diffuse term, drives the colour ramp
varying float vSpec;         // narrow crest filaments
varying float vRim;
varying float vAlpha;
varying float vFade;

void main() {
  vec2 uv = position.xy;
  float side = position.z;

  vec3 P  = surfacePos(uv);
  vec3 Pu = surfacePos(uv + vec2(uDeltaU, 0.0));   // next sample along this line
  vec3 Pv = surfacePos(uv + vec2(0.0, uDeltaV));   // same sample on the next line

  // Normal from the two analytic tangents of the displaced surface. Both are
  // needed anyway (one for the ribbon direction, one for the line pitch), so
  // the normal is free and exact to the sampling of the mesh.
  vec3 N = normalize(cross(Pv - P, Pu - P));

  vec4 cP  = projectionMatrix * modelViewMatrix * vec4(P,  1.0);
  vec4 cPu = projectionMatrix * modelViewMatrix * vec4(Pu, 1.0);
  vec4 cPv = projectionMatrix * modelViewMatrix * vec4(Pv, 1.0);

  vec2 sP  = cP.xy  / max(cP.w,  1e-4) * uHalfRes;
  vec2 sPu = cPu.xy / max(cPu.w, 1e-4) * uHalfRes;
  vec2 sPv = cPv.xy / max(cPv.w, 1e-4) * uHalfRes;

  vec2 tangent = sPu - sP;
  float tLen = length(tangent);
  vec2 dir = tLen > 1e-5 ? tangent / tLen : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float spacingPx = length(sPv - sP);

  float viewDist = -(modelViewMatrix * vec4(P, 1.0)).z;

  // Width: a constant world thickness thins with distance, clamped so it can
  // never fall below a pixel.
  float basePx = uWidthPx * uPixelScale * uWidthBoost;
  float wantPx = basePx * clamp(uRefDist / max(viewDist, 1e-3), 0.45, 1.7);

  // Light DOF — near lines soften and dim, mid stays sharp, far dissolves via
  // the depth fade below.
  float nearT = clamp((uFocusDist - viewDist) / max(uFocusDist - uNearDist, 1e-3), 0.0, 1.0);
  float blurPx = uNearBlurPx * uPixelScale * uWidthBoost * nearT * nearT;

  // The floor is in device pixels on purpose: it is an antialiasing limit of
  // the framebuffer, not a design width. Scaling it with the render scale is
  // what lets ribbons fall under a pixel and shimmer.
  float drawPx = max(wantPx + blurPx, uMinPx * uWidthBoost);

  // Where the surface turns away, neighbouring lines converge onto the same
  // pixels and beat against the grid. Dimming them is not enough — the beat
  // survives at lower contrast. The fix is to widen the ribbon until each one
  // overlaps several of its neighbours, so the picket fence becomes continuous
  // coverage, and to pay for the extra width in alpha below.
  //
  // uSafePx is the on-screen line pitch above which lines resolve on their own;
  // below it they are merged at uMergeK times overlap. The taper between the
  // two is what makes the cloth read as fine lines up close and as a smooth
  // shaded surface where it recedes — and it scales with the render
  // resolution, so a 4K master keeps its line texture much further back.
  float dense = 1.0 - smoothstep(uSafePx, uSafePx * 2.0, spacingPx);
  float mergePx = min(spacingPx, uSafePx) * uMergeK;
  drawPx = max(drawPx, mergePx * dense);

  vSoft = clamp(blurPx / max(drawPx, 1e-4), 0.0, 1.0);

  // Energy conservation. A line deposits the same amount of ink however wide
  // it was drawn, so spreading it over drawPx costs exactly wantPx/drawPx in
  // alpha. The density then takes care of itself: drawPx/spacingPx ribbons
  // overlap a given pixel, so the wash settles at wantPx/spacingPx — the true
  // fraction of the pixel the lines cover — no matter how far the ribbon was
  // widened. Scaling by the spacing here as well would double-count it, which
  // both darkens the cloth and defeats the merge above.
  float alpha = min(wantPx / drawPx, 1.0);

  vec2 offsetPx = perp * side * (drawPx * 0.5);
  gl_Position = cP + vec4(offsetPx / uHalfRes * max(cP.w, 1e-4), 0.0, 0.0);

  // ---- shading -----------------------------------------------------------
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(cameraPosition - P);
  vec3 H = normalize(L + V);

  // Height above the mean plane. The base points all lie in the plane through
  // the origin whose normal is uPlaneN, so this is just the displacement.
  float hNorm = dot(P, uPlaneN) / max(uAmp, 1e-3);
  // Cheap occlusion: troughs between folds sit in their own shadow.
  float occ = mix(uTroughDarken, 1.0, smoothstep(-1.0, 0.55, hNorm));

  float ndl = dot(N, L);
  vBright = (uAmbient + uDiffuse * pow(clamp(ndl, 0.0, 1.0), uDiffusePow)) * occ;
  vSpec = uSpecAmount * pow(clamp(dot(N, H), 0.0, 1.0), uSpecPow) * occ;

  // Rim: the surface turning steeply away from the plane normal is what draws
  // the bright filament along the edge of a fold.
  float steep = clamp(1.0 - abs(dot(N, uPlaneN)), 0.0, 1.0);
  vRim = uRimAmount * pow(steep, uRimPow) * clamp(ndl * 0.5 + 0.5, 0.0, 1.0) * occ;

  vFade = 1.0 - smoothstep(uFadeStart, uFadeEnd, viewDist);
  vAlpha = clamp(alpha, 0.0, 1.0) * uAlphaScale * vFade;
  vSide = side;
}
`;

export const LINE_FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3 uShadow;
uniform vec3 uMid;
uniform vec3 uHot;
uniform vec3 uSpecColor;
uniform vec3 uBackground;
uniform float uGlowPass;
uniform float uGlowThreshold;

varying float vSide;
varying float vSoft;
varying float vBright;
varying float vSpec;
varying float vRim;
varying float vAlpha;
varying float vFade;

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? mix(uShadow, uMid, t * 2.0) : mix(uMid, uHot, (t - 0.5) * 2.0);
}

void main() {
  // Analytic coverage. A fixed smoothstep profile is sampled once per pixel
  // centre, so a ribbon around a pixel wide lands on one centre or two
  // depending on where it falls — that beat, not the line density, is the
  // dominant source of moire. Dividing by the pixel footprint of vSide turns
  // this into the true covered fraction of the pixel, which is continuous in
  // the ribbon's subpixel position and therefore beat-free.
  float footprint = max(fwidth(vSide), 1e-5);
  float cover = clamp((1.0 - abs(vSide)) / footprint, 0.0, 1.0);
  // Defocused ribbons additionally lose their flat core.
  cover *= mix(1.0, smoothstep(1.0, 0.0, abs(vSide)), vSoft);
  if (cover <= 0.001) discard;

  vec3 col = ramp(vBright) + uSpecColor * vSpec + uHot * vRim;
  float alpha = vAlpha * cover;

  if (uGlowPass > 0.5) {
    // Bloom only on the crest filaments: gate on how hot this fragment is.
    float hot = smoothstep(uGlowThreshold, 1.0, vBright + vSpec + vRim * 0.6);
    if (hot <= 0.001) discard;
    gl_FragColor = vec4(col * hot, alpha * hot);
    return;
  }

  // Dissolve into the background rather than just going transparent, so the far
  // field loses contrast as well as opacity.
  col = mix(uBackground, col, mix(0.35, 1.0, vFade));
  gl_FragColor = vec4(col, alpha);
}
`;
