import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";

import { CAM_VFOV_DEG, CAM_Y } from "./constants";
import { PALETTES, type PaletteName } from "./palette";
import { mulberry32 } from "./random";
import { Streamlines } from "./Streamlines";

export type FlowFieldProps = {
  palette: PaletteName;
  fieldSeed: number;
};

/**
 * A seamless, tileable grain plate. Rasterised once by Chrome and then tiled,
 * which is far cheaper than running a full-frame SVG filter every frame.
 */
const GRAIN_TILE = (() => {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'>` +
    `<filter id='n' x='0' y='0' width='100%' height='100%'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='3' stitchTiles='stitch' seed='7'/>` +
    `<feColorMatrix type='saturate' values='0'/>` +
    `<feComponentTransfer><feFuncA type='discrete' tableValues='1'/></feComponentTransfer>` +
    `</filter>` +
    `<rect width='260' height='260' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
})();

export const FlowField: React.FC<FlowFieldProps> = ({ palette, fieldSeed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const background = PALETTES[palette].background;

  // The grain plate is shifted every frame so the pattern never sits still.
  // Seeded from the frame number, so it is identical on every render thread.
  const grainOffset = useMemo(() => {
    const rand = mulberry32(frame * 2654435761 + 17);
    return `${(rand() * 260).toFixed(1)}px ${(rand() * 260).toFixed(1)}px`;
  }, [frame]);

  // Sizes are fractions of the frame, so the 1080p preview and a later 4K
  // render are the same picture at two resolutions.
  const grainTile = `${(height * 0.12).toFixed(1)}px ${(height * 0.12).toFixed(1)}px`;

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio || 1}
        gl={{
          antialias: false,
          alpha: false,
          stencil: false,
          powerPreference: "high-performance",
        }}
        // Initial values only; <CameraRig> inside re-applies the full camera
        // from the same constants the CPU-side projection uses.
        camera={{ fov: CAM_VFOV_DEG, position: [0, CAM_Y, 0], rotation: [0, 0, 0] }}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <Streamlines palette={palette} fieldSeed={fieldSeed} />
      </ThreeCanvas>

      {/* Vignette. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 74% 78% at 50% 56%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.34) 78%, rgba(0,0,0,0.62) 100%)",
        }}
      />

      {/* Fine grain. Additive, so it dithers the near-black field that would
          otherwise band badly once the frame is encoded to H.264. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          backgroundImage: GRAIN_TILE,
          backgroundRepeat: "repeat",
          backgroundSize: grainTile,
          backgroundPosition: grainOffset,
          mixBlendMode: "screen",
          opacity: 0.022,
        }}
      />
    </AbsoluteFill>
  );
};
