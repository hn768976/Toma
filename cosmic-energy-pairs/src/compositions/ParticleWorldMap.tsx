import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { MapColours } from "../colourways";
import { LandCell, rasterizeLand } from "../lib/landGrid";
import { Stage } from "../lib/Stage";
import { buildNetwork, LABELS, makeCamera, MAP_FRAMES_TOTAL, MAP_POST, WorldMapLook } from "../looks/worldmap";

export const MAP_FRAMES = MAP_FRAMES_TOTAL;

// Natural Earth 1:110m land (public domain), loaded once per page.
let landPromise: Promise<LandCell[]> | null = null;
const loadLand = () =>
  (landPromise ??= fetch(staticFile("data/ne_110m_land.geojson"))
    .then((r) => r.json())
    .then(rasterizeLand));

/** Tiny placeholder coordinate numbers that blink near a few network nodes. */
const Labels: React.FC<{ cells: LandCell[]; colour: string }> = ({ cells, colour }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { nodes } = useMemo(() => buildNetwork(cells), [cells]);
  const cam = makeCamera(frame, width / height);
  return (
    <AbsoluteFill>
      {LABELS.map((text, i) => {
        const node = nodes[(i * 5 + 2) % nodes.length];
        const start = node.appear + 30 + i * 9;
        if (frame < start) return null;
        // Blink: deterministic on/off pattern from the frame number.
        const on = Math.floor((frame - start + i * 3) / 7) % 4 !== 3;
        const p = node.pos.clone().project(cam);
        const x = (p.x * 0.5 + 0.5) * width + 18;
        const y = (-p.y * 0.5 + 0.5) * height - 34;
        return (
          <div
            key={text}
            style={{
              position: "absolute",
              left: x,
              top: y,
              fontFamily: "'DejaVu Sans Mono', 'Menlo', 'Consolas', monospace",
              fontSize: 22,
              letterSpacing: 1,
              color: colour,
              opacity: on ? 0.85 : 0.12,
              textShadow: `0 0 8px ${colour}`,
            }}
          >
            {text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const ParticleWorldMap: React.FC<{ colours: MapColours }> = ({ colours }) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading Natural Earth land data"));
  const [cells, setCells] = useState<LandCell[] | null>(null);
  useEffect(() => {
    loadLand()
      .then((c) => {
        setCells(c);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle, continueRender, cancelRender]);

  const key = JSON.stringify(colours);
  const create = useMemo(
    () => (cells ? () => new WorldMapLook(JSON.parse(key), cells) : null),
    [cells, key],
  );
  if (!cells || !create) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
  return (
    <AbsoluteFill>
      <Stage create={create} post={MAP_POST} msaa={4} />
      <Labels cells={cells} colour={colours.label} />
    </AbsoluteFill>
  );
};
