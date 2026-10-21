import React from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, WIDTH } from "./lib/colors";
import { BranchingTreeCyan, BranchingTreeRed } from "./scenes/BranchingTree";
import { PeopleLinkUpFlip } from "./scenes/PeopleLinkUp";
import { SocialClusterRed, SocialClusterWhite } from "./scenes/SocialCluster";
import { PeopleBulbWhite } from "./scenes/PeopleBulb";
import { CrowdPlatformBlue } from "./scenes/CrowdPlatform";
import { BigDataCrowdClean, BigDataCrowdTitle } from "./scenes/BigDataCrowd";
import { PeopleGridCyan } from "./scenes/PeopleGrid";
import { PeopleWorldMapCyan, PeopleWorldMapRed } from "./scenes/WorldMap";

const comps: { id: string; component: React.FC; seconds: number }[] = [
  { id: "BranchingTree-Red", component: BranchingTreeRed, seconds: 30 },
  { id: "BranchingTree-Cyan", component: BranchingTreeCyan, seconds: 30 },
  { id: "PeopleLinkUp-Flip", component: PeopleLinkUpFlip, seconds: 30 },
  { id: "SocialCluster-Red", component: SocialClusterRed, seconds: 20 },
  { id: "SocialCluster-White", component: SocialClusterWhite, seconds: 20 },
  { id: "PeopleGrid-Cyan", component: PeopleGridCyan, seconds: 25 },
  { id: "PeopleBulb-White", component: PeopleBulbWhite, seconds: 24 },
  { id: "CrowdPlatform-Blue", component: CrowdPlatformBlue, seconds: 30 },
  { id: "BigDataCrowd-Title", component: BigDataCrowdTitle, seconds: 18 },
  { id: "BigDataCrowd-Clean", component: BigDataCrowdClean, seconds: 18 },
  { id: "PeopleWorldMap-Red", component: PeopleWorldMapRed, seconds: 15 },
  { id: "PeopleWorldMap-Cyan", component: PeopleWorldMapCyan, seconds: 15 },
];

export const RemotionRoot: React.FC = () => (
  <>
    {comps.map((c) => (
      <Composition
        key={c.id}
        id={c.id}
        component={c.component}
        durationInFrames={c.seconds * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
  </>
);
