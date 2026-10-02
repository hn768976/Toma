import React from "react";
import { Composition } from "remotion";
import { BalanceScreen } from "./balance-screen/BalanceScreen";
import { BALANCE_VERSIONS, DURATION as BS_DURATION } from "./balance-screen/data";
import { CodeScreen, LOOP as CS_LOOP } from "./code-screen/CodeScreen";
import { EquationFlight } from "./equation-flight/EquationFlight";
import { LOOP as EF_LOOP } from "./equation-flight/field";

// All compositions are defined at 4K UHD, 30fps. Render previews with
// --scale=0.5 (1920x1080) and stills with --scale=1.5625 (6000x3375).
const W = 3840;
const H = 2160;
const FPS = 30;

/**
 * Loop check: pass {"loopCheck": true} in --props to make a looping
 * composition 601 frames long, so frame 600 can be rendered and compared
 * with frame 0. Leave it off for real renders.
 */
const loopLength =
  (loop: number) =>
  ({ props }: { props: { loopCheck?: boolean } }) => ({
    durationInFrames: props.loopCheck ? loop + 1 : loop,
  });

export const RemotionRoot: React.FC = () => (
  <>
    {/* Look 1 — Equation Flight (20 s seamless loops) */}
    <Composition
      id="EquationFlight-Black"
      component={EquationFlight}
      durationInFrames={EF_LOOP}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ variant: "black" as const, loopCheck: false }}
      calculateMetadata={loopLength(EF_LOOP)}
    />
    <Composition
      id="EquationFlight-Navy"
      component={EquationFlight}
      durationInFrames={EF_LOOP}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ variant: "navy" as const, loopCheck: false }}
      calculateMetadata={loopLength(EF_LOOP)}
    />

    {/* Look 2 — AI Code Screen (20 s seamless loops) */}
    <Composition
      id="AICodeScreen-Dark"
      component={CodeScreen}
      durationInFrames={CS_LOOP}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ variant: "dark" as const, loopCheck: false }}
      calculateMetadata={loopLength(CS_LOOP)}
    />
    <Composition
      id="AICodeScreen-Light"
      component={CodeScreen}
      durationInFrames={CS_LOOP}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ variant: "light" as const, loopCheck: false }}
      calculateMetadata={loopLength(CS_LOOP)}
    />

    {/* Look 3 — Balance Screen (10 s, one-way, NOT a loop) */}
    {(["drain", "grow"] as const).map((version) => (
      <Composition
        key={version}
        id={BALANCE_VERSIONS[version].id}
        component={BalanceScreen}
        durationInFrames={BS_DURATION}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ version }}
      />
    ))}
  </>
);
