import React, { useCallback } from "react";
import { Composition } from "remotion";
import type * as THREE from "three";
import { FPS, HEIGHT, LOOP, WIDTH } from "./lib/constants";
import { Stage } from "./lib/Stage";
import { createFabric } from "./fabric/fabric";
import { FABRIC_COLOURWAYS } from "./fabric/palettes";
import { createCubes } from "./cubes/cubes";
import { CUBES_COLOURWAYS } from "./cubes/palettes";
import { createRings } from "./rings/rings";
import { RING_CAMERAS, RING_PALETTES } from "./rings/presets";

/**
 * Loop-check mode: `REMOTION_LOOP_CHECK=1` (read at bundle time) makes every
 * composition 601 frames so frame 600 can be rendered and compared with 0.
 */
const DURATION = process.env.REMOTION_LOOP_CHECK === "1" ? LOOP + 1 : LOOP;

// ---------------------------------------------------------------------------
// Data rows: one per version. Adding a colourway or a camera angle is adding
// a row here (plus a palette / camera preset entry).
// ---------------------------------------------------------------------------
type Row =
  | { id: string; look: "fabric"; colourway: keyof typeof FABRIC_COLOURWAYS; seed: number }
  | { id: string; look: "cubes"; colourway: keyof typeof CUBES_COLOURWAYS }
  | { id: string; look: "rings"; colourway: keyof typeof RING_PALETTES; camera: keyof typeof RING_CAMERAS };

export const ROWS: Row[] = [
  { id: "PastelFabric-Iridescent", look: "fabric", colourway: "iridescent", seed: 0 },
  { id: "PastelFabric-Champagne", look: "fabric", colourway: "champagne", seed: 3.7 },
  { id: "LockCubes-BlueOrange", look: "cubes", colourway: "blueOrange" },
  { id: "DataRings-FrontTilt", look: "rings", colourway: "blue", camera: "frontTilt" },
  { id: "DataRings-CloseAngle", look: "rings", colourway: "blue", camera: "closeAngle" },
  { id: "DataRings-LowHorizon", look: "rings", colourway: "blue", camera: "lowHorizon" },
  { id: "DataRings-TopSpin", look: "rings", colourway: "blue", camera: "topSpin" },
  { id: "DataRings-FrontTiltViolet", look: "rings", colourway: "violet", camera: "frontTilt" },
];

type Creator = (gl: THREE.WebGLRenderer) => import("./lib/Stage").Look;

const LookComp: React.FC<{ row: Row }> = ({ row }) => {
  const key = JSON.stringify(row);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useCallback<Creator>(
    (gl) => {
      switch (row.look) {
        case "fabric":
          return createFabric({ palette: FABRIC_COLOURWAYS[row.colourway], seed: row.seed })(gl);
        case "cubes":
          return createCubes(CUBES_COLOURWAYS[row.colourway])(gl);
        case "rings":
          return createRings({ palette: RING_PALETTES[row.colourway], camera: RING_CAMERAS[row.camera] })(gl);
      }
    },
    [key],
  );
  const background =
    row.look === "fabric"
      ? FABRIC_COLOURWAYS[row.colourway].background
      : row.look === "cubes"
        ? CUBES_COLOURWAYS[row.colourway].background
        : RING_PALETTES[row.colourway].background;
  return <Stage create={create} background={background} />;
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {ROWS.map((row) => (
        <Composition
          key={row.id}
          id={row.id}
          component={LookComp}
          durationInFrames={DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ row }}
        />
      ))}
    </>
  );
};
