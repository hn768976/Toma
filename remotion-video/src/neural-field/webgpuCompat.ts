// Compatibility shim for GPUTexture.createView().
//
// three.js r186 fills its texture-view descriptor with fields from recent
// WebGPU drafts — notably `swizzle: 'rgba'` (the identity swizzle, gated
// behind the optional `texture-component-swizzle` feature) and `usage`.
// Chrome builds whose Dawn predates those drafts, or which expect the
// dictionary form of the swizzle rather than the string form, reject the whole
// call with a TypeError and the render dies before the first frame.
//
// Every field we strip here is either the identity value or optional, so
// removing it cannot change what gets drawn. The shim tries the descriptor
// untouched first and only falls back when the browser actually complains,
// so on a browser that accepts three's descriptor this is a no-op beyond one
// try/catch. Once a working shape is found it is reused for every later call.

type ViewDescriptor = Record<string, unknown>;

/** Fields to drop, in order, until createView is accepted. */
const OPTIONAL_FIELDS = ["swizzle", "usage"] as const;

const PATCH_FLAG = "__neuralFieldCreateViewPatched";

export const installWebGPUCompat = () => {
  const gpuTexture = (globalThis as { GPUTexture?: { prototype: Record<string, unknown> } })
    .GPUTexture;
  const proto = gpuTexture?.prototype;
  if (!proto || typeof proto.createView !== "function") return;
  if (proto[PATCH_FLAG]) return;

  const original = proto.createView as (descriptor?: ViewDescriptor) => unknown;

  // How many fields we currently have to strip. Starts at 0 (descriptor is
  // passed through verbatim) and only grows if the browser rejects it.
  let stripCount = 0;

  const sanitized = (descriptor: ViewDescriptor, drop: number) => {
    const copy: ViewDescriptor = { ...descriptor };
    for (let i = 0; i < drop; i++) delete copy[OPTIONAL_FIELDS[i]];
    return copy;
  };

  proto.createView = function patchedCreateView(descriptor?: ViewDescriptor) {
    if (!descriptor) return original.call(this);

    for (let drop = stripCount; drop <= OPTIONAL_FIELDS.length; drop++) {
      try {
        const result = original.call(
          this,
          drop === 0 ? descriptor : sanitized(descriptor, drop),
        );
        stripCount = drop;
        return result;
      } catch (err) {
        // A TypeError here means the descriptor shape was rejected, so it is
        // worth retrying with one more optional field removed. Anything else
        // (or running out of fields to strip) is a real error.
        if (!(err instanceof TypeError) || drop === OPTIONAL_FIELDS.length) {
          throw err;
        }
      }
    }

    // Unreachable: the loop either returns or rethrows.
    return original.call(this, descriptor);
  };

  proto[PATCH_FLAG] = true;
};
