import React, { useMemo } from "react";
import { PostSettings } from "./engine/post";
import { Stage } from "./engine/Stage";
import { earthLook } from "./looks/earth";
import { hierarchyLook } from "./looks/hierarchy";
import { slatsLook } from "./looks/slats";
import { trailsLook } from "./looks/trails";
import { tunnelLook } from "./looks/tunnel";
import {
  EARTH_VERSIONS,
  HIERARCHY_VERSIONS,
  SLAT_VERSIONS,
  TRAIL_VERSIONS,
  TUNNEL_VERSIONS,
} from "./versions";

export const LOOP_FRAMES = 600;
export const HIERARCHY_FRAMES = 360;

export type LoopProps = { loopCheck?: boolean };

const BASE_POST: PostSettings = {
  clearColor: "#000000",
  exposure: 1.0,
  bloomStrength: 1.0,
  bloomRadius: 0.8,
  bloomThreshold: 0.6,
  bloomKnee: 0.45,
  grain: 0.02,
  dither: true,
  blackPreserve: false,
  loopFrames: LOOP_FRAMES,
  vignette: 0.2,
  samples: 4,
};

// ---- Look 1: Earth Horizon Rays ---------------------------------------
const EARTH_POST: PostSettings = {
  ...BASE_POST,
  bloomStrength: 1.1,
  bloomRadius: 0.85,
  bloomThreshold: 0.55,
  vignette: 0.25,
};
export const EarthHorizon: React.FC<{ version: keyof typeof EARTH_VERSIONS } & LoopProps> = ({
  version,
}) => {
  const params = useMemo(() => ({ colors: EARTH_VERSIONS[version] }), [version]);
  return <Stage factory={earthLook} params={params} post={EARTH_POST} needs={{ land: true }} />;
};

// ---- Look 2: Neon Grid Tunnel -----------------------------------------
const TUNNEL_POST: Record<keyof typeof TUNNEL_VERSIONS, PostSettings> = {
  Blue: {
    ...BASE_POST,
    clearColor: TUNNEL_VERSIONS.Blue.background,
    exposure: 1.0,
    bloomStrength: 2.0,
    bloomRadius: 0.9,
    bloomThreshold: 0.25,
    vignette: 0.35,
    radialBlur: 0.02,
  },
  Magenta: {
    ...BASE_POST,
    clearColor: TUNNEL_VERSIONS.Magenta.background,
    exposure: 1.0,
    bloomStrength: 2.0,
    bloomRadius: 0.9,
    bloomThreshold: 0.25,
    vignette: 0.35,
    radialBlur: 0.02,
  },
};
export const NeonGridTunnel: React.FC<{ version: keyof typeof TUNNEL_VERSIONS } & LoopProps> = ({
  version,
}) => {
  const params = useMemo(() => ({ colors: TUNNEL_VERSIONS[version] }), [version]);
  return <Stage factory={tunnelLook} params={params} post={TUNNEL_POST[version]} />;
};

// ---- Look 3: Hierarchy Network ----------------------------------------
const HIERARCHY_POST: PostSettings = {
  ...BASE_POST,
  loopFrames: HIERARCHY_FRAMES,
  bloomStrength: 1.0,
  bloomRadius: 0.7,
  bloomThreshold: 0.7,
  vignette: 0.35,
  dof: { focus: 19.5, range: 5, maxBlur: 0.03 },
};
export const HierarchyNetwork: React.FC<{ version: keyof typeof HIERARCHY_VERSIONS }> = ({ version }) => {
  const params = useMemo(() => ({ colors: HIERARCHY_VERSIONS[version] }), [version]);
  return <Stage factory={hierarchyLook} params={params} post={HIERARCHY_POST} needs={{ hdri: true }} />;
};

// ---- Look 4: Diagonal Slats -------------------------------------------
const SLAT_POST: Record<keyof typeof SLAT_VERSIONS, PostSettings> = {
  Black: {
    ...BASE_POST,
    exposure: SLAT_VERSIONS.Black.exposure,
    grain: SLAT_VERSIONS.Black.grain,
    bloomStrength: 0.35,
    bloomThreshold: 0.8,
    vignette: 0.25,
  },
  White: {
    ...BASE_POST,
    exposure: SLAT_VERSIONS.White.exposure,
    grain: SLAT_VERSIONS.White.grain,
    bloomStrength: 0.2,
    bloomThreshold: 1.2,
    vignette: 0.12,
  },
};
export const DiagonalSlats: React.FC<{ version: keyof typeof SLAT_VERSIONS } & LoopProps> = ({ version }) => {
  const params = useMemo(() => ({ colors: SLAT_VERSIONS[version] }), [version]);
  return <Stage factory={slatsLook} params={params} post={SLAT_POST[version]} needs={{ hdri: true }} />;
};

// ---- Look 5: Speed Trails ---------------------------------------------
const TRAILS_POST: PostSettings = {
  ...BASE_POST,
  clearColor: "#000000",
  bloomStrength: 1.8,
  bloomRadius: 0.95,
  bloomThreshold: 0.3,
  grain: 0,
  blackPreserve: true,
  vignette: 0,
};
export const SpeedTrails: React.FC<{ version: keyof typeof TRAIL_VERSIONS } & LoopProps> = ({ version }) => {
  const params = useMemo(() => ({ colors: TRAIL_VERSIONS[version] }), [version]);
  return <Stage factory={trailsLook} params={params} post={TRAILS_POST} />;
};
