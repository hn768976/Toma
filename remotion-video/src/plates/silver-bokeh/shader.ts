import { PLATE_FRAG_HEADER } from "../shared/glsl/lib";

/**
 * SilverBokeh - high-key silver bokeh.
 *
 * Reference read: an almost-white field (mean luminance sits around 225)
 * carrying dense, heavily overlapped white discs with only a few percent
 * of contrast between them and the background. Measured motion is the
 * second gentlest of the four (MAD 0.30) with no translation.
 *
 * The difficulty here is the opposite of the dark plates: with everything
 * bunched into the top of the range there is almost no room to work, and
 * any disc that is a shade too bright clips to flat white and kills the
 * overlap. Discs are therefore composited as a SUBTRACTIVE darkening of
 * the field plus a small additive core, so their edges stay readable
 * against the white without pushing anything to 255.
 */
export const SILVER_BOKEH_FRAG =
  PLATE_FRAG_HEADER +
  /* glsl */ `
uniform vec3  uFieldTop;
uniform vec3  uFieldBottom;
uniform vec3  uDiscTint;
uniform vec3  uShadeTint;    // the cool grey discs are separated against
uniform float uDiscGain;
uniform float uShade;        // how far a disc edge darkens the field
uniform float uHotspot;
uniform vec2  uHotspotPos;

/**
 * A layer of soft white discs.
 *
 * Returns a signed contribution: positive at the disc centre, slightly
 * negative around its edge. That edge darkening is what gives a white-on-
 * white bokeh its shape.
 */
vec3 softLayer(
  vec2 px,
  float cellPx,
  float radiusPx,
  float soft,
  float rim,
  float seed,
  float gain
) {
  vec3 acc = vec3(0.0);
  vec2 cellSize = vec2(cellPx, cellPx);
  vec2 baseCell = floor(px / cellSize);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = baseCell + vec2(float(i), float(j));
      vec4 r = cellRandom(cell, seed);
      if (r.w > 0.80) continue;

      vec2 centre = (cell + vec2(0.14 + r.x * 0.72, 0.14 + r.y * 0.72)) * cellSize;

      float phase = r.x * TAU;
      float cycles = 1.0 + floor(r.z * 2.0);
      centre += vec2(
        cos(TAU * cycles * uT + phase),
        sin(TAU * cycles * uT + phase * 1.27)
      ) * cellPx * 0.085;

      float radius = radiusPx * (0.58 + r.z * 0.9);
      float d = length(px - centre) / radius;
      if (d > 1.0) continue;

      float edge = clamp(soft, 0.02, 1.0);
      float body = 1.0 - smoothstep(1.0 - edge, 1.0, d);
      float ringPos = 1.0 - edge * 0.42;
      float ringWidth = max(edge * 0.55, 0.05);
      float ring = exp(-pow((d - ringPos) / ringWidth, 2.0) * 2.6) * body;

      float brightness = 0.35 + r.z * 0.85;
      float pulse = 0.85 + 0.15 * cos(TAU * (1.0 + floor(r.w * 2.0)) * uT + r.y * TAU);

      // Additive core, subtractive shoulder. The shoulder is what keeps
      // overlapping discs distinguishable in a frame with no headroom.
      acc += uDiscTint * (body * 0.30 + ring * rim) * brightness * pulse * gain;
      acc -= uShadeTint * smoothstep(0.45, 1.0, d) * body * uShade * brightness;
    }
  }
  return acc;
}

void main() {
  vec2 uv = vTextureCoord;
  vec2 px = uv * uResolution;
  float s = uScale;
  float aspect = uResolution.x / uResolution.y;

  // ---- field -------------------------------------------------------------
  vec3 col = mix(uFieldTop, uFieldBottom, smoothstep(0.0, 1.0, uv.y));

  // Very soft large-scale cloud, kept to a couple of percent so it reads
  // as unevenness in the light rather than as texture.
  float cloud = loopFbm(uv * vec2(2.4 * aspect, 2.4), vec2(0.22, 0.14), uT);
  col *= 0.965 + 0.055 * cloud;

  // ---- discs, back to front ----------------------------------------------
  col += softLayer(px, 78.0 * s, 33.0 * s, 0.42, 0.22, 4.3, uDiscGain * 0.55);
  col += softLayer(px, 152.0 * s, 68.0 * s, 0.38, 0.26, 9.1, uDiscGain);
  col += softLayer(px, 296.0 * s, 138.0 * s, 0.58, 0.14, 19.7, uDiscGain * 0.78);

  // ---- drifting hotspot --------------------------------------------------
  // The brightest part of the frame wanders on a closed elliptical path.
  vec2 hp = uHotspotPos + vec2(cos(TAU * uT) * 0.09, sin(TAU * uT) * 0.055);
  vec2 hd = (uv - hp) * vec2(aspect, 1.0);
  col += vec3(1.0) * exp(-dot(hd, hd) * 2.1) * uHotspot;

  // ---- lens + grade ------------------------------------------------------
  float radial = length(uv - 0.5) * 2.0;
  col = fringe(col, 0.010, radial);
  // Only a whisper of vignette - the reference stays bright into the
  // corners and a heavy falloff would read as a different shot.
  col *= 1.0 - vignette(uv, 0.80, 0.95) * 0.10;

  col *= uExposure;
  // Gentle shoulder so overlapping discs roll off instead of clipping to
  // a flat white plateau.
  col = tonemap(col, 0.14);
  col = saturate3(col, 0.86);
  col = liftGammaGain(col, vec3(0.0), 0.99, vec3(1.0, 1.0, 1.005));

  col += grain(px, uT, uLoopFrames) * uGrainAmount;

  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
