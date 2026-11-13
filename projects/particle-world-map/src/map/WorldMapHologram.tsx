import { useMemo } from "react";
import { GLCanvas } from "../lib/GLCanvas";
import { type CameraMode, makeWorldMapFactory } from "./scene";

export type WorldMapHologramProps = { camera: CameraMode };

export const WorldMapHologram: React.FC<WorldMapHologramProps> = ({ camera }) => {
  const factory = useMemo(() => makeWorldMapFactory(camera), [camera]);
  return <GLCanvas factory={factory} />;
};
