import { z } from "zod";
import { EarthCanvas } from "./EarthCanvas";
import { SHOT_IDS } from "./config";

export const orbitalEarthSchema = z.object({
  shot: z.enum(SHOT_IDS as [string, ...string[]]),
  /** 1 renders at delivery resolution; 2 supersamples and filters down. */
  superSample: z.number().min(1).max(2),
  /** MSAA samples on the scene pass. 1 disables it. */
  samples: z.number().int().min(1).max(4),
});

export type OrbitalEarthProps = z.infer<typeof orbitalEarthSchema>;

export const OrbitalEarth: React.FC<OrbitalEarthProps> = ({ shot, superSample, samples }) => (
  <EarthCanvas
    shot={shot as Parameters<typeof EarthCanvas>[0]["shot"]}
    superSample={superSample}
    samples={samples}
  />
);
