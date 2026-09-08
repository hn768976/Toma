import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  CAM_DISTANCE,
  FLAT_HEIGHT,
  FLAT_WIDTH,
  OVERSCAN,
  P_MAX,
  type Palette,
  THETA_MAX,
} from "./constants";
import { drawFlat } from "./draw-flat";
import { createWarper, type WarpParams, type Warper } from "./warp";

const WARP_PARAMS: WarpParams = {
  thetaMax: THETA_MAX,
  camDistance: CAM_DISTANCE,
  pMax: P_MAX,
  overscan: OVERSCAN,
  grain: 0.021,
  vignette: 0.68,
  edgeFalloff: 0.5,
};

export const CurvedMapDisplay: React.FC<{ palette: Palette }> = ({
  palette,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const outputRef = useRef<HTMLCanvasElement>(null);
  const flatRef = useRef<HTMLCanvasElement | null>(null);
  const warperRef = useRef<Warper | null>(null);

  // The whole pipeline — flat composite, then warp — runs synchronously here,
  // so it is complete before the browser paints and Remotion captures.
  useLayoutEffect(() => {
    const output = outputRef.current;
    if (!output) return;

    if (!flatRef.current) {
      const flat = document.createElement("canvas");
      flat.width = FLAT_WIDTH;
      flat.height = FLAT_HEIGHT;
      flatRef.current = flat;
    }
    const flat = flatRef.current;
    const ctx = flat.getContext("2d", { alpha: false });
    if (!ctx) return;

    drawFlat(ctx, frame, palette);

    if (!warperRef.current) {
      warperRef.current = createWarper(output);
    }
    warperRef.current.render(flat, frame, WARP_PARAMS);
  }, [frame, palette, width, height]);

  return (
    <canvas
      ref={outputRef}
      width={width}
      height={height}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        backgroundColor: palette.bgOuter,
      }}
    />
  );
};
