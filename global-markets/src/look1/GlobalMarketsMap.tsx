import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useAssets, WorldData } from "../common/assets";
import { MAP_PALETTES, MapPalette } from "../common/palettes";
import { MarketsEngine } from "./engine";

const Scene: React.FC<{ world: WorldData; palette: MapPalette }> = ({ world, palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { gl } = useThree();
  const ref = useRef<MarketsEngine | null>(null);
  if (!ref.current) {
    const dpr = gl.getPixelRatio();
    const pw = Math.floor(width * dpr);
    const ph = Math.floor(height * dpr);
    ref.current = new MarketsEngine(gl, world, palette, pw, ph, pw / width);
  }
  useEffect(() => () => ref.current?.dispose(), []);
  useFrame(() => {
    ref.current?.render(frameRef.current);
  }, 1);
  return null;
};

export const GlobalMarketsMap: React.FC<{ paletteId: string }> = ({ paletteId }) => {
  const { width, height } = useVideoConfig();
  const world = useAssets("50m");
  const palette = MAP_PALETTES.find((p) => p.id === paletteId)!;
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.ocean }}>
      {world ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          linear
          gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        >
          <Scene world={world} palette={palette} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
