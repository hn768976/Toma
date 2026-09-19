import { interpolate } from "remotion";
import { PixiStage, type SceneFactory } from "../PixiStage";
import { createShaderMesh, GLSL_COMMON } from "../shaders/fullscreen";
import { BARS_BLACK } from "../constants";

/**
 * Version 3 - "Bars".
 *
 * Pure black-and-white stripes that rotate from vertical through diagonal to
 * horizontal over 20 seconds. Contrast flips are seamless: the stripe duty
 * ramps to 1 so the frame goes fully solid, the fore/background swap happens
 * on that solid frame, then the duty ramps up again from 0. Nothing cuts.
 */
const FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float uAngle;
uniform float uFreq;
uniform float uDuty;
uniform float uPhase;
uniform float uSeed;
uniform float uInvert;
uniform float uVary;
uniform float uAspect;

${GLSL_COMMON}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec2 dir = vec2(cos(uAngle), sin(uAngle));

  float t = dot(p, dir) * uFreq + uPhase;
  float id = floor(t);
  float s = fract(t);

  // Width variation is faded out as the duty approaches 1, so a full ramp
  // really does cover the frame and the contrast flip stays invisible.
  float varAmt = uVary * (1.0 - smoothstep(0.62, 1.0, uDuty));
  float width = clamp(uDuty + (hash11(id * 1.7 + uSeed) - 0.5) * 2.0 * varAmt, 0.0, 1.0);

  // fwidth on t (not on fract(t)) stays well behaved across the stripe seam.
  float aa = max(fwidth(t), 1e-5);
  float bar = smoothstep(width + aa, width - aa, s);

  vec3 background = mix(vec3(0.0), vec3(0.988), uInvert);
  vec3 foreground = mix(vec3(0.988), vec3(0.0), uInvert);

  fragColor = vec4(mix(background, foreground, bar), 1.0);
}
`;

/**
 * Seconds at which the contrast flips. Each flip lands on a frame where the
 * duty ramp has filled the screen solid.
 */
const FLIPS = [2.65, 8.6, 15.4];

const invertAt = (time: number) =>
  FLIPS.filter((f) => time >= f).length % 2 === 0 ? 0 : 1;

/** Duty sawtooths to 1 just before each flip, then restarts from 0. */
const dutyAt = (time: number) =>
  interpolate(
    time,
    [0, 1.4, 2.65, 2.66, 5.0, 7.4, 8.6, 8.61, 11.5, 14.2, 15.4, 15.41, 17.6, 20.44],
    [0.04, 0.34, 1.0, 0.0, 0.42, 0.52, 1.0, 0.0, 0.3, 0.24, 1.0, 0.0, 0.34, 0.46],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

const createMonoBarsScene: SceneFactory = (app) => {
  const { mesh, uniforms } = createShaderMesh(FRAG, {
    uAngle: { value: 0, type: "f32" },
    uFreq: { value: 3, type: "f32" },
    uDuty: { value: 0.3, type: "f32" },
    uPhase: { value: 0, type: "f32" },
    uSeed: { value: 11.37, type: "f32" },
    uInvert: { value: 0, type: "f32" },
    uVary: { value: 0.26, type: "f32" },
    uAspect: { value: 16 / 9, type: "f32" },
  });

  app.stage.addChild(mesh);

  return ({ time, width, height }) => {
    uniforms.uAspect = width / height;
    uniforms.uDuty = dutyAt(time);
    uniforms.uInvert = invertAt(time);

    // 0 rad = vertical stripes, PI/2 = horizontal.
    uniforms.uAngle = interpolate(
      time,
      [0, 6.5, 9.5, 12.0, 15.0, 17.0, 18.4, 20.44],
      [0, 0, 0.16, 0.33, 0.4, 0.95, 1.5708, 1.5708],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

    // Stripe count: sparse opening, dense middle, wide diagonals, fine finish.
    uniforms.uFreq = interpolate(
      time,
      [0, 2.0, 4.0, 7.0, 9.5, 12.5, 15.0, 17.5, 20.44],
      [1.6, 2.4, 4.2, 7.5, 5.5, 3.2, 2.6, 4.4, 6.5],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

    // Slow drift keeps the stripes alive between the structural moves.
    uniforms.uPhase = time * 0.14;

    // Re-seed on each flip so the new stripe widths are a fresh set.
    uniforms.uSeed = 11.37 + FLIPS.filter((f) => time >= f).length * 23.9;
  };
};

export const MonoBars: React.FC = () => (
  <PixiStage createScene={createMonoBarsScene} backgroundColor={BARS_BLACK} />
);
