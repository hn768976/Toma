import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { useThreeScene } from "../lib/useThreeScene";
import { makeDataWallBuilder } from "./buildDataWall";
import { AMBER_TEAL, STEEL_BLUE } from "./palettes";
import { LOW_ANGLE_DRIFT } from "./cameraRigs";

export type CyberDataWallProps = { variant: "v1" | "v2" };

export const CyberDataWall: React.FC<CyberDataWallProps> = ({ variant }) => {
  const builder = useMemo(
    () =>
      makeDataWallBuilder(
        variant === "v1" ? STEEL_BLUE : AMBER_TEAL,
        LOW_ANGLE_DRIFT,
      ),
    [variant],
  );
  const canvasRef = useThreeScene(builder);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
