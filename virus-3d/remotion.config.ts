/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// PNG intermediates: these plates are mostly smooth dark gradients, where JPEG
// frame encoding shows visible banding and blocking.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
