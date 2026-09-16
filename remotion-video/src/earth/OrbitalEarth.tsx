import { z } from "zod";
import { EarthCanvas } from "./EarthCanvas";

export const orbitalEarthSchema = z.object({
  shot: z.enum(["orbitDrift", "lowHorizon"]),
  /** 1 renders at delivery resolution; 2 supersamples and filters down. */
  superSample: z.number().min(1).max(2),
  /** MSAA samples on the scene pass. 1 disables it. */
  samples: z.number().int().min(1).max(4),
});

export type OrbitalEarthProps = z.infer<typeof orbitalEarthSchema>;

export const OrbitalEarth: React.FC<OrbitalEarthProps> = ({ shot, superSample, samples }) => (
  <EarthCanvas shot={shot} superSample={superSample} samples={samples} />
);
