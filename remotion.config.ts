/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// The effect is pure 2D canvas, so no GPU/ANGLE flags are needed.
// Higher quality for the still frames we use to eyeball the look.
Config.setStillImageFormat("png");
