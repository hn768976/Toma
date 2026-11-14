import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { ShaderCanvas } from "./gl/ShaderCanvas";
import { integrateKeys, Keys, sampleKeys } from "./keyframes";
import { warpFragmentShader } from "./warpShader";

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const warpTunnelSchema = z.object({
  camera: z.enum(["reference", "banking-orbit"]),
  deep: rgb,
  violet: rgb,
  lavender: rgb,
  cyan: rgb,
  blue: rgb,
  pink: rgb,
  renderScale: z.number().min(0.1).max(2),
});

export type WarpTunnelProps = z.infer<typeof warpTunnelSchema>;

// Envelopes keyed to the reference's measured per-second brightness:
// dense, bright stretch around 4–8 s, a sparse star-field lull at ~11 s,
// then the nebula thickens again toward the end.
const DENSITY: Keys = [
  [0, 0.76], [1, 0.7], [2, 0.7], [4, 0.68], [6, 0.82], [7.3, 0.96],
  [8.1, 1.08], [9, 0.82], [10, 0.55], [11.5, 0.36], [12.5, 0.5], [14, 0.68],
  [16, 0.78], [17.5, 0.82], [19, 0.72],
];
const FLARE: Keys = [
  [0, 0.25], [3, 0.3], [5, 0.42], [7, 0.6], [8, 0.85], [8.8, 0.68],
  [10, 0.35], [12, 0.25], [13.5, 0.55], [15, 0.4], [17.5, 0.5], [19, 0.4],
];
// Version 1: steady forward flight.
const SPEED_REFERENCE: Keys = [[0, 1.4], [19, 1.4]];
// Version 2: the camera surges through the bright section, then eases off.
const SPEED_ORBIT: Keys = [
  [0, 1.2], [4, 1.5], [7.5, 2.0], [9.5, 1.9], [12, 1.4], [19, 1.25],
];

type Camera = { center: [number, number]; roll: number; travel: number };

const cameraAt = (mode: WarpTunnelProps["camera"], t: number, duration: number): Camera => {
  if (mode === "reference") {
    // Vanishing point sits slightly left of and above centre, drifting gently.
    return {
      center: [
        -0.13 + 0.035 * Math.sin(0.33 * t),
        0.06 - 0.03 * Math.sin(0.45 * t + 1.0),
      ],
      roll: 0.025 * t,
      travel: integrateKeys(SPEED_REFERENCE, t),
    };
  }
  // Banking orbit: the vanishing point sweeps a figure-eight across the frame
  // while the camera rolls into each turn, as if steering through a winding
  // tunnel.
  const u = (Math.PI * 2 * t) / duration;
  return {
    center: [0.28 * Math.sin(u), 0.13 * Math.sin(2 * u)],
    roll: -0.45 * Math.sin(u) + 0.5 * (t / duration) * Math.PI,
    travel: integrateKeys(SPEED_ORBIT, t),
  };
};

export const WarpTunnel: React.FC<WarpTunnelProps> = ({
  camera,
  deep,
  violet,
  lavender,
  cyan,
  blue,
  pink,
  renderScale,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const cam = cameraAt(camera, t, durationInFrames / fps);

  return (
    <ShaderCanvas
      fragmentShader={warpFragmentShader}
      renderScale={renderScale}
      uniforms={{
        uCenter: cam.center,
        uRoll: cam.roll,
        uTravel: cam.travel,
        uDensity: sampleKeys(DENSITY, t),
        uFlare: sampleKeys(FLARE, t),
        uHole: 0.13,
        uDeep: deep,
        uViolet: violet,
        uLavender: lavender,
        uCyan: cyan,
        uBlue: blue,
        uPink: pink,
      }}
    />
  );
};
