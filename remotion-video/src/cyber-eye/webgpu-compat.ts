// three r186 passes `swizzle: "rgba"` (a string) in every GPUTextureViewDescriptor.
// Older Dawn builds (e.g. the Chromium shipped with Playwright 1.56) expose the
// `texture-component-swizzle` feature but expect a dictionary there and throw a
// TypeError. Dropping an identity swizzle is a no-op, so we strip it.
export const installWebGPUCompat = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (!g.GPUTexture || g.__cyberEyeSwizzlePatched) {
    return;
  }
  const proto = g.GPUTexture.prototype;
  const original = proto.createView;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proto.createView = function patchedCreateView(this: unknown, desc?: any) {
    if (desc && typeof desc.swizzle === "string") {
      const { swizzle, ...rest } = desc;
      if (swizzle === "rgba") {
        return original.call(this, rest);
      }
      try {
        return original.call(this, desc);
      } catch {
        return original.call(this, rest);
      }
    }
    return original.call(this, desc);
  };
  g.__cyberEyeSwizzlePatched = true;
};
