import { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { ShaderCanvas } from "../gl/ShaderCanvas";
import { SILK_FRAGMENT_SHADER } from "./silkShader";

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const silkFlowSchema = z.object({
  shadowTint: rgb,
  midTint: rgb,
  highTint: rgb,
  exposure: z.number(),
  sheen: z.number(),
  contrast: z.number(),
  /** Apply the measured brightness envelope (disable only for calibration). */
  envelope: z.boolean(),
  /** Camera push-in: zoom factor reached at the last frame (1 = static). */
  pushIn: z.number().min(1),
  /** Camera roll over the clip, in degrees (0 = static). */
  rollDegrees: z.number(),
});

export type SilkFlowProps = z.infer<typeof silkFlowSchema>;

/**
 * Exposure gain sampled every 0.5 s. Calibrated in a closed loop: the shader
 * was rendered with a flat gain, its mean luma compared with the reference's
 * mean luma at the same timestamps (watermark masked out), and the ratio
 * stored here. Reproduces the reference's light "breathing": a peak around
 * 1-2 s, then a slow decline into near-black at the end.
 */
const GAIN = [
  0.671, 0.734, 0.939, 1.143, 1.027, 0.712, 0.606, 0.534, 0.481,
  0.482, 0.490, 0.521, 0.571, 0.651, 0.616, 0.864, 0.707, 0.574,
  0.503, 0.522, 0.582, 0.562, 0.401, 0.280, 0.204,
];

/**
 * Relative animation speed per 2 s window, from the reference's motion
 * energy (mean absolute frame difference): the cloth moves most in the
 * first ~4 s, then settles.
 */
const SPEED_WINDOWS = [1.95, 1.85, 1.05, 1.9, 2.2, 1.85];
const BASE_SPEED = 1.1;

const speedAt = (seconds: number) =>
  BASE_SPEED *
  interpolate(
    seconds,
    SPEED_WINDOWS.map((_, i) => i * 2 + 1),
    SPEED_WINDOWS,
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

/** Integral of the speed profile -> smooth, monotonic animation clock. */
const flowTime = (frame: number, fps: number) => {
  let acc = 0;
  for (let f = 0; f < frame; f++) {
    acc += speedAt((f + 0.5) / fps) / fps;
  }
  return acc;
};

export const SilkFlow: React.FC<SilkFlowProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const seconds = frame / fps;
  const gain = props.envelope
    ? interpolate(
        seconds,
        GAIN.map((_, i) => i * 0.5),
        GAIN,
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 1;

  const progress = frame / Math.max(1, durationInFrames - 1);
  const eased = progress * progress * (3 - 2 * progress);
  const zoom = 1 + (props.pushIn - 1) * eased;
  const roll = ((props.rollDegrees * (eased - 0.5)) * Math.PI) / 180;
  const ft = flowTime(frame, fps);

  const uniforms = useMemo(
    () => ({
      uGain: gain,
      uFlowTime: ft,
      uZoom: zoom,
      uRoll: roll,
      uExposure: props.exposure,
      uShadowTint: props.shadowTint,
      uMidTint: props.midTint,
      uHighTint: props.highTint,
      uSheen: props.sheen,
      uContrast: props.contrast,
    }),
    [gain, ft, zoom, roll, props],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ShaderCanvas fragmentShader={SILK_FRAGMENT_SHADER} uniforms={uniforms} />
    </AbsoluteFill>
  );
};

/** Version 1 — neutral black satin, matching the reference. */
export const silkV1Defaults: SilkFlowProps = {
  shadowTint: [1, 1, 1],
  midTint: [1, 1, 1],
  highTint: [1, 1, 1],
  exposure: 1,
  sheen: 1,
  contrast: 1,
  envelope: true,
  pushIn: 1,
  rollDegrees: 0,
};

/**
 * Version 2 — alternate palette: champagne-gold satin on warm black, with a
 * slow camera push-in and a few degrees of roll for extra depth.
 */
export const silkV2Defaults: SilkFlowProps = {
  shadowTint: [0.55, 0.3, 0.12],
  midTint: [1.25, 0.8, 0.36],
  highTint: [1.42, 1.12, 0.66],
  exposure: 1.7,
  sheen: 1,
  contrast: 1,
  envelope: true,
  pushIn: 1.18,
  rollDegrees: 6,
};
