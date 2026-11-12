/**
 * Render configuration shared by the Studio and the CLI.
 * All configuration options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// Software WebGL (SwiftShader via ANGLE) works on every machine, including
// headless servers without a GPU, and gives deterministic frames.
Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Tag output as Rec.709 (limited/TV range) for maximum player compatibility.
Config.setColorSpace("bt709");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Optional: use a locally installed Chrome / Chrome Headless Shell instead of
// letting Remotion download one (useful offline or behind a firewall).
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
