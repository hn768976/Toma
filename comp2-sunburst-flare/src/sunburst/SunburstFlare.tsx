import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { GlCanvas } from "../gl/GlCanvas";
import { buildDiscs, computeScene, movingCamera, staticCamera } from "./scene";
import { LIGHT_CURVE } from "./lightCurve";
import { SUNBURST_FRAG } from "./shader";

export type SunburstProps = {
  /** "locked" = tripod framing of the reference; "pan" = alternative camera move */
  camera: "locked" | "pan";
};

const srgb = (r: number, g: number, b: number) =>
  [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

// Palette (shared by both versions — V2 changes the camera, not the colours)
const PALETTE = {
  uBgDark: srgb(48, 42, 32),
  uBgLight: srgb(124, 108, 92),
  uBgLow: srgb(96, 80, 120),
  uLeaf: srgb(112, 106, 34),
  uGlare: [0.43, 0.37, 0.38],
  uSunCol: [1.0, 0.96, 0.9],
  uRayCol: [0.55, 0.45, 0.3],
};

export const SunburstFlare: React.FC<SunburstProps> = ({ camera }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const discs = useMemo(() => buildDiscs(2024), []);

  const uniforms = useMemo(() => {
    const cam = camera === "pan" ? movingCamera(time, (durationInFrames - 1) / fps) : staticCamera();
    const sc = computeScene(discs, cam, time);
    return {
      uTime: time,
      uFrame: frame,
      uExposure: LIGHT_CURVE[Math.min(frame, LIGHT_CURVE.length - 1)],
      uCam: [cam.x, cam.y, cam.zoom, cam.roll],
      uSun: sc.sunScreen,
      uSunPow: sc.sunPow,
      uRayRot: sc.rayRot,
      uDiscCount: discs.length,
      uDisc: sc.discPos,
      uDiscCol: sc.discCol,
      uGhostCount: 7,
      uGhost: sc.ghost,
      uGhostCol: sc.ghostCol,
      uGhostShape: sc.ghostShape,
      ...PALETTE,
    };
  }, [camera, discs, durationInFrames, fps, frame, time]);

  return <GlCanvas fragment={SUNBURST_FRAG} uniforms={uniforms} />;
};
