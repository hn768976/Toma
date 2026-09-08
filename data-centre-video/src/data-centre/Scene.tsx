/**
 * The whole facility, assembled.
 */

import React from "react";
import { CameraRig } from "./CameraRig";
import { Lighting } from "./Lighting";
import { Floor } from "./Floor";
import { Racks } from "./Racks";
import { Trays } from "./Trays";
import { Cables } from "./Cables";
import { Ceiling } from "./Ceiling";
import { Props as DetailProps } from "./Props";
import { CAMERA_DISTANCE } from "./constants";
import { buildLayout } from "./layout";
import type { Theme } from "./theme";

export const Scene: React.FC<{ theme: Theme; seed: number }> = ({
  theme,
  seed,
}) => {
  const layout = React.useMemo(
    () => buildLayout(seed, theme.cableColors, theme.cableAccent),
    [seed, theme],
  );

  return (
    <>
      <CameraRig />
      <color attach="background" args={[theme.background]} />
      {/* Fog is measured from the camera, which sits CAMERA_DISTANCE back;
          it fades the far edge of the floor grid into the background so no
          edge is ever visible. */}
      <fog
        attach="fog"
        args={[
          theme.background,
          CAMERA_DISTANCE + theme.fogNear,
          CAMERA_DISTANCE + theme.fogFar,
        ]}
      />
      <Lighting theme={theme} />
      <Floor layout={layout} theme={theme} />
      <Racks layout={layout} theme={theme} />
      <Trays layout={layout} theme={theme} />
      <Cables layout={layout} theme={theme} />
      <DetailProps layout={layout} theme={theme} />
      <Ceiling layout={layout} theme={theme} />
    </>
  );
};
