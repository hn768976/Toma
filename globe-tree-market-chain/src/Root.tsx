import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { KeywordGlobe } from "./globe/KeywordGlobe";
import { BlockchainBuild } from "./build/BlockchainBuild";
import { BlockchainPanels } from "./panels/BlockchainPanels";
import { CircuitTree } from "./tree/CircuitTree";
import { MarketDashboard } from "./market/MarketDashboard";
import { BUILD_VERSIONS, GLOBE_VERSIONS, MARKET_VERSIONS, PANELS_VERSIONS, TREE_VERSIONS } from "./versions";

// `loopCheck: true` temporarily extends a 600-frame composition to 601 so
// frame 600 can be rendered and compared with frame 0.
type LoopProps = { loopCheck?: boolean };
const withLoop =
  (base: number): CalculateMetadataFunction<LoopProps & Record<string, unknown>> =>
  ({ props }) => ({ durationInFrames: props.loopCheck ? base + 1 : base });

const common = { fps: 30, width: 3840, height: 2160 } as const;

export const RemotionRoot: React.FC = () => (
  <>
    {GLOBE_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={KeywordGlobe as React.FC<Record<string, unknown>>}
        durationInFrames={600}
        defaultProps={{ version: v, loopCheck: false }}
        calculateMetadata={withLoop(600)}
        {...common}
      />
    ))}
    {TREE_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={CircuitTree as React.FC<Record<string, unknown>>}
        durationInFrames={600}
        defaultProps={{ version: v, loopCheck: false }}
        calculateMetadata={withLoop(600)}
        {...common}
      />
    ))}
    {MARKET_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={MarketDashboard as React.FC<Record<string, unknown>>}
        durationInFrames={600}
        defaultProps={{ version: v, loopCheck: false }}
        calculateMetadata={withLoop(600)}
        {...common}
      />
    ))}
    {PANELS_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={BlockchainPanels as React.FC<Record<string, unknown>>}
        durationInFrames={600}
        defaultProps={{ version: v, loopCheck: false }}
        calculateMetadata={withLoop(600)}
        {...common}
      />
    ))}
    {BUILD_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={BlockchainBuild as React.FC<Record<string, unknown>>}
        durationInFrames={450}
        defaultProps={{ version: v }}
        {...common}
      />
    ))}
  </>
);
