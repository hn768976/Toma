import React from "react";
import { Composition, Still } from "remotion";
import { DataCable } from "./DataCable";
import { Diagnostics } from "./Diagnostics";
import { DURATION, FPS, HEIGHT, LOOKS, WIDTH } from "./looks";

/**
 * Eight compositions, two rigs. Adding a ninth is a data row in looks.ts --
 * see the README.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {LOOKS.map((config) => (
      <Composition
        key={config.id}
        id={config.id}
        component={DataCable}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ lookId: config.id }}
      />
    ))}
    {/* 601 frames so the verify loop can compare frame 600 against frame 0.
        Pass --props='{"lookId":"..."}' to point it at any look. */}
    <Composition
      id="LoopCheck"
      component={DataCable}
      durationInFrames={DURATION + 1}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ lookId: LOOKS[0].id }}
    />
    <Still id="Diagnostics" component={Diagnostics} width={1920} height={1080} />
  </>
);
