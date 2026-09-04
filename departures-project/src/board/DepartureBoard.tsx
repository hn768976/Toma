import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Grain, Scanlines, ScreenGlow, Vignette } from "./Effects";
import { Plane } from "./Plane";
import { ROWS, Status } from "./data";
import {
  CHAR_STAGGER,
  FLAP_FIELDS,
  FLAP_ROWS_PER_COLUMN,
  FlapField,
  flapCharAt,
} from "./flapPlan";
import { LCD_FIELDS, LCD_PLAN, charsAt, textAt } from "./lcdPlan";
import type { BoardTheme } from "./theme";

/** `#rrggbb` to `rgba(...)`, for glows tinted by the text they come from. */
const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const LCD_TRACKING = 0.06;

const LcdBoard: React.FC<{ theme: BoardTheme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const m = theme.metrics;
  const lcd = theme.lcd!;

  const rowFont = m.rowFontSize * height;
  const headerFont = m.columnHeaderSize * height;
  const titleFont = m.titleSize * height;

  /**
   * A cell reserves the width of its full value and reveals characters from
   * the left, so a half-typed centred or right-aligned column does not drift
   * sideways as it fills.
   */
  const cell = (
    col: (typeof lcd.columns)[string],
    content: string,
    hidden: string,
    color: string,
    fontSize: number,
    tracking: number,
    glow: number,
  ) => (
    <div
      style={{
        position: "absolute",
        left: col.left * width,
        width: col.width * width,
        top: 0,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent:
          col.align === "left" ? "flex-start" : col.align === "right" ? "flex-end" : "center",
        color,
        fontSize,
        letterSpacing: `${tracking}em`,
        whiteSpace: "pre",
        textShadow: `0 0 ${fontSize * 0.26}px ${alpha(color, glow)}`,
      }}
    >
      {/* Tracking adds a trailing gap after the last glyph; pull it back so the
          centred and right-aligned columns sit where the grid says they do. */}
      <span style={{ marginRight: -tracking * fontSize }}>
        {content}
        <span style={{ visibility: "hidden" }}>{hidden}</span>
      </span>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: theme.surface, fontFamily: theme.fontFamily }}>
      <div
        style={{
          position: "absolute",
          left: m.planeLeft * width,
          top: m.titleY * height,
          transform: "translateY(-50%)",
        }}
      >
        <Plane size={m.planeSize * height} color={lcd.titleColor} glow="rgba(190,220,255,0.35)" />
      </div>
      <div
        style={{
          position: "absolute",
          left: m.titleLeft * width,
          top: m.titleY * height,
          transform: "translateY(-50%)",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: titleFont,
          letterSpacing: "-0.012em",
          color: lcd.titleColor,
          textShadow: `0 0 ${titleFont * 0.10}px rgba(255,255,255,0.32)`,
        }}
      >
        {lcd.title}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: m.columnHeaderY * height,
          height: headerFont * 1.6,
          transform: "translateY(-50%)",
        }}
      >
        {LCD_FIELDS.map((field) =>
          React.cloneElement(
            cell(lcd.columns[field], lcd.columns[field].label, "", lcd.columnHeaderColor, headerFont, 0.12, 0.3),
            { key: field },
          ),
        )}
      </div>

      {LCD_PLAN.map((cells, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: (m.rowsTop + rowIndex * m.rowHeight) * height,
            height: m.rowHeight * height,
            background: lcd.rowTint[rowIndex % 2],
          }}
        >
          {LCD_FIELDS.map((field) => {
            const plan = cells[field];
            const value = textAt(plan, frame);
            const typed = charsAt(plan, frame);
            const color = field === "remarks" ? theme.statusColor[value as Status] : lcd.textColor;
            return React.cloneElement(
              cell(
                lcd.columns[field],
                value.slice(0, typed),
                value.slice(typed),
                color,
                rowFont,
                LCD_TRACKING,
                0.4,
              ),
              { key: field },
            );
          })}
        </div>
      ))}

      <ScreenGlow color="rgba(120,175,255,0.16)" opacity={1} />
      <Scanlines opacity={0.04} />
      <Grain opacity={0.30} />
      <Vignette strength={0.28} />
    </AbsoluteFill>
  );
};

