import React from "react";
import { Composition } from "remotion";
import { LookCanvas } from "./lib/LookCanvas";
import { FPS, HEIGHT, LOOP, WIDTH } from "./lib/loop";
import { VARIANTS } from "./variants";

type Props = { variant: string; loopCheck?: boolean; topDown?: boolean };

const Look: React.FC<Props> = ({ variant, topDown }) => {
  const v = VARIANTS.find((x) => x.id === variant);
  if (!v) throw new Error(`Unknown variant ${variant}`);
  return <LookCanvas factory={v.factory} opts={{ topDown }} />;
};

export const RemotionRoot: React.FC = () => (
  <>
    {VARIANTS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={Look}
        defaultProps={{ variant: v.id, loopCheck: false } as Props}
        // --props='{"loopCheck":true}' adds frame 600 for the seamless-loop test
        calculateMetadata={({ props }) => ({ durationInFrames: LOOP + (props.loopCheck ? 1 : 0) })}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
  </>
);
