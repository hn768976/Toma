import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ACCENT, alpha } from "../shared/theme";
import { MicroLabel, Panel, Readout } from "../shared/ui";
import { rand, wander } from "../shared/rand";
import { LAYOUT, LOAD_COLORS } from "./data";

const COLS = 11;
const ROWS = 8;

export const RegionalLoadMap: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, w, h } = LAYOUT.loadMap;
  const gap = 2.6;
  // Fit the grid to whichever axis runs out first, so it never spills over the
  // capacity readout in the footer.
  const gridTop = 48;
  const gridBottom = 34;
  const cell = Math.min(
    (w - 36 - gap * (COLS - 1)) / COLS,
    (h - gridTop - gridBottom - gap * (ROWS - 1)) / ROWS,
  );
  const gridW = cell * COLS + gap * (COLS - 1);
  const capacity = wander("edgecap", frame / 80, 41, 52, 2);

  return (
    <Panel x={x} y={y} width={w} height={h} title="REGIONAL LOAD MAP" accent={ACCENT.violet} delay={10}>
      <div style={{ position: "absolute", left: (w - gridW) / 2, top: gridTop }}>
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const i = r * COLS + c;
            // Every cell holds a colour for a few seconds, then crossfades to
            // the next one on its own schedule.
            const hold = 34 + rand(`hold${i}`) * 44;
            const step = Math.floor(frame / hold + rand(`ph${i}`) * 9);
            const local = (frame / hold + rand(`ph${i}`) * 9) % 1;
            const from = LOAD_COLORS[Math.floor(rand(`c${i}-${step}`) * LOAD_COLORS.length)];
            const to = LOAD_COLORS[Math.floor(rand(`c${i}-${step + 1}`) * LOAD_COLORS.length)];
            const mix = Math.max(0, Math.min(1, (local - 0.78) / 0.22));
            const level = 0.48 + rand(`l${i}-${step}`) * 0.52;
            const appear = interpolate(frame, [12 + i * 0.35, 30 + i * 0.35], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: c * (cell + gap),
                  top: r * (cell + gap),
                  width: cell,
                  height: cell,
                  borderRadius: 2,
                  background: alpha(from, level),
                  opacity: appear,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 2,
                    background: alpha(to, level),
                    opacity: mix,
                  }}
                />
              </div>
            );
          }),
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          bottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <MicroLabel>Edge capacity</MicroLabel>
        <Readout size={10} color={ACCENT.violet} weight={700}>
          {capacity.toFixed(1)}%
        </Readout>
      </div>
    </Panel>
  );
};
