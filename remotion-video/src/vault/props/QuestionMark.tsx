// The teal question mark that hangs top-right from cue 12 until the hormone
// answers it in cue 15.

import React from "react";
import { FONT_STACK, PALETTE } from "../constants";
import { Glow } from "../Glow";

export const QuestionMark: React.FC<{ pulse: number }> = ({ pulse }) => (
  <>
    <Glow color={PALETTE.teal} size={520} opacity={0.3 + 0.1 * pulse} />
    <div
      style={{
        position: "absolute",
        left: -140,
        top: -190,
        width: 280,
        height: 340,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_STACK,
        fontWeight: 700,
        fontSize: 300,
        lineHeight: 1,
        color: PALETTE.teal,
      }}
    >
      ?
    </div>
  </>
);
