// The standalone player page: one fixed 1920x1080 frame with the composition
// inside it, and a replay button parked OUTSIDE that frame so a screen
// recording cropped to the frame never catches the control.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  DURATION_IN_FRAMES,
  FONT_STACK,
  FPS,
  HEIGHT,
  PALETTE,
  WIDTH,
} from "../vault/constants";
import { KurzgesagtVault } from "../vault/KurzgesagtVault";

const CONTROL_BAR_HEIGHT = 74;

export const Stage: React.FC = () => {
  const player = useRef<PlayerRef>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const ref = player.current;
    if (!ref) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    ref.addEventListener("play", onPlay);
    ref.addEventListener("pause", onPause);
    ref.addEventListener("ended", onEnded);
    return () => {
      ref.removeEventListener("play", onPlay);
      ref.removeEventListener("pause", onPause);
      ref.removeEventListener("ended", onEnded);
    };
  }, []);

  const replay = useCallback(() => {
    const ref = player.current;
    if (!ref) return;
    ref.seekTo(0);
    ref.play();
  }, []);

  const toggle = useCallback(() => {
    const ref = player.current;
    if (!ref) return;
    if (ref.isPlaying()) ref.pause();
    else ref.play();
  }, []);

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT + CONTROL_BAR_HEIGHT,
        position: "relative",
      }}
    >
      {/* Everything above this line is the recordable area. */}
      <div style={{ width: WIDTH, height: HEIGHT, position: "relative" }}>
        <Player
          ref={player}
          component={KurzgesagtVault}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          compositionWidth={WIDTH}
          compositionHeight={HEIGHT}
          style={{ width: WIDTH, height: HEIGHT }}
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          autoPlay
        />
      </div>

      {/* Controls live below the frame, outside the recording. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: HEIGHT,
          width: WIDTH,
          height: CONTROL_BAR_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 12,
          paddingTop: 18,
          fontFamily: FONT_STACK,
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "rgba(247, 243, 233, 0.34)",
          }}
        >
          1920 × 1080 · 29s · 30fps
        </span>
        <button type="button" onClick={toggle} style={buttonStyle(false)}>
          {playing ? "pause" : "play"}
        </button>
        <button type="button" onClick={replay} style={buttonStyle(true)}>
          replay
        </button>
      </div>
    </div>
  );
};

const buttonStyle = (primary: boolean): React.CSSProperties => ({
  appearance: "none",
  border: "none",
  cursor: "pointer",
  borderRadius: 999,
  padding: "11px 26px",
  fontFamily: FONT_STACK,
  fontWeight: 700,
  fontSize: 17,
  letterSpacing: "0.01em",
  textTransform: "lowercase",
  color: primary ? PALETTE.navy : PALETTE.cream,
  backgroundColor: primary ? PALETTE.teal : "rgba(247, 243, 233, 0.1)",
});
