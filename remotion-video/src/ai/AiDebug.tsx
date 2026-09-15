import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { useNeuralGeometry } from "./useGlb";

const Geo: React.FC = () => {
  const geometry = useNeuralGeometry();
  console.log("DEBUG geometry:", geometry ? "LOADED" : "NULL");
  if (geometry) {
    const bb = geometry.boundingBox;
    console.log("DEBUG bbox min", bb?.min.toArray(), "max", bb?.max.toArray());
    console.log("DEBUG posCount", geometry.attributes.position.count);
  }
  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshNormalMaterial wireframe={false} />
    </mesh>
  );
};

export const AiDebug: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#101018" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 40, position: [0, 0, 4.4], near: 0.1, far: 100 }}
      >
        <ambientLight intensity={2} />
        <mesh position={[-1.6, 1.0, 0]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshBasicMaterial color="magenta" />
        </mesh>
        <Geo />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
