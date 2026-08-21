import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { Paper } from "../components/Paper";
import { PhoneCharacter } from "../components/PhoneCharacter";
import { SpeakerCharacter } from "../components/SpeakerCharacter";
import { Arrow } from "../components/Arrow";
import { DataPackets } from "../components/DataPacket";
import { MiniIcon, MiniIconKind } from "../components/MiniIcon";
import { SceneLabel } from "../components/SceneLabel";
import { CameraMove } from "../components/CameraMove";
import { HAND_DRAWN_FILTER_ID } from "../components/HandDrawnFilter";
import { PALETTE } from "../constants";
import { PHONE_POS, SPEAKER_POS } from "../layout";

export const dataTransferSceneSchema = z.object({
  packetLabel: z.string(),
  rangeLabel: z.string(),
  extraLabel: z.string(),
});

export type DataTransferSceneProps = z.infer<typeof dataTransferSceneSchema>;

export const dataTransferSceneDefaults: DataTransferSceneProps = {
  packetLabel: "Data travels as tiny packets, super fast",
  rangeLabel: "Works up to about 10 meters (33 ft) away",
  extraLabel: "Headphones. Speakers. Keyboards. Watches. Mice.",
};

const RANGE_CENTER = { x: (PHONE_POS.x + SPEAKER_POS.x) / 2, y: (PHONE_POS.y + SPEAKER_POS.y) / 2 };
const RANGE_RADIUS = 470;

const ICONS: { kind: MiniIconKind }[] = [
  { kind: "headphones" },
  { kind: "keyboard" },
  { kind: "watch" },
  { kind: "mouse" },
];

// Scene 4 (0:18-0:26): packets stream between the paired devices, then we
// reveal the effective range, then a quick montage of other gadgets that
// use the same trick.
export const DataTransferScene: React.FC<DataTransferSceneProps> = ({
  packetLabel,
  rangeLabel,
  extraLabel,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const rangeProgress = interpolate(frame, [95, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const iconsStart = 185;

  return (
    <AbsoluteFill>
      <Paper />
      <CameraMove
        frame={frame}
        keyframes={[
          { frame: 0, scale: 1.1 },
          { frame: 100, scale: 1 },
          { frame: durationInFrames, scale: 0.94 },
        ]}
      >
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ position: "absolute" }}>
          {rangeProgress > 0 && (
            <circle
              cx={RANGE_CENTER.x}
              cy={RANGE_CENTER.y}
              r={RANGE_RADIUS}
              fill="none"
              stroke={PALETTE.ink}
              strokeWidth={4}
              strokeDasharray="16 14"
              opacity={rangeProgress * 0.5}
              style={{ filter: `url(#${HAND_DRAWN_FILTER_ID})` }}
            />
          )}

          <Arrow
            from={{ x: PHONE_POS.x + 90, y: PHONE_POS.y - 40 }}
            to={{ x: SPEAKER_POS.x - 100, y: SPEAKER_POS.y - 40 }}
            progress={1}
            color={PALETTE.ink}
            curveAmount={-70}
            dashed
          />
          <DataPackets
            from={{ x: PHONE_POS.x + 90, y: PHONE_POS.y - 40 }}
            to={{ x: SPEAKER_POS.x - 100, y: SPEAKER_POS.y - 40 }}
            curveAmount={-70}
            frame={frame}
            progress={interpolate(frame, [0, 15], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}
          />

          <PhoneCharacter x={PHONE_POS.x} y={PHONE_POS.y} frame={frame} happy connected bluetoothOn />
          <SpeakerCharacter x={SPEAKER_POS.x} y={SPEAKER_POS.y} frame={frame} happy connected bluetoothOn />
        </svg>
      </CameraMove>

      <SceneLabel
        text={packetLabel}
        frame={frame}
        appearFrame={6}
        x={960}
        y={175}
        fontSize={44}
        maxWidth={1300}
      />

      <SceneLabel
        text={rangeLabel}
        frame={frame}
        appearFrame={98}
        x={960}
        y={955}
        fontSize={42}
        maxWidth={1200}
      />

      {frame > iconsStart && (
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ position: "absolute" }}>
          {ICONS.map((icon, i) => {
            const localFrame = frame - iconsStart - i * 8;
            const opacity = interpolate(localFrame, [0, 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const bounce = interpolate(localFrame, [0, 12], [30, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <MiniIcon
                key={icon.kind}
                kind={icon.kind}
                x={760 + i * 140}
                y={620 + bounce}
                scale={1.6}
                opacity={opacity}
                color={PALETTE.blue}
              />
            );
          })}
        </svg>
      )}
      <SceneLabel
        text={extraLabel}
        frame={frame}
        appearFrame={iconsStart + 18}
        x={960}
        y={730}
        fontSize={38}
        maxWidth={1300}
      />
    </AbsoluteFill>
  );
};
