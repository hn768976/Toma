import React from "react";
import { PLANE_HEIGHT, PLANE_WIDTH, UI } from "../constants";
import { hash } from "../noise";

// Screen area beyond the laid-out UI.
//
// At this angle the perspective drags a surprising amount of off-layout
// surface into the corners of the frame. Without this, the plane's own
// edge is visible as a hard diagonal into black and the shot reads as a
// floating rectangle rather than as a crop of something larger. None of
// it is meant to be legible — it just has to keep going.
const BLEED_X = 1500;
const BLEED_Y = 900;

export const PlaneBleed: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: -BLEED_X,
      top: -BLEED_Y,
      width: PLANE_WIDTH + BLEED_X * 2,
      height: PLANE_HEIGHT + BLEED_Y * 2,
      background: UI.deck,
      filter: "blur(7px)",
      zIndex: -1,
    }}
  >
    {Array.from({ length: 26 }, (_, i) => {
      const w = 260 + hash(i, 5) * 900;
      const h = 120 + hash(i, 9) * 460;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: hash(i, 1) * (PLANE_WIDTH + BLEED_X * 2 - w),
            top: hash(i, 3) * (PLANE_HEIGHT + BLEED_Y * 2 - h),
            width: w,
            height: h,
            background: hash(i, 11) > 0.5 ? UI.panel : UI.panelLo,
            border: `1px solid rgba(126,160,190,0.07)`,
            borderRadius: 6,
            opacity: 0.34,
          }}
        />
      );
    })}
  </div>
);
