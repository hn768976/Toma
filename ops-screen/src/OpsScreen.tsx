import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { BarReadout } from "./components/BarReadout";
import { CodePanel } from "./components/CodePanel";
import { FileTable } from "./components/FileTable";
import { LogStream } from "./components/LogStream";
import { MarginStrip } from "./components/MarginStrip";
import { BackgroundField, ScreenTexture } from "./components/Overlays";
import { Window } from "./components/Window";
import { TABLE_A, TABLE_B, TABLE_C } from "./content";
import { area } from "./layout";
import { MONO } from "./load-fonts";
import { BLUE, GREEN, type Theme } from "./theme";
import "./load-fonts";

export type Variant = "green" | "blue";

const THEMES: Record<Variant, Theme> = { green: GREEN, blue: BLUE };

/**
 * Text sizes as fractions of frame height. Quoted here against a
 * 1080-tall frame; at 2160 every number doubles and the 1080p preview
 * stays an exact scale model of the 4K render.
 */
const SIZE = {
  listing: 0.0072, // ~7.8px at 1080p — texture, not reading matter
  log: 0.0088, // ~9.5px
  bars: 0.0088,
  code: 0.0155, // ~16.7px — the one thing that must be readable
};

export const OpsScreen: React.FC<{ variant: Variant }> = ({ variant }) => {
  const theme = THEMES[variant];
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: theme.bgDeep, fontFamily: MONO }}>
      <BackgroundField theme={theme} />

      <AbsoluteFill style={{ display: "flex", flexDirection: "row" }}>
        <MarginStrip theme={theme} width={width * 0.046} />

        {/* The window field: one 24 x 24 grid, windows claim cells on it
            and overlap by design. z-index puts the code panel on top. */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(24, 1fr)",
            gridTemplateRows: "repeat(24, 1fr)",
            padding: `${height * 0.022}px ${width * 0.018}px ${height * 0.022}px ${width * 0.01}px`,
          }}
        >
          <Window
            theme={theme}
            title="DATA(01)::SCAN(4B)"
            meta="ID 09 882 51"
            appearAt={0}
            style={{ ...area(1, 8, 2, 18), zIndex: 1 }}
          >
            <FileTable
              theme={theme}
              rows={TABLE_A}
              from={30}
              to={132}
              scale={SIZE.listing}
            />
          </Window>

          <Window
            theme={theme}
            title="DATA(03)::INDEX(1F)"
            meta="ID 77 199 62"
            appearAt={8}
            style={{ ...area(18, 25, 2, 25), zIndex: 1 }}
          >
            <FileTable
              theme={theme}
              rows={TABLE_B}
              from={44}
              to={150}
              scale={SIZE.listing}
            />
          </Window>

          <Window
            theme={theme}
            title="DATA(02)::QUEUE(0C)"
            meta="ID 41 306 08"
            appearAt={16}
            style={{ ...area(7, 15, 1, 5), zIndex: 2 }}
          >
            <FileTable
              theme={theme}
              rows={TABLE_C}
              from={38}
              to={96}
              scale={SIZE.listing}
              columns={2}
              showState={false}
            />
          </Window>

          <Window
            theme={theme}
            title="LEVELS(02)"
            meta="CH 07"
            appearAt={32}
            style={{ ...area(14, 19, 1, 5), zIndex: 3 }}
          >
            <BarReadout theme={theme} scale={SIZE.bars} />
          </Window>

          <Window
            theme={theme}
            title="STREAM(07)"
            meta="TRACE"
            appearAt={24}
            style={{ ...area(1, 7, 18, 25), zIndex: 3 }}
          >
            <LogStream theme={theme} scale={SIZE.log} />
          </Window>

          <Window
            theme={theme}
            title="EDIT(00)::SEGMENT"
            meta="ID 77 199 62"
            appearAt={40}
            accent
            style={{ ...area(6, 17, 4, 25), zIndex: 6 }}
          >
            <CodePanel theme={theme} scale={SIZE.code} />
          </Window>
        </div>
      </AbsoluteFill>

      <ScreenTexture theme={theme} />
    </AbsoluteFill>
  );
};
