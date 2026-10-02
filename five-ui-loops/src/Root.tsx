import "./lib/fonts";
import React from "react";
import { CalculateMetadataFunction, Composition, Folder } from "remotion";
import {
  aiDiagnosisVersions,
  cartCounterVersions,
  dataStackVersions,
  dotMapVersions,
  gradientOrbVersions,
} from "./versions";
import { AIDiagnosis } from "./looks/ai-diagnosis/AIDiagnosis";
import { CartCounter } from "./looks/cart-counter/CartCounter";
import { DataStack } from "./looks/data-stack/DataStack";
import { DotWorldMap } from "./looks/dot-map/DotWorldMap";
import { GradientOrb } from "./looks/gradient-orb/GradientOrb";

const FPS = 30;
const W = 3840;
const H = 2160;

// Loop check: `--props='{"loopCheck":true}'` renders a looping composition at
// 601 frames so frame 600 can be compared against frame 0.
type LoopProps = { loopCheck?: boolean };
const loopMeta: CalculateMetadataFunction<LoopProps> = ({ props }) => ({
  durationInFrames: props.loopCheck ? 601 : 600,
});

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="AIDiagnosis">
      {aiDiagnosisVersions.map((v) => (
        <Composition
          key={v.key}
          id={`AIDiagnosis-${v.key}`}
          component={() => <AIDiagnosis version={v} />}
          durationInFrames={450}
          fps={FPS}
          width={W}
          height={H}
        />
      ))}
    </Folder>
    <Folder name="CartCounter">
      {cartCounterVersions.map((v) => (
        <Composition
          key={v.key}
          id={`CartCounter-${v.key}`}
          component={() => <CartCounter version={v} />}
          durationInFrames={300}
          fps={FPS}
          width={W}
          height={H}
        />
      ))}
    </Folder>
    <Folder name="DataStack">
      {dataStackVersions.map((v) => (
        <Composition
          key={v.key}
          id={`DataStack-${v.key}`}
          component={() => <DataStack version={v} />}
          durationInFrames={360}
          fps={FPS}
          width={W}
          height={H}
        />
      ))}
    </Folder>
    <Folder name="DotWorldMap">
      {dotMapVersions.map((v) => (
        <Composition
          key={v.key}
          id={`DotWorldMap-${v.key}`}
          component={(_: LoopProps) => <DotWorldMap version={v} />}
          durationInFrames={600}
          calculateMetadata={loopMeta}
          defaultProps={{ loopCheck: false } as LoopProps}
          fps={FPS}
          width={W}
          height={H}
        />
      ))}
    </Folder>
    <Folder name="GradientOrb">
      {gradientOrbVersions.map((v) => (
        <Composition
          key={v.key}
          id={`GradientOrb-${v.key}`}
          component={(_: LoopProps) => <GradientOrb version={v} />}
          durationInFrames={600}
          calculateMetadata={loopMeta}
          defaultProps={{ loopCheck: false } as LoopProps}
          fps={FPS}
          width={W}
          height={H}
        />
      ))}
    </Folder>
  </>
);
