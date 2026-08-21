import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { Paper } from "../components/Paper";
import { BluetoothLogo } from "../components/BluetoothLogo";
import { SceneLabel } from "../components/SceneLabel";
import { CameraMove } from "../components/CameraMove";
import { FONT_FAMILY, PALETTE } from "../constants";

export const titleSceneSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  logoColor: z.string(),
});

export type TitleSceneProps = z.infer<typeof titleSceneSchema>;

export const titleSceneDefaults: TitleSceneProps = {
  title: "How Does Bluetooth Work?",
  subtitle: "A 30-second explainer",
  logoColor: PALETTE.blue,
};

// Scene 1 (0:00-0:05): logo draws itself on, title + subtitle pop in,
// camera does a slow push-in to open the video.
export const TitleScene: React.FC<TitleSceneProps> = ({
  title,
  subtitle,
  logoColor,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const logoProgress = interpolate(frame, [6, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoScale = interpolate(frame, [0, 20], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Paper />
      <CameraMove
        frame={frame}
        keyframes={[
          { frame: 0, scale: 1 },
          { frame: durationInFrames, scale: 1.06 },
        ]}
      >
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: `scale(${logoScale})` }}>
            <BluetoothLogo progress={logoProgress} size={170} color={logoColor} />
          </div>
        </AbsoluteFill>
      </CameraMove>

      <SceneLabel
        text={title}
        frame={frame}
        appearFrame={40}
        x={960}
        y={660}
        fontSize={84}
        underline
        maxWidth={1400}
      />
      <SceneLabel
        text={subtitle}
        frame={frame}
        appearFrame={68}
        x={960}
        y={745}
        fontSize={42}
        color={PALETTE.ink}
        maxWidth={900}
      />
      <div
        style={{
          position: "absolute",
          bottom: 40,
          width: "100%",
          textAlign: "center",
          fontFamily: FONT_FAMILY,
          fontSize: 28,
          color: PALETTE.ink,
          opacity: interpolate(frame, [90, 115], [0, 0.6], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        grab a pencil, let's sketch it out ✏️
      </div>
    </AbsoluteFill>
  );
};
