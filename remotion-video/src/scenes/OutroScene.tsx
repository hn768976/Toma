import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { Paper } from "../components/Paper";
import { BluetoothLogo } from "../components/BluetoothLogo";
import { SceneLabel } from "../components/SceneLabel";
import { FONT_FAMILY, PALETTE } from "../constants";

export const outroSceneSchema = z.object({
  recapLines: z.array(z.string()),
  closingLine: z.string(),
  farewell: z.string(),
});

export type OutroSceneProps = z.infer<typeof outroSceneSchema>;

export const outroSceneDefaults: OutroSceneProps = {
  recapLines: ["Short-range.", "Low-power.", "Always ready to connect."],
  closingLine: "Now you know how Bluetooth works!",
  farewell: "Thanks for watching!",
};

const FADE_START = 95;
const FADE_END = 120;

// Scene 5 (0:26-0:30): a quick hand-written recap, then the whole sketch
// fades to a clean Bluetooth-blue card with a farewell line.
export const OutroScene: React.FC<OutroSceneProps> = ({
  recapLines,
  closingLine,
  farewell,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoProgress = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoScale = spring({ frame, fps, config: { damping: 12 } });

  const contentOpacity = interpolate(frame, [FADE_START, FADE_END], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const farewellOpacity = interpolate(frame, [FADE_START + 5, FADE_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: PALETTE.blue }} />

      <AbsoluteFill style={{ opacity: contentOpacity }}>
        <Paper />
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 90 }}>
          <div style={{ transform: `scale(${interpolate(logoScale, [0, 1], [0.4, 1])})` }}>
            <BluetoothLogo progress={logoProgress} size={100} />
          </div>
        </AbsoluteFill>

        {recapLines.map((line, i) => (
          <SceneLabel
            key={line}
            text={`✓  ${line}`}
            frame={frame}
            appearFrame={22 + i * 14}
            x={960}
            y={430 + i * 90}
            fontSize={50}
            align="center"
            color={PALETTE.ink}
          />
        ))}

        <SceneLabel
          text={closingLine}
          frame={frame}
          appearFrame={22 + recapLines.length * 14 + 10}
          x={960}
          y={880}
          fontSize={58}
          color={PALETTE.blue}
          underline
          maxWidth={1500}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          opacity: farewellOpacity,
        }}
      >
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 84,
            color: PALETTE.white,
          }}
        >
          {farewell}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
