import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";
import { BackgroundWash } from "./BackgroundWash";
import { GrainPass } from "./GrainPass";
import { SphereRings } from "./SphereRings";
import { COMPOSITION_IDS, resolveComposition } from "./compositions";
import { PALETTE_NAMES, resolvePalette, type PaletteName } from "./palettes";
import type { SphereRippleProps } from "./types";

export const sphereRippleDefaultProps: SphereRippleProps = {
  composition: "r01",
  palette: "cobalt",
};

export const SPHERE_RIPPLE_COMPOSITION_IDS = COMPOSITION_IDS;
export const SPHERE_RIPPLE_PALETTE_NAMES = PALETTE_NAMES;

/**
 * A single still. `durationInFrames` is 1 and nothing here reads the frame —
 * the same composition and palette always produce the same image.
 */
export const SphereRipple: React.FC<SphereRippleProps> = ({
  composition,
  palette,
}) => {
  const spec = useMemo(() => resolveComposition(composition), [composition]);
  const pal = useMemo(() => resolvePalette(palette as PaletteName), [palette]);

  // Painting 4K ring art takes a while; hold the render open until every
  // layer's layout effect has run. Child layout effects complete before this
  // parent effect fires.
  const [handle] = useState(() =>
    delayRender(`SphereRipple ${composition}/${palette}`, {
      timeoutInMilliseconds: 300000,
    }),
  );
  useEffect(() => {
    continueRender(handle);
  }, [handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black", isolation: "isolate" }}>
      <BackgroundWash spec={spec} palette={pal} />
      <SphereRings spec={spec} palette={pal} />
      <GrainPass spec={spec} />
    </AbsoluteFill>
  );
};
