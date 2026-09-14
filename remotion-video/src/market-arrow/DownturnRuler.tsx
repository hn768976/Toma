import React from "react";
import { DOWNTURN } from "./constants";
import { formatSigned, sampleRamp } from "./palette";
import { downturnValueAt } from "./series";

// The vertical scale on the left: a finite ruler of numbered ticks with
// MINOR_PER_MAJOR unlabelled ticks between them, scrolling upward as the
// readout plunges. Only the ticks currently within (or just outside) the
// frame are rendered.
export const DownturnRuler: React.FC<{
  scroll: number;
  /** 0..1 crash progress; drives how hot the numbers read. */
  intensity: number;
  ramp: readonly string[];
  fontFamily: string;
}> = ({ scroll, intensity, ramp, fontFamily }) => {
  const { majorGap, minorPerMajor, anchorY, axisX, rulerMajors } = DOWNTURN;
  const minorGap = majorGap / minorPerMajor;

  const screenY = (worldY: number) => worldY - scroll + anchorY;
  const rulerEndY = screenY(rulerMajors * majorGap);

  // Visible window, padded so ticks slide in and out cleanly.
  const firstMajor = Math.max(
    0,
    Math.floor((scroll - anchorY - 300) / majorGap),
  );
  const lastMajor = Math.min(
    rulerMajors,
    Math.ceil((scroll - anchorY + 1400) / majorGap),
  );

  const ticks: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];

  for (let major = firstMajor; major <= lastMajor; major++) {
    const majorY = screenY(major * majorGap);

    ticks.push(
      <div
        key={`M${major}`}
        style={{
          position: "absolute",
          left: axisX - DOWNTURN.majorTickLength,
          top: majorY - 3,
          width: DOWNTURN.majorTickLength,
          height: 6,
          background: DOWNTURN.axis,
          borderRadius: 3,
        }}
      />,
    );

    // Deeper numbers, and numbers lower in frame, read hotter. This is
    // what turns the whole column from blue to molten over the 10s.
    const yNorm = Math.max(0, Math.min(1, (majorY - 120) / 900));
    const heat = Math.max(0, Math.min(1, -0.1 + 0.5 * yNorm + 1.2 * intensity));
    const color = sampleRamp(ramp, heat);

    labels.push(
      <div
        key={`L${major}`}
        style={{
          position: "absolute",
          left: axisX + DOWNTURN.majorTickLength,
          top: majorY - DOWNTURN.labelSize * 0.72,
          fontFamily,
          fontSize: DOWNTURN.labelSize,
          fontWeight: 500,
          letterSpacing: 1,
          color,
          textShadow: `0 0 ${20 + 26 * intensity}px ${color}`,
          whiteSpace: "nowrap",
        }}
      >
        {formatSigned(downturnValueAt(major))}
      </div>,
    );

    if (major === rulerMajors) break;
    for (let minor = 1; minor < minorPerMajor; minor++) {
      ticks.push(
        <div
          key={`m${major}-${minor}`}
          style={{
            position: "absolute",
            left: axisX - DOWNTURN.minorTickLength,
            top: majorY + minor * minorGap - 2,
            width: DOWNTURN.minorTickLength,
            height: 4,
            background: DOWNTURN.axisDim,
            borderRadius: 2,
          }}
        />,
      );
    }
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Spine. Stops at the ruler's tail so the end can arrive in frame. */}
      <div
        style={{
          position: "absolute",
          left: axisX - 4,
          top: -400,
          width: 8,
          height: Math.max(0, rulerEndY + 400),
          background: DOWNTURN.axis,
          boxShadow: `0 0 26px rgba(233, 244, 251, 0.4)`,
        }}
      />
      {/* Terminating arrowhead, only relevant once the tail is near frame. */}
      <div
        style={{
          position: "absolute",
          left: axisX - 17,
          top: rulerEndY,
          width: 0,
          height: 0,
          borderLeft: "17px solid transparent",
          borderRight: "17px solid transparent",
          borderTop: `54px solid ${DOWNTURN.axis}`,
        }}
      />
      {ticks}
      {labels}
    </div>
  );
};
