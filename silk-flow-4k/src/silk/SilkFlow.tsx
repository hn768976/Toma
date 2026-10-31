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
});

export type SilkFlowProps = z.infer<typeof silkFlowSchema>;

/**
 * Brightness envelope measured from the reference clip (average luma every
 * 0.5 s, black level removed). It reproduces the slow "breathing" of the
 * light on the cloth and the gentle darkening over the last seconds.
 */
const ENVELOPE = [
  22.5, 25.2, 27.3, 26.8, 24.7, 22.6, 20.5, 18.4, 17.7, 18.6, 19.1, 20.1, 21.9,
  23.7, 22.7, 21.1, 19.0, 18.5, 17.8, 16.5, 15.6, 14.9, 12.8, 9.9, 6.1,
];
const ENVELOPE_MEAN = 20;

export const SilkFlow: React.FC<SilkFlowProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const seconds = frame / fps;
  const gain =
    interpolate(
      seconds,
      ENVELOPE.map((_, i) => i * 0.5),
      ENVELOPE,
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ) / ENVELOPE_MEAN;

  const uniforms = useMemo(
    () => ({
      uGain: gain,
      uExposure: props.exposure,
      uShadowTint: props.shadowTint,
      uMidTint: props.midTint,
      uHighTint: props.highTint,
      uSheen: props.sheen,
      uContrast: props.contrast,
    }),
    [gain, props],
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
};

/** Version 2 — alternate palette: champagne-gold satin on warm black. */
export const silkV2Defaults: SilkFlowProps = {
  shadowTint: [0.55, 0.3, 0.12],
  midTint: [1.25, 0.8, 0.36],
  highTint: [1.42, 1.12, 0.66],
  exposure: 1.25,
  sheen: 1,
  contrast: 1,
};
