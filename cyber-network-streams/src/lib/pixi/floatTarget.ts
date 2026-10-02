import { BufferImageSource, Texture } from "pixi.js";

// Pixi 8's GL backend allocates render textures with RGBA/UNSIGNED_BYTE
// whatever `format` says (GlTextureSystem.onSourceUpdate has no uploader for
// plain render-texture sources). A BufferImageSource goes through the buffer
// uploader, which honours the format, so this gives a real RGBA16F target.
export const floatTarget = (width: number, height: number) =>
  new Texture({
    source: new BufferImageSource({
      resource: new Uint16Array(width * height * 4),
      width,
      height,
      format: "rgba16float",
      scaleMode: "linear",
      autoGenerateMipmaps: false,
    }),
  });
