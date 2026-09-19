import { interpolate } from "remotion";
import { PixiStage, type SceneFactory } from "../PixiStage";
import { createShaderMesh, GLSL_COMMON } from "../shaders/fullscreen";
import { MOSAIC_PALETTE, hexToVec3 } from "../constants";

/**
 * Bakes the palette into the shader as a const array. A uniform array of vec3
 * would be padded to vec4 by std140 and read back misaligned, and the ramp
 * never changes at runtime, so a compile-time constant is both safer and
 * keeps constants.ts as the single source of truth.
 */
const PALETTE_GLSL = `const vec3 PAL[8] = vec3[8](\n${MOSAIC_PALETTE.map(
  (c) => {
    const [r, g, b] = hexToVec3(c);
    return `  vec3(${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)})`;
  },
).join(",\n")}\n);`;

/**
 * Version 1 - "Mosaic".
 *
 * Three stacked grids of rectangles. Each grid row picks its own column count,
 * so block widths vary the way they do in the reference, and rows step
 * sideways by whole cells over time, which reads as tiles reshuffling rather
 * than sliding. Colour comes from a drifting noise field biased by uTone:
 * low tone keeps the picture in the white/turquoise end of the ramp, high
 * tone pushes it into the blues and navy.
 */
const FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform float uTone;
uniform float uReveal;
uniform float uAspect;

${GLSL_COMMON}
${PALETTE_GLSL}

vec3 paletteAt(float v) {
  float idx = clamp(floor(v * 7.999), 0.0, 7.0);
  return PAL[int(idx)];
}

// Colour for one cell of one layer.
vec3 cellColour(vec2 cell, float seed, float t, float tone) {
  float n = noise21(vec2(cell.x * 0.34, cell.y * 0.62) + vec2(t * 0.24, t * 0.17) + seed);
  float jump = hash21(cell + floor(t * 0.9) * 13.0 + seed);
  float mixed = mix(n, jump, 0.4);
  // Centre of the ramp slides from the pale end to the blue end with tone.
  float centre = mix(0.16, 0.56, tone);
  float spread = mix(0.42, 0.95, tone);
  return paletteAt(clamp(centre + (mixed - 0.5) * spread, 0.0, 1.0));
}

// One grid layer. w = 0 where the layer is transparent and lower layers show.
vec4 layer(vec2 uv, float rows, float seed, float t, float tone, float fill) {
  float row = floor(uv.y * rows);
  // Each row gets its own column count -> varied block widths.
  float cols = floor(mix(4.0, 10.0, hash11(row * 1.7 + seed * 3.0)));
  // Whole-cell horizontal step, at a per-row rate.
  float slide = floor(t * (0.5 + hash11(row + seed) * 1.6) + hash11(row * 3.1 + seed) * 16.0);
  float col = floor(uv.x * cols + slide);
  vec2 cell = vec2(col, row);
  float present = step(1.0 - fill, hash21(cell * 1.31 + seed * 17.0));
  return vec4(cellColour(cell, seed, t, tone), present);
}

void main() {
  vec2 uv = vUv;
  float t = uTime;

  vec3 col = layer(uv, 4.0, 0.0, t, uTone, 1.0).rgb;

  vec4 mid = layer(uv, 6.0, 1.0, t * 1.15, uTone, 0.5);
  col = mix(col, mid.rgb, mid.a);

  vec4 fine = layer(uv, 9.0, 2.0, t * 0.85, uTone, 0.26);
  col = mix(col, fine.rgb, fine.a);

  // Diagonal wipe from the white opening frames into the mosaic.
  float diag = uv.x * 0.62 + uv.y * 0.38;
  float rv = remap(uReveal - diag, 0.0, 0.3);
  col = mix(PAL[0], col, rv);

  fragColor = vec4(col, 1.0);
}
`;

const createMosaicScene: SceneFactory = (app) => {
  const { mesh, uniforms } = createShaderMesh(FRAG, {
    uTime: { value: 0, type: "f32" },
    uTone: { value: 0, type: "f32" },
    uReveal: { value: 0, type: "f32" },
    uAspect: { value: 16 / 9, type: "f32" },
  });

  app.stage.addChild(mesh);

  return ({ time, width, height }) => {
    uniforms.uTime = time;
    uniforms.uAspect = width / height;

    // White hold, then the wipe reveals the mosaic between 0.5s and 1.9s.
    uniforms.uReveal = interpolate(time, [0.5, 1.9], [0, 1.3], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Pale -> saturated blues -> back toward cyan and white for the ending.
    uniforms.uTone = interpolate(
      time,
      [0.5, 3.0, 7.0, 11.5, 14.5, 16.2],
      [0, 0.78, 1, 0.92, 0.5, 0.18],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  };
};

export const MosaicBlocks: React.FC = () => (
  <PixiStage createScene={createMosaicScene} backgroundColor={MOSAIC_PALETTE[0]} />
);
