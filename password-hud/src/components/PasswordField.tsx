import React from "react";
import { Easing, interpolate } from "remotion";
import { mixRgb, rgba, type Rgb } from "../lib/color";
import { COLORS, FONTS, PANEL } from "../lib/design";
import {
  LABEL,
  MASK_LENGTH,
  filledCount,
  keystrokeFrames,
  labelCharStart,
  type Outcome,
  type SceneState,
} from "../lib/timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.out(Easing.cubic);

const Caret: React.FC<{ frame: number; color: Rgb; px: (v: number) => number }> = ({
  frame,
  color,
  px,
}) => (
  <div
    style={{
      width: px(PANEL.maskSize * 0.12),
      height: px(PANEL.maskSize * 1.02),
      background: rgba(color, frame % 18 < 11 ? 0.85 : 0.12),
      marginLeft: px(PANEL.maskSize * 0.16),
      boxShadow: `0 0 ${px(14)}px ${rgba(color, 0.4)}`,
    }}
  />
);

export const PasswordField: React.FC<{
  frame: number;
  outcome: Outcome;
  state: SceneState;
  px: (v: number) => number;
}> = ({ frame, outcome, state, px }) => {
  // How far the field has taken on the state colour: the cross-fade on a
  // granted entry, the rejection flash on a denied one.
  const resolveMix =
    outcome === "granted"
      ? interpolate(frame, [240, 255], [0, 1], { easing: Easing.bezier(0.65, 0, 0.35, 1), ...clamp })
      : state.flash;

  // The HUD furniture cross-fades straight to the settled state colour rather
  // than tracking the shield through amber.
  const settled = outcome === "granted" ? COLORS.green : COLORS.red;
  const borderColor = mixRgb(COLORS.hud, settled, resolveMix);
  const maskColor = mixRgb(COLORS.white, settled, resolveMix * (outcome === "granted" ? 0.85 : 0.4));
  const filled = filledCount(frame, outcome);

  const typingCaret = frame >= 84 && frame < 240;
  const emptyCaret = outcome === "denied" && frame >= 292;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div
        style={{
          display: "flex",
          fontFamily: FONTS.hud,
          fontWeight: 600,
          fontSize: px(PANEL.labelSize),
          letterSpacing: px(PANEL.labelSize * PANEL.labelTracking),
          color: rgba(mixRgb(COLORS.white, settled, resolveMix * 0.35), 0.94),
          lineHeight: 1,
          marginBottom: px(46),
        }}
      >
        {LABEL.split("").map((char, i) => {
          const start = labelCharStart(i);
          return (
            <span
              key={i}
              style={{
                opacity: interpolate(frame, [start, start + 5], [0, 1], clamp),
                transform: `translateY(${px(
                  interpolate(frame, [start, start + 8], [10, 0], { easing: easeOut, ...clamp }),
                )}px)`,
              }}
            >
              {char}
            </span>
          );
        })}
      </div>

      <div
        style={{
          position: "relative",
          width: px(PANEL.fieldWidth),
          height: px(PANEL.fieldHeight),
          border: `${px(3)}px solid ${rgba(borderColor, 0.55 + resolveMix * 0.45)}`,
          background: rgba(mixRgb(COLORS.bgDeep, settled, resolveMix * 0.1), 0.5),
          boxShadow: `0 0 ${px(30 + resolveMix * 90)}px ${rgba(
            borderColor,
            0.1 + resolveMix * 0.4,
          )}, inset 0 0 ${px(50)}px ${rgba(borderColor, 0.06 + resolveMix * 0.1)}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: px(42),
          overflow: "hidden",
        }}
      >
        {/* Field corner ticks */}
        {[
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ].map(([cx, cy], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx ? undefined : px(10),
              right: cx ? px(10) : undefined,
              top: cy ? undefined : px(10),
              bottom: cy ? px(10) : undefined,
              width: px(14),
              height: px(14),
              borderTop: cy ? undefined : `${px(2)}px solid ${rgba(borderColor, 0.7)}`,
              borderBottom: cy ? `${px(2)}px solid ${rgba(borderColor, 0.7)}` : undefined,
              borderLeft: cx ? undefined : `${px(2)}px solid ${rgba(borderColor, 0.7)}`,
              borderRight: cx ? `${px(2)}px solid ${rgba(borderColor, 0.7)}` : undefined,
            }}
          />
        ))}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            transform: `translateX(${px(Math.sin(frame * 2.55) * state.shake)}px)`,
          }}
        >
          {Array.from({ length: MASK_LENGTH }).map((_, i) => {
            if (i >= filled) return null;
            const at = keystrokeFrames[i];
            const pop = interpolate(frame, [at, at + 5], [1.35, 1], { easing: easeOut, ...clamp });
            const fade = interpolate(frame, [at, at + 3], [0, 1], clamp);
            const shake =
              state.shake === 0 ? 0 : Math.sin(frame * 2.55 + i * 0.22) * state.shake * 0.35;
            return (
              <span
                key={i}
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: px(PANEL.maskSize),
                  lineHeight: 1,
                  letterSpacing: px(PANEL.maskSize * PANEL.maskTracking),
                  color: rgba(maskColor, 0.92 * fade),
                  textShadow: `0 0 ${px(18 + resolveMix * 34)}px ${rgba(
                    maskColor,
                    0.35 + resolveMix * 0.4,
                  )}`,
                  transform: `translate(${px(shake)}px, ${px(
                    PANEL.maskSize * 0.2,
                  )}px) scale(${pop})`,
                  display: "inline-block",
                }}
              >
                *
              </span>
            );
          })}
          {(typingCaret || emptyCaret) && <Caret frame={frame} color={borderColor} px={px} />}
        </div>
      </div>
    </div>
  );
};
