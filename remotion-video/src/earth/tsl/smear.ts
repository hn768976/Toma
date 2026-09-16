import { float, texture, vec2 } from "three/tsl";
import type { Node, Texture } from "three/webgpu";

/**
 * Samples a map smeared along longitude.
 *
 * The timelapse pass spins the planet fast enough that a single sample
 * strobes badly — the surface jumps a visible distance between frames. Taking
 * several taps along the direction of travel is a shutter: it is the same
 * integration a real camera does over its exposure, and it is what turns the
 * cloud deck and the city lights into streaks rather than a flickering mess.
 *
 * The tap count is fixed when the material is built, so shots that do not ask
 * for a smear compile down to a single texture fetch and pay nothing.
 */
export const smearedTexture = (
  map: Texture,
  uvNode: Node,
  taps: number,
  span: Node,
): Node => {
  if (taps <= 1) {
    return texture(map, uvNode);
  }

  let accumulated: Node | null = null;
  for (let tap = 0; tap < taps; tap++) {
    const shift = tap / (taps - 1) - 0.5;
    const offset = vec2(span.mul(shift), float(0));
    const sample = texture(map, uvNode.add(offset));
    accumulated = accumulated === null ? sample : accumulated.add(sample);
  }

  return (accumulated as Node).div(taps);
};
