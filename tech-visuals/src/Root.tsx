import React from "react";
import { Composition } from "remotion";
import { LookCanvas } from "./lib/LookCanvas";
import { createGridPucks, SLATE, WHITE } from "./looks/gridPucks";
import { createFolderRow } from "./looks/folderRow";
import { createNetworkHub } from "./looks/networkHub";
import { createDashboard } from "./looks/dashboard";
import { WithInter } from "./lib/fonts";
import { createTurbineCheck } from "./looks/turbineCheck";
import { BLUE_WHITE, CYAN_NAVY, createFlowchart } from "./looks/flowchart";

const W = 3840;
const H = 2160;
const FPS = 30;

const pucksSlate = createGridPucks(SLATE);
const pucksWhite = createGridPucks(WHITE);
const folderRow = createFolderRow();
const hubDraw = createNetworkHub("drawOn");
const hubLoop = createNetworkHub("pulseLoop");
const flowBW = createFlowchart(BLUE_WHITE);
const flowCN = createFlowchart(CYAN_NAVY);
const turbineCheck = createTurbineCheck();
const dashboard = createDashboard();

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="GridPucks-Slate" component={() => <LookCanvas create={pucksSlate} />} durationInFrames={600} fps={FPS} width={W} height={H} />
    <Composition id="GridPucks-White" component={() => <LookCanvas create={pucksWhite} />} durationInFrames={600} fps={FPS} width={W} height={H} />
    <Composition id="FolderRow-Blue" component={() => <LookCanvas create={folderRow} />} durationInFrames={600} fps={FPS} width={W} height={H} />
    <Composition id="NetworkHub-DrawOn" component={() => <LookCanvas create={hubDraw} />} durationInFrames={450} fps={FPS} width={W} height={H} />
    <Composition id="NetworkHub-PulseLoop" component={() => <LookCanvas create={hubLoop} />} durationInFrames={600} fps={FPS} width={W} height={H} />
    <Composition id="FlowchartBuild-BlueWhite" component={() => <LookCanvas create={flowBW} />} durationInFrames={450} fps={FPS} width={W} height={H} />
    <Composition id="FlowchartBuild-CyanNavy" component={() => <LookCanvas create={flowCN} />} durationInFrames={450} fps={FPS} width={W} height={H} />
    <Composition id="WindTurbineDashboard-Story" component={() => <WithInter><LookCanvas create={dashboard} /></WithInter>} durationInFrames={450} fps={FPS} width={W} height={H} />
    <Composition id="Dev-TurbineModelCheck" component={() => <LookCanvas create={turbineCheck} />} durationInFrames={60} fps={FPS} width={W} height={H} />
  </>
);
