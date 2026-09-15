// The nine versions, one per reference clip.
//
// Each entry is registered twice by Root: once at 1080p for delivery and
// once at 4K for the project hand-off. Frame counts are the reference
// durations rounded to whole frames at 30fps.

import React from "react";
import { VersionProps } from "./shared";
import { V01PlaqueClean, V01_DURATION } from "./V01PlaqueClean";
import { V02CariesFormation, V02_DURATION } from "./V02CariesFormation";
import { V03Biofilm, V03_DURATION } from "./V03Biofilm";
import { V04GingivalDisease, V04_DURATION } from "./V04GingivalDisease";
import { V05GumRestoration, V05_DURATION } from "./V05GumRestoration";
import { V06TartarCrystals, V06_DURATION } from "./V06TartarCrystals";
import { V07WireframeScan, V07_DURATION } from "./V07WireframeScan";
import { V08WhiteningArch, V08_DURATION } from "./V08WhiteningArch";
import { V09EnamelSparkle, V09_DURATION } from "./V09EnamelSparkle";

export type VersionSpec = {
  id: string;
  label: string;
  durationInFrames: number;
  component: React.FC<VersionProps>;
};

export const DENTAL_VERSIONS: VersionSpec[] = [
  {
    id: "01-PlaqueClean",
    label: "Plaque removal by cleaning bubbles",
    durationInFrames: V01_DURATION,
    component: V01PlaqueClean,
  },
  {
    id: "02-CariesFormation",
    label: "Formation of a carious lesion",
    durationInFrames: V02_DURATION,
    component: V02CariesFormation,
  },
  {
    id: "03-Biofilm",
    label: "Biofilm and a plant-essence rinse",
    durationInFrames: V03_DURATION,
    component: V03Biofilm,
  },
  {
    id: "04-GingivalDisease",
    label: "Progression of gingival disease",
    durationInFrames: V04_DURATION,
    component: V04GingivalDisease,
  },
  {
    id: "05-GumRestoration",
    label: "Restoring inflamed, receded gingiva",
    durationInFrames: V05_DURATION,
    component: V05GumRestoration,
  },
  {
    id: "06-TartarCrystals",
    label: "Calculus lifted by mineral crystals",
    durationInFrames: V06_DURATION,
    component: V06TartarCrystals,
  },
  {
    id: "07-WireframeScan",
    label: "Scan visualisation",
    durationInFrames: V07_DURATION,
    component: V07WireframeScan,
  },
  {
    id: "08-WhiteningArch",
    label: "Whitening across the arch",
    durationInFrames: V08_DURATION,
    component: V08WhiteningArch,
  },
  {
    id: "09-EnamelSparkle",
    label: "Enamel polish",
    durationInFrames: V09_DURATION,
    component: V09EnamelSparkle,
  },
];
