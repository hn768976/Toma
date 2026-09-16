/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setRspack(true);
// PNG rather than JPEG for the frame intermediates. This piece is almost
// entirely dark, subtly-graded gradients and fine glowing text, which is
// exactly what JPEG intermediates band and ring on. Feeding ffmpeg JPEGs
// also makes it tag the output full-range (yuvj420p) instead of the
// limited-range bt709 an editor expects.
Config.setVideoImageFormat("png");

// Remotion's v4 default converts RGB to YUV with a bt601 matrix, while
// every player treats an untagged HD H.264 file as bt709. That mismatch
// shifts the grade, which matters here because the grade is the only
// thing separating the blue and teal versions. Tag and convert as bt709.
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
Config.overrideBundlerConfig(enableTailwind);

// The CodeGrid compositions render through three.js' WebGPURenderer, so
// headless Chrome has to hand out a real WebGPU adapter. On a machine
// with a GPU, `gl: "vulkan"` alone is enough. On a GPU-less box (CI, this
// container) Dawn finds no Vulkan device and navigator.gpu.requestAdapter()
// resolves to null, which would silently drop three.js to its WebGL
// fallback. scripts/chrome-webgpu.sh re-points Chrome at its bundled
// SwiftShader Vulkan ICD so WebGPU works either way. See that file.
Config.setChromiumOpenGlRenderer("vulkan");

// `__dirname` here points into @remotion/cli, not the project, so resolve
// the shim against the project root instead.
const webgpuShim = path.join(process.cwd(), "scripts", "chrome-webgpu.sh");
if (existsSync(webgpuShim)) {
  Config.setBrowserExecutable(webgpuShim);
}

// WebGPU device creation is per-browser-tab and SwiftShader rasterises on
// the CPU, so more workers than cores makes every frame slower rather
// than the render shorter.
Config.setConcurrency(2);

// Software rasterisation of a full 4K frame can exceed the default.
Config.setDelayRenderTimeoutInMilliseconds(300000);
