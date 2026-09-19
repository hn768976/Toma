import { PLATE_FRAG_HEADER } from "../shared/glsl/lib";

/**
 * BokehCurtain - defocused string-light curtain.
 *
 * Reference read: vertical strands of out-of-focus point lights. Amber
 * strands and steel blue-white strands interleave over a teal field, warm
 * massed low and left. Measured frame-to-frame difference is the highest
 * of the four plates (MAD 5.3) with zero net translation, so the energy
 * is all twinkle and sway rather than drift.
 *
 * The structure that matters is the STRAND. Discs are stacked at a
 * vertical pitch slightly tighter than their own diameter so they merge
 * into continuous chains, while columns sit far enough apart to leave
 * background between them. Colour and size are assigned per column, not
 * per disc: a whole strand is warm or cool, near or far, which is what
 * separates this from an even field of dots.
 */
export const BOKEH_CURTAIN_FRAG =
  PLATE_FRAG_HEADER +
  /* glsl */ `
uniform vec3  uBackTop;
uniform vec3  uBackBottom;
uniform vec3  uWarm;
uniform vec3  uCool;
uniform float uWarmBias;     // share of strands that run amber
uniform float uSway;         // sway amplitude, fraction of a cell
uniform float uTwinkle;      // depth of the per-disc brightness pulse
uniform float uDensity;      // fraction of cells along a strand that light
uniform float uHotspot;      // strength of the blown-out corner
uniform float uSpill;        // warm haze bled into the field by the amber strands

/**
 * One depth layer of strand lights.
 *
 * Only the 3x3 cells around the pixel are inspected. Disc radius is held
 * below the cell pitch in both axes, so no light outside that
 * neighbourhood can reach this pixel and the cost per pixel is fixed no
 * matter how many lights the layer notionally holds.
 */
vec3 strandLayer(
  vec2 px,
  vec2 cellSize,
  float radiusPx,
  float soft,
  float rim,
  float seed,
  float warmLift,
  float gain
) {
  vec3 acc = vec3(0.0);
  vec2 baseCell = floor(px / cellSize);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = baseCell + vec2(float(i), float(j));

      // ---- per-column (strand) properties ----
      float colId = cell.x;
      float colRand = hash11(colId * 3.719 + seed * 11.3);
      float colRand2 = hash11(colId * 7.331 + seed * 5.17);
      float colRand3 = hash11(colId * 1.937 + seed * 23.9);
      // Warmth gets its own hash: keyed to colRand2 it would correlate
      // with strand size and the amber population would collapse onto the
      // few large strands.
      float colWarm = hash11(colId * 5.221 + seed * 17.6);
      // Per-strand output, so some chains blow out and others sit back.
      float colGain = 0.72 + hash11(colId * 9.117 + seed * 3.4) * 0.72;

      // Strands are offset horizontally as a whole, so the chain stays
      // vertical instead of zig-zagging cell to cell. Kept narrow so
      // neighbouring strands do not drift apart and open gaps.
      float colJitter = (colRand - 0.5) * 0.42;
      // Depth: a whole strand is nearer or further, so its discs share a
      // size. Mixing sizes within one strand destroys the chain read.
      float colSize = 0.86 + colRand2 * 0.42;
      // Sparse strands leave the teal field visible between them.
      float colAlive = step(0.03, colRand3);

      if (colAlive < 0.5) continue;

      // ---- per-disc properties ----
      vec4 r = cellRandom(cell, seed);
      if (r.w > uDensity) continue;

      vec2 centre = (cell + vec2(0.5 + colJitter, 0.5 + (r.y - 0.5) * 0.34)) * cellSize;

      // Sway on a closed path - integer cycle counts put every disc back
      // exactly where it started at the end of the loop. The whole strand
      // shares a phase so it swings as one hanging string.
      float phase = colRand * TAU;
      float cycles = 1.0 + floor(colRand2 * 2.0);
      centre.x += cos(TAU * cycles * uT + phase) * cellSize.x * uSway;
      centre.y += sin(TAU * cycles * uT + phase * 1.63) * cellSize.y * uSway * 0.4;

      float radius = radiusPx * colSize * (0.92 + r.z * 0.16);
      float d = length(px - centre) / radius;
      float shape = bokehProfile(d, soft, rim);
      if (shape <= 0.0) continue;

      // Blink. Each light gets its own rate between roughly half a hertz
      // and two and a half, and its own phase, so the curtain reads as
      // hundreds of independently flickering bulbs rather than one field
      // swelling in unison.
      float hzA = mix(0.55, 2.5, r.y);
      float tw = shimmer(uT, uLoopSeconds, r.x * TAU, hzA, hzA * 1.87 + 0.31,
                         uTwinkle * uShimmer, 2.7);

      // Warmth is a property of the strand. A vertical bias pushes amber
      // low and steel blue high, matching the reference's distribution.
      // Amber massed low and to the left, steel blue high and right.
      float heightMix = 1.0 - clamp(centre.y / uResolution.y, 0.0, 1.0);
      float leftMix = 1.0 - clamp(centre.x / uResolution.x, 0.0, 1.0);
      float warmChance = clamp(uWarmBias + warmLift - heightMix * 0.30 + leftMix * 0.22, 0.0, 1.0);
      float warmth = step(1.0 - warmChance, colWarm);
      vec3 tint = mix(uCool, uWarm, warmth);

      float weight = (0.62 + r.z * 0.5) * max(tw, 0.0) * gain * colGain;
      acc += tint * shape * weight;
    }
  }
  return acc;
}

void main() {
  vec2 uv = vTextureCoord;
  vec2 px = uv * uResolution;
  float s = uScale;

  // ---- background field -------------------------------------------------
  vec3 bg = mix(uBackTop, uBackBottom, smoothstep(0.0, 1.0, uv.y));

  // Faint vertical structure: the out-of-focus surface the lights hang
  // against. Looped by cross-fading two flow offsets of the same field.
  float weave = loopFbm(vec2(uv.x * 30.0, uv.y * 2.6), vec2(0.0, 0.7), uT);
  bg *= 0.78 + 0.34 * weave;
  bg += uCool * 0.06 * smoothstep(0.4, 1.0, weave);

  // ---- three depth layers, back to front --------------------------------
  vec3 light = vec3(0.0);

  // Back: small, dense, cool. Reads as the far side of the curtain.
  // Vertical pitch under the disc diameter so the chain stays continuous.
  light += strandLayer(
    px, vec2(58.0, 46.0) * s, 27.0 * s, 0.34, 0.18, 3.1, -0.26, 0.40
  );

  // Mid: the layer that carries the read.
  light += strandLayer(
    px, vec2(140.0, 104.0) * s, 67.0 * s, 0.26, 0.24, 8.7, 0.0, 0.88
  );

  // Front: large and very soft - closest to the lens, so furthest from
  // focus and least defined.
  light += strandLayer(
    px, vec2(248.0, 186.0) * s, 120.0 * s, 0.52, 0.10, 17.3, 0.26, 0.58
  );

  // Out-of-focus amber does not stay inside its discs - it hazes the
  // whole lower-left quadrant. Without this spill the strands read as
  // warm but the frame still reads as cold, which is what separated the
  // first pass from the reference.
  float spillLow = smoothstep(0.18, 1.0, uv.y);
  float spillLeft = smoothstep(0.95, 0.05, uv.x);
  float spill = spillLow * (0.35 + 0.65 * spillLeft);
  float spillBreathe = 0.9 + 0.1 * cos(TAU * uT + 1.1);
  bg += uWarm * spill * uSpill * spillBreathe;

  vec3 col = bg + light;

  // ---- blown-out corner --------------------------------------------------
  // A cluster running into the lens bottom-right. Breathes once per loop.
  vec2 hp = (uv - vec2(0.93, 0.86)) * vec2(1.0, 0.82);
  float hot = exp(-dot(hp, hp) * 9.0);
  float breathe = 0.82 + 0.18 * cos(TAU * uT);
  col += uWarm * hot * uHotspot * breathe;

  // ---- lens + grade ------------------------------------------------------
  float radial = length(uv - 0.5) * 2.0;
  col = fringe(col, 0.016, radial);
  col *= 1.0 - vignette(uv, 0.86, 0.8) * 0.34;

  col *= uExposure;
  col = tonemap(col, 0.52);
  col = saturate3(col, 1.08);
  col = liftGammaGain(col, vec3(0.004, 0.008, 0.016), 0.98, vec3(1.0, 0.99, 0.98));

  col += grain(px, uT, uLoopFrames) * uGrainAmount;

  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
