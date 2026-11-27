import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { PaletteName } from "./look";
import { WavesScene } from "./WavesScene";

export type WavesProps = {
  palette: PaletteName;
  /** Look-dev stills only: show this frame instead of the current one. */
  frameOverride?: number;
};

export const Waves: React.FC<WavesProps> = ({ palette, frameOverride }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        // The drawing buffer follows the render scale (0.5 -> 1080p, 1 -> 4K).
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio}
        flat
        gl={{ antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" }}
      >
        <WavesScene palette={palette} frameOverride={frameOverride} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
