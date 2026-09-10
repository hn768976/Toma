import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { MONO } from "../fonts";
import { COLORS, type Accent } from "../theme";
import { alpha, mix } from "../color";
import { lineAlert, panelAlert } from "../alert";
import { rngFor } from "../random";
import {
  bigReadout,
  gridCells,
  meterLevels,
  readoutRows,
  serialColumn,
} from "./content";
import { Panel } from "./Panel";

type Placement = { col: [number, number]; row: [number, number] };

/**
 * The small cluster of blocks and bracket labels that sits at the right
 * end of the top banner. Abstract by design — the labels name nothing.
 */
const HeaderChips: React.FC<{ id: string; accent: Accent }> = ({ id, accent }) => {
  const frame = useCurrentFrame();
  const heat = panelAlert(frame, id, accent);
  const color = mix(COLORS.dataBright, accent.color, heat);

  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        top: 34,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", gap: 12 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            style={{
              width: (i % 3) * 22 + 54,
              height: 26,
              background: alpha(color, (Math.floor(frame / 18) + i) % 5 === 0 ? 0.7 : 0.3),
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontWeight: 500,
          fontSize: 32,
          letterSpacing: "0.18em",
          color: alpha(color, 0.7),
        }}
      >
        [LINK] [SEG] [IDX]
      </div>
    </div>
  );
};

/** The wide filled banner at the top of the frame. */
export const HeaderPanel: React.FC<
  Placement & { id: string; accent: Accent; title: string; subtitle?: string }
> = ({ id, accent, col, row, title, subtitle }) => {
  const frame = useCurrentFrame();
  const heat = panelAlert(frame, id, accent);
  const titleColor = mix(COLORS.dataBright, accent.color, heat * 0.7);

  return (
    <Panel id={id} accent={accent} col={col} row={row} emphasis padding={34}>
      <div
        style={{
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 84,
          letterSpacing: "0.06em",
          color: titleColor,
          textShadow: `0 0 26px ${alpha(titleColor, 0.45)}`,
          lineHeight: 1,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 500,
            fontSize: 46,
            letterSpacing: "0.22em",
            color: alpha(mix(COLORS.text, accent.color, heat), 0.8),
            marginTop: 14,
          }}
        >
          {subtitle}
        </div>
      ) : null}
      <HeaderChips id={`${id}:chips`} accent={accent} />
      <TickRow id={`${id}:ticks`} accent={accent} count={26} top={false} />
    </Panel>
  );
};

/** `DATA SOURCE` style panel: caps header over one long numeric readout. */
export const ReadoutPanel: React.FC<
  Placement & { id: string; accent: Accent; header: string }
> = ({ id, accent, col, row, header }) => {
  const frame = useCurrentFrame();
  const heat = panelAlert(frame, id, accent);
  // The readout re-rolls a few times a second so the panel feels live.
  const value = useMemo(() => bigReadout(`${id}:${Math.floor(frame / 7)}`), [id, frame]);
  const color = mix(COLORS.dataBright, accent.color, heat);

  return (
    <Panel id={id} accent={accent} col={col} row={row} emphasis padding={34}>
      <div
        style={{
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 76,
          letterSpacing: "0.1em",
          color,
          textShadow: `0 0 24px ${alpha(color, 0.4)}`,
        }}
      >
        {header}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontWeight: 400,
          fontSize: 58,
          letterSpacing: "0.08em",
          color: alpha(mix(COLORS.text, accent.color, heat), 0.92),
          marginTop: 20,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
      <MeterStrip id={`${id}:meters`} accent={accent} count={7} />
    </Panel>
  );
};

/** Two columns of `LBL 0F3A` rows — the densest texture in the frame. */
export const RowsPanel: React.FC<
  Placement & {
    id: string;
    accent: Accent;
    columns: number;
    rows: number;
    fontSize: number;
  }
