/**
 * Satellite layout, bound to this project.
 *
 * The arrangement itself — both MODES, the node placement and the connector
 * paths — lives in the vendored library and knows nothing about this project.
 * This module binds it to the node-hub's icon registry, loop length and dot
 * periods, so callers pass a mode and a count and get positions back:
 *
 *   "radiating" — nodes burst from the hub at deliberately uneven distances
 *                 and jittered angles; paths are straight hub spokes plus
 *                 node-to-node cross-links, which is what makes it read as a
 *                 network rather than a star.
 *   "arcs"      — nodes are beads strung along a few large intersecting
 *                 circle segments that sweep across the frame; the hub sits
 *                 where two of them cross and there are no spokes at all. The
 *                 arcs themselves are the connective tissue.
 *
 * <ConnectorLines> and <IconNode> render either arrangement without knowing
 * which one they were given.
 */
import {
  buildSatelliteLayout,
  resolveFrame as libResolveFrame,
  type FrameState,
  type Layout as LibLayout,
  type LayoutNode as LibLayoutNode,
  type LayoutOptions as LibLayoutOptions,
} from "../lib/layout/satelliteLayout";
import { LOOP_FRAMES, PERIODS } from "./constants";
import type { IconName } from "./icons";

export { STUB_FROM, STUB_TO } from "../lib/layout/satelliteLayout";
export type {
  FrameState,
  LayoutPath,
  PathDot,
  ResolvedDot,
} from "../lib/layout/satelliteLayout";

export type LayoutNode = LibLayoutNode<IconName>;
export type Layout = LibLayout<IconName>;

/** This project's options: the loop length and dot periods are supplied here. */
export type LayoutOptions = Omit<
  LibLayoutOptions<IconName>,
  "loopFrames" | "dotPeriods"
>;

export const buildLayout = (opts: LayoutOptions): Layout =>
  buildSatelliteLayout<IconName>({
    ...opts,
    loopFrames: LOOP_FRAMES,
    dotPeriods: PERIODS.dot,
  });

export const resolveFrame = (layout: Layout, frame: number): FrameState =>
  libResolveFrame(layout, frame, LOOP_FRAMES);
