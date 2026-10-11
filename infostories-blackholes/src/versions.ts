import { createEclipse } from "./blackhole/eclipse";
import { createLensed } from "./blackhole/lensed";
import { createInfo } from "./info/pipeline";
import { dataAnalysisIdea } from "./info/stories/dataAnalysisIdea";
import { aidaFunnel } from "./info/stories/aidaFunnel";
import { swot } from "./info/stories/swot";
import type { StageFactory } from "./lib/GLStage";

/** One data row per version. `file` is the delivery name of the rendered file. */
export type Version = { id: string; file: string; frames: number; loop: boolean; factory: StageFactory };

const LOOP = 600;
const STORY = 450;

export const VERSIONS: Version[] = [
  {
    id: "InfoStory-DataAnalysisIdea",
    file: "InfoStory_DataAnalysisIdea",
    frames: STORY,
    loop: false,
    factory: createInfo({ period: STORY, loop: false, calm: false, story: dataAnalysisIdea, layerRot: [-0.1, -0.42, 0], bgYaw: -15, grain: 0.015 }),
  },
  {
    id: "InfoStory-AIDAFunnel",
    file: "InfoStory_AIDAFunnel",
    frames: STORY,
    loop: false,
    factory: createInfo({ period: STORY, loop: false, calm: false, story: aidaFunnel, layerRot: [-0.04, 0.2, 0.045], grain: 0.015 }),
  },
  {
    id: "InfoStory-SWOT",
    file: "InfoStory_SWOT",
    frames: STORY,
    loop: false,
    factory: createInfo({ period: STORY, loop: false, calm: false, story: swot, layerRot: [-0.22, 0.4, -0.12], grain: 0.015 }),
  },
  {
    id: "InfoPlane-Background",
    file: "InfoPlane_Background",
    frames: LOOP,
    loop: true,
    factory: createInfo({ period: LOOP, loop: true, calm: true, story: null, layerRot: [0, 0, 0], grain: 0.015 }),
  },
  {
    id: "BlackHole-EmberEclipse",
    file: "BlackHole_EmberEclipse",
    frames: LOOP,
    loop: true,
    factory: createEclipse({
      period: LOOP,
      ringHot: "#FFF4C0", ringMid: "#FFB040", ringCool: "#E8502A",
      glowInner: "#E84A2A", glowOuter: "#8A2010",
      cream: "#E8D0B0", tan: "#A87A5A", brown: "#3A2A20",
      hazeHi: "#2A4A48", hazeLo: "#0A1A1C",
      grain: 0.02,
    }),
  },
  {
    id: "BlackHole-LensedPeach",
    file: "BlackHole_LensedPeach",
    frames: LOOP,
    loop: true,
    factory: createLensed({
      period: LOOP,
      ring: "#FFF8F4", inner: "#FFB89A", outer: "#C85A3A",
      bg0: "#1E0E0C", bg1: "#2A1412", shadowGlow: "#C49498",
      grain: 0.02,
    }),
  },
  {
    id: "BlackHole-LensedIce",
    file: "BlackHole_LensedIce",
    frames: LOOP,
    loop: true,
    factory: createLensed({
      period: LOOP,
      ring: "#F4FAFF", inner: "#9AD0FF", outer: "#3A5AC8",
      bg0: "#060A18", bg1: "#0A1228", shadowGlow: "#7A90C4",
      grain: 0.02,
    }),
  },
];
