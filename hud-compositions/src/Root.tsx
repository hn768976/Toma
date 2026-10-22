import "./index.css";
import { Composition } from "remotion";
import { FPS, HEIGHT, SATELLITE_DURATION, WIDTH, WORLD_DURATION } from "./common/constants";
import { WorldTracking, worldSchema } from "./worldmap/WorldTracking";
import { MAP_TEX_H, MAP_TEX_W, MapTextureBake } from "./worldmap/MapTextureBake";
import { SatelliteTargeting, satelliteSchema } from "./satellite/SatelliteTargeting";
import { TerrainBake, terrainBakeSchema } from "./satellite/TerrainBake";
import { BAKE_SIZE } from "./satellite/terrain.frag";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SatelliteTargeting-V1"
        component={SatelliteTargeting}
        durationInFrames={SATELLITE_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={satelliteSchema}
        defaultProps={{ variant: "reference" as const }}
      />
      <Composition
        id="SatelliteTargeting-V2"
        component={SatelliteTargeting}
        durationInFrames={SATELLITE_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={satelliteSchema}
        defaultProps={{ variant: "orbit" as const }}
      />
      <Composition
        id="WorldTracking-V1"
        component={WorldTracking}
        durationInFrames={WORLD_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={worldSchema}
        defaultProps={{ palette: "reference" as const }}
      />
      <Composition
        id="WorldTracking-V2"
        component={WorldTracking}
        durationInFrames={WORLD_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={worldSchema}
        defaultProps={{ palette: "holo" as const }}
      />
      {/* Asset bakers for the satellite terrain textures (see README). */}
      <Composition
        id="TerrainBake-Wide"
        component={TerrainBake}
        durationInFrames={1}
        fps={FPS}
        width={BAKE_SIZE.wide[0]}
        height={BAKE_SIZE.wide[1]}
        schema={terrainBakeSchema}
        defaultProps={{ region: "wide" as const }}
      />
      <Composition
        id="TerrainBake-Close"
        component={TerrainBake}
        durationInFrames={1}
        fps={FPS}
        width={BAKE_SIZE.close[0]}
        height={BAKE_SIZE.close[1]}
        schema={terrainBakeSchema}
        defaultProps={{ region: "close" as const }}
      />
      <Composition
        id="MapTextureBake"
        component={MapTextureBake}
        durationInFrames={1}
        fps={FPS}
        width={MAP_TEX_W}
        height={MAP_TEX_H}
      />
    </>
  );
};
