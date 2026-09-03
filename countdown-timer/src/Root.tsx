import React from "react";
import { Composition } from "remotion";
import { CountdownTimer } from "./countdown/CountdownTimer";
import { VARIANTS } from "./countdown/variants";

/**
 * The three versions differ only in how long they run. Everything else —
 * palette, bar count, digit construction, glow, drift — is shared, which
 * is the whole point of the set.
 *
 * Each `durationInFrames` below is the timer itself plus the 30-frame
 * hold on 00:00 at the end.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Countdown60"
        component={CountdownTimer}
        durationInFrames={VARIANTS.sixty.durationInFrames}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "sixty" as const }}
      />
    </>
  );
};
