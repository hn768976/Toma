/**
 * Decides whether WebGPU can actually drive a canvas of a given size here.
 *
 * `WebGPURenderer` falls back to WebGL 2 on its own when `navigator.gpu` is
 * missing, which covers most machines. It does not cover headless Linux with a
 * software Dawn build: there the adapter and device are handed out happily and
 * only the canvas swap chain fails, deep inside the backend and as an unhandled
 * rejection that no `try`/`catch` around the renderer can see.
 *
 * So the swap chain is exercised here first — at the real output size, because
 * the backing allocation is what fails and it is size dependent — and the
 * answer decides which backend gets built.
 */
export const canDriveCanvasWithWebGPU = async (
  doc: Document,
  width: number,
  height: number,
): Promise<boolean> => {
  const gpu = navigator.gpu as GPU | undefined;
  if (!gpu) {
    return false;
  }

  let device: GPUDevice | null = null;
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return false;
    }
    device = await adapter.requestDevice();

    const canvas = doc.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    // `getContext` in @types/web has no "webgpu" overload yet.
    const context = canvas.getContext(
      "webgpu",
    ) as unknown as GPUCanvasContext | null;
    if (!context) {
      return false;
    }

    // Both scopes are needed: a missing swap-chain backing surfaces as an
    // internal error, and popping either can itself reject once the instance
    // has been dropped, which counts as a failure too.
    device.pushErrorScope("internal");
    device.pushErrorScope("validation");
    context.configure({
      device,
      format: gpu.getPreferredCanvasFormat(),
      alphaMode: "opaque",
    });
    context.getCurrentTexture();

    // Both pops are issued before either is awaited, and both get a rejection
    // handler attached synchronously. Awaiting them one at a time would leave
    // the second scope unpopped when the first rejects, and Dawn then reports
    // it as an unhandled rejection that fails the whole render.
    const failed = Symbol("failed");
    const scopes = [device.popErrorScope(), device.popErrorScope()].map((p) =>
      p.catch(() => failed as unknown as GPUError),
    );
    const results = await Promise.all(scopes);
    context.unconfigure();

    return results.every((result) => result === null);
  } catch {
    return false;
  } finally {
    device?.destroy();
  }
};
