/**
 * Deciding whether WebGPU is actually usable is harder than checking for
 * `navigator.gpu`: plenty of environments (headless containers without a
 * working Vulkan/Dawn backend, for one) expose the API, hand out an adapter and
 * a device, and only then drop the GPU instance. Dawn reports that as an
 * *unhandled* promise rejection rather than by rejecting the call we made, so a
 * plain try/catch around renderer setup never sees it and the page dies.
 *
 * So we probe: run a throwaway render pass, and treat anything short of full
 * success as "not usable". While the probe runs — and afterwards if it failed —
 * we swallow the specific rejections Dawn emits on the way down, so a dead
 * WebGPU stack degrades to the WebGL2 backend instead of failing the render.
 */

/** Substrings of the errors a collapsing WebGPU stack produces. */
const WEBGPU_FAILURE_HINTS = [
  "popErrorScope",
  "Instance dropped",
  "Device Lost",
  "device was lost",
  "GPUDevice",
  "GPUTexture",
  "GPUAdapter",
  "WebGPU",
];

const PROBE_TIMEOUT_MS = 10_000;

let suppressing = false;

const looksLikeWebGPUFailure = (value: unknown) => {
  const message =
    value instanceof Error
      ? `${value.name}: ${value.message}`
      : typeof value === "string"
        ? value
        : String((value as { message?: string } | null)?.message ?? value);
  return WEBGPU_FAILURE_HINTS.some((hint) => message.includes(hint));
};

const installSuppressor = () => {
  if (typeof window === "undefined") return;
  window.addEventListener("unhandledrejection", (event) => {
    if (!suppressing || !looksLikeWebGPUFailure(event.reason)) return;
    event.preventDefault();
    console.warn("Ignoring WebGPU teardown error:", event.reason);
  });
  window.addEventListener("error", (event) => {
    if (!suppressing || !looksLikeWebGPUFailure(event.error ?? event.message)) {
      return;
    }
    event.preventDefault();
    console.warn("Ignoring WebGPU teardown error:", event.message);
  });
};

installSuppressor();

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);

const runProbe = async (): Promise<boolean> => {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (!gpu) return false;

  suppressing = true;
  try {
    const adapter = await withTimeout(gpu.requestAdapter(), PROBE_TIMEOUT_MS);
    if (!adapter) return false;

    const device = await withTimeout(adapter.requestDevice(), PROBE_TIMEOUT_MS);
    if (!device) return false;

    let lost = false;
    void device.lost.then(() => {
      lost = true;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("webgpu") as GPUCanvasContext | null;
    if (!context) return false;
    context.configure({
      device,
      format: gpu.getPreferredCanvasFormat(),
      alphaMode: "opaque",
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.end();
    device.queue.submit([encoder.finish()]);

    const done = await withTimeout(
      device.queue.onSubmittedWorkDone().then(() => true),
      PROBE_TIMEOUT_MS,
    );

    device.destroy();
    return done === true && !lost;
  } catch (error) {
    console.warn("WebGPU probe failed:", error);
    return false;
  } finally {
    // Keep swallowing only if WebGPU turned out to be broken; a healthy stack
    // should never be shielded from its own errors.
    suppressing = !probeSucceeded;
  }
};

let probeSucceeded = false;
let cached: Promise<boolean> | null = null;

/** Resolves true only if a real WebGPU render pass completed successfully. */
export const isWebGPUUsable = (): Promise<boolean> => {
  cached ??= runProbe().then((ok) => {
    probeSucceeded = ok;
    suppressing = !ok;
    return ok;
  });
  return cached;
};
