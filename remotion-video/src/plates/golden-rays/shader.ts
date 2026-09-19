import { PLATE_FRAG_HEADER } from "../shared/glsl/lib";

/**
 * GoldenRays - late sun through foliage.
 *
 * Reference read: a blown-out warm core in the upper right, crepuscular
 * shafts raking down to the lower left, dark olive foliage bands behind,
 * and soft amber bokeh where gaps between leaves defocus into discs. The
 * grade is hazy and low-contrast with strongly lifted blacks - veiling
 * glare from shooting into the sun.
 *
 * Shafts are built as noise in the ANGLE around the sun and held constant
 * along the radius, which is what makes them converge on the source the
 * way real crepuscular rays do. Animating them by rotating the angular
 * field would break the loop, so the field oscillates instead.
 */
export const GOLDEN_RAYS_FRAG =
  PLATE_FRAG_HEADER +
  /* glsl */ `
uniform vec3  uFoliageDark;
uniform vec3  uFoliageLit;
uniform vec3  uSunCore;
uniform vec3  uGold;
uniform vec2  uSunPos;
uniform float uSunSize;
uniform float uRayStrength;
uniform float uRayDetail;
uniform float uBokehGain;
uniform float uHaze;         // veiling glare lifted across the frame

/** Warm defocus discs in the gaps between leaves. */
vec3 bokehLayer(
  vec2 px,
  float cellPx,
  float radiusPx,
  float soft,
  float rim,
  float seed,
  float gain,
  float lightMask
) {
  vec3 acc = vec3(0.0);
  vec2 cellSize = vec2(cellPx, cellPx);
  vec2 baseCell = floor(px / cellSize);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = baseCell + vec2(float(i), float(j));
      vec4 r = cellRandom(cell, seed);
      if (r.w > 0.62) continue;

      vec2 centre = (cell + vec2(0.15 + r.x * 0.7, 0.15 + r.y * 0.7)) * cellSize;

      float phase = r.x * TAU;
      float cycles = 1.0 + floor(r.z * 2.0);
      centre += vec2(
        cos(TAU * cycles * uT + phase),
        sin(TAU * cycles * uT + phase * 1.44)
      ) * cellPx * 0.09;

      float radius = radiusPx * (0.55 + r.z * 0.95);
      float d = length(px - centre) / radius;
      float shape = bokehProfile(d, soft, rim);
      if (shape <= 0.0) continue;

      // Leaves move in the wind, so gaps open and close: discs breathe in
      // and out rather than holding a constant brightness.
      float k = 1.0 + floor(r.w * 3.0);
      float tw = 0.62 + 0.38 * cos(TAU * k * uT + r.y * TAU);

      // Hotter discs nearer the sun, cooling towards the shadow side.
      vec3 tint = mix(uGold, uSunCore, clamp(lightMask * 1.3, 0.0, 1.0) * r.z);
      acc += tint * shape * (0.4 + r.z * 0.8) * tw * gain * mix(0.16, 1.0, lightMask);
    }
  }
  return acc;
}

void main() {
  vec2 uv = vTextureCoord;
  vec2 px = uv * uResolution;
  float s = uScale;
  float aspect = uResolution.x / uResolution.y;

  vec2 sd = (uv - uSunPos) * vec2(aspect, 1.0);
  float sunDist = length(sd);
  float ang = atan(sd.y, sd.x);

  // Overall falloff from the sun, used to drive almost everything else.
  float lightMask = clamp(exp(-sunDist * 1.55), 0.0, 1.0);

  // ---- foliage ----------------------------------------------------------
  // Diagonal bands: the out-of-focus fronds. Coordinates are rotated and
  // squashed so the noise stretches along one axis into band shapes.
  const mat2 lean = mat2(0.80, -0.60, 0.60, 0.80);
  vec2 fp = lean * uv * vec2(2.2 * aspect, 5.4);
  float bands = loopFbm(fp, vec2(0.30, -0.16), uT);
  float bands2 = loopFbm(fp * 2.1 + 11.3, vec2(-0.22, 0.12), uT);
  float foliage = clamp(bands * 0.7 + bands2 * 0.42, 0.0, 1.0);

  // Push the bands apart before mixing. The first pass let the two
  // foliage tones sit too close together, and the warm passes on top
  // then flattened the whole frame into one sheet of gold - the dark
  // green mass that anchors the reference disappeared entirely.
  foliage = smoothstep(0.30, 0.70, foliage);
  // A second, tighter band set over the top. The reference reads as
  // overlapping fronds, not one smooth gradient, and that only comes
  // through with more than one spatial frequency of shadow.
  float fronds = smoothstep(0.42, 0.58, loopFbm(fp * 0.55 - 7.7, vec2(0.18, -0.09), uT));
  foliage = clamp(foliage * (0.62 + 0.55 * fronds), 0.0, 1.0);
  vec3 col = mix(uFoliageDark, uFoliageLit, foliage);
  // Foliage lifts only close to the sun, and even there it keeps some
  // of its own colour rather than washing to gold.
  col = mix(col, uFoliageLit, lightMask * 0.30);

  // ---- crepuscular shafts ------------------------------------------------
  // Noise in angle, near-constant in radius, so every shaft points back
  // at the sun. The angular field rocks on one cycle per loop instead of
  // rotating, which keeps the loop seamless.
  float angWobble = ang + cos(TAU * uT) * 0.045;
  float rays =
      fbm3(vec2(angWobble * uRayDetail, sunDist * 0.9)) * 0.72
    + fbm3(vec2(angWobble * uRayDetail * 2.7 + 5.1, sunDist * 0.5)) * 0.34;
  rays = pow(clamp(rays, 0.0, 1.0), 2.3);
  // Shafts are strongest just outside the core and fade with distance.
  float rayFalloff = smoothstep(0.03, 0.26, sunDist) * exp(-sunDist * 2.05);
  float rayPulse = 0.85 + 0.15 * cos(TAU * 2.0 * uT);
  col += uGold * rays * rayFalloff * uRayStrength * rayPulse;

  // ---- sun core ----------------------------------------------------------
  // Three nested lobes: a clipped core, the bloom around it, and a wide
  // veil that washes the whole upper right.
  float core = exp(-pow(sunDist / uSunSize, 2.0) * 2.4);
  float bloom = exp(-sunDist / (uSunSize * 2.6));
  float veil = exp(-sunDist * 0.85);
  float breathe = 0.93 + 0.07 * cos(TAU * uT);
  col += uSunCore * (core * 0.95 + bloom * 0.62) * breathe;
  col += uGold * veil * 0.13 * breathe * lightMask;

  // ---- bokeh -------------------------------------------------------------
  col += bokehLayer(px, 150.0 * s, 56.0 * s, 0.34, 0.26, 7.7, uBokehGain, lightMask);
  col += bokehLayer(px, 290.0 * s, 112.0 * s, 0.52, 0.16, 15.9, uBokehGain * 0.72, lightMask);

  // ---- lens + grade ------------------------------------------------------
  // Veiling glare: shooting into the sun lifts the whole frame and kills
  // shadow contrast. This is most of what makes the reference read as
  // "backlit" rather than "bright".
  col += uGold * uHaze * (0.06 + 0.94 * lightMask);

  float radial = length(uv - 0.5) * 2.0;
  col = fringe(col, 0.026, radial);
  col *= 1.0 - vignette(uv, 0.92, 0.85) * 0.22;

  col *= uExposure;
  col = tonemap(col, 0.42);
  col = saturate3(col, 1.10);
  col = liftGammaGain(col, vec3(0.055, 0.055, 0.052), 0.96, vec3(1.01, 1.0, 0.98));

  col += grain(px, uT, uLoopFrames) * uGrainAmount;

  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
