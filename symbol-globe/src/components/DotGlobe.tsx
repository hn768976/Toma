/**
 * The rotating dot globe.
 *
 * A d3 orthographic projection gives a true sphere: the far hemisphere is
 * clipped away rather than folded onto the near one. The projection's rotate
 * longitude advances by exactly 360 degrees across the loop, so the globe
 * completes one revolution and frame 450 lands back on frame 0.
 *
 * The lat/lon sample grid and the land test are rotation-independent, so they
 * are computed once. Per frame the work is only: project each land point, drop
 * the ones the projection clipped, and draw a dot.
 *
 * What sells the curvature is foreshortening. For an orthographic projection of
 * a unit sphere the projected distance from the centre is sin(delta), where
 * delta is the angle from the point the camera faces — so cos(delta), the
 * cosine of that angle, falls straight out of the screen position with no extra
 * trigonometry. Dots are scaled and dimmed by it, shrinking and fading towards
 * the limb.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { geoCircle, geoOrthographic, geoPath } from "d3-geo";
import {
  rasteriseLandMask,
  sampleLandPoints,
  type LandPoint,
} from "../lib/dotMapFromLand";
import { colorRamp, withAlpha } from "../lib/color";
import type { GeoPermissibleObjects } from "d3-geo";
import { useStageLayer } from "../stage/CanvasStage";
import {
  ARC_CENTRES,
  DOT_SIZE_CENTRE,
  DOT_SIZE_LIMB,
  DOT_STEP_DEG,
  DESIGN_HEIGHT,
  GLOBE_DIAMETER_RATIO,
  GLOBE_TILT_DEG,
} from "../config";
import type { Palette } from "../variants";

/** Colour/alpha buckets used to batch dots into a few fills per frame. */
const SHADE_STEPS = 20;

export type DotGlobeProps = {
  palette: Palette;
  /**
   * Land polygons, or null while they are still loading. Loading is the
   * parent's job: a state update here would re-render only this component,
   * and the shared canvas is composited by an ancestor.
   */
  land: GeoPermissibleObjects | null;
  /**
   * Frames in one full loop. Passed explicitly rather than read from the
   * composition so the same component can be rendered past the end of its loop
   * (frame 450 of a 450-frame cycle) to prove the loop actually closes.
   */
  loopLength: number;
  z: number;
};

export const DotGlobe: React.FC<DotGlobeProps> = ({
  palette,
  land,
  loopLength,
  z,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const scale = height / DESIGN_HEIGHT;
  const radius = (height * GLOBE_DIAMETER_RATIO) / 2;
  const cx = width / 2;
  const cy = height / 2;

  // Built once: rasterise the land, then keep the sample points that fall on it.
  const landPoints: LandPoint[] = useMemo(() => {
    if (!land) return [];
    const mask = rasteriseLandMask(land, 2048);
    return sampleLandPoints(mask, { stepDeg: DOT_STEP_DEG, stagger: true });
  }, [land]);

  // Limb (turned away) through to centre (facing the viewer).
  const shades = useMemo(
    () => colorRamp(palette.globeDim, palette.globeDot, SHADE_STEPS),
    [palette.globeDim, palette.globeDot],
  );

  const arcs = useMemo(
    () => ARC_CENTRES.map((centre) => geoCircle().center(centre).radius(90)()),
    [],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    // Exactly one revolution across the loop, so frame 450 lands back on the
    // longitude frame 0 started from.
    const turn = frame / loopLength;
    const projection = geoOrthographic()
      .translate([cx, cy])
      .scale(radius)
      .rotate([turn * 360, GLOBE_TILT_DEG, 0])
      // Without this the projection would wrap the far hemisphere back over the
      // near one and the globe would read as a flat disc.
      .clipAngle(90);

    // --- land dots -------------------------------------------------------
    // Gathered into shade buckets first: assigning fillStyle re-parses a colour
    // string every time, so a few hundred dots per bucket cost one assignment
    // and one fill instead of one each.
    const buckets: number[][] = Array.from({ length: SHADE_STEPS }, () => []);
    for (const point of landPoints) {
      const projected = projection([point.lon, point.lat]);
      if (!projected) continue;
      const [px, py] = projected;
      const dx = px - cx;
      const dy = py - cy;
      const rr = (dx * dx + dy * dy) / (radius * radius);
      if (rr > 1) continue;
      const facing = Math.sqrt(Math.max(0, 1 - rr));
      const bucket = Math.min(
        SHADE_STEPS - 1,
        Math.floor(facing * SHADE_STEPS),
      );
      buckets[bucket].push(px, py);
    }

    ctx.globalCompositeOperation = "source-over";
    for (let b = 0; b < SHADE_STEPS; b++) {
      const coords = buckets[b];
      if (coords.length === 0) continue;
      const facing = (b + 0.5) / SHADE_STEPS;
      // A gentle power keeps more of the disc near full size, so the shrink
      // reads as curvature at the edge rather than a gradient across the face.
      const eased = Math.pow(facing, 0.55);
      const diameter =
        (DOT_SIZE_LIMB + (DOT_SIZE_CENTRE - DOT_SIZE_LIMB) * eased) * scale;
      ctx.fillStyle = shades[b];
      // Orthographic projection crowds dots together towards the limb, which on
      // its own would read as a bright dense rim — the signature of a flat
      // disc. Fading them hard as they turn away cancels that crowding and is
      // the strongest curvature cue in the frame.
      ctx.globalAlpha = 0.14 + 0.86 * Math.pow(facing, 0.8);
      ctx.beginPath();
      for (let i = 0; i < coords.length; i += 2) {
        const x = coords[i];
        const y = coords[i + 1];
        ctx.moveTo(x + diameter / 2, y);
        ctx.arc(x, y, diameter / 2, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- great-circle arcs across the face --------------------------------
    const path = geoPath(projection, ctx);
    ctx.strokeStyle = withAlpha(palette.arcLine, 0.32);
    ctx.lineWidth = 2 * scale;
    for (const arc of arcs) {
      ctx.beginPath();
      path(arc);
      ctx.stroke();
    }

    // --- darker core -------------------------------------------------------
    // Holding the middle of the disc down stops the sphere reading as an evenly
    // lit plate, and makes the limb ring below feel like it is wrapping around.
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.86);
    core.addColorStop(0, withAlpha(palette.backgroundDeep, 0.34));
    core.addColorStop(0.55, withAlpha(palette.backgroundDeep, 0.18));
    core.addColorStop(1, withAlpha(palette.backgroundDeep, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.86, 0, Math.PI * 2);
    ctx.fill();

    // --- atmosphere --------------------------------------------------------
    // Concentrated on the limb itself: the peak sits at r = radius, and both
    // shoulders fall away quickly. A wide band here reads as a halo hanging
    // around the globe rather than as air sitting on its edge.
    const inner = radius * 0.9;
    const outer = radius * 1.075;
    const peak = (radius - inner) / (outer - inner);
    const limb = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    limb.addColorStop(0, withAlpha(palette.globeLimb, 0));
    limb.addColorStop(peak * 0.72, withAlpha(palette.globeLimb, 0.07));
    limb.addColorStop(peak, withAlpha(palette.globeLimb, 0.26));
    limb.addColorStop(Math.min(1, peak + 0.18), withAlpha(palette.globeLimb, 0.1));
    limb.addColorStop(1, withAlpha(palette.globeLimb, 0));
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = limb;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  };

  useStageLayer({ id: "dot-globe", z, draw });
  return null;
};
