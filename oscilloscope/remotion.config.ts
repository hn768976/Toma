/**
 * Note: when rendering through the Node APIs this file does not apply; pass the
 * same options directly instead.
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The traces are wide, soft glows over a near-black field; JPEG frame captures
// at the default quality band visibly, so capture them closer to lossless.
Config.setJpegQuality(96);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
// Tag the output Rec. 709 limited range. Without this the JPEG frame captures
// carry a full-range flag through to the mp4 (ffmpeg reports `yuvj420p`) and
// players that honour it lift the blacks on an already near-black picture.
Config.setColorSpace("bt709");
// There is no sound; an empty AAC track only makes the file longer than 14s.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Use it there; on a normal machine
// this path does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
