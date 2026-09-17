import { z } from "zod";
import { FlightGridScene } from "./FlightGridScene";
import { VERSION_ONE, VERSION_TWO } from "./scene-config";

export const flightGridSchema = z.object({
  version: z.enum(["one", "two"]),
  resolutionScale: z.number().min(0.5).max(4),
});

export type FlightGridProps = z.infer<typeof flightGridSchema>;

// Both deliverables are the same scene graph under different rig
// keyframes, so the composition is a thin selector. `resolutionScale`
// keeps the 1080p and 4K compositions visually identical by scaling every
// px-denominated value (line widths, bokeh radii) rather than letting them
// halve at 4K.
export const FlightGrid: React.FC<FlightGridProps> = ({
  version,
  resolutionScale,
}) => (
  <FlightGridScene
    config={version === "one" ? VERSION_ONE : VERSION_TWO}
    resolutionScale={resolutionScale}
  />
);
