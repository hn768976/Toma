import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Background } from "./components/Background";
import { Overlays } from "./components/Overlays";
import { Panel } from "./components/Panel";
import { css } from "./lib/color";
import { COLORS, PLANE } from "./lib/design";
import { getSceneState, type Outcome } from "./lib/timeline";
import { useScale } from "./lib/useScale";

export type PasswordHudProps = {
  outcome: Outcome;
};

/**
 * The whole scene is real DOM under one `perspective` container: the panel and
 * the background are flat planes at a fixed angle, so the type stays vector and
 * the 4K render is genuinely 4K. The camera never moves independently of the
 * plane.
 */
export const PasswordHud: React.FC<PasswordHudProps> = ({ outcome }) => {
  const frame = useCurrentFrame();
  const px = useScale();
  const state = getSceneState(frame, outcome);

  return (
    <AbsoluteFill style={{ backgroundColor: "#03080f" }}>
      {/* The ground the texture sits on. It lives outside the 3D container: in a
          preserve-3d context painting order follows depth, and an opaque plane
          at z=0 would hide every slice behind it. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 82% 66% at 50% 46%, ${css(
            COLORS.bgLiftFloor,
          )} 0%, ${css(COLORS.bgDeepFloor)} 62%, #00040b 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          perspective: px(PLANE.perspective),
          perspectiveOrigin: "50% 44%",
        }}
      >
        <AbsoluteFill
          style={{
            transformStyle: "preserve-3d",
            transform: `scale(${PLANE.coverScale}) rotateX(${PLANE.rotateX}deg) rotateZ(${PLANE.rotateZ}deg)`,
          }}
        >
          <Background accent={state.accent} accentColor={state.base} />

          {/* Shallow depth of field: the panel stays sharp, everything behind
              it softens toward the frame edges. One backdrop pass rather than a
              blurred duplicate of the texture. */}
          <div
            style={{
              position: "absolute",
              inset: px(-500),
              backdropFilter: `blur(${px(22)}px)`,
              WebkitBackdropFilter: `blur(${px(22)}px)`,
              maskImage:
                "radial-gradient(ellipse 58% 54% at 50% 47%, rgba(0,0,0,0) 34%, rgba(0,0,0,1) 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 58% 54% at 50% 47%, rgba(0,0,0,0) 34%, rgba(0,0,0,1) 100%)",
              pointerEvents: "none",
            }}
          />

          <Panel frame={frame} outcome={outcome} state={state} px={px} />
        </AbsoluteFill>
      </AbsoluteFill>

      <Overlays />
    </AbsoluteFill>
  );
};
