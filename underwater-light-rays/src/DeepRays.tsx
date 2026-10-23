import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ShaderCanvas } from "./gl/ShaderCanvas";
import { DEEP_RAYS_FRAG } from "./shaders/deepRays";

export type CameraMove = "locked" | "tiltReveal";

type Props = {
  camera: CameraMove;
};

// Matches the slow "breathing" of the reference's light (about +-20% over
// 2-5 s cycles). Periods divide nothing in particular, so it never looks looped.
const pulse = (t: number) =>
  1 +
  0.11 * Math.sin((2 * Math.PI * t) / 3.4 + 0.4) +
  0.07 * Math.sin((2 * Math.PI * t) / 5.3 + 1.9) +
  0.05 * Math.sin((2 * Math.PI * t) / 2.2 + 2.6);

const ease = Easing.inOut(Easing.sin);

export const DeepRays: React.FC<Props> = ({ camera }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const cam = useMemo(() => {
    if (camera === "locked") {
      return [0, 0, 1, 0] as const;
    }
    // Tilt up and pan towards the light from the darker lower left, easing
    // out of a slight push-in into a wider framing that brings the light
    // source into frame, with a gentle roll.
    const range = [0, durationInFrames - 1];
    const opts = { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
    return [
      interpolate(frame, range, [-0.2, 0.14], opts),
      interpolate(frame, range, [-0.22, 0.1], opts),
      interpolate(frame, range, [1.16, 1.0], opts),
      interpolate(frame, range, [0.06, -0.035], opts),
    ] as const;
  }, [camera, frame, durationInFrames]);

  const uniforms = useMemo(
    () => ({
      uCam: cam,
      uLightPos: [1.69, 1.06],
      uPulse: pulse(t),
      uColDeep: [0.0, 0.0, 0.012],
      uColWater: [0.0, 0.2, 0.36],
      uColRay: [0.32, 0.69, 0.86],
      uColCore: [0.8, 0.98, 1.0],
    }),
    [cam, t],
  );

  return <ShaderCanvas fragmentShader={DEEP_RAYS_FRAG} uniforms={uniforms} />;
};
