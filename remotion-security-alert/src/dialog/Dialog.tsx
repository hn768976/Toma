import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import {
  BEATS,
  COLORS,
  PASSWORD_LENGTH,
  USERNAME,
  type Accent,
} from "../theme";
import { alpha } from "../color";
import { DIALOG } from "./metrics";
import { typeSchedule, typedCount } from "./typing";
import { Field } from "./Field";
import { Footer, TitleBar } from "./Chrome";
import { AlertGraphic } from "./AlertGraphic";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Stage = "form" | "flash" | "cleared" | "alert";

const stageAt = (frame: number): Stage => {
  if (frame < BEATS.flash) return "form";
  if (frame < BEATS.cleared) return "flash";
  if (frame < BEATS.alert) return "cleared";
  return "alert";
};

/**
 * The login window. One component drives both outcomes — only `accent`
 * differs between the two compositions, plus the glyph and caps it
 * resolves to.
 */
export const Dialog: React.FC<{ accent: Accent }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const stage = stageAt(frame);

  const userSchedule = useMemo(
    () =>
      typeSchedule(
        "username",
        USERNAME.length,
        BEATS.username.from,
        BEATS.username.to,
      ),
    [],
  );
  const passSchedule = useMemo(
    () =>
      typeSchedule(
        "password",
        PASSWORD_LENGTH,
        BEATS.password.from,
        BEATS.password.to,
      ),
    [],
  );

  const typedUser = USERNAME.slice(0, typedCount(frame, userSchedule));
  const typedPass = "*".repeat(typedCount(frame, passSchedule));

  const userActive = frame < BEATS.password.from;
  const passActive = frame >= BEATS.password.from;
  const caretOn = Math.floor(frame / 8) % 2 === 0;
  const flash = stage === "flash" ? 1 : 0;

  const enter = interpolate(
    frame,
    [BEATS.dialogIn.from, BEATS.dialogIn.to],
    [0, 1],
    { ...CLAMP, easing: Easing.out(Easing.cubic) },
  );

  return (
    <div
      style={{
        width: DIALOG.width,
        height: DIALOG.height,
        opacity: enter,
        transform: `scale(${(0.965 + enter * 0.035).toFixed(4)})`,
        display: "flex",
        flexDirection: "column",
        background: COLORS.dialogBody,
        border: `${DIALOG.border}px solid ${COLORS.dialogBorder}`,
        outline: `10px solid ${alpha("#03161c", 0.85)}`,
        boxShadow: `0 40px 120px ${alpha("#000000", 0.6)}, 0 0 90px ${alpha(COLORS.dialogBorder, 0.18)}`,
        boxSizing: "border-box",
      }}
    >
      <TitleBar accent={accent} />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: DIALOG.fieldGap,
          // The blow-out lifts the whole body for two frames, not just
          // the fields, so the cut lands as one event.
          background: flash
            ? alpha(COLORS.white, 0.22)
            : COLORS.dialogBody,
          overflow: "hidden",
        }}
      >
        {stage === "form" || stage === "flash" ? (
          <>
            <Field
              text={typedUser}
              active={userActive}
              caretVisible={userActive && caretOn && !flash}
              flash={flash}
            />
            <Field
              text={typedPass}
              active={passActive}
              caretVisible={passActive && caretOn && !flash}
              flash={flash}
              mask
            />
          </>
        ) : null}

        {stage === "alert" ? <AlertGraphic accent={accent} /> : null}
      </div>

      <Footer accent={accent} />
    </div>
  );
};
