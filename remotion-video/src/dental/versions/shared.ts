// Bits every version needs.

export type VersionProps = {
  /** 1 = 1080p, 2 = 4K. Drives supersampling, not layout. */
  resolutionScale: number;
};

/**
 * Supersampling factor for the WebGL buffer.
 *
 * At 1080p the canvas is drawn at 1.5x and downsampled, which cleans up
 * the enamel silhouettes MSAA alone leaves ragged. At 4K there are already
 * enough samples, and a second factor on top would quadruple a render that
 * is software-rasterised to begin with.
 */
export const stageDpr = (resolutionScale: number) =>
  resolutionScale >= 2 ? 1 : 1;

/** Frame counts, matched to each reference clip at 30fps. */
export const FPS = 30;
