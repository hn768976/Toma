import "./lib/fonts";
import React from "react";
import { CalculateMetadataFunction, Composition, Folder } from "remotion";
import { GrainGlow, GRAIN_GLOW_LOOP } from "./looks/grain-glow/GrainGlow";
import { GRAIN_GLOW_VERSIONS, GrainGlowVersion } from "./looks/grain-glow/versions";
import { PlexusSphere } from "./looks/plexus/PlexusSphere";
import { DURATION as PLEXUS_DURATION } from "./looks/plexus/nodes";
import { PLEXUS_VERSIONS } from "./looks/plexus/versions";
import { NeonBadge, NEON_BADGE_LOOP } from "./looks/neon-badge/NeonBadge";
import { NEON_BADGE_VERSIONS, NeonBadgeVersion } from "./looks/neon-badge/versions";
import { HexMosaic } from "./looks/hex-mosaic/HexMosaic";
import { DURATION as HEX_DURATION } from "./looks/hex-mosaic/layout";
import { HEX_MOSAIC_VERSIONS } from "./looks/hex-mosaic/versions";

const FPS = 30;
const WIDTH = 3840;
const HEIGHT = 2160;

/**
 * Looping compositions accept `{"loopCheck": true}` to gain one extra frame,
 * so frame 600 can be rendered and compared against frame 0.
 */
type LoopProps<V> = { version: V; loopCheck?: boolean };
const loopMeta =
  <V,>(loop: number): CalculateMetadataFunction<LoopProps<V>> =>
  ({ props }) => ({ durationInFrames: props.loopCheck ? loop + 1 : loop });

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Look1-GrainGlow">
      {GRAIN_GLOW_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={GrainGlow}
          durationInFrames={GRAIN_GLOW_LOOP}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ version: v, loopCheck: false } as LoopProps<GrainGlowVersion>}
          calculateMetadata={loopMeta<GrainGlowVersion>(GRAIN_GLOW_LOOP)}
        />
      ))}
    </Folder>
    <Folder name="Look2-PlexusSphere">
      {PLEXUS_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={PlexusSphere}
          durationInFrames={PLEXUS_DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ version: v }}
        />
      ))}
    </Folder>
    <Folder name="Look3-HexMosaic">
      {HEX_MOSAIC_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={HexMosaic}
          durationInFrames={HEX_DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ version: v }}
        />
      ))}
    </Folder>
    <Folder name="Look4-NeonBadge">
      {NEON_BADGE_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={NeonBadge}
          durationInFrames={NEON_BADGE_LOOP}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ version: v, loopCheck: false } as LoopProps<NeonBadgeVersion>}
          calculateMetadata={loopMeta<NeonBadgeVersion>(NEON_BADGE_LOOP)}
        />
      ))}
    </Folder>
  </>
);
