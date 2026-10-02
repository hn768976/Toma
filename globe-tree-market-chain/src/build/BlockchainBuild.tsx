import React from "react";
import { AbsoluteFill } from "remotion";
import { Stage } from "../lib/three/Stage";
import { useAsync } from "../lib/useAsync";
import { BuildVersion } from "../versions";
import { buildBuildWorld } from "./world";

export const BlockchainBuild: React.FC<{ version: BuildVersion }> = ({ version }) => {
  const world = useAsync(`build-${version.id}`, async () => buildBuildWorld(version, window.devicePixelRatio || 1));
  return (
    <AbsoluteFill style={{ background: version.board }}>
      <Stage world={world} background={version.board} />
    </AbsoluteFill>
  );
};
