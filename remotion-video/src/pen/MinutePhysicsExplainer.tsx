// "the alarm" — a 58s MinutePhysics-style explainer, 1740 frames at 30fps.
//
// One long sheet of white paper, 7680x1080. Everything is drawn on it left to
// right and the camera scrolls sideways past the marks; nothing is erased
// except once, in scene 6. Corrections are crossings-out.

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BellVibration } from "./BellVibration";
import { cameraAt } from "./camera";
import { buildSheet } from "./content";
import { ERASE_FRAME, HEIGHT, PAPER, WIDTH } from "./constants";
import { registerPenFont } from "./font";
import { InkMark } from "./Ink";

registerPenFont();

export const MinutePhysicsExplainer: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = cameraAt(frame);
  const marks = useMemo(() => buildSheet().marks, []);

  // Scale about the viewport centre, then scroll sideways.
  const transform = [
    `translate(${WIDTH / 2 - camera.centre * camera.scale} ${(HEIGHT / 2) * (1 - camera.scale)})`,
    `scale(${camera.scale})`,
  ].join(" ");

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, overflow: "hidden" }}>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ display: "block" }}
      >
        <g transform={transform}>
          {marks.map((mark, i) => (
            <InkMark key={i} mark={mark} frame={frame} id={`ink-${i}`} />
          ))}
          <BellVibration frame={frame} from={ERASE_FRAME + 6} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
