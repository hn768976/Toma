// The standalone player shell: one fixed 1920x1080 frame with a composition
// inside it, and the controls parked OUTSIDE that frame so a screen recording
// cropped to the frame never catches them.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";

const CONTROL_BAR_HEIGHT = 74;
const WIDTH = 1920;
const HEIGHT = 1080;

export type StageTheme = {
  /** Page colour behind and below the frame. */
  page: string;
  /** Control-bar text and button colours. */
  meta: string;
  buttonText: string;
  buttonBackground: string;
  accent: string;
  accentText: string;
  fontStack: string;
};

export const Stage: React.FC<{
  component: React.ComponentType;
  durationInFrames: number;
  fps: number;
  meta: string;
  theme: StageTheme;
}> = ({ component, durationInFrames, fps, meta, theme }) => {
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

  const button = (primary: boolean): React.CSSProperties => ({
    appearance: "none",
    border: "none",
    cursor: "pointer",
    borderRadius: 999,
    padding: "11px 26px",
    fontFamily: theme.fontStack,
    fontWeight: 700,
    fontSize: 17,
    letterSpacing: "0.01em",
    textTransform: "lowercase",
    color: primary ? theme.accentText : theme.buttonText,
    backgroundColor: primary ? theme.accent : theme.buttonBackground,
  });

  return (
    <div style={{ width: WIDTH, height: HEIGHT + CONTROL_BAR_HEIGHT, position: "relative" }}>
      {/* Everything above this line is the recordable area. */}
      <div style={{ width: WIDTH, height: HEIGHT, position: "relative" }}>
        <Player
          ref={player}
          component={component}
          durationInFrames={durationInFrames}
          fps={fps}
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
          fontFamily: theme.fontStack,
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: theme.meta,
          }}
        >
          {meta}
        </span>
        <button type="button" onClick={toggle} style={button(false)}>
          {playing ? "pause" : "play"}
        </button>
        <button type="button" onClick={replay} style={button(true)}>
          replay
        </button>
      </div>
    </div>
  );
};
