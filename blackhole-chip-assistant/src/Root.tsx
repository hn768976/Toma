import React from "react";
import { CalculateMetadataFunction, Composition, Folder } from "remotion";
import { BlackHole, BlackHoleProps } from "./blackhole/BlackHole";
import { ChipProps, ProcessorChip } from "./chip/Chip";
import { AIAssistant } from "./assistant/Assistant";
import { ASSISTANT_FRAMES, FPS, HEIGHT, LOOP_FRAMES, WIDTH } from "./common/constants";

/**
 * Loop test: pass --props='{"loopTest":true}' to make a looping composition
 * 601 frames long with the loop phase un-wrapped, then compare frame 0 with
 * frame 600. Normal renders ignore this.
 */
type LoopTestProps = { loopTest?: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loopMeta: CalculateMetadataFunction<any> = ({ props }) => ({
  durationInFrames: (props as LoopTestProps).loopTest ? LOOP_FRAMES + 1 : LOOP_FRAMES,
});

const BlackHoleComp: React.FC<BlackHoleProps & LoopTestProps> = ({ loopTest, ...p }) => (
  <BlackHole {...p} wrap={!loopTest} />
);

const ChipComp: React.FC<ChipProps & LoopTestProps> = ({ loopTest, ...p }) => (
  <ProcessorChip {...p} wrap={!loopTest} />
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Look1-BlackHole">
        <Composition
          id="BlackHole-Blue"
          component={BlackHoleComp}
          durationInFrames={LOOP_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ palette: "blue" as const, loopTest: false }}
          calculateMetadata={loopMeta}
        />
        <Composition
          id="BlackHole-Gold"
          component={BlackHoleComp}
          durationInFrames={LOOP_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ palette: "gold" as const, loopTest: false }}
          calculateMetadata={loopMeta}
        />
      </Folder>
      <Folder name="Look2-ProcessorChip">
        <Composition
          id="ProcessorChip-Blue"
          component={ChipComp}
          durationInFrames={LOOP_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ palette: "blue" as const, loopTest: false }}
          calculateMetadata={loopMeta}
        />
        <Composition
          id="ProcessorChip-Gold"
          component={ChipComp}
          durationInFrames={LOOP_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ palette: "gold" as const, loopTest: false }}
          calculateMetadata={loopMeta}
        />
      </Folder>
      {/* Look 3 is a one-way chat exchange: 300 frames, NOT a loop. */}
      <Folder name="Look3-AIAssistant">
        <Composition
          id="AIAssistant-Neon"
          component={AIAssistant}
          durationInFrames={ASSISTANT_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ palette: "neon" as const }}
        />
        <Composition
          id="AIAssistant-Terminal"
          component={AIAssistant}
          durationInFrames={ASSISTANT_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ palette: "terminal" as const }}
        />
      </Folder>
    </>
  );
};
