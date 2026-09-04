import React from "react";
import type { DepthConfig } from "../depth";
import { depthOpacity, layerBlur, layerZ } from "../depth";
import type { Layer as LayerData } from "../scene";
import type { Palette } from "../theme";
import { HexBlock } from "./HexBlock";
import { RecordGroup } from "./RecordGroup";

/**
 * One depth plane: a flat billboard of text and icons parked at its current Z.
 *
 * The blur is recomputed every frame from the plane's distance to the focal
 * slab, so elements sharpen as they come into focus and soften again as they
 * pass — a fixed per-layer blur would read as a flat matte painting instead.
 */
export const Layer: React.FC<{
  layer: LayerData;
  cfg: DepthConfig;
  frame: number;
  durationInFrames: number;
  width: number;
  palette: Palette;
}> = ({ layer, cfg, frame, durationInFrames, width, palette }) => {
  const z = layerZ(cfg, layer.index, frame, durationInFrames);
  const opacity = depthOpacity(cfg, z) * layer.alpha;

  // Wrapped-round layers fade to nothing at both ends of the cycle; skip them
  // rather than paying for a large blurred surface nobody can see.
  if (opacity < 0.004) {
    return null;
  }

  const blur = layerBlur(cfg, z);
  const tones = [palette.dataBright, palette.dataMid, palette.dataDim];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: "50% 50%",
        transform: `translateZ(${z}px) rotateX(${layer.rotateX}deg) rotateY(${layer.rotateY}deg) rotateZ(${layer.rotateZ}deg)`,
        filter: blur > 0.15 ? `blur(${blur}px)` : undefined,
        opacity,
      }}
    >
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
        {layer.blocks.map((block, i) => (
          <HexBlock
            key={`b${i}`}
            block={block}
            frame={frame}
            width={width}
            color={tones[block.tone]}
            opacity={1}
          />
        ))}
        {layer.records.map((record, i) => (
          <RecordGroup
            key={`r${i}`}
            record={record}
            frame={frame}
            width={width}
            palette={palette}
            opacity={1}
          />
        ))}
      </div>
    </div>
  );
};
