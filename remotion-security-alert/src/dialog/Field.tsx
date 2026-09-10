import React from "react";
import { MONO } from "../fonts";
import { COLORS } from "../theme";
import { alpha, mix } from "../color";
import { DIALOG } from "./metrics";

/**
 * One input field. The caret is a solid block that blinks on a 16-frame
 * cycle, and the active field carries the small triangle marker from the
 * reference on its left.
 */
export const Field: React.FC<{
  text: string;
  active: boolean;
  caretVisible: boolean;
  /** 0..1 blow-out for the two-frame flash before the body clears. */
  flash: number;
  mask?: boolean;
}> = ({ text, active, caretVisible, flash, mask = false }) => {
  const fill = mix(active ? COLORS.fieldActive : COLORS.field, "#ffffff", flash);
  const fontSize = mask ? DIALOG.fieldHeight * 0.42 : DIALOG.fieldHeight * 0.47;

  return (
    <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
      <div
        style={{
          width: DIALOG.fieldPadding * 1.9,
          display: "flex",
          justifyContent: "flex-end",
          paddingRight: DIALOG.fieldPadding * 0.6,
          opacity: active ? 1 : 0,
        }}
      >
        <svg width={26} height={32} viewBox="0 0 26 32" aria-hidden>
          <path d="M 2 2 L 24 16 L 2 30 Z" fill={COLORS.fieldActive} />
        </svg>
      </div>

      <div
        style={{
          width: DIALOG.fieldWidth,
          height: DIALOG.fieldHeight,
          background: fill,
          borderRadius: 6,
          boxShadow: active
            ? `inset 0 0 0 2px ${alpha("#ffffff", 0.12)}`
            : undefined,
          display: "flex",
          alignItems: "center",
          paddingLeft: DIALOG.fieldPadding,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontWeight: 700,
            fontSize,
            letterSpacing: mask ? "0.34em" : "0.07em",
            // The blow-out inverts rather than swallowing the text —
            // white-on-white would read as an early clear, not a flash.
            color: flash > 0.5 ? COLORS.dialogBody : COLORS.fieldText,
            whiteSpace: "nowrap",
            lineHeight: 1,
            // Masking characters sit low in the em box; nudge them back up.
            transform: mask ? `translateY(${-fontSize * 0.28}px)` : undefined,
          }}
        >
          {text}
        </span>
        {caretVisible ? (
          <span
            style={{
              display: "inline-block",
              width: fontSize * 0.5,
              height: fontSize * 1.05,
              background: flash > 0.5 ? COLORS.dialogBody : COLORS.fieldText,
              marginLeft: mask ? 0 : fontSize * 0.12,
              opacity: 0.9,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
