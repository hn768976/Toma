import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { Paper } from "../components/Paper";
import { PhoneCharacter } from "../components/PhoneCharacter";
import { SpeakerCharacter } from "../components/SpeakerCharacter";
import { RadioWaves } from "../components/RadioWaves";
import { Arrow } from "../components/Arrow";
import { FrequencyHop } from "../components/FrequencyHop";
import { SceneLabel } from "../components/SceneLabel";
import { CameraMove } from "../components/CameraMove";
import { useDrawOn } from "../hooks/useDrawOn";
import { FONT_FAMILY, PALETTE } from "../constants";
import { PHONE_POS, SPEAKER_POS } from "../layout";

export const pairingSceneSchema = z.object({
  waveLabel: z.string(),
  hopLabel: z.string(),
  pairedLabel: z.string(),
});

export type PairingSceneProps = z.infer<typeof pairingSceneSchema>;

export const pairingSceneDefaults: PairingSceneProps = {
  waveLabel: "They talk using 2.4 GHz radio waves",
  hopLabel: "...hopping channels 1,600×/sec to dodge interference",
  pairedLabel: "Paired!",
};

const HANDSHAKE_START = 75;
const HANDSHAKE_END = 118;

// Scene 3 (0:11-0:18): the devices exchange radio waves, a frequency-hop
// diagram explains why Bluetooth barely ever gets jammed, then they shake
// hands and lock in a "Paired!" badge.
export const PairingScene: React.FC<PairingSceneProps> = ({
  waveLabel,
  hopLabel,
  pairedLabel,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { ref: checkRef, dashProps } = useDrawOn();

  const handshakeProgress = interpolate(
    frame,
    [HANDSHAKE_START, HANDSHAKE_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const paired = frame > HANDSHAKE_END;
  const pairedBounce = spring({
    frame: frame - HANDSHAKE_END,
    fps,
    config: { damping: 10, mass: 0.6 },
  });

  const wavesOpacity = interpolate(frame, [HANDSHAKE_START - 5, HANDSHAKE_START + 15], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hopOpacity = interpolate(frame, [HANDSHAKE_START - 5, HANDSHAKE_START + 15], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Paper />
      <CameraMove
        frame={frame}
        keyframes={[
          { frame: 0, scale: 1 },
          { frame: HANDSHAKE_START, scale: 1.08 },
          { frame: durationInFrames, scale: 1.12 },
        ]}
      >
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ position: "absolute" }}>
          <g opacity={wavesOpacity}>
            <RadioWaves center={PHONE_POS} frame={frame} angleDeg={0} />
            <RadioWaves center={SPEAKER_POS} frame={frame} angleDeg={180} color={PALETTE.orange} />
          </g>

          <Arrow
            from={{ x: PHONE_POS.x + 90, y: PHONE_POS.y - 40 }}
            to={{ x: SPEAKER_POS.x - 100, y: SPEAKER_POS.y - 40 }}
            progress={handshakeProgress}
            color={PALETTE.green}
            curveAmount={-70}
          />

          <PhoneCharacter x={PHONE_POS.x} y={PHONE_POS.y} frame={frame} happy={paired} connected={paired} bluetoothOn />
          <SpeakerCharacter x={SPEAKER_POS.x} y={SPEAKER_POS.y} frame={frame} happy={paired} connected={paired} bluetoothOn />
        </svg>
      </CameraMove>

      <div style={{ opacity: wavesOpacity }}>
        <SceneLabel
          text={waveLabel}
          frame={frame}
          appearFrame={8}
          x={960}
          y={175}
          fontSize={44}
          maxWidth={1300}
        />
      </div>

      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ position: "absolute", opacity: hopOpacity }}>
        <FrequencyHop
          x={960}
          y={870}
          frame={frame}
          progress={interpolate(frame, [30, 45], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
        />
      </svg>
      <div style={{ opacity: hopOpacity }}>
        <SceneLabel
          text={hopLabel}
          frame={frame}
          appearFrame={35}
          x={960}
          y={950}
          fontSize={34}
          color={PALETTE.ink}
          maxWidth={1200}
        />
      </div>

      {paired && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              transform: `scale(${interpolate(pairedBounce, [0, 1], [0.4, 1])})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <svg width={110} height={110} viewBox="-10 -10 120 120" style={{ overflow: "visible" }}>
              <circle
                cx={50}
                cy={50}
                r={48}
                fill={PALETTE.green}
                opacity={0.15}
                stroke={PALETTE.green}
                strokeWidth={5}
              />
              <path
                ref={checkRef}
                d="M 28 52 L 44 68 L 74 34"
                fill="none"
                stroke={PALETTE.green}
                strokeWidth={9}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={dashProps(interpolate(pairedBounce, [0, 1], [0, 1]))}
              />
            </svg>
            <div
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: 56,
                color: PALETTE.green,
              }}
            >
              {pairedLabel}
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
