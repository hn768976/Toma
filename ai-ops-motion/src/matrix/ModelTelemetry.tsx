import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ACCENT, MATRIX } from "../shared/theme";
import { MicroLabel, Panel, Readout, Sparkline } from "../shared/ui";
import { wander } from "../shared/rand";
import { LAYOUT, TELEMETRY } from "./data";

const SPARK_LEN = 30;

export const ModelTelemetry: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, w, h } = LAYOUT.telemetry;
  const gap = 10;
  const tileW = (w - 36 - gap) / 2;
  const tileH = (h - 62 - 20 - gap) / 2;

  return (
    <Panel x={x} y={y} width={w} height={h} title="MODEL TELEMETRY" accent={ACCENT.teal} delay={18}>
      {TELEMETRY.map((t, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const appear = interpolate(frame, [26 + i * 5, 52 + i * 5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const series = Array.from({ length: SPARK_LEN }, (_, s) =>
          wander(`tel${i}`, (frame - (SPARK_LEN - 1 - s) * 2.6) / 38, 0, 1, 3),
        );
        const value = wander(`telv${i}`, frame / 50, t.min, t.max, 2);
        const prefix = "prefix" in t ? t.prefix : "";

        return (
          <div
            key={t.label}
            style={{
              position: "absolute",
              left: 18 + col * (tileW + gap),
              top: 56 + row * (tileH + gap),
              width: tileW,
              height: tileH,
              borderRadius: 5,
              background: MATRIX.panelInner,
              border: `1px solid ${MATRIX.borderSoft}`,
              opacity: appear,
            }}
          >
            <MicroLabel style={{ position: "absolute", left: 10, top: 9, fontSize: 7.5 }}>
              {t.label}
            </MicroLabel>
            <div style={{ position: "absolute", right: 10, top: 7 }}>
              <Readout size={11} color={t.color} weight={700}>
                {prefix}
                {value.toFixed(t.decimals)}
                {t.unit}
              </Readout>
            </div>
            <div style={{ position: "absolute", left: 10, top: 30 }}>
              <Sparkline
                values={series}
                width={tileW - 20}
                height={tileH - 44}
                color={t.color}
                strokeWidth={1.8}
                min={0}
                max={1}
                reveal={appear}
              />
            </div>
          </div>
        );
      })}
    </Panel>
  );
};
