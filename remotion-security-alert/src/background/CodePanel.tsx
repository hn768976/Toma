import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { MONO } from "../fonts";
import { COLORS, type Accent } from "../theme";
import { mix } from "../color";
import { lineAlert } from "../alert";
import { codeBlock } from "./content";
import { Panel } from "./Panel";

/**
 * A block of monospace fragments scrolling slowly upward. The block is
 * generated once at twice the visible length and rendered twice, so the
 * translate can wrap with a modulo instead of accumulating state.
 */
export const CodePanel: React.FC<{
  id: string;
  accent: Accent;
  col: [number, number];
  row: [number, number];
  lines: number;
  fontSize: number;
  /** Pixels per frame. Deliberately slow — this is texture, not motion. */
  speed: number;
  header?: string;
}> = ({ id, accent, col, row, lines, fontSize, speed, header }) => {
  const frame = useCurrentFrame();
  const source = useMemo(() => codeBlock(id, lines), [id, lines]);
  const lineHeight = Math.round(fontSize * 1.62);
  const span = source.length * lineHeight;
  const offset = -(((frame * speed) % span) + span) % span;

  return (
    <Panel id={id} accent={accent} col={col} row={row} padding={22} column>
      {header ? (
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: fontSize * 1.15,
            letterSpacing: "0.16em",
            color: mix(COLORS.dataBright, accent.color, lineAlert(frame, `${id}:h`, accent)),
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          {header}
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          maskImage:
            "linear-gradient(to bottom, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%)",
        }}
      >
        <div style={{ transform: `translateY(${offset}px)` }}>
          {[0, 1].map((copy) =>
            source.map((line, i) => {
              const heat = lineAlert(frame, `${id}:${i}`, accent);
              return (
                <div
                  key={`${copy}-${i}`}
                  style={{
                    fontFamily: MONO,
                    fontSize,
                    lineHeight: `${lineHeight}px`,
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                    color: mix(COLORS.text, accent.color, heat),
                    opacity: 0.46 + (i % 5 === 0 ? 0.34 : 0) + heat * 0.4,
                  }}
                >
                  {line}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </Panel>
  );
};
