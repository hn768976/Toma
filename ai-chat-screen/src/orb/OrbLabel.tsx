import React from "react";

import { SANS_FAMILY } from "../fonts";
import type { Layout } from "../layout";

// `AI` set large and light with `Chat` smaller beneath, centred on the
// orb. Glow lives here and on the orb only — never on the code.
export const OrbLabel: React.FC<{ layout: Layout; glow: string }> = ({ layout, glow }) => {
  const { orbCenterX, orbCenterY, height } = layout;
  const aiSize = Math.round(height * 0.088);
  const chatSize = Math.round(height * 0.034);

  return (
    <div
      style={{
        position: "absolute",
        left: orbCenterX,
        top: orbCenterY,
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: "#ffffff",
        fontFamily: `${SANS_FAMILY}, system-ui, sans-serif`,
        textShadow: `0 0 ${aiSize * 0.42}px ${glow}cc, 0 0 ${aiSize * 0.16}px rgba(255,255,255,0.45)`,
      }}
    >
      <span
        style={{
          fontWeight: 200,
          fontSize: aiSize,
          letterSpacing: aiSize * 0.06,
          lineHeight: 1,
          textIndent: aiSize * 0.06,
        }}
      >
        AI
      </span>
      <span
        style={{
          fontWeight: 300,
          fontSize: chatSize,
          letterSpacing: chatSize * 0.32,
          lineHeight: 1,
          marginTop: chatSize * 0.5,
          textIndent: chatSize * 0.32,
          opacity: 0.92,
        }}
      >
        Chat
      </span>
    </div>
  );
};
