import { GLSL_HASH } from "./lib";

/**
 * Full-resolution pixel-cell pass.
 *
 * Works in "design pixels" (`uRenderSize / uScale`), so a 4K render is a true
 * 2x supersample of the 1080p look rather than a different picture: cells keep
 * the same on-screen size and only gain edge precision.
 *
 * Loop safety: every time-driven term is either snapped to a whole number of
 * cells per loop, or advanced by a whole number of cycles per loop.
 */
export const CELLS_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 finalColor;

uniform sampler2D uField;
uniform sampler2D uPalette;

uniform vec2  uRenderSize;
uniform float uScale;
uniform float uPhase;      // 0..1 through the loop
uniform float uLoopTime;   // seconds
uniform float uSeed;

uniform vec2  uCell;       // cell size, design px
uniform vec2  uGutter;     // dark gap as a fraction of the cell, per axis
uniform float uSpeedMin;   // slowest tier, in screen-widths per loop
uniform float uSpeedSteps; // number of per-row speed tiers above the slowest

uniform float uCoverage;
uniform float uRunCoherence;
uniform float uMaxRun;
uniform float uHoleChance;

uniform float uStreakChance;
uniform float uStreakRun;
uniform float uStreakBoost;

uniform float uTwinkleCycles; // whole cycles per loop
uniform float uTwinkleDepth;  // 0..1 how far a run dims at the bottom of its cycle
uniform float uCellSparkle;   // 0..1 per-cell brightness scatter within a dash
uniform float uHotChance;
uniform float uHotBoost;
uniform float uPrimaryChance;

uniform float uHueJitter;
uniform float uRowHueJitter;
uniform float uBright;
uniform float uSat;

uniform float uRowWarp;    // smooth row-to-row shear, uv units
uniform float uRowJitter;  // random row-to-row shear, uv units
uniform float uWaveFreq;
uniform float uWaveCycles; // whole cycles per loop

uniform float uBurstSlots;  // whole slots per loop
uniform float uBurstAmount; // extra gain on a surge slot
uniform float uDropAmount;  // 0..1 signal loss on a dropout slot

uniform float uTearChance;
uniform float uTearAmount; // design px
uniform float uTearBlock;  // rows per tear block
uniform float uTearSlots;  // whole slots per loop

const float TAU = 6.28318530718;

${GLSL_HASH}