const FlapBoard: React.FC<{ theme: BoardTheme; columns: number }> = ({ theme, columns }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const m = theme.metrics;
  const flap = theme.flap!;

  const cellsPerColumn = FLAP_FIELDS.reduce((sum, f) => sum + f.width, 0);
  const unitsPerColumn = cellsPerColumn + (FLAP_FIELDS.length - 1) * m.fieldGap;
  const totalUnits = columns * unitsPerColumn + (columns - 1) * m.centreGap + 2 * m.sideMargin;
  const unit = width / totalUnits;

  const cellW = unit * m.cellWidthRatio;
  const cellH = m.cellHeight * height;
  const pitch = m.rowPitch * height;
  const font = m.fontSize * height;
  const top = (height - FLAP_ROWS_PER_COLUMN * pitch) / 2;

  /** Left edge of a field, in pixels, for a given column of the board. */
  const fieldLeft = (columnIndex: number, fieldIndex: number) => {
    let units = m.sideMargin + columnIndex * (unitsPerColumn + m.centreGap);
    for (let i = 0; i < fieldIndex; i++) {
      units += FLAP_FIELDS[i].width + m.fieldGap;
    }
    return units * unit;
  };

  return (
    <AbsoluteFill style={{ background: theme.surface, fontFamily: theme.fontFamily }}>
      {Array.from({ length: columns }, (_, columnIndex) =>
        Array.from({ length: FLAP_ROWS_PER_COLUMN }, (_, r) => {
          const rowIndex = columnIndex * FLAP_ROWS_PER_COLUMN + r;
          if (rowIndex >= ROWS.length) return null;
          const y = top + r * pitch;
          return (
            <div key={`${columnIndex}-${r}`}>
              <div
                style={{
                  position: "absolute",
                  left: fieldLeft(columnIndex, 0) - unit * 0.5,
                  width: unitsPerColumn * unit + unit,
                  top: y + pitch - (pitch - cellH) / 2,
                  height: Math.max(1, height * 0.001),
                  background: flap.separator,
                }}
              />
              {FLAP_FIELDS.map((field, fieldIndex) =>
                Array.from({ length: field.width }, (_, charIndex) => {
                  const state = flapCharAt(rowIndex, field.key as FlapField, charIndex, frame);
                  const color =
                    field.key === "status"
                      ? theme.statusColor[state.text.trim() as Status]
                      : flap.fieldColor[field.key];
                  return (
                    <div
                      key={`${field.key}-${charIndex}`}
                      style={{
                        position: "absolute",
                        left: fieldLeft(columnIndex, fieldIndex) + charIndex * unit + (unit - cellW) / 2,
                        top: y + (pitch - cellH) / 2,
                        width: cellW,
                        height: cellH,
                        borderRadius: cellH * 0.06,
                        background: flap.cellFace,
                        boxShadow: `inset 0 ${cellH * 0.035}px 0 ${flap.cellHighlight}, 0 ${
                          cellH * 0.05
                        }px ${cellH * 0.09}px ${flap.cellShadow}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color,
                        fontSize: font,
                        fontWeight: 700,
                        lineHeight: 1,
                        // A flap caught mid-riffle is a shade darker: it is
                        // between two rest positions and catches less light.
                        opacity: state.flipping ? 0.82 : 1,
                        textShadow: `0 ${font * 0.03}px ${font * 0.06}px rgba(0,0,0,0.9)`,
                      }}
                    >
                      {state.char === " " ? "" : state.char}
                    </div>
                  );
                }),
              )}
            </div>
          );
        }),
      )}

      {Array.from({ length: columns - 1 }, (_, i) => (
        <div
          key={`divider-${i}`}
          style={{
            position: "absolute",
            left: fieldLeft(i + 1, 0) - (m.centreGap / 2 + m.fieldGap / 2) * unit,
            top: top - pitch * 0.1,
            width: Math.max(1, width * 0.0006),
            height: FLAP_ROWS_PER_COLUMN * pitch + pitch * 0.2,
            background: flap.divider,
          }}
        />
      ))}

      <Grain opacity={0.58} />
      <Vignette strength={0.34} />
    </AbsoluteFill>
  );
};

/**
 * One board, two suits of clothes. The row data, the status model and the
 * update behaviour are shared; the theme decides how a cell is drawn and how
 * many columns of flights the board carries.
 */
export const DepartureBoard: React.FC<{ theme: BoardTheme; columns: number }> = ({
  theme,
  columns,
}) => (theme.mode === "lcd" ? <LcdBoard theme={theme} /> : <FlapBoard theme={theme} columns={columns} />);
