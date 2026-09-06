import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { BACKGROUND, Palette } from "./constants";
import { CameraRig, StrokeField } from "./StrokeField";
import { Grain } from "./Grain";

export type LineWaveProps = {
  palette: Palette;
  grainOpacity: number;
};

/**
 * A band of fine line strokes lying on an undulating surface, seen almost
 * edge-on across the lower half of a white frame.
 *
 * There is no bloom and no glow anywhere in this file, and there must not be:
 * additive compositing on white washes the frame out instead of brightening
 * it. Everything dark in the picture is strokes overlapping.
 */
export const LineWave: React.FC<LineWaveProps> = ({ palette, grainOpacity }) => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
      <ThreeCanvas
        width={width}
        height={height}
        gl={{
          antialias: false, // the strokes anti-alias themselves, in shader
          alpha: false,
        }}
        style={{ backgroundColor: BACKGROUND }}
      >
        <color attach="background" args={[BACKGROUND]} />
        <CameraRig />
        <StrokeField palette={palette} />
      </ThreeCanvas>
      <Grain opacity={grainOpacity} />
    </AbsoluteFill>
  );
};
