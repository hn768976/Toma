import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ACCENT, alpha, DISPLAY_FONT, MATRIX } from "../shared/theme";
import { MicroLabel, Readout, usePanelEntry } from "../shared/ui";
import { wander } from "../shared/rand";
import { LAYOUT } from "./data";

export const HeaderBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { opacity } = usePanelEntry(0);
  const { x, y, w, h } = LAYOUT.header;

  // Title letters spread apart as the film opens, then settle.
  const tracking = interpolate(frame, [0, 45], [16, 7.5], {
    extrapolateRight: "clamp",
    easing: (t) => 1 - (1 - t) ** 3,
  });
  const titleReveal = interpolate(frame, [4, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sync = wander("sync", frame / 90, 99.981, 99.998, 2);
  const livePulse = 0.45 + 0.55 * Math.sin((frame / 30) * Math.PI * 1.6);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        opacity,
        background: "rgba(8, 16, 29, 0.55)",
        border: `1px solid ${MATRIX.borderSoft}`,
        borderRadius: 5,
      }}
    >
      <div style={{ position: "absolute", left: 18, top: h / 2 - 3, display: "flex", gap: 7 }}>
        {[ACCENT.teal, ACCENT.green, ACCENT.violet].map((c, i) => (
          <div
            key={c}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: c,
              opacity: 0.55 + 0.35 * Math.sin((frame / 30) * Math.PI * 1.2 + i * 1.1),
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 64,
          top: h / 2 - 1,
          width: 108,
          height: 2,
          background: `linear-gradient(90deg, ${alpha(ACCENT.teal, 0.5)}, ${alpha(ACCENT.teal, 0)})`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 194,
          top: h / 2 - 11,
          height: 22,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          gap: 7,
          borderRadius: 11,
          border: `1px solid ${alpha(ACCENT.teal, 0.28)}`,
          background: alpha(ACCENT.teal, 0.06),
        }}
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            background: ACCENT.teal,
            opacity: livePulse,
            boxShadow: `0 0 8px ${ACCENT.teal}`,
          }}
        />
        <MicroLabel style={{ color: alpha(ACCENT.teal, 0.85), fontSize: 8.5 }}>
          System live
        </MicroLabel>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 10,
          textAlign: "center",
          fontFamily: DISPLAY_FONT,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: tracking,
          color: MATRIX.text,
          clipPath: `inset(0 ${(1 - titleReveal) * 50}% 0 ${(1 - titleReveal) * 50}%)`,
        }}
      >
        AUTONOMOUS OPERATIONS MATRIX
      </div>
      <MicroLabel
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 34,
          textAlign: "center",
          fontSize: 8,
          letterSpacing: 4.2,
          opacity: interpolate(frame, [18, 40], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Orchestration · Telemetry · Control
      </MicroLabel>

      <div
        style={{
          position: "absolute",
          right: 232,
          top: h / 2 - 8,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <MicroLabel style={{ fontSize: 8.5 }}>Global sync</MicroLabel>
        <Readout size={12} color={ACCENT.green} weight={700}>
          {sync.toFixed(3)}%
        </Readout>
      </div>

      <div
        style={{
          position: "absolute",
          right: 18,
          top: h / 2 - 6,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: ACCENT.green,
            boxShadow: `0 0 8px ${ACCENT.green}`,
            opacity: livePulse,
          }}
        />
        <MicroLabel style={{ fontSize: 8.5, color: MATRIX.textDim }}>
          All regions nominal
        </MicroLabel>
      </div>
    </div>
  );
};
