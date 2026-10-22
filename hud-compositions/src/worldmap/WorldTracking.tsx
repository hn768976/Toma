import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import { DesignSpace } from "../common/DesignSpace";
import { ramp } from "../common/math";
import { useFonts } from "../common/useFonts";
import { MapCanvas, MapLook } from "./MapCanvas";
import { BootDialogs, Chrome, FOCUS, SearchFrame } from "./Overlays";
import { WORLD_ALTERNATE, WORLD_REFERENCE } from "./palette";
import { MapCamera, projectPoint } from "./projection";
import { mapCameraAt, W } from "./timeline";

export const worldSchema = z.object({
  /** "reference" graphite/red grade, or "holo" navy/cyan/amber grade. */
  palette: z.enum(["reference", "holo"]),
});


export const WorldTracking: React.FC<z.infer<typeof worldSchema>> = ({ palette }) => {
  useFonts();
  const frame = useCurrentFrame();
  const pal = palette === "holo" ? WORLD_ALTERNATE : WORLD_REFERENCE;

  // Motion blur over a 180° shutter: the faster the camera moves on screen,
  // the more sub-samples; a final directional smear hides the residual steps.
  const c0 = mapCameraAt(frame - 0.25);
  const c1 = mapCameraAt(frame + 0.25);
  const shift = projectPoint(c0, c1.lon, c1.lat, 1920, 1080);
  const vx = shift.x - 960;
  const vy = shift.y - 540;
  const zoomPx = Math.abs(Math.log(c1.k / c0.k)) * 900;
  const travel = Math.hypot(vx, vy) + zoomPx;
  const samples = travel < 1.5 ? 1 : Math.min(40, Math.ceil(travel / 6));
  const cams: MapCamera[] =
    samples === 1
      ? [mapCameraAt(frame)]
      : Array.from({ length: samples }, (_, i) => mapCameraAt(frame - 0.25 + (0.5 * (i + 0.5)) / samples));
  const smear = samples > 1 ? { x: -vx / samples, y: -vy / samples } : undefined;

  const focusOn = ramp(frame, W.frameIn - 2, W.frameIn + 10);
  const look: MapLook = {
    bright:
      ramp(frame, W.brighten, W.brighten + 8) * (1 - ramp(frame, W.zoomNA[1], W.zoomNA[1] + 20)) * 0.9 +
      0.25 * Math.exp(-Math.pow((frame - W.alpha) / 3, 2)),
    focus: focusOn > 0 ? { ...FOCUS, dim: 0.42 * focusOn, lift: (frame >= W.alpha ? 0.1 : 0.16) * focusOn } : undefined,
    reveal: ramp(frame, 0, 16),
    revealSeed: Math.floor(frame / 2),
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <MapCanvas cams={cams} palette={pal} look={look} smear={smear} />
      <DesignSpace>
        <Chrome frame={frame} pal={pal} />
        <SearchFrame frame={frame} cam={mapCameraAt(frame)} pal={pal} />
        <BootDialogs frame={frame} pal={pal} />
      </DesignSpace>
    </AbsoluteFill>
  );
};
