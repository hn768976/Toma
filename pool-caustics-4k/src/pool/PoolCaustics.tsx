import { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { ShaderCanvas } from "../gl/ShaderCanvas";
import { POOL_FRAGMENT_SHADER } from "./poolShader";

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const poolCausticsSchema = z.object({
  camera: z.enum(["top-down", "tilted-glide"]),
  tileColor: rgb,
  groutColor: rgb,
  causticColor: rgb,
  skyColor: rgb,
});

export type PoolCausticsProps = z.infer<typeof poolCausticsSchema>;

const srgb = (r: number, g: number, b: number): [number, number, number] => [
  r / 255,
  g / 255,
  b / 255,
];

// Tile grid measured from the reference (FFT of the grout lines):
// ~62 tiles across and ~41 tiles down the frame.
const GRID: [number, number] = [62, 41];

export const PoolCaustics: React.FC<PoolCausticsProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const total = durationInFrames / fps;

  // Version 2 camera: a slow forward glide over the pool with an eased
  // yaw drift and a gentle tilt change — smooth, no cuts.
  const p = t / total;
  const eased = interpolate(p, [0, 1], [0, 1], {
    easing: (x) => x * x * (3 - 2 * x),
  });
  const camPos: [number, number, number] = [
    2.0 + 3.0 * eased,
    -6.0 + 2.1 * t,
    9.0 + 0.25 * Math.sin(t * 0.6),
  ];
  const camYaw = ((-9 + 16 * eased) * Math.PI) / 180;
  const camPitch = ((52 - 6 * eased) * Math.PI) / 180;

  const uniforms = useMemo(
    () => ({
      uCamMode: props.camera === "top-down" ? 0 : 1,
      uGrid: GRID,
      uCamPos: camPos,
      uCamYaw: camYaw,
      uCamPitch: camPitch,
      uCamFov: (52 * Math.PI) / 180,
      uTileColor: props.tileColor,
      uGroutColor: props.groutColor,
      uCausticColor: props.causticColor,
      uSkyColor: props.skyColor,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props, camPos[0], camPos[1], camPos[2], camYaw, camPitch],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#00b8f0" }}>
      <ShaderCanvas fragmentShader={POOL_FRAGMENT_SHADER} uniforms={uniforms} />
    </AbsoluteFill>
  );
};

const PALETTE = {
  tileColor: srgb(24, 197, 253),
  groutColor: srgb(100, 229, 255),
  causticColor: srgb(185, 250, 255),
  skyColor: srgb(214, 240, 255),
};

/** Version 1 — top-down, matching the reference framing. */
export const poolV1Defaults: PoolCausticsProps = {
  camera: "top-down",
  ...PALETTE,
};

/** Version 2 — same water and palette, tilted gliding camera. */
export const poolV2Defaults: PoolCausticsProps = {
  camera: "tilted-glide",
  ...PALETTE,
};
