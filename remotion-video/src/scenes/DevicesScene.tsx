import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { Paper } from "../components/Paper";
import { PhoneCharacter } from "../components/PhoneCharacter";
import { SpeakerCharacter } from "../components/SpeakerCharacter";
import { SceneLabel } from "../components/SceneLabel";
import { CameraMove } from "../components/CameraMove";
import { PALETTE } from "../constants";
import { PHONE_POS, SPEAKER_POS } from "../layout";

export const devicesSceneSchema = z.object({
  phoneLabel: z.string(),
  speakerLabel: z.string(),
  caption: z.string(),
});

export type DevicesSceneProps = z.infer<typeof devicesSceneSchema>;

export const devicesSceneDefaults: DevicesSceneProps = {
  phoneLabel: "Your Phone",
  speakerLabel: "Bluetooth Speaker",
  caption: "Every Bluetooth gadget hides a tiny radio inside.",
};

const PHONE_TARGET = PHONE_POS;
const SPEAKER_TARGET = SPEAKER_POS;

// Scene 2 (0:05-0:11): the two characters slide in and wave hello, camera
// pans gently across them while a caption explains what's inside.
export const DevicesScene: React.FC<DevicesSceneProps> = ({
  phoneLabel,
  speakerLabel,
  caption,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const phoneEntrance = spring({
    frame,
    fps,
    config: { damping: 13, mass: 0.8 },
  });
  const speakerEntrance = spring({
    frame: frame - 10,
    fps,
    config: { damping: 13, mass: 0.8 },
  });

  const phoneX = PHONE_TARGET.x + interpolate(phoneEntrance, [0, 1], [-520, 0]);
  const speakerX = SPEAKER_TARGET.x + interpolate(speakerEntrance, [0, 1], [520, 0]);

  const waving = frame > 45 && frame < 100;

  return (
    <AbsoluteFill>
      <Paper />
      <CameraMove
        frame={frame}
        keyframes={[
          { frame: 0, scale: 1.02, x: -30 },
          { frame: durationInFrames / 2, scale: 1, x: 0 },
          { frame: durationInFrames, scale: 1.02, x: 30 },
        ]}
      >
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ position: "absolute" }}>
          <PhoneCharacter x={phoneX} y={PHONE_TARGET.y} frame={frame} waving={waving} happy bluetoothOn />
          <SpeakerCharacter x={speakerX} y={SPEAKER_TARGET.y} frame={frame} waving={waving} happy bluetoothOn />
        </svg>
      </CameraMove>

      <SceneLabel
        text={phoneLabel}
        frame={frame}
        appearFrame={18}
        x={PHONE_TARGET.x}
        y={330}
        fontSize={40}
        underline
        underlineColor={PALETTE.blue}
      />
      <SceneLabel
        text={speakerLabel}
        frame={frame}
        appearFrame={28}
        x={SPEAKER_TARGET.x}
        y={330}
        fontSize={40}
        underline
        underlineColor={PALETTE.blue}
      />

      <SceneLabel
        text={caption}
        frame={frame}
        appearFrame={95}
        x={960}
        y={960}
        fontSize={46}
        maxWidth={1300}
      />
    </AbsoluteFill>
  );
};
