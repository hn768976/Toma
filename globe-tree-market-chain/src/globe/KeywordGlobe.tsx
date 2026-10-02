import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFonts } from "../lib/fonts";
import { loadLand } from "../lib/landmask";
import { Stage } from "../lib/three/Stage";
import { useAsync } from "../lib/useAsync";
import { GlobeVersion } from "../versions";
import { buildGlobeWorld } from "./world";

export const KeywordGlobe: React.FC<{ version: GlobeVersion }> = ({ version }) => {
  const world = useAsync(`globe-${version.id}`, async () => {
    const [, land] = await Promise.all([loadFonts(), loadLand()]);
    return buildGlobeWorld(version, land);
  });
  return (
    <AbsoluteFill style={{ background: version.bgEdge }}>
      <Stage world={world} background={version.bgEdge} />
    </AbsoluteFill>
  );
};
