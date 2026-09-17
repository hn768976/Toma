import React from "react";
import { Composition } from "remotion";
import { FPS, RESOLUTIONS, SHOTS, type ResolutionKey, type ShotId } from "./config";
import { Shot01ContainerAscent } from "./shots/Shot01ContainerAscent";
import { Shot02ContainerWall } from "./shots/Shot02ContainerWall";
import { Shot03ContainerCanyon } from "./shots/Shot03ContainerCanyon";
import { Shot04CloudCruise } from "./shots/Shot04CloudCruise";
import { Shot05OverheadSilhouette } from "./shots/Shot05OverheadSilhouette";
import { Shot06AirportSign } from "./shots/Shot06AirportSign";
import { DevMaterialProbe } from "./DevMaterialProbe";

/**
 * Twelve compositions: each of the six shots at both delivery resolutions.
 *
 * The 4K entries are not a different edit — same scene, same camera, same
 * frame count. Only the raymarch step counts and texture anisotropy change,
 * and those follow from the resolution (see `QUALITY` in config.ts), so a 4K
 * render is a straight `remotion render <id>` away with nothing to re-time.
 */

const COMPONENTS: Record<ShotId, React.FC<{ readonly resolution: ResolutionKey }>> = {
  "container-ascent": Shot01ContainerAscent,
  "container-wall": Shot02ContainerWall,
  "container-canyon": Shot03ContainerCanyon,
  "cloud-cruise": Shot04CloudCruise,
  "overhead-silhouette": Shot05OverheadSilhouette,
  "airport-sign": Shot06AirportSign,
};

/**
 * `Shot01-ContainerAscent-1080p` and friends.
 *
 * Remotion only allows letters, digits and hyphens in a composition id, so the
 * separator is a hyphen rather than the underscore the filenames use.
 */
export const compositionId = (index: number, id: ShotId, resolution: ResolutionKey) => {
  const pascal = id
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
  return `Shot${String(index + 1).padStart(2, "0")}-${pascal}-${resolution === "4k" ? "4K" : "1080p"}`;
};

export const AviationCompositions: React.FC = () => (
  <>
    {SHOTS.flatMap((shot, index) =>
      (Object.keys(RESOLUTIONS) as ResolutionKey[]).map((resolution) => (
        <Composition
          key={compositionId(index, shot.id, resolution)}
          id={compositionId(index, shot.id, resolution)}
          component={COMPONENTS[shot.id]}
          durationInFrames={shot.durationInFrames}
          fps={FPS}
          width={RESOLUTIONS[resolution].width}
          height={RESOLUTIONS[resolution].height}
          defaultProps={{ resolution }}
        />
      )),
    )}
    <Composition
      id="DevMaterialProbe"
      component={DevMaterialProbe}
      durationInFrames={240}
      fps={FPS}
      width={1280}
      height={720}
    />
  </>
);
