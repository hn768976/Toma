import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import "./fonts";
import { SCROLL_PX_PER_FRAME } from "./constants";
import { THEMES, type ThemeName } from "./theme";
import { Backdrop } from "./Backdrop";
import { BoardPlane } from "./board/BoardPlane";
import { Grade } from "./Grade";

export type CommoditiesBoardProps = { theme: ThemeName };

export const CommoditiesBoard: React.FC<CommoditiesBoardProps> = ({
  theme: themeName,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const theme = THEMES[themeName];

  // Linear, unbroken auto-scroll: easing here would make the board read as an
  // animation rather than a screen. 8px per frame x 480 frames = one exact
  // cycle, so frame 480 is frame 0 again.
  const scroll = frame * SCROLL_PX_PER_FRAME;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.backgroundTo, overflow: "hidden" }}>
      <Backdrop theme={theme} frame={frame} frameWidth={width} />
      <BoardPlane frame={frame} scroll={scroll} theme={theme} frameWidth={width} />
      <Grade theme={theme} frame={frame} />
    </AbsoluteFill>
  );
};
