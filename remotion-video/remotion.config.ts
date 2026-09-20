/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Deliverables are tagged BT.709 / TV range like the reference clips.
Config.setColorSpace("bt709");
Config.overrideBundlerConfig(enableTailwind);

// Some sandboxed dev environments block downloading Remotion's own
// Chrome Headless Shell but ship a Playwright Chromium at this path.
// Reuse it there instead of downloading; on a normal machine this path
// won't exist and Remotion falls back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
  // Point the Vulkan loader at Chromium's bundled SwiftShader so WebGPU works
  // on a machine without a GPU.
  process.env.VK_ICD_FILENAMES ??= path.join(
    path.dirname(playwrightHeadlessShell),
    "vk_swiftshader_icd.json",
  );
}

// The Cyber Eye compositions render with three.js' WebGPURenderer. Remotion
// always launches Chromium with --enable-unsafe-webgpu; on Linux the Vulkan
// backend additionally needs the "vulkan" GL renderer.
if (process.platform === "linux") {
  Config.setChromiumOpenGlRenderer("vulkan");
}
// Shader compilation + the first WebGPU frame can take a while in software
// rendering, so give delayRender() plenty of headroom.
Config.setDelayRenderTimeoutInMilliseconds(300000);
