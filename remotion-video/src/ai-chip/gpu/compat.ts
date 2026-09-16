/**
 * Small compatibility shims between the three.js WebGPU backend and the
 * browser actually doing the rendering.
 *
 * Each one feature-detects first and does nothing when the browser already
 * agrees with three.js, so they fall away by themselves as Chrome catches up.
 */

/**
 * three.js r186 puts `swizzle: 'rgba'` on every `GPUTextureViewDescriptor`,
 * following a later revision of the WebGPU spec where component swizzling is a
 * string. Chromium 141 implements the earlier form, where it is a dictionary,
 * and rejects the string outright:
 *
 *   TypeError: Failed to read the 'swizzle' property from
 *   'GPUTextureViewDescriptor': The provided value is not of type
 *   'GPUTextureComponentSwizzle'.
 *
 * `'rgba'` is the identity swizzle, so dropping the key is equivalent to what
 * three.js asked for.
 */
export const patchTextureViewSwizzle = (device: GPUDevice) => {
  const probe = device.createTexture({
    label: "swizzle-support-probe",
    size: [1, 1, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING,
  });

  let rejectsStringSwizzle = false;
  try {
    probe.createView({ swizzle: "rgba" } as GPUTextureViewDescriptor);
  } catch {
    rejectsStringSwizzle = true;
  }

  probe.destroy();

  if (!rejectsStringSwizzle) {
    return;
  }

  const prototype = Object.getPrototypeOf(probe) as GPUTexture;
  const createView = prototype.createView;

  prototype.createView = function patchedCreateView(
    this: GPUTexture,
    descriptor?: GPUTextureViewDescriptor,
  ) {
    if (descriptor !== undefined && "swizzle" in descriptor) {
      const copy: Record<string, unknown> = {};
      for (const name in descriptor) {
        if (name !== "swizzle") {
          copy[name] = (descriptor as unknown as Record<string, unknown>)[name];
        }
      }

      return createView.call(this, copy as GPUTextureViewDescriptor);
    }

    return createView.call(this, descriptor);
  };
};

export const applyWebGpuCompat = (device: GPUDevice) => {
  patchTextureViewSwizzle(device);
};
