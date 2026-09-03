/**
 * <PerspectiveCorridor> — the shared engine.
 *
 * A faked two-plane corridor. It places arbitrary elements on a floor and a
 * ceiling converging to a horizon, derives scale, speed, opacity and blur from
 * each element's depth, recycles them from the near edge back to the horizon,
 * and composites them through three depth-of-field buffers.
 *
 * It does not know what it is drawing. Element groups are supplied as children
 * (<FibreStrand>, <SlabPanel>, <BlockCluster>, ...), each contributing a set of
 * element records and a renderer function. Swapping the children is the only
 * difference between the three variants.
 */
import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
} from "react";
import { useCanvasLayer } from "../lib/canvasLayers";
import { BucketKey, DofBuffers } from "../lib/dofBuffers";
import { frac } from "../lib/math";
import {
  CorridorGeometry,
  Plane,
  Point,
  Projected,
  bandMask,
  depthAlpha,
  depthBuckets,
  projectPoint,
} from "../lib/perspective";

/** Every element carries at least this. Renderers extend it. */
export interface CorridorElement {
  seed: string;
  /** Lateral position, -1..1, spread outward from the vanishing point. */
  lane: number;
  plane: Plane;
  /** Depth phase at frame 0, 0..1. */
  d0: number;
  /**
   * Whole traversals of the corridor per loop. Must be an integer so the
   * element lands back where it started on frame `loop`. 0 pins it at d0.
   */
  cycles: number;
}

/** What a renderer is handed alongside the element and its projection. */
export interface CorridorApi {
  geo: CorridorGeometry;
  frame: number;
  loop: number;
  palette: Record<string, string>;
  /** Screen position of a lane at a depth. */
  point: (lane: number, d: number, plane: Plane) => Point;
  /** Open-band alpha multiplier at a screen y. */
  band: (y: number) => number;
}

export type ElementRenderer<E extends CorridorElement> = (
  ctx: CanvasRenderingContext2D,
  element: E,
  projected: Projected & { fade: number },
  api: CorridorApi,
) => void;

export interface CorridorGroup {
  id: string;
  order: number;
  elements: CorridorElement[];
  render: ElementRenderer<never>;
  /** Composite mode for this group inside the depth buffers. */
  blend?: GlobalCompositeOperation;
  /** Depth at which this group's elements start fading in off the horizon. */
  fadeIn?: number;
}

type GroupRegistry = Map<string, CorridorGroup>;
const GroupContext = createContext<GroupRegistry | null>(null);

/** Register an element group with the enclosing <PerspectiveCorridor>. */
export const useCorridorGroup = <E extends CorridorElement>(group: {
  id: string;
  order: number;
  elements: E[];
  render: ElementRenderer<E>;
  blend?: GlobalCompositeOperation;
  fadeIn?: number;
}): void => {
  const registry = useContext(GroupContext);
  if (registry) registry.set(group.id, group as unknown as CorridorGroup);
};

const BUCKETS: BucketKey[] = ["far", "mid", "near"];

export interface PerspectiveCorridorProps {
  order: number;
  geo: CorridorGeometry;
  frame: number;
  loop: number;
  palette: Record<string, string>;
  blend: GlobalCompositeOperation;
  dof: { far: number; near: number };
  children?: React.ReactNode;
}

export const PerspectiveCorridor: React.FC<PerspectiveCorridorProps> = ({
  order,
  geo,
  frame,
  loop,
  palette,
  blend,
  dof,
  children,
}) => {
  const registry = useMemo<GroupRegistry>(() => new Map(), []);
  // Cleared before children render and re-register (see CanvasStage).
  registry.clear();

  const buffersRef = useRef<DofBuffers | null>(null);
  const dofKey = `${geo.width}x${geo.height}:${dof.far}:${dof.near}`;
  const keyRef = useRef("");
  if (keyRef.current !== dofKey) {
    keyRef.current = dofKey;
    buffersRef.current = new DofBuffers(geo.width, geo.height, [
      { key: "far", resScale: 0.45, blurPx: dof.far },
      { key: "mid", resScale: 1, blurPx: 0 },
      { key: "near", resScale: 0.45, blurPx: dof.near },
    ]);
  }

  const api: CorridorApi = useMemo(
    () => ({
      geo,
      frame,
      loop,
      palette,
      point: (lane, d, plane) => projectPoint(geo, lane, d, plane),
      band: (y) => bandMask(geo, y),
    }),
    [geo, frame, loop, palette],
  );

  useCanvasLayer({
    id: "perspective-corridor",
    order,
    draw: (ctx) => {
      const buffers = buffersRef.current;
      if (!buffers) return;
      buffers.clear(blend);

      const groups = [...registry.values()].sort((a, b) => a.order - b.order);
      const t = frame / loop;

      for (const group of groups) {
        const groupBlend = group.blend ?? blend;
        for (const key of BUCKETS) {
          buffers.ctx(key).globalCompositeOperation = groupBlend;
        }
        const render = group.render as unknown as ElementRenderer<CorridorElement>;

        for (const element of group.elements) {
          // Depth advances linearly; the squared y curve turns that into a
          // speed proportional to d, so near elements travel much faster.
          const d =
            element.cycles === 0
              ? element.d0
              : Math.max(1e-4, frac(element.d0 + element.cycles * t));

          const fadeBase = depthAlpha(d, group.fadeIn);
          if (fadeBase < 0.004) continue;

          const p = projectPoint(geo, element.lane, d, element.plane);
          const mask = bandMask(geo, p.y);
          const buckets = depthBuckets(d);

          for (const key of BUCKETS) {
            const weight = buckets[key];
            if (weight < 0.006) continue;
            const bctx = buffers.ctx(key);
            bctx.save();
            render(
              bctx,
              element,
              {
                d,
                x: p.x,
                y: p.y,
                scale: d,
                alpha: fadeBase * mask * weight,
                fade: fadeBase * weight,
                buckets,
              },
              api,
            );
            bctx.restore();
          }
        }
      }

      buffers.composite(ctx);
    },
  });

  return (
    <GroupContext.Provider value={registry}>{children}</GroupContext.Provider>
  );
};
