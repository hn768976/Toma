import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import type { CameraVariant } from "./cameraPaths";
import { GlobeScene } from "./GlobeScene";

export type DigitalGlobeProps = { variant: CameraVariant };

export const DigitalGlobe: React.FC<DigitalGlobeProps> = ({ variant }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        // Deep navy space with a brighter blue bloom on the right, as in the reference.
        background:
          "radial-gradient(ellipse 70% 90% at 92% 30%, #1d3f9e 0%, rgba(20,45,130,0.55) 35%, rgba(4,10,40,0) 75%)," +
          "radial-gradient(ellipse 60% 70% at 85% 105%, #1a3586 0%, rgba(10,25,80,0) 70%)," +
          "linear-gradient(160deg, #050c2b 0%, #071338 45%, #0a1a4c 100%)",
      }}
    >
      <ThreeCanvas
        width={width}
        height={height}
        dpr={1}
        gl={{ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 35, near: 0.005, far: 60, position: [0, 0, 5] }}
        style={{ position: "absolute", inset: 0 }}
      >
        <GlobeScene variant={variant} />
      </ThreeCanvas>
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 75% 75% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,2,12,0.6) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
