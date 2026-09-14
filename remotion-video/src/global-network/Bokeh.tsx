import React from "react";
import { interpolate } from "remotion";
import { BOKEH } from "./scene-data";
import { type Palette } from "./constants";

// Out-of-focus specks drifting through the foreground. They hold off
// until the pull-back is underway — popping them in at frame 0 makes the
// opening read as busy rather than as a slow reveal.
const FADE_IN = [18, 54] as const;

// One very slow loop over the whole shot; each blob rides it at its own
// phase so nothing moves in lockstep.
const DRIFT_PERIOD = 460;

export const Bokeh: React.FC<{ palette: Palette; frame: number }> = ({
  palette,
  frame,
}) => {
  const groupOpacity = interpolate(frame, FADE_IN, [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (groupOpacity <= 0) {
    return null;
  }

  return (
    <g opacity={groupOpacity}>
      {BOKEH.map((blob, i) => {
        const t = (frame / DRIFT_PERIOD + blob.phase) % 1;
        const wobble = Math.sin((t + blob.phase) * Math.PI * 2);
        const x = blob.x + blob.driftX * wobble;
        const y = blob.y + blob.driftY * (t * 2 - 1);
        // Gentle breathing so the field never looks like a still frame.
        const pulse =
          0.78 + 0.22 * Math.sin((frame / 97 + blob.phase) * Math.PI * 2);
        const colorIndex = blob.colorIndex % palette.bokeh.length;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={blob.radius}
            fill={`url(#bokeh-${colorIndex})`}
            opacity={blob.baseOpacity * pulse * 1.5}
          />
        );
      })}
    </g>
  );
};
