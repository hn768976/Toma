import React from "react";
import { BAR_FONT_SIZE, BAR_HEIGHT, COL_NAME_X, PLANE_WIDTH } from "../constants";
import { FONT_TEXT } from "../fonts";
import type { Theme } from "../theme";

/**
 * A physical strip laid over the list: a gradient face, a thin highlight along
 * the top edge and a drop shadow onto the rows beneath. These are the strongest
 * visual rhythm in the frame, so they get the bloom on the dark version.
 */
export const SectionBar: React.FC<{ title: string; theme: Theme }> = ({
  title,
  theme,
}) => (
  <div style={{ position: "relative", width: PLANE_WIDTH, height: BAR_HEIGHT }}>
    {theme.bloomOpacity > 0 ? (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: BAR_HEIGHT * 0.15,
          width: PLANE_WIDTH,
          height: BAR_HEIGHT * 0.7,
          background: theme.barFrom,
          filter: `blur(${BAR_HEIGHT * 0.42}px)`,
          opacity: theme.bloomOpacity,
        }}
      />
    ) : null}
    <div
      style={{
        position: "absolute",
        left: 0,
        top: BAR_HEIGHT * 0.19,
        width: PLANE_WIDTH,
        height: BAR_HEIGHT * 0.62,
        background: `linear-gradient(to bottom, ${theme.barFrom} 0%, ${theme.barFrom} 26%, ${theme.barTo} 100%)`,
        boxShadow: `0 ${BAR_HEIGHT * 0.06}px ${BAR_HEIGHT * 0.16}px ${theme.barShadow}`,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: 3,
          background: theme.barHighlight,
        }}
      />
      <span
        style={{
          marginLeft: COL_NAME_X - 90,
          fontFamily: FONT_TEXT,
          fontWeight: 700,
          fontSize: BAR_FONT_SIZE,
          letterSpacing: BAR_FONT_SIZE * 0.13,
          color: theme.barText,
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </span>
    </div>
  </div>
);
