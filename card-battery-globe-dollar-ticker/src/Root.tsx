import React from "react";
import { Composition } from "remotion";
import { LookCanvas, LookFactory } from "./lib/LookCanvas";
import { circuitBattery } from "./looks/circuitBattery";
import { paymentNetwork } from "./looks/paymentNetwork";
import { Version, VERSIONS } from "./versions";

const W = 3840;
const H = 2160;
const FPS = 30;
const FRAMES = 600;

const FACTORIES: Record<Version["look"], LookFactory<never>> = {
  payment: paymentNetwork as LookFactory<never>,
  battery: circuitBattery as LookFactory<never>,
};

const LookComp: React.FC<{ look: Version["look"]; params: Version["params"] }> = ({ look, params }) => (
  <LookCanvas factory={FACTORIES[look]} params={params as never} />
);

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={LookComp}
        defaultProps={{ look: v.look, params: v.params }}
        durationInFrames={FRAMES}
        fps={FPS}
        width={W}
        height={H}
      />
    ))}
  </>
);
