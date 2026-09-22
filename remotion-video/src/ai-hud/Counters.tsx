import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT_MONO, PALETTE } from "./constants";
import { COUNTERS } from "./geometry";
import { wave } from "./loop";
import { Label } from "./panels";

/**
 * Small decimal readouts scattered near the core and the clusters.
 *
 * Each value is a sum of sines with integer cycle counts, so the whole set
 * reads the same at frame 600 as at frame 0. Tabular figures keep the digits
 * from jittering sideways as they change.
 */
export const Counters: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <g>
      {COUNTERS.map((c, i) => {
        let v = c.base;
        for (const term of c.terms) {
          v += term.amp * wave(frame, term.cycles, term.shift);
        }
        const clamped = Math.min(0.99, Math.max(0.01, v));
        return (
          <g key={i}>
            {c.label ? (
              <Label x={c.x} y={c.y - c.size * 0.82} size={c.size * 0.52} opacity={0.5}>
                {c.label}
              </Label>
            ) : null}
            <text
              x={c.x}
              y={c.y}
              fontFamily={FONT_MONO}
              fontSize={c.size * 0.84}
              fontWeight={500}
              fill={c.warm ? PALETTE.warm : PALETTE.text}
              opacity={0.64}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {clamped.toFixed(2)}
            </text>
          </g>
        );
      })}
    </g>
  );
};
