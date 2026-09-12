import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ACCENT, alpha, DISPLAY_FONT, MATRIX } from "../shared/theme";
import { Bar, MicroLabel, Readout, Panel } from "../shared/ui";
import { wander } from "../shared/rand";
import { LAYOUT, OPERATIONS } from "./data";

export const ActiveOperations: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, w, h } = LAYOUT.activeOps;
  const rowTop = 62;
  const rowGap = (h - rowTop - 62) / OPERATIONS.length;
  const queue = wander("queue", frame / 70, 218, 302, 2);

  return (
    <Panel x={x} y={y} width={w} height={h} title="ACTIVE OPERATIONS" accent={ACCENT.teal} delay={6}>
      {OPERATIONS.map((op, i) => {
        // Each row's bar grows in on its own beat, then breathes around `base`.
        const grow = interpolate(frame, [14 + i * 4, 44 + i * 4], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: (t) => 1 - (1 - t) ** 3,
        });
        const value = wander(`op${i}`, frame / 55 + i, op.base - op.swing, op.base + op.swing, 2);
        const top = rowTop + i * rowGap;

        return (
          <div key={op.label} style={{ position: "absolute", left: 18, top, width: w - 36 }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 3,
                width: 9,
                height: 9,
                borderRadius: 5,
                background: alpha(op.color, 0.9),
                boxShadow: `0 0 9px ${alpha(op.color, 0.8)}`,
                opacity: 0.55 + 0.45 * Math.sin((frame / 30) * Math.PI * 1.3 + i * 0.8),
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 22,
                top: 0,
                fontFamily: DISPLAY_FONT,
                fontSize: 11.5,
                fontWeight: 400,
                color: MATRIX.text,
                opacity: 0.86,
              }}
            >
              {op.label}
            </div>
            <div style={{ position: "absolute", right: 0, top: -1, opacity: grow }}>
              <Readout size={11} color={op.color} weight={700}>
                {Math.round(value * grow)}%
              </Readout>
            </div>
            <div style={{ position: "absolute", left: 22, top: 20 }}>
              <Bar width={w - 58} value={value * grow} color={op.color} />
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          bottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <MicroLabel>Queue depth</MicroLabel>
        <Readout size={10.5} color={ACCENT.teal} weight={700}>
          {Math.round(queue)} TASKS
        </Readout>
      </div>
    </Panel>
  );
};
