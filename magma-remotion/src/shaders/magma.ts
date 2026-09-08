import { NOISE_4D } from "./noise4d";

/**
 * The plane is a 2x2 quad and the vertex shader writes clip space directly, so
 * the field always fills the frame exactly and no camera maths can drift.
 */
export const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uT;          // normalised loop position, frame / durationInFrames
uniform float uDuration;   // durationInFrames, for the grain seed

uniform vec3 uPal[7];      // colour ramp, cool -> hot

uniform float uCells;      // cells across the frame width
uniform float uWarpAmp1;
uniform float uWarpFreq1;
uniform float uWarpRate1;  // radius of the time circle => evolution speed
uniform float uWarpAmp2;
uniform float uWarpFreq2;
uniform float uWarpRate2;
uniform float uJitter;     // feature-point orbit radius
uniform float uCellCycles; // whole orbits per loop (integer keeps it periodic)
uniform float uCells2;     // second cellular octave, relative to the first
uniform float uCellCycles2;
uniform float uFiligree;   // strength of that octave's fine crackle
uniform float uPlateMin;   // smallest crust island radius, in cell units
uniform float uPlateVar;   // spread of island radius across cells
uniform float uSpeck;      // cooled specks the fine octave drops in the matrix
uniform float uHeatGamma;  // exposure; see the note in palettes.ts
uniform float uVeinW;
uniform float uContourN;   // iso-levels per cell => concentric rings
uniform float uBloom;
uniform float uPulse;
uniform float uPulseCycles;
uniform float uGrain;
uniform float uCrust;

const float TAU = 6.28318530718;

${NOISE_4D}

// -- cheap 2D hashes, for the cell lattice and the grain ---------------------

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

// Fine 2D value noise, used only for the crust grain on the dark plates.
float vnoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// The time axis, traversed as a circle so t = 0 and t = 1 are the same point.
// The radius is the speed control: a smaller circle covers less noise space
// per loop, so the field evolves more slowly, and it still closes exactly.
vec2 timeCircle(float radius) {
  return radius * vec2(cos(TAU * uT), sin(TAU * uT));
}

/**
 * Worley / cellular noise.
 *
 * Rather than pay for 4D Worley (81 cells searched instead of 9), the loop is
 * carried by the feature points themselves: each one runs an ellipse whose
 * phase and axes are hashed per cell, closed once per uCellCycles. Cells keep
 * their identity for the whole loop, so plates breathe and veins open and
 * close without anything popping.
 *
 * Returns vec3(F1, F2, cellId).
 */
vec3 worley(vec2 p, float phase) {
  vec2 ip = floor(p);
  vec2 fp = p - ip;
  float f1 = 8.0;
  float f2 = 8.0;
  float id = 0.0;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 cell = ip + g;
      vec2 h = hash22(cell);

      vec2 axes = uJitter * vec2(0.40 + 0.60 * h.x, 0.40 + 0.60 * fract(h.x * 7.31 + 0.17));
      float ang = phase + h.y * TAU;
      vec2 o = vec2(0.5) + axes * vec2(cos(ang), sin(ang));

      vec2 r = g + o - fp;
      float d = dot(r, r);            // ordering by d2 is ordering by d
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash21(cell);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return vec3(sqrt(f1), sqrt(f2), id);
}

// Piecewise ramp over the seven palette stops.
vec3 ramp(float x) {
  vec3 c = uPal[0];
  c = mix(c, uPal[1], smoothstep(0.00, 0.16, x));
  c = mix(c, uPal[2], smoothstep(0.16, 0.36, x));
  c = mix(c, uPal[3], smoothstep(0.36, 0.55, x));
  c = mix(c, uPal[4], smoothstep(0.55, 0.72, x));
  c = mix(c, uPal[5], smoothstep(0.72, 0.87, x));
  c = mix(c, uPal[6], smoothstep(0.87, 0.96, x));
  return c;
}

