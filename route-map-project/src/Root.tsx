import React from "react";
import { Composition } from "remotion";
import { REGIONS } from "./data/regions";
import { RouteMap } from "./RouteMap";
import type { Palette, RouteType } from "./lib/types";

/** 3840x2160 / 30fps / 480 frames (16s), a seamless loop. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION = 480;

interface CompSpec {
  id: string;
  regionId: string;
  palette?: Palette;
  routeType?: RouteType;
}

/**
 * One composition per region. The two that match the references are named for
 * their deliverable files; the rest are configured and ready for a separate 4K
 * pass.
 */
export const COMPOSITIONS: CompSpec[] = [
  { id: "RouteMapGlobalMixed", regionId: "global" },
  { id: "V2-RouteMapEuropeShipping", regionId: "europe" },
  { id: "V1-RouteMapNorthAmericaAir", regionId: "northAmerica" },
  { id: "RouteMapNorthAtlanticAir", regionId: "northAtlantic" },
  { id: "RouteMapAsiaPacificShipping", regionId: "asiaPacific" },
  { id: "RouteMapMiddleEastShipping", regionId: "middleEast" },
];

export const RemotionRoot: React.FC = () => (
  <>
    {COMPOSITIONS.map((c) => {
      const region = REGIONS.find((r) => r.id === c.regionId);
      if (!region) throw new Error(`Composition ${c.id} references unknown region ${c.regionId}`);
      return (
        <Composition
          key={c.id}
          id={c.id}
          component={RouteMap}
          durationInFrames={DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{
            regionId: c.regionId,
            palette: c.palette ?? region.palette,
            routeType: c.routeType ?? region.routeType,
          }}
        />
      );
    })}
  </>
);
