import React from "react";
import { Composition } from "remotion";
import { LookCanvas, LookFactory } from "./lib/LookCanvas";
import { circuitBattery } from "./looks/circuitBattery";
import { dollarGlobe } from "./looks/dollarGlobe";
import { mapTicker } from "./looks/mapTicker";
import { marketGlobe } from "./looks/marketGlobe";
import { paymentNetwork } from "./looks/paymentNetwork";
import { Version, VERSIONS } from "./versions";

const W = 3840;
const H = 2160;
const FPS = 30;
const FRAMES = 600;

const FACTORIES: Record<Version["look"], LookFactory<never>> = {
  payment: paymentNetwork as LookFactory<never>,
  battery: circuitBattery as LookFactory<never>,
  marketGlobe: marketGlobe as LookFactory<never>,
  dollarGlobe: dollarGlobe as LookFactory<never>,
  mapTicker: mapTicker as LookFactory<never>,
};

type CompProps = { look: Version["look"]; params: Version["params"]; loopCheck?: boolean };

const LookComp: React.FC<CompProps> = ({ look, params }) => (
  <LookCanvas factory={FACTORIES[look]} params={params as never} />
);

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={LookComp}
        defaultProps={{ look: v.look, params: v.params } as CompProps}
        durationInFrames={FRAMES}
        // Loop check (README): `--props='{"loopCheck":true}'` makes it 601 frames
        // so frame 600 can be rendered and compared with frame 0.
        calculateMetadata={({ props }) => ({
          durationInFrames: (props as { loopCheck?: boolean }).loopCheck ? FRAMES + 1 : FRAMES,
        })}
        fps={FPS}
        width={W}
        height={H}
      />
    ))}
  </>
);
