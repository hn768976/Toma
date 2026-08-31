import { loopSin } from "./math";
import type { VariantConfig } from "./variants";

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 600;

/** The flow runs slightly past the far edge so nothing terminates on screen. */
const FLOW_OVERRUN = 0.03;

/**
 * Flow space. `u` is distance travelled away from the nodes, 0 at the node
 * edge and 1 just past the far edge. Every piece of geometry is authored in
 * flow space and mapped through here, so flipping `fanDirection` flips the
 * whole composition with it.
 */
export interface Flow {
  readonly nodeX: number;
  readonly length: number;
  readonly direction: 1 | -1;
  /** Flow position -> screen x. */
  readonly x: (u: number) => number;
}

export const makeFlow = (config: VariantConfig): Flow => {
  const direction = config.fanDirection;
  const nodeX =
    direction === 1
      ? WIDTH * config.nodeEdgeFraction
      : WIDTH * (1 - config.nodeEdgeFraction);
  const length = WIDTH * (1 - config.nodeEdgeFraction + FLOW_OVERRUN);
  return {
    nodeX,
    length,
    direction,
    x: (u: number) => nodeX + direction * u * length,
  };
};

export const nodeY = (config: VariantConfig, index: number): number =>
  HEIGHT * config.sources[index].yFraction;

/**
 * Very slight ambient drift of the whole composition: a closed Lissajous
 * figure of +/-10px that returns to its start at frame 600.
 */
export const AMBIENT_AMPLITUDE = 10;

export const ambientDrift = (frame: number): { dx: number; dy: number } => ({
  dx: AMBIENT_AMPLITUDE * loopSin(frame, 1, 0),
  dy: AMBIENT_AMPLITUDE * loopSin(frame, 2, 1 / 6),
});
