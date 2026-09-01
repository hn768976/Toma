import React, { useLayoutEffect, useMemo, useRef } from "react";
import { geoPath } from "d3-geo";
import { interpolate, useCurrentFrame } from "remotion";
import { buildLandProjection } from "../geo";
import { HEIGHT, ICON_CENTER_X, ICON_CENTER_Y, TIMING, WIDTH } from "../layout";
import { mapDrift } from "../motion";
import type { Palette } from "../variants";
import { createOffscreen, withAlpha } from "../util";

/** Slack around the map buffer so drifting never exposes a bare edge. */
const MAP_MARGIN = 40;

type Props = { palette: Palette };

/**
 * Deep fill, a soft radial wash behind the verdict icon, and Natural Earth
 * land polygons at low contrast. The projection and the land path are built
 * exactly once; every frame only blits the finished buffer at a drift offset.
 */
export const WorldBackdrop: React.FC<Props> = ({ palette }) => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const mapBuffer = useMemo(() => {
    const buffer = createOffscreen(WIDTH + MAP_MARGIN * 2, HEIGHT + MAP_MARGIN * 2);
    const ctx = buffer?.getContext("2d");
    if (!buffer || !ctx) return buffer;

    const { land, projection } = buildLandProjection();
    ctx.save();
    ctx.translate(MAP_MARGIN, MAP_MARGIN);
    const path = geoPath(projection, ctx);
    ctx.beginPath();
    path(land);
    ctx.fillStyle = withAlpha(palette.mapLand, 0.82);
    ctx.fill();
    // A hairline of the same hue keeps small islands from disappearing
    // without lifting the landmass contrast.
    ctx.strokeStyle = withAlpha(palette.mapLand, 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    return buffer;
  }, [palette.mapLand]);

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = palette.backgroundDeep;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const fade = interpolate(frame, TIMING.backdropFadeIn, [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    const wash = ctx.createRadialGradient(
      ICON_CENTER_X,
      ICON_CENTER_Y,
      0,
      ICON_CENTER_X,
      ICON_CENTER_Y,
      1650,
    );
    wash.addColorStop(0, withAlpha(palette.backgroundWash, 0.95 * fade));
    wash.addColorStop(0.55, withAlpha(palette.backgroundWash, 0.42 * fade));
    wash.addColorStop(1, withAlpha(palette.backgroundWash, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (mapBuffer) {
      const drift = mapDrift(frame);
      ctx.globalAlpha = fade;
      ctx.drawImage(mapBuffer, -MAP_MARGIN + drift.x, -MAP_MARGIN + drift.y);
      ctx.globalAlpha = 1;
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}
    />
  );
};
