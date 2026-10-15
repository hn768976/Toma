import React from "react";
import { Composition } from "remotion";
import { Aurora } from "./looks/aurora/Aurora";
import { Brain } from "./looks/brain/Brain";
import { StarDisc } from "./looks/stardisc/StarDisc";
import { Diatoms } from "./looks/diatoms/Diatoms";
import { SatelliteNetwork } from "./looks/satellites/SatelliteNetwork";
import { ROWS, Row } from "./rows";

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
/** 20s loops. The loop check passes --props='{"loopCheck":true}' for 601 frames. */
export const DURATION = 600;

type Props = { row: Row; loopCheck?: boolean };

const Look: React.FC<Props> = ({ row }) => {
  switch (row.look) {
    case "brain":
      return <Brain params={row.params} />;
    case "aurora":
      return <Aurora params={row.params} />;
    case "stardisc":
      return <StarDisc params={row.params} />;
    case "diatoms":
      return <Diatoms params={row.params} />;
    case "satellites":
      return <SatelliteNetwork params={row.params} />;
  }
};

export const RemotionRoot: React.FC = () => (
  <>
    {ROWS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={Look}
        durationInFrames={DURATION}
        calculateMetadata={({ props }: { props: Props }) => ({ durationInFrames: props.loopCheck ? DURATION + 1 : DURATION })}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ row, loopCheck: false } as Props}
      />
    ))}
  </>
);
