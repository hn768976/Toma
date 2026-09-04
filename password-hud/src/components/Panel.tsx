import React from "react";
import { Easing, interpolate } from "remotion";
import { mixRgb, rgba } from "../lib/color";
import { COLORS, PANEL } from "../lib/design";
import type { Outcome, SceneState } from "../lib/timeline";
import { panelEntrance } from "../lib/timeline";
import { ConfirmTicks, CornerBrackets, PulseRings, ScanLine, TickRow } from "./HudDetail";
import { PasswordField } from "./PasswordField";
import { Shield } from "./Shield";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Panel: React.FC<{
  frame: number;
  outcome: Outcome;
  state: SceneState;
  px: (v: number) => number;
}> = ({ frame, outcome, state, px }) => {
  const entrance = panelEntrance(frame);
  const resolveMix =
    outcome === "granted"
      ? interpolate(frame, [240, 255], [0, 1], { easing: Easing.bezier(0.65, 0, 0.35, 1), ...clamp })
      : state.flash;

  const settled = outcome === "granted" ? COLORS.green : COLORS.red;
  const hud = mixRgb(COLORS.hud, settled, resolveMix);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: px(PANEL.centerY),
        width: px(PANEL.width),
        height: px(PANEL.height),
        marginLeft: px(-PANEL.width / 2),
        marginTop: px(-PANEL.height / 2),
        opacity: entrance.opacity,
        transform: `translateY(${px(entrance.rise)}px) scale(${entrance.scale})`,
      }}
    >
      {/* Faint glow sitting behind the card. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: px(PANEL.width * 1.5),
          height: px(PANEL.height * 2.2),
          marginLeft: px(-PANEL.width * 0.75),
          marginTop: px(-PANEL.height * 1.1),
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${rgba(
            mixRgb(COLORS.hud, settled, resolveMix),
            0.16 + resolveMix * 0.12 + state.glow * 0.08,
          )} 0%, ${rgba(COLORS.hud, 0)} 70%)`,
        }}
      />

      <PulseRings frame={frame} color={state.color} px={px} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(160deg, ${rgba(COLORS.panel, 0.88)} 0%, ${rgba(
            COLORS.panel,
            0.82,
          )} 55%, rgba(4, 9, 17, 0.9) 100%)`,
          border: `${px(PANEL.border)}px solid ${rgba(hud, 0.72 + resolveMix * 0.25)}`,
          borderRadius: px(PANEL.radius),
          boxShadow: `0 0 ${px(70 + resolveMix * 80)}px ${rgba(hud, 0.12 + resolveMix * 0.2)}`,
          overflow: "hidden",
        }}
      >
        {/* Thin highlight along the top inside edge — reads as a lit surface. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: px(1.5),
            background: `linear-gradient(to right, ${rgba(hud, 0)} 0%, ${rgba(
              hud,
              0.5,
            )} 30%, ${rgba(hud, 0.5)} 70%, ${rgba(hud, 0)} 100%)`,
          }}
        />
        <ScanLine frame={frame} color={hud} px={px} />
        <TickRow color={hud} px={px} count={44} />
        <TickRow color={hud} px={px} count={44} bottom />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            paddingLeft: px(PANEL.padding),
            paddingRight: px(PANEL.padding),
          }}
        >
          <div
            style={{
              width: px(PANEL.shieldColumn),
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Shield size={392} color={state.color} base={state.base} glow={state.glow} px={px} />
          </div>

          {/* Divider between the shield and the entry column. */}
          <div
            style={{
              width: px(2),
              height: px(PANEL.height * 0.62),
              background: `linear-gradient(to bottom, ${rgba(hud, 0)} 0%, ${rgba(
                hud,
                0.45,
              )} 50%, ${rgba(hud, 0)} 100%)`,
              marginRight: px(96),
            }}
          />

          <PasswordField frame={frame} outcome={outcome} state={state} px={px} />
        </div>

        {outcome === "granted" && <ConfirmTicks frame={frame} color={state.color} px={px} />}
      </div>

      <CornerBrackets color={hud} px={px} />
    </div>
  );
};