> = ({ id, accent, col, row, columns, rows, fontSize }) => {
  const frame = useCurrentFrame();
  const data = useMemo(() => readoutRows(id, columns * rows), [id, columns, rows]);

  return (
    <Panel id={id} accent={accent} col={col} row={row} padding={24}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          columnGap: 20,
          rowGap: Math.round(fontSize * 0.6),
        }}
      >
        {data.map((cell, i) => {
          const heat = lineAlert(frame, `${id}:${i}`, accent);
          return (
            <div
              key={i}
              style={{
                fontFamily: MONO,
                fontSize,
                letterSpacing: "0.05em",
                whiteSpace: "nowrap",
                color: mix(COLORS.text, accent.color, heat),
                opacity: 0.42 + (i % 4 === 0 ? 0.32 : 0) + heat * 0.45,
              }}
            >
              <span style={{ opacity: 0.62 }}>{cell.label}</span> {cell.value}
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

/** The stacked serial column from the lower right of the reference. */
export const SerialPanel: React.FC<
  Placement & { id: string; accent: Accent; count: number; header?: string }
> = ({ id, accent, col, row, count, header }) => {
  const frame = useCurrentFrame();
  const items = useMemo(
    () => serialColumn(`${id}:${Math.floor(frame / 12)}`, count),
    [id, frame, count],
  );

  return (
    <Panel id={id} accent={accent} col={col} row={row} padding={26}>
      {header ? (
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 40,
            letterSpacing: "0.18em",
            color: alpha(COLORS.dataBright, 0.75),
            marginBottom: 16,
          }}
        >
          {header}
        </div>
      ) : null}
      {items.map((value, i) => {
        const heat = lineAlert(frame, `${id}:${i}`, accent);
        return (
          <div
            key={i}
            style={{
              fontFamily: MONO,
              fontWeight: 500,
              fontSize: 44,
              lineHeight: 1.42,
              letterSpacing: "0.09em",
              color: mix(COLORS.dataBright, accent.color, heat),
              opacity: 0.46 + heat * 0.45,
            }}
          >
            {value}
          </div>
        );
      })}
    </Panel>
  );
};

/** The grid of empty boxes that sits behind the dialog. */
export const BoxGridPanel: React.FC<
  Placement & { id: string; accent: Accent; columns: number; rows: number }
> = ({ id, accent, col, row, columns, rows }) => {
  const frame = useCurrentFrame();
  const cells = useMemo(() => gridCells(id, columns * rows), [id, columns, rows]);
  const heat = panelAlert(frame, id, accent);

  return (
    <Panel id={id} accent={accent} col={col} row={row} padding={30}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: 22,
          height: "100%",
        }}
      >
        {cells.map((v, i) => {
          // A few cells brighten on a slow seeded cycle.
          const blink = (Math.floor(frame / 24) + i) % 11 === 0 ? 0.3 : 0;
          return (
            <div
              key={i}
              style={{
                border: `2px solid ${alpha(mix(COLORS.panel, accent.color, heat), 0.42)}`,
                background: alpha(
                  mix(COLORS.text, accent.color, heat),
                  0.05 + v * 0.09 + blink,
                ),
              }}
            />
          );
        })}
      </div>
    </Panel>
  );
};

/** A row of small bar meters. */
export const MeterStrip: React.FC<{
  id: string;
  accent: Accent;
  count: number;
}> = ({ id, accent, count }) => {
  const frame = useCurrentFrame();
  const base = useMemo(() => meterLevels(id, count), [id, count]);
  const heat = panelAlert(frame, id, accent);

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-end", marginTop: 26, height: 34 }}>
      {base.map((level, i) => {
        const wobble = 0.5 + 0.5 * Math.sin(frame / (7 + i) + i * 2.1);
        const h = 12 + (level * 0.7 + wobble * 0.3) * 22;
        return (
          <div
            key={i}
            style={{
              width: 44,
              height: h,
              background: alpha(mix(COLORS.dataBright, accent.color, heat), 0.55),
            }}
          />
        );
      })}
    </div>
  );
};

/** A ladder of tick marks, used along panel edges and the spine. */
export const TickRow: React.FC<{
  id: string;
  accent: Accent;
  count: number;
  top?: boolean;
}> = ({ id, accent, count, top = true }) => {
  const frame = useCurrentFrame();
  const heat = panelAlert(frame, id, accent);
  const rand = useMemo(() => {
    const r = rngFor(id);
    return Array.from({ length: count }, () => r());
  }, [id, count]);

  return (
    <div
      style={{
        position: "absolute",
        left: 34,
        right: 34,
        [top ? "top" : "bottom"]: 10,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        height: 20,
      }}
    >
      {rand.map((v, i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: v > 0.72 ? 20 : 10,
            background: alpha(mix(COLORS.text, accent.color, heat), 0.5 + v * 0.3),
          }}
        />
      ))}
    </div>
  );
};

/** The vertical divider running the full height of the frame. */
export const Spine: React.FC<Placement & { id: string; accent: Accent }> = ({
  id,
  accent,
  col,
  row,
}) => {
  const frame = useCurrentFrame();
  const heat = panelAlert(frame, id, accent);
  const color = mix(COLORS.panel, accent.color, heat);

  return (
    <div
      style={{
        gridColumn: `${col[0]} / ${col[1]}`,
        gridRow: `${row[0]} / ${row[1]}`,
        position: "relative",
        display: "flex",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div style={{ width: 5, background: alpha(mix(COLORS.dataBright, accent.color, heat), 0.7) }} />
      <div
        style={{
          width: 34,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "40px 0",
        }}
      >
        {Array.from({ length: 34 }, (_, i) => (
          <div
            key={i}
            style={{
              height: 5,
              width: i % 4 === 0 ? "100%" : "48%",
              alignSelf: "flex-start",
              background: alpha(color, i % 4 === 0 ? 0.85 : 0.45),
            }}
          />
        ))}
      </div>
      <div style={{ width: 5, background: alpha(mix(COLORS.dataBright, accent.color, heat), 0.7) }} />
    </div>
  );
};
