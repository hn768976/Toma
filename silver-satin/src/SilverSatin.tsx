import React, { useMemo } from "react";
import { z } from "zod";
import { ShaderCanvas } from "./gl/ShaderCanvas";
import { SATIN_FRAG } from "./gl/satinShader";

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const satinSchema = z.object({
  /** 0 = top-down reference camera, 1 = low-angle perspective dolly/orbit. */
  cameraMode: z.union([z.literal(0), z.literal(1)]),
  deep: rgb,
  shadow: rgb,
  mid: rgb,
  light: rgb,
  sheen: rgb,
});

export type SatinProps = z.infer<typeof satinSchema>;

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const SILVER = {
  deep: hex("#1a1218"),
  shadow: hex("#0f1a40"),
  mid: hex("#6f7a95"),
  light: hex("#e0dcec"),
  sheen: hex("#fff0f6"),
};

/** Version 1 — matches the reference: top-down camera, silver / navy satin. */
export const REFERENCE_PROPS: SatinProps = { cameraMode: 0, ...SILVER };

/** Version 2 — same satin, low-angle perspective camera with dolly + orbit. */
export const LOW_ANGLE_PROPS: SatinProps = { cameraMode: 1, ...SILVER };

export const SilverSatin: React.FC<SatinProps> = (props) => {
  const uniforms = useMemo(
    () => ({
      uCamMode: props.cameraMode,
      // V1 reference framing has the dense pleats down the left side
      uPleatBias: props.cameraMode === 0 ? 1 : 0.6,
      uDeep: props.deep,
      uShadow: props.shadow,
      uMid: props.mid,
      uLight: props.light,
      uSheen: props.sheen,
    }),
    [props.cameraMode, props.deep, props.shadow, props.mid, props.light, props.sheen],
  );
  return <ShaderCanvas fragmentShader={SATIN_FRAG} uniforms={uniforms} />;
};