void main() {
  float aspect = uResolution.x / uResolution.y;

  // Aspect-corrected so cells stay round, then scaled to uCells across the
  // frame width. No centre term anywhere: the field has to tile-feel, and any
  // origin-relative maths would plant a focal point in the middle of it.
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  vec2 q = p * (uCells / aspect);

  // -- domain warp, two levels ---------------------------------------------
  // Level 1 is large and slow. Its divergence is also what varies cell size
  // across the field: where the warp spreads, plates open out; where it
  // converges, they crowd. That gives non-uniform cells with no centre bias,
  // which a multiplicative frequency term could not do.
  vec2 c1 = timeCircle(uWarpRate1);
  vec2 w1 = vec2(
    snoise4(vec4(q * uWarpFreq1, c1)),
    snoise4(vec4(q * uWarpFreq1 + vec2(41.7, 19.3), c1))
  );
  vec2 q1 = q + w1 * uWarpAmp1;

  // Level 2 is finer and quicker: the liquid detail riding on the big swirl.
  vec2 c2 = timeCircle(uWarpRate2);
  vec2 w2 = vec2(
    snoise4(vec4(q1 * uWarpFreq2 + vec2(7.9, 63.1), c2)),
    snoise4(vec4(q1 * uWarpFreq2 + vec2(88.2, 5.4), c2))
  );
  vec2 qc = q1 + w2 * uWarpAmp2;

  // -- cellular structure ---------------------------------------------------
  float phase = TAU * uT * uCellCycles;
  vec3 w = worley(qc, phase);
  float f1 = w.x;
  float f2 = w.y;
  float cid = w.z;

  float edge = f2 - f1;   // -> 0 on the boundary between two cells

  // Vein width from its own field, so some boundaries stay thin cracks while
  // others open into wide channels — spatially, not per pixel.
  float vwN = snoise4(vec4(q * 0.20 + vec2(120.0, 77.0), timeCircle(uWarpRate1 * 1.4)));
  float veinW = uVeinW * (1.0 + 0.95 * vwN);
  veinW = max(veinW, 0.02);

  float vein = 1.0 - smoothstep(0.0, veinW, edge);
  float core = 1.0 - smoothstep(0.0, veinW * 0.22, edge);

  // A second, finer cellular octave. The plates and their rings come from the
  // octave above; this one only contributes thin crackle, which is what fills
  // the molten channels with filigree instead of leaving them flat orange.
  //
  // The domain warp above varies far too slowly to bend anything at this
  // scale, so the fine cells would meet along their straight perpendicular
  // bisectors and lay an angular web over the matrix. This extra wobble is
  // deliberately cheap value noise rather than a third 4D octave: it is
  // sampled in warped space, which already loops, so it needs no time axis of
  // its own.
  vec2 fineWobble = vec2(
    vnoise2(qc * 2.1 + vec2(11.3, 4.7)),
    vnoise2(qc * 2.1 + vec2(47.9, 29.1))
  ) - 0.5;
  vec3 wb = worley(qc * uCells2 + fineWobble * 1.3 + vec2(53.1, 91.7), TAU * uT * uCellCycles2);
  float edgeB = wb.y - wb.x;
  float filigree = 1.0 - smoothstep(0.0, veinW * 0.34, edgeB);

  // -- concentric contours inside the plates --------------------------------
  // A periodic ramp on the distance field: every iso-level draws a thin line,
  // which is what reads as cooling crust rather than a fire filter.
  float rings = f1 * uContourN;
  float tri = abs(fract(rings) - 0.5) * 2.0;
  float line = 1.0 - smoothstep(0.0, 0.34, tri);

  // -- crust plates as islands ----------------------------------------------
  // The dark crust does not tile the frame. In the reference it sits as
  // rounded islands of varying size floating in one connected molten matrix,
  // which is F1 thresholded per cell — the F2-F1 tiling would instead make
  // every plate share a border with its neighbours and close the matrix off.
  float radius = uPlateMin + uPlateVar * fract(cid * 41.7);
  float island = 1.0 - smoothstep(radius - 0.07, radius + 0.07, f1);
  float molten = 1.0 - island;

  // How deep into the matrix a pixel sits. Without this the molten area is a
  // flat wash; the reference cools it back down as it approaches each island.
  float moltenDepth = smoothstep(radius, radius + 0.34, f1);

  // The fine octave also throws small cooled specks into the matrix, which is
  // what stops it reading as one continuous sheet of yellow.
  float radius2 = 0.20 + 0.26 * fract(wb.z * 41.7);
  float speck = 1.0 - smoothstep(radius2 - 0.09, radius2 + 0.09, wb.x);
  float matrix = molten * (1.0 - uSpeck * speck);

  // -- which plates are hot, which have cooled ------------------------------
  // cid is per cell and static, so a plate keeps its character for the whole
  // loop; the low-frequency field migrates the hot regions across it.
  float hotN = snoise4(vec4(q * 0.20 + vec2(900.0, 400.0), timeCircle(uWarpRate1 * 0.8)));
  float regionHeat = clamp(0.60 + 0.55 * hotN, 0.0, 1.0);
  float cooled = smoothstep(0.50, 0.92, cid);   // a few plates sit nearly black
  float crustHeat = regionHeat * (1.0 - 0.75 * cooled);

  float heat =
      0.06                                         // the crust never reaches void
    + 0.42 * matrix * (0.55 + 0.45 * regionHeat) * (0.40 + 0.60 * moltenDepth)
    + 0.26 * vein * (0.35 + 0.65 * molten)         // cell borders run through it
    + 0.30 * core                                  // and blow out at their centre
    + 0.20 * crustHeat * island                    // warmth banked in the crust
    + 0.34 * line * (0.35 + 0.65 * crustHeat) * (0.50 + 0.50 * island)
    + uFiligree * filigree * (0.25 + 0.75 * regionHeat) * (0.30 + 0.70 * molten);

  // A subtle level shift per ring band, so the contours read as topography
  // rather than as lines drawn on a flat surface.
  heat += 0.05 * (0.5 - tri) * crustHeat;

  // Fine crust texture, in warped space so it travels with the plates. Barely
  // visible at 1080p; it is there to give the dark plates something at 4K.
  float crust = vnoise2(qc * 46.0) * 0.65 + vnoise2(qc * 97.0) * 0.35;
  heat += uCrust * (crust - 0.5) * (1.0 - vein);

  // Breathing on the hottest regions only. An integer cycle count keeps it
  // periodic; hotN is already periodic, so the phase offset is safe.
  float pulse = 1.0 + uPulse * sin(TAU * uT * uPulseCycles + hotN * 3.0 + cid * TAU);
  heat *= mix(1.0, pulse, smoothstep(0.38, 0.90, heat));

  // Bias the distribution towards the cool end so the plates actually sit
  // dark and only the vein cores reach the top of the ramp. Per palette,
  // because the three ramps are not equally luminous — see palettes.ts.
  heat = pow(clamp(heat, 0.0, 1.0), uHeatGamma);

  vec3 col = ramp(heat);

  // -- bloom ---------------------------------------------------------------
  // Analytic, not a post pass: the vein position is already known here, so the
  // glow can be confined to a wide falloff around the veins. A separable blur
  // over the whole frame would lift the dark plates into orange haze, and the
  // crust contrast is the entire subject.
  float glow = 1.0 - smoothstep(0.0, veinW * 4.0, edge);
  col += uBloom * glow * glow * uPal[5];

  // Grain, ~2%. Doubles as dither: the plate interiors are large near-black
  // regions and will band in H.264 without it. Seeded from fract(uT) so the
  // frame at t = 1 is identical to the frame at t = 0.
  float seed = floor(fract(uT) * uDuration + 0.5);
  float g = hash21(vUv * uResolution + vec2(seed * 1.7, seed * 3.1));
  col += (g - 0.5) * uGrain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
