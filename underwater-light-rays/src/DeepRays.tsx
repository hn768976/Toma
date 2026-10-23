import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ShaderCanvas } from "./gl/ShaderCanvas";
import { DEEP_RAYS_FRAG } from "./shaders/deepRays";

export type CameraMove = "locked" | "tiltReveal";

type Props = {
  camera: CameraMove;
};

// Slow "breathing" of the light, fitted to the reference's brightness curve
// (dominant periods 10, 6.7, 4 and 2.5 s, phases matched so the swells land
// at the same moments as in the reference).
const pulse = (t: number) =>
  1 +
  0.08 * Math.sin((2 * Math.PI * t) / 10 - 2.677) +
  0.08 * Math.sin((2 * Math.PI * t) / 6.7 + 0.316) +
  0.07 * Math.sin((2 * Math.PI * t) / 4 + 0.942) +
  0.06 * Math.sin((2 * Math.PI * t) / 2.5 + 1.973);

// Per-second exposure correction, measured by comparing this scene's frame
// brightness with the reference's at each second. Brings the procedural rays'
// slow drift in line with the reference's overall light over the 20 seconds.
const EXPOSURE = [
  1.08, 1.03, 1.0, 1.01, 0.97, 0.91, 0.9, 0.89, 0.93, 1.04, 1.1, 1.12, 1.1,
  1.2, 1.24, 1.26, 1.24, 1.17, 1.2, 1.24, 1.23,
];
const exposure = (t: number) =>
  interpolate(
    t,
    EXPOSURE.map((_, i) => i),
    EXPOSURE,
    { easing: Easing.inOut(Easing.sin), extrapolateRight: "clamp" },
  );

const ease = Easing.inOut(Easing.sin);

export const DeepRays: React.FC<Props> = ({ camera }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const cam = useMemo(() => {
    if (camera === "locked") {
      return [0, 0, 1, 0] as const;
    }
    // A diver's view: starts rolled and looking down into the dark, then
    // tilts up and pulls back to a wide shot with the light entering frame.
    const range = [0, durationInFrames - 1];
    const opts = { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
    return [
      interpolate(frame, range, [0.04, 0.2], opts),
      interpolate(frame, range, [-0.06, 0.12], opts),
      interpolate(frame, range, [1.18, 0.94], opts),
      interpolate(frame, range, [0.2, -0.06], opts),
    ] as const;
  }, [camera, frame, durationInFrames]);

  const uniforms = useMemo(
    () => ({
      uCam: cam,
      uLightPos: [1.66, 1.13],
      uRaySource: [2.9, 3.3],
      uPulse: pulse(t) * exposure(t),
      uColDeep: [0.0, 0.0, 0.012],
      uColWater: [0.0, 0.2, 0.36],
      uColRay: [0.32, 0.69, 0.86],
      uColCore: [0.8, 0.98, 1.0],
    }),
    [cam, t],
  );

  return <ShaderCanvas fragmentShader={DEEP_RAYS_FRAG} uniforms={uniforms} />;
};
