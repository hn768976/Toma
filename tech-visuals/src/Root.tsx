import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { WithInter } from "./lib/fonts";
import { LookCanvas } from "./lib/LookCanvas";
import { createDashboard } from "./looks/dashboard";
import { BLUE_WHITE, CYAN_NAVY, createFlowchart } from "./looks/flowchart";
import { createFolderRow } from "./looks/folderRow";
import { createGridPucks, SLATE, WHITE } from "./looks/gridPucks";
import { createNetworkHub } from "./looks/networkHub";
import { createTurbineCheck } from "./looks/turbineCheck";

const W = 3840;
const H = 2160;
const FPS = 30;
const LOOP = 600; // 20 s seamless loops
const STORY = 450; // 15 s stories

// Look factories are created once at module level (stable identity → one GL scene per tab).
const pucksSlate = createGridPucks(SLATE);
const pucksWhite = createGridPucks(WHITE);
const folderRow = createFolderRow();
const hubDraw = createNetworkHub("drawOn");
const hubLoop = createNetworkHub("pulseLoop");
const flowBW = createFlowchart(BLUE_WHITE);
const flowCN = createFlowchart(CYAN_NAVY);
const dashboard = createDashboard();
const turbineCheck = createTurbineCheck();

const GridPucksSlate: React.FC = () => <LookCanvas create={pucksSlate} />;
const GridPucksWhite: React.FC = () => <LookCanvas create={pucksWhite} />;
const FolderRowBlue: React.FC = () => <LookCanvas create={folderRow} />;
const NetworkHubDrawOn: React.FC = () => <LookCanvas create={hubDraw} />;
const NetworkHubPulseLoop: React.FC = () => <LookCanvas create={hubLoop} />;
const FlowchartBlueWhite: React.FC = () => <LookCanvas create={flowBW} />;
const FlowchartCyanNavy: React.FC = () => <LookCanvas create={flowCN} />;
const WindTurbineDashboard: React.FC = () => (
  <WithInter>
    <LookCanvas create={dashboard} />
  </WithInter>
);
const TurbineModelCheck: React.FC = () => <LookCanvas create={turbineCheck} />;

// Loops accept --props='{"loopCheck":true}' → 601 frames, so frame 600 can be compared with frame 0.
type LoopProps = { loopCheck?: boolean };
const loopMeta: CalculateMetadataFunction<LoopProps> = ({ props }) => ({
  durationInFrames: props.loopCheck ? LOOP + 1 : LOOP,
});

const common = { fps: FPS, width: W, height: H };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="GridPucks-Slate" component={GridPucksSlate} durationInFrames={LOOP} defaultProps={{} as LoopProps} calculateMetadata={loopMeta} {...common} />
    <Composition id="GridPucks-White" component={GridPucksWhite} durationInFrames={LOOP} defaultProps={{} as LoopProps} calculateMetadata={loopMeta} {...common} />
    <Composition id="WindTurbineDashboard-Story" component={WindTurbineDashboard} durationInFrames={STORY} {...common} />
    <Composition id="FlowchartBuild-BlueWhite" component={FlowchartBlueWhite} durationInFrames={STORY} {...common} />
    <Composition id="FlowchartBuild-CyanNavy" component={FlowchartCyanNavy} durationInFrames={STORY} {...common} />
    <Composition id="NetworkHub-DrawOn" component={NetworkHubDrawOn} durationInFrames={STORY} {...common} />
    <Composition id="NetworkHub-PulseLoop" component={NetworkHubPulseLoop} durationInFrames={LOOP} defaultProps={{} as LoopProps} calculateMetadata={loopMeta} {...common} />
    <Composition id="FolderRow-Blue" component={FolderRowBlue} durationInFrames={LOOP} defaultProps={{} as LoopProps} calculateMetadata={loopMeta} {...common} />
    {/* Development: still of the code-built turbine used for the model check. */}
    <Composition id="Dev-TurbineModelCheck" component={TurbineModelCheck} durationInFrames={60} {...common} />
  </>
);
