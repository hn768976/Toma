import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { z } from "zod";
import { ShaderCanvas, Uniforms } from "./ShaderCanvas";
import { smokeFragmentShader } from "./smokeShader";

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const smokePortalSchema = z.object({
  inner: rgb,
  outer: rgb,
  core: rgb,
  hole: rgb,
  flareL: rgb,
  flareR: rgb,
  /** "static" = locked-off reference framing, "dolly" = push-in with roll and parallax. */
  camera: z.enum(["static", "dolly"]),
  /** 1 = full 4K shader resolution. Lower only for quick previews. */
  internalScale: z.number().min(0.05).max(1),
});

export type SmokePortalProps = z.infer<typeof smokePortalSchema>;

/** Version 1 - matches the reference: locked-off camera, magenta / violet smoke. */
export const smokePortalV1: SmokePortalProps = {
  inner: [1.6, 0.025, 0.5],
  outer: [0.11, 0.065, 0.85],
  core: [2.4, 1.5, 2.3],
  hole: [0.07, 0.006, 0.035],
  flareL: [0.55, 0.22, 0.04],
  flareR: [0.45, 0.55, 0.62],
  camera: "static",
  internalScale: 1,
};

/**
 * Version 2 - alternative camera movement: the camera starts wide, dollies
 * into the portal while rolling, with depth parallax between the inner plume
 * and the outer cloud. Same palette, timing and effect as the reference.
 */
export const smokePortalV2: SmokePortalProps = {
  ...smokePortalV1,
  camera: "dolly",
};

const useCamera = (camera: SmokePortalProps["camera"], frame: number) => {
  if (camera === "static") {
    return { zoom: 1, roll: 0, pan: [0, 0] as [number, number], parallax: 0 };
  }
  const ease = Easing.bezier(0.45, 0, 0.25, 1);
  const zoom = interpolate(frame, [0, 300], [0.6, 1.35], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const roll = interpolate(frame, [0, 300], [-0.35, 0.55], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panX = interpolate(frame, [0, 300], [0.12, -0.03], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panY = interpolate(frame, [0, 300], [-0.05, 0.02], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { zoom, roll, pan: [panX, panY] as [number, number], parallax: 1 };
};

export const SmokePortal: React.FC<SmokePortalProps> = (props) => {
  const frame = useCurrentFrame();
  const cam = useCamera(props.camera, frame);
  const uniforms: Uniforms = useMemo(
    () => ({
      uZoom: cam.zoom,
      uRoll: cam.roll,
      uPan: cam.pan,
      uParallax: cam.parallax,
      uInner: props.inner,
      uOuter: props.outer,
      uCore: props.core,
      uHole: props.hole,
      uFlareL: props.flareL,
      uFlareR: props.flareR,
    }),
    [props, cam.zoom, cam.roll, cam.pan, cam.parallax],
  );
  return (
    <ShaderCanvas
      fragmentShader={smokeFragmentShader}
      uniforms={uniforms}
      internalScale={props.internalScale}
    />
  );
};
