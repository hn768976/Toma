/**
 * Note: when using the Node.js APIs this file does not apply — pass the same
 * options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);
// PNG frames: the chart is flat vector art on a near-black ground, where JPEG
// intermediates would band the glow.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
// The template is silent; without this Remotion muxes an empty AAC track that
// also pads the file past the exact 20.000s duration.
Config.setMuted(true);
