import React from "react";
import { useCurrentFrame } from "remotion";
import { MONO } from "../fonts";
import { BEATS, COLORS, type Accent } from "../theme";
import { alpha, mix } from "../color";
import { DIALOG } from "./metrics";

/** Title bar: status square, then the window's caption in small bold caps. */
export const TitleBar: React.FC<{ accent: Accent }> = ({ accent }) => {
  const frame = useCurrentFrame();
  // Green while the form is live; blinks in the accent once it resolves.
  const resolved = frame >= BEATS.alert;
  const blink = Math.floor(frame / 9) % 2 === 0;
  const square = resolved
    ? blink
      ? accent.color
      : mix(accent.colorDeep, COLORS.dialogTitleBar, 0.4)
    : COLORS.successGreen;

  return (
    <div
      style={{
        height: DIALOG.titleBar,
        background: COLORS.dialogTitleBar,
        borderBottom: `2px solid ${alpha(COLORS.dialogBorder, 0.55)}`,
        display: "flex",
        alignItems: "center",
        gap: DIALOG.titleBar * 0.28,
        paddingLeft: DIALOG.titleBar * 0.26,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: DIALOG.titleBar * 0.36,
          height: DIALOG.titleBar * 0.36,
          background: square,
        }}
      />
      <div
        style={{
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: DIALOG.titleBar * 0.36,
          letterSpacing: "0.07em",
          color: COLORS.white,
        }}
      >
        USERNAME AND PASSWORD
      </div>
    </div>
  );
};

const Button: React.FC<{ label: string; accent: Accent }> = ({
  label,
  accent,
}) => {
  const frame = useCurrentFrame();
  const lit = frame >= BEATS.alert && Math.floor(frame / 7) % 2 === 0;

  return (
    <div
      style={{
        width: DIALOG.button.width,
        height: DIALOG.button.height,
        background: "#3a3550",
        display: "flex",
        alignItems: "center",
        gap: DIALOG.button.height * 0.22,
        paddingLeft: DIALOG.button.height * 0.18,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: DIALOG.button.indicator,
          height: DIALOG.button.indicator,
          background: lit ? accent.color : COLORS.alertRed,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          flex: 1,
          textAlign: "center",
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: DIALOG.button.height * 0.46,
          letterSpacing: "0.03em",
          color: COLORS.white,
          paddingRight: DIALOG.button.indicator * 0.6,
        }}
      >
        {label}
      </div>
    </div>
  );
};

/** Footer: the `connect` / `AUTO` pair, each with its indicator block. */
export const Footer: React.FC<{ accent: Accent }> = ({ accent }) => (
  <div
    style={{
      height: DIALOG.footer,
      background: COLORS.dialogTitleBar,
      borderTop: `2px solid ${alpha(COLORS.dialogBorder, 0.55)}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-evenly",
      flexShrink: 0,
    }}
  >
    <Button label="connect" accent={accent} />
    <Button label="AUTO" accent={accent} />
  </div>
);
