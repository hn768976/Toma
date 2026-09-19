// The six versions, one per reference clip.
//
// Each entry is registered twice in Root.tsx: a 4K master (the deliverable
// project composition) and a native 1080p composition for quick previews.
// The 1080p MP4s that ship are rendered from the 4K masters at --scale 0.5,
// so what you review at 1080p is exactly the master, just smaller.

import type React from "react";
import { VERSION_DURATIONS, type VersionId } from "./constants";
import { V1BlueCells } from "./versions/V1BlueCells";
import { V2VirionAttack } from "./versions/V2VirionAttack";
import { V3CoronaFlythrough } from "./versions/V3CoronaFlythrough";
import { V4ColourJourney } from "./versions/V4ColourJourney";
import { V5AmberField } from "./versions/V5AmberField";
import { V6GreenOnBlack } from "./versions/V6GreenOnBlack";

export interface VersionEntry {
  id: VersionId;
  /** Composition id prefix, e.g. "Micro-V1-BlueCells". */
  name: string;
  component: React.FC;
  durationInFrames: number;
  description: string;
}

export const VERSIONS: VersionEntry[] = [
  {
    id: "v1",
    name: "Micro-V1-BlueCells",
    component: V1BlueCells,
    durationInFrames: VERSION_DURATIONS.v1,
    description: "Backlit blue blastocysts drifting through a lit fluid.",
  },
  {
    id: "v2",
    name: "Micro-V2-VirionAttack",
    component: V2VirionAttack,
    durationInFrames: VERSION_DURATIONS.v2,
    description: "Red virions swarm and coat a pale host cell.",
  },
  {
    id: "v3",
    name: "Micro-V3-CoronaFlythrough",
    component: V3CoronaFlythrough,
    durationInFrames: VERSION_DURATIONS.v3,
    description: "Camera flies through a dense field of green spiked virions.",
  },
  {
    id: "v4",
    name: "Micro-V4-ColourJourney",
    component: V4ColourJourney,
    durationInFrames: VERSION_DURATIONS.v4,
    description: "Amber to olive to teal, resolving into clean blue water.",
  },
  {
    id: "v5",
    name: "Micro-V5-AmberField",
    component: V5AmberField,
    durationInFrames: VERSION_DURATIONS.v5,
    description: "Dense fibrous microbes over a warm amber vignette.",
  },
  {
    id: "v6",
    name: "Micro-V6-GreenOnBlack",
    component: V6GreenOnBlack,
    durationInFrames: VERSION_DURATIONS.v6,
    description: "Sparse glowing green cells falling through pure black.",
  },
];
