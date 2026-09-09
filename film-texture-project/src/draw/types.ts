import type {Version} from '../config';

/**
 * Everything is drawn straight into the canvas backing store, which is sized to
 * the *output* resolution. `s` converts the 4K design space into those device
 * pixels; sizes that are physical film damage (scratch width, hair width,
 * chromatic fringing, weave) deliberately ignore `s` and stay in device pixels,
 * so a 2px scratch is 2px at 1080p and at 4K alike.
 */
export type DrawCtx = {
  ctx: CanvasRenderingContext2D;
  /** Output width in device pixels. */
  w: number;
  /** Output height in device pixels. */
  h: number;
  /** Design (4K) pixels -> output device pixels. */
  s: number;
  /** Frame already wrapped into [0, DURATION). */
  frame: number;
  v: Version;
};
