import React from "react";
import { useCurrentFrame } from "remotion";

type Props = {
  width: number;
  height: number;
  /** 0..1 */
  progress: number;
  trackFrom: string;
  trackTo: string;
  fillFrom: string;
  fillTo: string;
  /** Glow radius in px around the filled part; 0 disables it. */
  glow?: number;
  /** Adds a travelling sheen inside the fill. */
  sheen?: boolean;
};

// A rounded capsule bar. The fill is clipped by the track's own radius so
// the leading edge keeps a clean round cap at every progress value.
export const ProgressBar: React.FC<Props> = ({
  width,
  height,
  progress,
  trackFrom,
  trackTo,
  fillFrom,
  fillTo,
  glow = 0,
  sheen = true,
}) => {
  const frame = useCurrentFrame();
  const radius = height / 2;
  const filled = Math.max(0, Math.min(1, progress)) * width;
  // Sheen sweeps the filled section roughly once per second.
  const sheenX = ((frame * 0.02) % 1) * (filled + width * 0.25) - width * 0.12;

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderRadius: radius,
        background: `linear-gradient(180deg, ${trackFrom} 0%, ${trackTo} 100%)`,
        overflow: "hidden",
      }}
    >
      {filled > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: filled,
            borderRadius: radius,
            background: `linear-gradient(180deg, ${fillFrom} 0%, ${fillTo} 100%)`,
            boxShadow: glow
              ? `0 0 ${glow}px ${fillFrom}, 0 0 ${glow * 2.4}px ${fillTo}`
              : undefined,
            overflow: "hidden",
          }}
        >
          {sheen ? (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: sheenX,
                width: width * 0.16,
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%)",
              }}
            />
          ) : null}
          {/* Bright leading edge */}
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: Math.min(height * 1.6, filled),
              background:
                "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 100%)",
            }}
          />
        </div>
      ) : null}
    </div>
  );
};
