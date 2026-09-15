// Loader for the preprocessed mandibular arch.
//
// `public/models/mandible.bin` is baked offline from the source GLB by
// `tools/bake-mandible.py`. Baking moves three expensive things out of
// render time: the tooth/gum segmentation, the ambient-occlusion solve and
// the per-tooth island IDs. What ships is a flat, already-world-space
// buffer the GPU can take almost verbatim.
//
// Layout (little-endian, header is 4-byte aligned so the typed-array
// views below can alias the buffer with no copy):
//
//   0   char[4]  "TOMA"
//   4   uint32   format version
//   8   uint32   vertexCount           (n)
//   12  uint32   indexCount            (m)
//   16  uint32   toothCount
//   20  float32  position[n * 3]       centred, arch width normalised to 1.0
//   ..  float32  normal[n * 3]
//   ..  float32  gumT[n]               signed height above the gum line
//   ..  float32  theta[n]              arch angle, -1 (rear left) .. 1 (rear right), 0 at the midline
//   ..  uint8    band[n]               0 = off the tooth band, 255 = on it
//   ..  uint8    ao[n]                 baked ambient occlusion
//   ..  uint8    tid[n]                tooth island index, 255 = gum
//   ..  (pad to 4 bytes)
//   ..  uint32   index[m]
//
// `gumT` and `band` are what let the shader move the gum line at render
// time: the tooth/gum split is recomputed per-fragment from `gumT` minus a
// recession uniform, rather than being frozen into the vertex data.

import { BufferAttribute, BufferGeometry } from "three";

export const MANDIBLE_MAGIC = "TOMA";
export const MANDIBLE_VERSION = 1;

export type MandibleData = {
  geometry: BufferGeometry;
  vertexCount: number;
  triangleCount: number;
  toothCount: number;
};

export const parseMandible = (buffer: ArrayBuffer): MandibleData => {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  );
  if (magic !== MANDIBLE_MAGIC) {
    throw new Error(
      `mandible.bin: expected magic "${MANDIBLE_MAGIC}", got "${magic}"`,
    );
  }
  const version = view.getUint32(4, true);
  if (version !== MANDIBLE_VERSION) {
    throw new Error(
      `mandible.bin: unsupported format version ${version}, expected ${MANDIBLE_VERSION}`,
    );
  }

  const vertexCount = view.getUint32(8, true);
  const indexCount = view.getUint32(12, true);
  const toothCount = view.getUint32(16, true);

  let offset = 20;
  const take = <T>(
    make: (b: ArrayBuffer, o: number, n: number) => T,
    length: number,
    bytesPerElement: number,
  ): T => {
    const out = make(buffer, offset, length);
    offset += length * bytesPerElement;
    return out;
  };

  const position = take(
    (b, o, n) => new Float32Array(b, o, n),
    vertexCount * 3,
    4,
  );
  const normal = take(
    (b, o, n) => new Float32Array(b, o, n),
    vertexCount * 3,
    4,
  );
  const gumT = take((b, o, n) => new Float32Array(b, o, n), vertexCount, 4);
  const theta = take((b, o, n) => new Float32Array(b, o, n), vertexCount, 4);
  const band = take((b, o, n) => new Uint8Array(b, o, n), vertexCount, 1);
  const ao = take((b, o, n) => new Uint8Array(b, o, n), vertexCount, 1);
  const tid = take((b, o, n) => new Uint8Array(b, o, n), vertexCount, 1);

  offset = Math.ceil(offset / 4) * 4;
  const index = new Uint32Array(buffer, offset, indexCount);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("normal", new BufferAttribute(normal, 3));
  geometry.setAttribute("aGumT", new BufferAttribute(gumT, 1));
  geometry.setAttribute("aTheta", new BufferAttribute(theta, 1));
  // Normalised so the shader reads these straight back as 0..1 floats.
  geometry.setAttribute("aBand", new BufferAttribute(band, 1, true));
  geometry.setAttribute("aAo", new BufferAttribute(ao, 1, true));
  // Tooth IDs are compared against an integer uniform, so they stay raw.
  geometry.setAttribute("aTid", new BufferAttribute(tid, 1, false));
  geometry.setIndex(new BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  return {
    geometry,
    vertexCount,
    triangleCount: indexCount / 3,
    toothCount,
  };
};
