import { useVideoConfig } from "remotion";
import { DESIGN_WIDTH } from "./design";

/**
 * Everything is authored in 3840-wide design units. This returns a converter so
 * sizes, blur radii and offsets stay a constant fraction of the frame whatever
 * resolution the composition is registered at.
 */
export const useScale = () => {
  const { width } = useVideoConfig();
  const factor = width / DESIGN_WIDTH;
  return (value: number) => value * factor;
};
