/**
 * Depth buffers for the arrow field.
 *
 * The mechanism lives in the shared library; this module only binds it to the
 * composition's viewport and band table.
 */

import { DEPTH_BANDS, HEIGHT, WIDTH } from "./constants";
import { DepthBuffers, useDepthBuffers as useLibDepthBuffers } from "../lib/depthBuffers";

export type { DepthBuffers };

export const useDepthBuffers = (): DepthBuffers | null =>
  useLibDepthBuffers(WIDTH, HEIGHT, DEPTH_BANDS);
