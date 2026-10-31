import { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ShaderCanvas } from "../gl/ShaderCanvas";
import { CameraMode, cameraAt, sunScreen } from "./camera";
import { PLANET_FRAG } from "./planetShader";
import { sunPulse } from "./sunPulse";

export type PlanetSunriseProps = {
  camera: CameraMode;
};

export const PlanetSunrise: React.FC<PlanetSunriseProps> = ({ camera }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const uniforms = useMemo(() => {
    const cam = cameraAt(camera, frame, durationInFrames);
    return {
      uSunPulse: sunPulse(frame),
      uSunScreen: sunScreen(cam),
      uZoom: cam.zoom,
      uRoll: cam.roll,
      uPan: cam.pan,
    };
  }, [camera, frame, durationInFrames]);
  return <ShaderCanvas fragmentShader={PLANET_FRAG} uniforms={uniforms} />;
};
