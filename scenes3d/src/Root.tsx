import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { DEV_ROWS, ROWS } from "./catalog";
import { Stage } from "./kit/Stage";

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const DURATION = 600;

type Props = { rowId: string; loopCheck?: boolean };

const Look: React.FC<Props> = ({ rowId }) => {
  const r = [...ROWS, ...DEV_ROWS].find((x) => x.id === rowId);
  if (!r) throw new Error(`Unknown row ${rowId}`);
  return <Stage factory={r.factory} params={r.params} prepare={r.prepare} />;
};

// --props='{"loopCheck":true}' makes a composition 601 frames long so that
// frames 0 and 600 can be compared.
const meta: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: props.loopCheck ? DURATION + 1 : DURATION,
});

export const RemotionRoot: React.FC = () => (
  <>
    {[...ROWS, ...DEV_ROWS].map((r) => (
      <Composition
        key={r.id}
        id={r.id}
        component={Look}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ rowId: r.id, loopCheck: false }}
        calculateMetadata={meta}
      />
    ))}
  </>
);
