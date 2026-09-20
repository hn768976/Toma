import { getRemotionEnvironment } from "remotion";

// Renderer backend selection.
//
// The scene is written once against a backend-agnostic surface and runs on
// WebGPU where that is genuinely available, falling back to WebGL2 and then
// WebGL1. Two traps informed the logic below:
//
//  1. Headless Chromium exposes `navigator.gpu` but hands back `null` from
//     `requestAdapter()`, so probing for the namespace alone selects a
//     backend that dies on the first draw call.
//  2. Even when a single tab *can* acquire a WebGPU device, Remotion's
//     offline renderer drives several tabs at once and the software GPU
//     stack only satisfies the first. The losing tabs silently receive a
//     dead device and then throw mid-render.
//
// So during an offline render we default to WebGL2, which is stable across
// every tab, and reserve automatic WebGPU for interactive use (Studio,
// Player, browser). `forceTier` lets anyone with real GPU hardware opt the
// render path back into WebGPU.

export type RendererTier = "webgpu" | "webgl2" | "webgl";
export type TierPreference = RendererTier | "auto";

type NavigatorGPU = {
  gpu?: {
    requestAdapter: (o?: unknown) => Promise<{
      requestDevice: () => Promise<{ limits?: Record<string, number> } | null>;
    } | null>;
  };
};

// Below these limits a device cannot hold the board textures we upload, so
// treat it as unusable rather than discovering that at draw time.
const MIN_TEXTURE_DIM = 4096;
const MIN_BUFFER_SIZE = 64 * 1024 * 1024;

let probe: Promise<boolean> | null = null;

export const supportsWebGPU = (): Promise<boolean> => {
  if (probe) return probe;
  probe = (async () => {
    const gpu = (navigator as unknown as NavigatorGPU).gpu;
    if (!gpu?.requestAdapter) return false;
    try {
      const adapter = await gpu.requestAdapter({
        powerPreference: "high-performance",
      });
      if (!adapter) return false;
      const device = await adapter.requestDevice();
      if (!device) return false;
      const limits = device.limits;
      if (limits) {
        if ((limits.maxTextureDimension2D ?? 0) < MIN_TEXTURE_DIM) return false;
        if ((limits.maxBufferSize ?? 0) < MIN_BUFFER_SIZE) return false;
      }
      // The probe device is intentionally left alive: on some headless GPU
      // stacks destroying it makes every later requestAdapter() return null.
      return true;
    } catch {
      return false;
    }
  })();
  return probe;
};

const webglTier = (): RendererTier =>
  document.createElement("canvas").getContext("webgl2") ? "webgl2" : "webgl";

export const resolveTier = async (
  preference: TierPreference = "auto",
): Promise<RendererTier> => {
  if (preference === "webgl" || preference === "webgl2") return preference;

  if (preference === "webgpu") {
    if (await supportsWebGPU()) return "webgpu";
    return webglTier();
  }

  // auto
  if (getRemotionEnvironment().isRendering) return webglTier();
  if (await supportsWebGPU()) return "webgpu";
  return webglTier();
};
