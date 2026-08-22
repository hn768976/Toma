// On-screen type: Nunito 700, cream, lowercase, never more than three words.

import React from "react";
import { FONT_STACK, PALETTE } from "../constants";

export const Label: React.FC<{ text: string; size?: number }> = ({
  text,
  size = 72,
}) => (
  <div
    style={{
      position: "absolute",
      left: -700,
      top: -size * 0.6,
      width: 1400,
      textAlign: "center",
      fontFamily: FONT_STACK,
      fontWeight: 700,
      fontSize: size,
      lineHeight: 1.2,
      letterSpacing: "-0.01em",
      color: PALETTE.cream,
      textTransform: "lowercase",
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);
