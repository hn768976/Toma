import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DURATION_IN_FRAMES, FIELD_MARGIN } from "./constants";
import { rgba } from "./vendor/core/color";
import { computeMeshFrame, generateNodes } from "./vendor/mesh/node-field";
import {
  AnamorphicFlare,
  flareStateAt,
} from "./vendor/light/AnamorphicFlare";
import { BackgroundWash } from "./components/BackgroundWash";
import { BokehLayer } from "./vendor/atmosphere/BokehLayer";
import { DustMotes } from "./components/DustMotes";
import { FacetLayer } from "./vendor/mesh/FacetLayer";
import { LabelField } from "./components/LabelField";
import { LightBloom, bloomLevelAt, bloomTopAt } from "./components/LightBloom";
import { NodeMesh, type LightBoost } from "./vendor/mesh/NodeMesh";
import { PostFx } from "./vendor/atmosphere/PostFx";
import { VARIANTS, type VariantName } from "./variants";

// A type alias (not an interface) so it satisfies Remotion's
// `Props extends Record<string, unknown>` constraint on <Composition>.
export type NetworkMeshProps = {
  variant: VariantName;
};

const TAU = Math.PI * 2;

/**
 * One mesh implementation, four versions. Density, facet mode, label set and
 * light mode are all config values read from VARIANTS — there is no separate
 * plexus and flare component.
 *
 * Every value below is a pure function of `useCurrentFrame()`: no Date.now(),
 * no requestAnimationFrame, no CSS animation and no component state, so
 * `npx remotion render` is deterministic and frames may be rendered in any
 * order across workers.
 */
export const NetworkMesh: React.FC<NetworkMeshProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // The loop period is a fixed 450 frames rather than the composition's
  // duration, so a longer composition can be rendered to prove that frame 450
  // is identical to frame 0.
  const durationInFrames = DURATION_IN_FRAMES;
  const config = VARIANTS[variant];
  const { palette } = config;

  // Generated once: base position, depth and drift path per node. Only the
  // per-frame positions and the edge list are rebuilt each frame.
  const nodes = useMemo(
    () =>
      generateNodes(
        config.nodeCount,
        `${variant}-mesh`,
        width,
        height,
        FIELD_MARGIN,
      ),
    [config.nodeCount, variant, width, height],
  );

  const mesh = useMemo(
    () =>
      computeMeshFrame(
        nodes,
        frame,
        durationInFrames,
        config.connectionThreshold,
        config.maxConnections,
        config.facetMode === "on",
        width,
        height,
        FIELD_MARGIN,
      ),
    [
      nodes,
      frame,
      durationInFrames,
      config.connectionThreshold,
      config.maxConnections,
      config.facetMode,
      width,
      height,
    ],
  );

  // Slight ambient camera drift on a closed path, +-10px.
  const t = (frame / durationInFrames) * TAU;
  const camX = 10 * Math.sin(t);
  const camY = 8 * Math.sin(2 * t + 1.1);

  const bloomLevel =
    config.lightMode === "risingBloom"
      ? bloomLevelAt(frame, durationInFrames)
      : 0;

  // What the variant's light element contributes to nodes and edges.
  const lightBoost = useMemo<LightBoost | undefined>(() => {
    if (config.lightMode === "anamorphic") {
      const flare = flareStateAt(frame, durationInFrames, width, height);
      if (flare.intensity <= 0.002) return undefined;
      return (x: number, y: number) => {
        const dy = (y - flare.y) / 300;
        const dx = (x - flare.x) / (width * 0.5);
        const vertical = Math.exp(-dy * dy);
        const along = 0.3 + 0.7 * Math.exp(-dx * dx);
        return flare.intensity * vertical * along;
      };
    }
    if (config.lightMode === "risingBloom") {
      const top = bloomTopAt(frame, durationInFrames, height);
      const level = bloomLevel;
      if (level <= 0.002) return undefined;
      return (_x: number, y: number) => {
        const depth = (y - top) / (height * 0.5);
        if (depth <= 0) return 0;
        return Math.min(1, depth) * level * 0.6;
      };
    }
    return undefined;
  }, [config.lightMode, frame, durationInFrames, width, height, bloomLevel]);

  // The vendored components hold no palette of their own; this is where
  // VARIANTS is turned into the colours each one needs.
  const meshColors = {
    nodeBase: palette.nodePale,
    nodePeak: palette.nodeBright,
    edgeNear: palette.edgeMain,
    edgeFar: palette.edgeDim,
  };
  const facetColors =
    palette.facet === undefined
      ? null
      : { facet: palette.facet, sink: palette.backgroundWash };
  const flareColors =
    palette.flareCore === undefined ||
    palette.flareCyan === undefined ||
    palette.flareMagenta === undefined
      ? null
      : {
          core: palette.flareCore,
          fringeA: palette.flareCyan,
          fringeB: palette.flareMagenta,
        };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: rgba(palette.backgroundDeep, 1),
        isolation: "isolate",
      }}
    >
      {/*
        Everything belonging to the scene shares one drifting group, so the
        ambient camera move is a single transform. The slight over-scale keeps
        the +-10px drift from exposing an edge.
      */}
      <AbsoluteFill
        style={{
          transform: `translate(${camX}px, ${camY}px) scale(1.015)`,
          transformOrigin: "center center",
        }}
      >
        <BackgroundWash
          width={width}
          height={height}
          frame={frame}
          duration={durationInFrames}
          palette={palette}
        />
        <BokehLayer
          width={width}
          height={height}
          frame={frame}
          duration={durationInFrames}
          color={palette.bokeh}
          pass="back"
        />
        {config.facetMode === "on" && facetColors ? (
          <FacetLayer
            width={width}
            height={height}
            mesh={mesh}
            colors={facetColors}
            opacity={config.facetOpacity}
          />
        ) : null}
        <NodeMesh
          width={width}
          height={height}
          nodes={nodes}
          mesh={mesh}
          colors={meshColors}
          lightBoost={lightBoost}
        />
        <LabelField
          width={width}
          height={height}
          frame={frame}
          duration={durationInFrames}
          palette={palette}
          labelSet={config.labelSet}
          count={config.labelCount}
        />
        <BokehLayer
          width={width}
          height={height}
          frame={frame}
          duration={durationInFrames}
          color={palette.bokeh}
          pass="front"
        />
        {config.dustMotes ? (
          <DustMotes
            width={width}
            height={height}
            frame={frame}
            duration={durationInFrames}
            palette={palette}
            bloomLevel={bloomLevel}
          />
        ) : null}
      </AbsoluteFill>

      {/* Light treatment sits outside the camera group: a lens artefact and
          ambient light do not travel with the scene. */}
      {config.lightMode === "risingBloom" ? (
        <LightBloom
          width={width}
          height={height}
          frame={frame}
          duration={durationInFrames}
          palette={palette}
        />
      ) : null}
      {config.lightMode === "anamorphic" && flareColors ? (
        <AnamorphicFlare
          width={width}
          height={height}
          frame={frame}
          duration={durationInFrames}
          colors={flareColors}
        />
      ) : null}

      <PostFx
        width={width}
        height={height}
        frame={frame}
        duration={durationInFrames}
      />
    </AbsoluteFill>
  );
};
