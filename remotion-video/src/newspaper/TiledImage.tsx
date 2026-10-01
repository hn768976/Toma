import React from "react";
import { AbsoluteFill, Img } from "remotion";

// Tiles an image across an area with <Img> elements (which Remotion
// waits on before capturing a frame, unlike CSS background-image).
// offsetX/offsetY shift the tile grid, wrapping within one tile.
export const TiledImage: React.FC<{
  src: string;
  tileSize: number;
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  style?: React.CSSProperties;
}> = ({ src, tileSize, width, height, offsetX = 0, offsetY = 0, style }) => {
  const ox = (offsetX % tileSize) - tileSize;
  const oy = (offsetY % tileSize) - tileSize;
  const cols = Math.ceil((width - ox) / tileSize);
  const rows = Math.ceil((height - oy) / tileSize);
  const tiles: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push(
        <Img
          key={`${r}-${c}`}
          src={src}
          style={{
            position: "absolute",
            left: ox + c * tileSize,
            top: oy + r * tileSize,
            width: tileSize,
            height: tileSize,
          }}
        />,
      );
    }
  }
  return (
    <AbsoluteFill style={{ overflow: "hidden", ...style }}>
      {tiles}
    </AbsoluteFill>
  );
};
