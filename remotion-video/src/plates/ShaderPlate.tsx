import { PixiShaderStage } from "./PixiShaderStage";
import type { PlateProps } from "./plates";

/**
 * Thin adapter: binds a plate's fragment shader to the schema-driven props so
 * every plate is tweakable from the Remotion studio sidebar and from
 * `--props` on the CLI.
 */
export const makePlate = (fragment: string): React.FC<PlateProps> => {
  const Plate: React.FC<PlateProps> = ({ density, brightness, seed, speed }) => (
    <PixiShaderStage
      fragment={fragment}
      uniforms={{ density, brightness, seed, speed }}
    />
  );
  return Plate;
};
