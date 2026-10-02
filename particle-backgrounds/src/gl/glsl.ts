/**
 * Shared GLSL for particle looks.
 * Sizes are authored in "4K pixels" (2160-line frame) and scaled by uPxScale =
 * drawingBufferHeight / 2160, so 720p previews and 4K renders frame identically.
 * Depth of field: per-sprite circle of confusion; energy-conserving (alpha falls
 * as 1/size^2 as the sprite grows), so out-of-focus items get large and soft.
 */
export const DOF_GLSL = /* glsl */ `
uniform float uPxScale;     // drawing-buffer height / 2160
uniform float uFocus;       // focus distance (world units, view depth)
uniform float uAperture;    // CoC in 4K px at depth -> 0 or infinity
uniform float uMaxCoc;      // clamp (4K px)
uniform float uProj;        // projection scale: 0.5*H_4k / tan(fov/2)
uniform float uBokehPow;    // 1 = energy conserving; <1 keeps big bokeh brighter

// Circle of confusion (4K px) for a view depth d > 0.
float cocAt(float d) {
  return min(uAperture * abs(1.0 - uFocus / max(d, 1e-3)), uMaxCoc);
}

// Returns vec2(pointSizePx, alphaScale) for an in-focus diameter base4k (4K px).
vec2 dofSprite(float base4k, float d) {
  float c = cocAt(d);
  float s = sqrt(base4k * base4k + c * c);
  float a = pow((base4k * base4k) / (s * s), uBokehPow);
  float px = s * uPxScale;
  // Sub-pixel sprites: keep 1.5px wide and lower alpha instead (same energy).
  if (px < 1.5) { a *= (px * px) / 2.25; px = 1.5; }
  return vec2(px, a);
}
`;

/** Fragment helper: soft round sprite. Small = gaussian, large = flat bokeh disc with a faint rim. */
export const SPRITE_FS_GLSL = /* glsl */ `
float spriteMask(vec2 pc, float px) {
  vec2 q = pc * 2.0 - 1.0;
  float r = length(q);
  if (r > 1.0) return 0.0;
  float g = exp(-r * r * 4.0);
  float edge = clamp(1.2 / px, 0.22, 1.0);
  float disc = (1.0 - smoothstep(1.0 - edge, 1.0, r)) * (0.85 + 0.15 * smoothstep(0.4, 1.0, r));
  float t = smoothstep(3.0, 14.0, px);
  // gaussian integrates to ~1/4 of the disc area; normalise so energy matches
  return mix(g * 1.9, disc * 0.8, t);
}
`;
