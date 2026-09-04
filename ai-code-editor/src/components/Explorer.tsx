import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

import type { Content } from "../content/types";
import { FONT_UI } from "../fonts";
import { T } from "../layout";
import type { Theme } from "../theme";
import { Chevron, FileGlyph, FolderGlyph, SearchGlyph, WarnGlyph } from "./Icons";

const ROW_H = 22;

export const Explorer: React.FC<{ theme: Theme; content: Content }> = ({ theme, content }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        background: theme.panel,
        borderRight: `1px solid ${theme.border}`,
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT_UI,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            letterSpacing: 0.9,
            textTransform: "uppercase",
            color: theme.chromeDim,
            fontWeight: 600,
          }}
        >
          Explorer
        </span>
        <span style={{ fontSize: 10.5, color: theme.chromeDim }}>{content.workspace}</span>
      </div>

      <div style={{ padding: "0 10px 8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            height: 24,
            padding: "0 8px",
            borderRadius: 5,
            background: theme.field,
            border: `1px solid ${theme.border}`,
          }}
        >
          <SearchGlyph size={11} color={theme.chromeDim} />
          <span style={{ fontSize: 11, color: theme.chromeDim }}>Filter files</span>
        </div>
      </div>

      <div style={{ flex: 1, paddingTop: 2 }}>
        {content.tree.map((node, index) => {
          const start = T.explorerStart + index * T.explorerStagger;
          const opacity = interpolate(
            frame,
            [start, start + T.explorerFade],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const shift = interpolate(frame, [start, start + T.explorerFade], [-5, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const isFolder = node.kind !== "file";
          const color = node.active ? theme.code : theme.chrome;

          return (
            <div
              key={`${node.depth}-${node.label}`}
              style={{
                position: "relative",
                height: ROW_H,
                display: "flex",
                alignItems: "center",
                gap: 6,
                paddingLeft: 10 + node.depth * 13,
                paddingRight: 10,
                opacity,
                transform: `translateX(${shift}px)`,
                background: node.active ? theme.hover : "transparent",
              }}
            >
              {node.active ? (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: theme.accent,
                  }}
                />
              ) : null}

              {isFolder ? (
                <>
                  <Chevron size={11} color={theme.chromeDim} open={node.kind === "open"} />
                  <FolderGlyph size={12} color={theme.chromeDim} />
                </>
              ) : (
                <>
                  <span style={{ width: 11 }} />
                  <FileGlyph size={12} color={node.warn ? theme.badge : theme.chromeDim} />
                </>
              )}

              <span
                style={{
                  fontSize: 12,
                  color,
                  fontWeight: node.active ? 500 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  flex: 1,
                }}
              >
                {node.label}
              </span>

              {node.warn ? <WarnGlyph size={11} color={theme.badge} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
