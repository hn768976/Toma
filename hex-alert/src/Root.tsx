import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { HexScene } from "./HexScene";
import "./font";
import { CYAN_THEME, GREEN_THEME } from "./themes";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-HexAlertsCyan"
        component={HexScene}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ theme: CYAN_THEME, showAlerts: true }}
      />
      <Composition
        id="V2-HexAlertsGreen"
        component={HexScene}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ theme: GREEN_THEME, showAlerts: true }}
      />
      <Composition
        id="V3-HexDataPlate"
        component={HexScene}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ theme: CYAN_THEME, showAlerts: false }}
      />
    </>
  );
};
