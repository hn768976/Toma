import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFonts } from "../lib/fonts";
import { Stage } from "../lib/three/Stage";
import { useAsync } from "../lib/useAsync";
import { PanelsVersion } from "../versions";
import { buildPanelsWorld } from "./world";

export const BlockchainPanels: React.FC<{ version: PanelsVersion }> = ({ version }) => {
  const world = useAsync(`panels-${version.id}`, async () => {
    await loadFonts();
    return buildPanelsWorld(version, window.devicePixelRatio || 1);
  });
  return (
    <AbsoluteFill style={{ background: version.navy }}>
      <Stage world={world} background={version.navy} />
    </AbsoluteFill>
  );
};
