import { PLATE_FRAG_HEADER } from "../shared/glsl/lib";

/**
 * DeepBlueDust - deep navy particle field.
 *
 * Reference read: near-black frame with a soft blue mass held to the
 * upper right, heavy vignette, and two distinct populations of light -
 * large translucent discs with pronounced bright RIMS (the signature of
 * the shot), and a dense scatter of tiny hard dust points that twinkle.
 * Measured motion is the gentlest of the four (MAD 0.28) with no net
 * translation, so everything drifts on small closed paths.
 *
 * The rim is what sells it. These discs are mostly hollow: the interior
 * sits barely above the background and the energy collects at the
 * aperture edge, so they read as rings floating in front of the nebula
 * rather than as blobs of paint on it.
 */
export const DEEP_BLUE_DUST_FRAG =
  PLATE_FRAG_HEADER +
  /* glsl */ `
uniform vec3  uDeep;         // darkest corner
uniform vec3  uNebula;       // the blue mass
uniform vec3  uDiscCool;     // majority disc tint
uniform vec3  uDiscTeal;     // minority teal-green disc tint
uniform vec3  uDustColor;
uniform vec2  uLightCentre;  // where the blue mass sits, in uv
uniform float uNebulaGain;
uniform float uDiscGain;
uniform float uHollow;       // 0 = solid disc, 1 = pure ring
uniform float uDustGain;
uniform float uDustTwinkle;
uniform float uVignetteAmount;

/**
 * A layer of ringed defocus discs.
 *
 * Interior brightness is scaled down by uHollow while the rim is left at
 * full strength, which is how a mirror-lens or heavily-stopped aperture
 * actually renders an out-of-focus point.
 */
vec3 discLayer(
  vec2 px,
  float cellPx,
  float radiusPx,
  float soft,
  float rim,
  float seed,
  float gain,
  float massMask
) {
  vec3 acc = vec3(0.0);
  vec2 cellSize = vec2(cellPx, cellPx);
  vec2 baseCell = floor(px / cellSize);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = baseCell + vec2(float(i), float(j));
      vec4 r = cellRandom(cell, seed);

      // Sparse: the reference is mostly empty frame.
      if (r.w > 0.55) continue;

      vec2 centre = (cell + vec2(0.16 + r.x * 0.68, 0.16 + r.y * 0.68)) * cellSize;

      // Small closed-path drift. One or two cycles per loop, so the disc
      // returns exactly to its start.
      float phase = r.x * TAU;
      float cycles = 1.0 + floor(r.z * 2.0);
      centre += vec2(
        cos(TAU * cycles * uT + phase),
        sin(TAU * cycles * uT + phase * 1.31)
      ) * cellPx * 0.075;

      float radius = radiusPx * (0.34 + r.z * r.z * 1.5);
      float d = length(px - centre) / radius;
      if (d > 1.0) continue;

      // Split the profile so the interior can be hollowed out without
      // touching the rim.
      float edge = clamp(soft, 0.02, 1.0);
      float body = 1.0 - smoothstep(1.0 - edge, 1.0, d);
      float ringPos = 1.0 - edge * 0.42;
      float ringWidth = max(edge * 0.55, 0.05);
      float ring = exp(-pow((d - ringPos) / ringWidth, 2.0) * 2.6) * body;
      float shape = body * (1.0 - uHollow * (0.55 + r.y * 0.35)) + ring * rim;

      // A minority of the discs pick up a teal-green cast, as in the
      // reference where a few highlights sit off the dominant blue.
      float tealPick = step(0.82, hash11(cell.x * 2.7 + cell.y * 5.3 + seed));
      vec3 tint = mix(uDiscCool, uDiscTeal, tealPick);

      // Brightness follows the nebula: discs away from the mass fall off
      // into the dark side of the frame rather than floating on black.
      float local = mix(0.10, 1.0, massMask);
      acc += tint * shape * (0.18 + r.z * r.z * 1.0) * gain * local;
    }
  }
  return acc;
}

/** Fine sparkling dust - single-pixel-ish points on a tight grid. */
vec3 dustLayer(vec2 px, float cellPx, float seed, float massMask) {
  vec3 acc = vec3(0.0);
  vec2 cellSize = vec2(cellPx, cellPx);
  vec2 baseCell = floor(px / cellSize);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = baseCell + vec2(float(i), float(j));
      vec4 r = cellRandom(cell, seed);
      if (r.w > 0.34) continue;

      vec2 centre = (cell + vec2(0.1 + r.x * 0.8, 0.1 + r.y * 0.8)) * cellSize;
      float phase = r.y * TAU;
      centre += vec2(cos(TAU * uT + phase), sin(TAU * uT + phase * 1.7)) * cellPx * 0.14;

      float radius = uScale * (0.9 + r.z * 1.7);
      float d = length(px - centre) / radius;
      float point = exp(-d * d * 2.2);

      // Twinkle hard - dust is the only fast-moving element in a plate
      // that is otherwise almost still.
      float k = 3.0 + floor(r.z * 5.0);
      float tw = 0.45 + 0.55 * pow(max(0.0, 0.5 + 0.5 * cos(TAU * k * uT + r.x * TAU)), 1.8);

      acc += uDustColor * point * tw * uDustTwinkle * (0.35 + r.z * 0.9) * mix(0.15, 1.0, massMask);
    }
  }
  return acc;
}

void main() {
  vec2 uv = vTextureCoord;
  vec2 px = uv * uResolution;
  float s = uScale;
  float aspect = uResolution.x / uResolution.y;

  // ---- the blue mass -----------------------------------------------------
  // A soft lobe centred off to the upper right, textured with looping
  // fbm so it breathes like drifting haze instead of sitting as a
  // static radial gradient.
  vec2 md = (uv - uLightCentre) * vec2(aspect, 1.0);
  float falloff = exp(-dot(md, md) * 3.4);
  float haze = loopFbm4(uv * vec2(3.4 * aspect, 3.4), vec2(0.35, -0.22), uT);
  float massMask = clamp(falloff * (0.55 + 0.9 * haze), 0.0, 1.0);

  vec3 col = uDeep;
  col += uNebula * massMask * uNebulaGain;
  // A second, broader and dimmer lobe stops the mass ending too abruptly.
  col += uNebula * exp(-dot(md, md) * 1.15) * uNebulaGain * 0.16;

  // ---- discs and dust ----------------------------------------------------
  col += discLayer(px, 168.0 * s, 62.0 * s, 0.30, 0.95, 5.3, uDiscGain, massMask);
  col += discLayer(px, 320.0 * s, 132.0 * s, 0.44, 0.75, 12.1, uDiscGain * 0.7, massMask);
  col += dustLayer(px, 34.0 * s, 21.7, massMask);

  // ---- lens + grade ------------------------------------------------------
  float radial = length(uv - 0.5) * 2.0;
  col = fringe(col, 0.022, radial);
  col *= 1.0 - vignette(uv, 0.52, 0.85) * uVignetteAmount;

  col *= uExposure;
  col = tonemap(col, 0.22);
  col = saturate3(col, 1.12);
  // Blacks stay crushed but not dead - the reference keeps a trace of
  // blue in the darkest corner rather than going to pure zero.
  col = liftGammaGain(col, vec3(0.0, 0.004, 0.012), 1.02, vec3(0.98, 1.0, 1.04));

  col += grain(px, uT, uLoopFrames) * uGrainAmount;

  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
