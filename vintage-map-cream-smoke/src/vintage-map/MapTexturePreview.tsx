import { useEffect, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { useAsyncResource } from "../lib/useAsyncResource";
import { getMapTexture } from "./buildTexture";
import { MAP_REGIONS } from "./regions";

// Debug view: the whole flat map texture, scaled to fit. Used for the map
// accuracy check (labels, borders, graticule). Also logs the placed labels
// as JSON so scripts/check-labels.mjs can test them against Natural Earth.
export const MapTexturePreview: React.FC<{ region: string; texScreenWidth: number }> = ({ region, texScreenWidth }) => {
  const r = MAP_REGIONS[region];
  const tex = useAsyncResource(`${region}@${texScreenWidth}`, () => getMapTexture(r, texScreenWidth), `map texture ${region}`);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!tex || !c) return;
    const s = c.width / tex.width;
    c.height = Math.round(tex.height * s);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    for (const t of tex.tiles) ctx.drawImage(t.canvas, t.gutter, t.gutter, t.w, t.h, t.x * s, t.y * s, t.w * s, t.h * s);
    console.log(`MAPLABELS ${JSON.stringify({ region, stats: tex.stats, labels: tex.labels, width: tex.width, height: tex.height })}`);
  }, [tex, region]);
  return (
    <AbsoluteFill style={{ background: "#222" }}>
      <canvas ref={ref} width={2000} height={1400} style={{ width: 2000 }} />
    </AbsoluteFill>
  );
};
