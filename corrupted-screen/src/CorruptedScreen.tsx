import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CorruptionCanvas } from "./layers/CorruptionCanvas";
import { Grain } from "./layers/Grain";
import { Message } from "./layers/Message";
import { Optics } from "./layers/Optics";
import { Scanlines } from "./layers/Scanlines";
import { PERSPECTIVE_RATIO, planeSize, ROTATE_Y, ROTATE_Z } from "./lib/plane";
import { hash, seedOf, signed } from "./lib/rand";
import { splitOffset, tearOffsets } from "./lib/tear";
import { Theme } from "./lib/theme";
import { glitchLevel, loopFrame, wobble } from "./lib/timing";
import { usePixelRatio } from "./lib/usePixelRatio";

const JOLT = seedOf("frame/jolt");

export type CorruptedScreenProps = {
  theme: Theme;
  showMessage: boolean;
};

export const CorruptedScreen: React.FC<CorruptedScreenProps> = ({ theme, showMessage }) => {
  const { width, height } = useVideoConfig();
  const frame = loopFrame(useCurrentFrame());
  const pixelRatio = usePixelRatio();

  const { planeWidth, planeHeight } = planeSize(width, height);

  const level = glitchLevel(frame);
  const tear = tearOffsets(frame, planeWidth, level);
  const split = splitOffset(frame, planeWidth, level);

  // No camera motion beyond a float that returns to where it started; every
  // term completes a whole number of cycles over the 600 frames.
  const floatX = wobble(frame, 1) * width * 0.0016;
  const floatY = wobble(frame, 2, 1.1) * height * 0.0013;
  const floatRoll = wobble(frame, 1, 0.6) * 0.16;

  // During the loudest frames the whole signal jumps sideways for a frame.
  const jolt = level > 0.6 ? signed(JOLT, frame) * width * 0.006 : 0;
  const joltY = level > 0.75 && hash(JOLT, frame, 1) < 0.4 ? signed(JOLT, frame, 2) * height * 0.004 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          perspective: width * PERSPECTIVE_RATIO,
          perspectiveOrigin: "50% 44%",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (width - planeWidth) / 2,
            top: (height - planeHeight) / 2,
            width: planeWidth,
            height: planeHeight,
            transform: `translate(${floatX + jolt}px, ${floatY + joltY}px) rotateY(${ROTATE_Y}deg) rotateZ(${
              ROTATE_Z + floatRoll
            }deg)`,
            transformStyle: "preserve-3d",
            backgroundColor: theme.bg,
          }}
        >
          <CorruptionCanvas
            theme={theme}
            planeWidth={planeWidth}
            planeHeight={planeHeight}
            frame={frame}
            level={level}
            tear={tear}
            split={split}
            pixelRatio={pixelRatio}
          />
          <Scanlines
            theme={theme}
            planeWidth={planeWidth}
            planeHeight={planeHeight}
            frame={frame}
            level={level}
          />
          {showMessage ? (
            <Message
              theme={theme}
              planeWidth={planeWidth}
              planeHeight={planeHeight}
              frame={frame}
              level={level}
              tear={tear}
              split={split}
            />
          ) : null}
        </div>
      </AbsoluteFill>

      <Optics theme={theme} width={width} height={height} frame={frame} level={level} />
      <Grain width={width} height={height} frame={frame} pixelRatio={pixelRatio} />
    </AbsoluteFill>
  );
};
