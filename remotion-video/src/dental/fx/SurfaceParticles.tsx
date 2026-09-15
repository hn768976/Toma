// Convenience wrapper: sample spawn points off the arch, then emit.
//
// Kept separate from ParticleField so the field itself stays a pure
// instanced renderer with no knowledge of the mesh.

import React, { useMemo } from "react";
import { ParticleField, ParticleFieldProps } from "./ParticleField";
import { sampleSurface, SurfaceRegion } from "./surfaceSamples";
import { useMandible } from "../mesh/useMandible";

export type SurfaceParticlesProps = Omit<ParticleFieldProps, "samples"> & {
  region: SurfaceRegion;
  count: number;
};

export const SurfaceParticles: React.FC<SurfaceParticlesProps> = ({
  region,
  count,
  seed,
  ...rest
}) => {
  const data = useMandible();
  const samples = useMemo(
    () => sampleSurface(data.geometry, region, count, seed),
    [data, region, count, seed],
  );
  return <ParticleField samples={samples} seed={seed} {...rest} />;
};
