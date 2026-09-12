/**
 * Remotion configuration.
 *
 * Note: When using the Node.JS APIs, this file does not apply —
 * pass the options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

// Rspack is left off: the bundle it emits breaks Remotion error symbolication here.
// Config.setRspack(true);
Config.setOverwriteOutput(true);

// The visualiser is flat colour on pure black: PNG frames avoid the JPEG
// chroma smearing that would otherwise soften the 1px LED segment gaps.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
