import React, { useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";

import { Assistant } from "./components/Assistant";
import { EditorPane } from "./components/Editor";
import { Explorer } from "./components/Explorer";
import { Terminal } from "./components/Terminal";
import { TitleBar } from "./components/TitleBar";
import { PYTHON } from "./content/python";
import { TYPESCRIPT } from "./content/typescript";
import type { Content } from "./content/types";
import "./fonts";
import { highlight } from "./highlight";
import type { HLine } from "./highlight";
import {
  BODY_H,
  COL_ASSISTANT,
  COL_EDITOR,
  COL_EXPLORER,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
} from "./layout";
import { DARK, LIGHT } from "./theme";

export type AiEditorProps = {
  themeId: "dark" | "light";
  contentId: "python" | "typescript";
};

const CONTENT: Record<AiEditorProps["contentId"], Content> = {
  python: PYTHON,
  typescript: TYPESCRIPT,
};

/**
 * Prism runs once per source string for the whole render, never per frame; the
 * animation only reveals more of the pre-tokenised lines as the frame advances.
 */
const cache = new Map<string, HLine[]>();
const tokenise = (key: string, code: string, language: Content["language"]): HLine[] => {
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  const lines = highlight(code, language);
  cache.set(key, lines);
  return lines;
};

export const AiEditor: React.FC<AiEditorProps> = ({ themeId, contentId }) => {
  const { width } = useVideoConfig();
  const theme = themeId === "dark" ? DARK : LIGHT;
  const content = CONTENT[contentId];

  const lines = useMemo(
    () => tokenise(`${contentId}:file`, content.code, content.language),
    [contentId, content],
  );
  const replyCodeLines = useMemo(
    () => tokenise(`${contentId}:reply`, content.chat.replyCode, content.language),
    [contentId, content],
  );

  const scale = width / DESIGN_WIDTH;
  const assistantWidth = Math.round(DESIGN_WIDTH * COL_ASSISTANT);

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <div
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          display: "flex",
          flexDirection: "column",
          background: theme.bg,
          color: theme.code,
        }}
      >
        <TitleBar theme={theme} content={content} />

        <div
          style={{
            height: BODY_H,
            display: "grid",
            gridTemplateColumns: `${COL_EXPLORER * 100}% ${COL_EDITOR * 100}% ${
              COL_ASSISTANT * 100
            }%`,
          }}
        >
          <Explorer theme={theme} content={content} />

          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <EditorPane theme={theme} content={content} lines={lines} />
            <Terminal theme={theme} content={content} />
          </div>

          <Assistant
            theme={theme}
            content={content}
            replyCodeLines={replyCodeLines}
            width={assistantWidth}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
