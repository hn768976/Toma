import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

import type { Content } from "../content/types";
import { FONT_MONO, FONT_UI } from "../fonts";
import { T, TERMINAL_H } from "../layout";
import type { Theme } from "../theme";
import { DotsGlyph, WarnGlyph } from "./Icons";

const LINE_H = 20;

const useReveal = (start: number) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [start, start + 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shift = interpolate(frame, [start, start + 9], [4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity, transform: `translateY(${shift}px)` };
};

const Row: React.FC<{ start: number; children: React.ReactNode }> = ({ start, children }) => {
  const reveal = useReveal(start);
  return (
    <div
      style={{
        height: LINE_H,
        display: "flex",
        alignItems: "center",
        gap: 8,
        whiteSpace: "pre",
        ...reveal,
      }}
    >
      {children}
    </div>
  );
};

const Tab: React.FC<{
  theme: Theme;
  label: React.ReactNode;
  active?: boolean;
}> = ({ theme, label, active }) => (
  <div
    style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "0 13px",
      height: "100%",
      fontSize: 11.5,
      color: active ? theme.code : theme.chrome,
    }}
  >
    {active ? (
      <div
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          bottom: 0,
          height: 2,
          background: theme.accent,
        }}
      />
    ) : null}
    {label}
  </div>
);

export const Terminal: React.FC<{ theme: Theme; content: Content }> = ({ theme, content }) => {
  const frame = useCurrentFrame();
  const warnStarts = [T.termWarn1, T.termWarn2];
  const problemCount = warnStarts.filter((start) => frame >= start + 9).length;

  return (
    <div
      style={{
        height: TERMINAL_H,
        background: theme.panelAlt,
        borderTop: `1px solid ${theme.border}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 30,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-between",
          borderBottom: `1px solid ${theme.border}`,
          fontFamily: FONT_UI,
        }}
      >
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <Tab theme={theme} label="Terminal" active />
          <Tab
            theme={theme}
            label={
              <>
                {problemCount > 0 ? <WarnGlyph size={10} color={theme.badge} /> : null}
                <span>
                  Problems{problemCount > 0 ? ` (${problemCount})` : ""}
                </span>
              </>
            }
          />
          <Tab theme={theme} label="Output" />
          <Tab theme={theme} label="Ports" />
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "0 14px" }}>
          <DotsGlyph size={13} color={theme.chromeDim} />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "8px 16px",
          fontFamily: FONT_MONO,
          fontSize: 11.5,
        }}
      >
        <Row start={T.termCmd}>
          <span style={{ color: theme.ok }}>$</span>
          <span style={{ color: theme.code }}>{content.terminal.command}</span>
        </Row>

        {content.terminal.warnings.map((warning, index) => (
          <Row key={warning.loc} start={warnStarts[index]}>
            <span style={{ color: theme.warn }}>warning</span>
            <span style={{ color: theme.chrome }}>{warning.loc}</span>
            <span style={{ color: theme.warn, opacity: 0.85 }}>{warning.rule}</span>
            <span style={{ color: theme.chromeDim }}>{warning.message}</span>
          </Row>
        ))}

        <Row start={T.termSummary}>
          <span style={{ color: theme.chromeDim }}>{content.terminal.summary}</span>
        </Row>
      </div>
    </div>
  );
};
