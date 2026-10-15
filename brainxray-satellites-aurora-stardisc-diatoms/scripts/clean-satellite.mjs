// One-off build step: NASA TDRS (C) GLB -> cleaned hero GLB + instancing LOD.
// Dev-only tools (not project dependencies):
//   npm i -D @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 \
//     @gltf-transform/functions@4.5.1 meshoptimizer draco3dgltf@1.5.7 sharp
// usage:
//   node scripts/clean-satellite.mjs "<TDRS (C).glb>" public/models/satellite_tdrs.glb
//   node scripts/clean-satellite.mjs --lod public/models/satellite_tdrs.glb public/models/satellite_tdrs_lod.glb
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, weld, simplify, textureCompress } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import draco3d from "draco3dgltf";
import sharp from "sharp";

const lod = process.argv[2] === "--lod";
const [input, output] = lod ? process.argv.slice(3) : process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});
const doc = await io.read(input);
const drop = (name) => {
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === name) e.dispose();
};
drop("KHR_draco_mesh_compression");
if (lod) {
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.08, error: 0.01 }),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: "jpeg", resize: [512, 512] }),
  );
} else {
  // the unused duplicate JPEG texture is removed by prune()
  await doc.transform(
    prune(),
    dedup(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.8, error: 0.0005 }),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: "png" }),
  );
}
drop("EXT_texture_webp");
let tris = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
console.log("triangles", tris, "textures", doc.getRoot().listTextures().map((t) => t.getMimeType()));
await io.write(output, doc);
