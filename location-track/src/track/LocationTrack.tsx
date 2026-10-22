import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { drawMapA, drawMapB, MapLayers } from "./maps";
import { MapRenderer } from "./renderer";
import { Palette } from "./palette";
import { viewAt } from "./timeline";
import { Hud } from "./Hud";
import { loadTrackFonts } from "./fonts";

// The maps are deterministic and expensive to paint, so build them once per page.
let mapsCache: Record<"A" | "B", MapLayers> | null = null;
const getMaps = () => {
  if (!mapsCache) mapsCache = { A: drawMapA(), B: drawMapB() };
  return mapsCache;
};

export const LocationTrack: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<MapRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Building maps"));

  useEffect(() => {
    loadTrackFonts()
      .then(() => {
        if (!renderer.current && canvas.current) {
          renderer.current = new MapRenderer(canvas.current, getMaps());
        }
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle]);

  const t = frame / fps;
  const view = viewAt(t);

  useLayoutEffect(() => {
    if (!ready || !renderer.current) return;
    try {
      renderer.current.render(view, palette, t);
    } catch (err) {
      cancelRender(err);
    }
  }, [ready, view, palette, t]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvas}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
      {ready && <Hud t={t} frame={frame} view={view} palette={palette} />}
    </AbsoluteFill>
  );
};
