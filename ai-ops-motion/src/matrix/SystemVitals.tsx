import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ACCENT, alpha, MATRIX } from "../shared/theme";
import { formatInt, MicroLabel, Panel, Readout, Sparkline } from "../shared/ui";
import { wander } from "../shared/rand";
import { LAYOUT } from "./data";

const TILES = [
  { key: "TOKENS / S", color: ACCENT.teal, sub: "+12.4%" },
  { key: "LATENCY", color: ACCENT.green, sub: "ms p50" },
  { key: "AGENTS", color: ACCENT.purple, sub: "274 active" },
  { key: "SUCCESS", color: ACCENT.blue, sub: "% today" },
] as const;

const SPARK_LEN = 26;

export const SystemVitals: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, w, h } = LAYOUT.vitals;
  const gap = 10;
  const tileW = (w - 36 - gap) / 2;
  const tileH = 104;

  const values = [
    wander("tokens", frame / 42, 11400, 13600, 3),
    wander("latency", frame / 38, 33, 46, 3),
    wander("agents", frame / 60, 272, 301, 2),
    100,
  ];

  const format = (i: number, v: number) =>
    i === 0 ? formatInt(v) : i === 1 ? String(Math.round(v)) : i === 2 ? formatInt(v) : v.toFixed(1);

  return (
    <Panel x={x} y={y} width={w} height={h} title="SYSTEM VITALS" accent={ACCENT.green} delay={13}>
      {TILES.map((tile, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const appear = interpolate(frame, [20 + i * 4, 44 + i * 4], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        // The sparkline scrolls: sample the same signal at receding frames.
        const series = Array.from({ length: SPARK_LEN }, (_, s) =>
          wander(`vital${i}`, (frame - (SPARK_LEN - 1 - s) * 3) / 42, 0, 1, 3),
        );

        return (
          <div
            key={tile.key}
            style={{
              position: "absolute",
              left: 18 + col * (tileW + gap),
              top: 48 + row * (tileH + gap),
              width: tileW,
              height: tileH,
              borderRadius: 5,
              background: MATRIX.panelInner,
              border: `1px solid ${MATRIX.borderSoft}`,
              opacity: appear,
            }}
          >
            <MicroLabel style={{ position: "absolute", left: 11, top: 10, fontSize: 8 }}>
              {tile.key}
            </MicroLabel>
            <div style={{ position: "absolute", left: 11, top: 26 }}>
              <Readout size={27} color={tile.color} weight={700}>
                {format(i, values[i])}
              </Readout>
            </div>
            <MicroLabel style={{ position: "absolute", left: 11, bottom: 12, fontSize: 7.5 }}>
              {tile.sub}
            </MicroLabel>
            <div style={{ position: "absolute", right: 10, bottom: 10 }}>
              <Sparkline
                values={series}
                width={tileW * 0.52}
                height={26}
                color={tile.color}
                strokeWidth={1.4}
                min={0}
                max={1}
                reveal={appear}
              />
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 18,
          bottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            background: ACCENT.green,
            boxShadow: `0 0 7px ${alpha(ACCENT.green, 0.9)}`,
            opacity: 0.5 + 0.5 * Math.sin((frame / 30) * Math.PI * 1.5),
          }}
        />
        <MicroLabel style={{ fontSize: 7.5, color: MATRIX.textDim }}>
          Model fleet healthy · 0 critical events
        </MicroLabel>
      </div>
    </Panel>
  );
};
