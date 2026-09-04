import React from "react";

import type { Content } from "../content/types";
import { FONT_MONO, FONT_UI } from "../fonts";
import { TITLE_BAR_H } from "../layout";
import type { Theme } from "../theme";
import { SearchGlyph } from "./Icons";

export const TitleBar: React.FC<{ theme: Theme; content: Content }> = ({ theme, content }) => (
  <div
    style={{
      height: TITLE_BAR_H,
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      padding: "0 14px",
      background: theme.panel,
      borderBottom: `1px solid ${theme.border}`,
      fontFamily: FONT_UI,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: `linear-gradient(135deg, ${theme.accent}, #22d3ee)`,
          opacity: 0.9,
        }}
      />
      <span style={{ fontSize: 12, color: theme.chrome, fontWeight: 500 }}>
        {content.workspace}
      </span>
      <span
        style={{
          fontSize: 10.5,
          color: theme.chromeDim,
          fontFamily: FONT_MONO,
          border: `1px solid ${theme.border}`,
          borderRadius: 4,
          padding: "1.5px 6px",
        }}
      >
        {content.branch}
      </span>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
      {content.breadcrumb.map((crumb, index) => (
        <React.Fragment key={crumb}>
          {index > 0 ? (
            <span style={{ color: theme.chromeDim, fontSize: 11 }}>/</span>
          ) : null}
          <span
            style={{
              color:
                index === content.breadcrumb.length - 1 ? theme.code : theme.chrome,
            }}
          >
            {crumb}
          </span>
        </React.Fragment>
      ))}
    </div>

    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: 260,
          height: 25,
          padding: "0 9px",
          borderRadius: 6,
          background: theme.field,
          border: `1px solid ${theme.border}`,
        }}
      >
        <SearchGlyph size={12} color={theme.chromeDim} />
        <span style={{ fontSize: 11.5, color: theme.chromeDim, flex: 1 }}>
          Search files and symbols
        </span>
        <span
          style={{
            fontSize: 10,
            fontFamily: FONT_MONO,
            color: theme.chromeDim,
            border: `1px solid ${theme.border}`,
            borderRadius: 3,
            padding: "0.5px 4px",
          }}
        >
          Ctrl K
        </span>
      </div>
    </div>
  </div>
);