void main() {
  vec2 p = vUv * uRenderSize / uScale;

  float row = floor(p.y / uCell.y);
  float rowA = hash11(row * 0.731 + uSeed);
  float rowB = hash11(row * 1.913 + uSeed + 5.0);

  // --- per-row scroll ------------------------------------------------------
  // For the clip to cut back to frame 0, a row's cell content has to repeat
  // over exactly the distance that row travels in one loop. That repeat
  // distance must also be at least a screen wide, or the repetition itself
  // becomes visible. Both hold only if every row covers a whole number of
  // screen-widths per loop, so speed is quantised into tiers rather than
  // being freely random per row.
  float cellsAcross = ceil(uRenderSize.x / uScale / uCell.x);
  float wrapCells = cellsAcross * (uSpeedMin + floor(rowA * uSpeedSteps));
  float offset = wrapCells * uCell.x * uPhase;

  // --- datamosh tear: blocks of rows yanked sideways for one time slot ------
  float tearBlock = floor(row / max(uTearBlock, 1.0));
  float tearSlot = floor(uPhase * uTearSlots);
  float tearRand = hash13(vec3(tearBlock, tearSlot, 17.0) + uSeed);
  float tearOn = step(1.0 - uTearChance, tearRand);
  offset += tearOn * (hash11(tearRand * 91.7) - 0.5) * uTearAmount;

  float xShift = rowB * 977.0; // decorrelate rows from each other
  float colF = (p.x - offset) / uCell.x + xShift;
  // colW is the column index folded into one repeat; everything that hashes a
  // cell's identity keys off it, so the field is periodic along the scroll.
  float colW = mod(floor(colF), wrapCells);
  vec2 cellUv = vec2(fract(colF), fract(p.y / uCell.y));

  // --- control field, sheared per row to break the mask into chevrons ------
  float shear = sin(row * uWaveFreq + uPhase * TAU * uWaveCycles) * uRowWarp
              + (rowA - 0.5) * uRowJitter;
  vec4 fld = texture(uField, clamp(vec2(vUv.x + shear, vUv.y), vec2(0.0), vec2(1.0)));

  // --- signal surges and dropouts -------------------------------------------
  // Past roughly a cell per frame the scroll stops reading as motion and
  // starts reading as static, so the sense of speed has to come from the
  // rate of discrete events instead. One hash per slot drives both ends:
  // high lands a surge, low lands a dropout.
  float burstRand = hash11(floor(uPhase * uBurstSlots) * 3.77 + uSeed + 91.0);
  float pulse = (1.0 + uBurstAmount * smoothstep(0.70, 1.0, burstRand))
              * (1.0 - uDropAmount * smoothstep(0.70, 1.0, 1.0 - burstRand));

  float density = fld.r * uCoverage * mix(1.0, pulse, 0.5);

  // --- dash runs ------------------------------------------------------------
  // Colour and brightness key off the *run*, not the cell. Keying them per
  // cell reads as confetti; the references show dashes whose cells share a
  // hue and an intensity, with only fine sparkle on top.
  float runLen = 1.0 + floor(hash11(row * 2.137 + uSeed + 13.0) * uMaxRun);
  float runId = floor(colW / runLen);
  float runRand = hash13(vec3(runId, row, 0.0) + uSeed);
  float cellRand = hash13(vec3(colW, row, 1.0) + uSeed);
  float sel = mix(cellRand, runRand, uRunCoherence);

  float lit = step(1.0 - density, sel);
  lit *= step(uHoleChance, hash13(vec3(colW, row, 2.0) + uSeed)); // holes inside runs

  // --- rare long bright bars ------------------------------------------------
  float sRunLen = uStreakRun * (0.5 + hash11(row * 3.77 + uSeed + 21.0));
  float sRand = hash13(vec3(floor(colW / sRunLen), row, 5.0) + uSeed + 61.0);
  float streak = step(1.0 - uStreakChance * fld.b, sRand);
  lit = max(lit, streak);

  // --- cell shape -----------------------------------------------------------
  float aax = 1.0 / max(uCell.x * uScale, 1.0);
  float aay = 1.0 / max(uCell.y * uScale, 1.0);
  float gx = uGutter.x <= 0.0
    ? 1.0
    : smoothstep(uGutter.x - aax, uGutter.x + aax, cellUv.x)
      * smoothstep(uGutter.x - aax, uGutter.x + aax, 1.0 - cellUv.x);
  float gy = uGutter.y <= 0.0
    ? 1.0
    : smoothstep(uGutter.y - aay, uGutter.y + aay, cellUv.y)
      * smoothstep(uGutter.y - aay, uGutter.y + aay, 1.0 - cellUv.y);

  // --- colour ---------------------------------------------------------------
  float hueJit = (hash13(vec3(runId, row, 9.0) + uSeed) - 0.5) * uHueJitter
               + (hash13(vec3(colW, row, 23.0) + uSeed) - 0.5) * uHueJitter * 0.25
               + (rowB - 0.5) * uRowHueJitter;
  vec3 rgb = texture(uPalette, vec2(clamp(fld.g + hueJit, 0.0, 1.0), 0.5)).rgb;

  // pure R/G/B dead-pixel sparks
  float pk = hash13(vec3(colW, row, 11.0) + uSeed);
  float seg = pk / max(uPrimaryChance, 1e-4);
  vec3 prim = mix(
    mix(vec3(1.0, 0.10, 0.12), vec3(0.14, 1.0, 0.26), step(0.3333, seg)),
    vec3(0.18, 0.40, 1.0),
    step(0.6666, seg)
  );
  rgb = mix(rgb, prim, step(pk, uPrimaryChance));

  // white-hot cores
  float hot = step(1.0 - uHotChance, hash13(vec3(runId, row, 3.0) + uSeed));
  rgb = mix(rgb, mix(rgb, vec3(1.0), 0.82), hot);

  float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(lum), rgb, uSat);

  // --- brightness -----------------------------------------------------------
  float tw = hash13(vec3(runId, row, 7.0) + uSeed);
  float twinkle = (1.0 - uTwinkleDepth)
    + uTwinkleDepth * (0.5 + 0.5 * cos(TAU * fract(tw + uPhase * uTwinkleCycles)));
  // a little per-cell sparkle so a dash is not a flat bar
  twinkle *= 1.0 - uCellSparkle * hash13(vec3(colW, row, 29.0) + uSeed);

  float amp = uBright * twinkle * pulse * mix(0.30, 1.55, fld.b);
  amp *= mix(1.0, uHotBoost, hot);
  amp *= mix(1.0, uStreakBoost, streak);

  finalColor = vec4(rgb * amp * lit * gx * gy, 1.0);
}
`;
