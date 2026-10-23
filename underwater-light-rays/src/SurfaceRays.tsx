import React from "react";
import { ShaderCanvas, Uniforms } from "./gl/ShaderCanvas";
import { SURFACE_RAYS_FRAG } from "./shaders/surfaceRays";

export type SurfacePalette = "ocean" | "goldenHour";

const PALETTES: Record<SurfacePalette, Uniforms> = {
  // Sampled from the reference: clear tropical blue.
  ocean: {
    uColTop: [0.06, 0.56, 0.82],
    uColMid: [0.07, 0.56, 0.81],
    uColLow: [0.0, 0.37, 0.64],
    uColShadow: [0.0, 0.1, 0.28],
    uColSeabed: [0.4, 0.8, 0.86],
    uColSurface: [0.55, 0.92, 1.0],
    uColRay: [0.55, 0.92, 1.0],
    uColSun: [1.0, 1.0, 0.97],
  },
  // Alternative grade: low evening sun, amber surface sinking into indigo.
  goldenHour: {
    uColTop: [0.78, 0.5, 0.27],
    uColMid: [0.62, 0.42, 0.32],
    uColLow: [0.3, 0.22, 0.34],
    uColShadow: [0.04, 0.04, 0.16],
    uColSeabed: [0.85, 0.6, 0.42],
    uColSurface: [1.0, 0.8, 0.5],
    uColRay: [1.0, 0.76, 0.44],
    uColSun: [1.0, 0.95, 0.8],
  },
};

type Props = {
  palette: SurfacePalette;
};

export const SurfaceRays: React.FC<Props> = ({ palette }) => {
  const uniforms = React.useMemo(
    () => ({ uSunPos: [0.3, 0.97], ...PALETTES[palette] }),
    [palette],
  );
  return <ShaderCanvas fragmentShader={SURFACE_RAYS_FRAG} uniforms={uniforms} />;
};
