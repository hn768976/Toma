/**
 * Bakes the supplied 194k-triangle container mesh into an LOD chain.
 *
 * Why this exists: the render target is a software rasteriser (SwiftShader),
 * where triangle count is the binding constraint -- measured at roughly 26ms
 * per million triangles at 1080p. A yard shot needs hundreds of containers on
 * screen, and the source mesh is ~50x denser than a container silhouette ever
 * needs. Simplification runs offline and the results are committed, so a
 * render never pays for it.
 *
 * Only the two near levels come from the mesh. They use meshoptimizer's
 * quality edge-collapse, which preserves the corrugation ridges. That path
 * stalls around 6k triangles because the Meshy mesh is non-manifold and runs
 * out of legal collapses; the sloppy simplifier goes further but rounds off
 * the boxy silhouette, which is the single most recognisable thing about a
 * container. So the far levels are built procedurally instead, in
 * src/yard/geometry.ts, where the silhouette stays exact and corrugation is
 * carried by banded shading.
 *
 * The sloppy path and normal recomputation are kept here because they are what
 * the far levels would need if they were ever taken from the mesh again.
 *
 * Run: npm run build:lods
 */
import { NodeIO } from "@gltf-transform/core";
import { weld, dedup, prune } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const MODELS = resolve(here, "../public/models");
const SRC = resolve(MODELS, "container.glb");

const LEVELS = [
  // Hero containers filling a large part of frame (the tight corner push).
  { name: "container-lod0", tris: 24000, mode: "quality", error: 0.002 },
  // Mid-ground stacks, the bulk of a wall shot.
  { name: "container-lod1", tris: 6800, mode: "quality", error: 0.01 },
];

/** Drops vertices no longer referenced and reindexes, so the GLB stays small. */
const compact = (indices, attrs, vertexCount) => {
  const remap = new Int32Array(vertexCount).fill(-1);
  let next = 0;
  const newIndices = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i];
    if (remap[v] === -1) remap[v] = next++;
    newIndices[i] = remap[v];
  }
  const out = {};
  for (const [name, { array, itemSize }] of Object.entries(attrs)) {
    const dst = new Float32Array(next * itemSize);
    for (let v = 0; v < vertexCount; v++) {
      const t = remap[v];
      if (t === -1) continue;
      for (let c = 0; c < itemSize; c++) dst[t * itemSize + c] = array[v * itemSize + c];
    }
    out[name] = { array: dst, itemSize };
  }
  return { indices: newIndices, attrs: out, vertexCount: next };
};

/** Area-weighted vertex normals; sloppy simplification invalidates the originals. */
const recomputeNormals = (indices, position, vertexCount) => {
  const n = new Float32Array(vertexCount * 3);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ax = position[a], ay = position[a + 1], az = position[a + 2];
    const e1x = position[b] - ax, e1y = position[b + 1] - ay, e1z = position[b + 2] - az;
    const e2x = position[c] - ax, e2y = position[c + 1] - ay, e2z = position[c + 2] - az;
    // Cross product magnitude is twice the triangle area, which is the
    // weighting we want -- big faces should dominate a shared vertex.
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) {
      n[v] += nx; n[v + 1] += ny; n[v + 2] += nz;
    }
  }
  for (let v = 0; v < vertexCount * 3; v += 3) {
    const l = Math.hypot(n[v], n[v + 1], n[v + 2]) || 1;
    n[v] /= l; n[v + 1] /= l; n[v + 2] /= l;
  }
  return n;
};

const main = async () => {
  await MeshoptSimplifier.ready;
  MeshoptSimplifier.useExperimentalFeatures = true;
  const io = new NodeIO();

  const doc = await io.read(SRC);
  await doc.transform(dedup(), weld({ tolerance: 0.0001 }), prune());
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];

  const srcAttrs = {
    POSITION: { array: prim.getAttribute("POSITION").getArray(), itemSize: 3 },
    NORMAL: { array: prim.getAttribute("NORMAL").getArray(), itemSize: 3 },
    TEXCOORD_0: { array: prim.getAttribute("TEXCOORD_0").getArray(), itemSize: 2 },
  };
  const srcIndices = new Uint32Array(prim.getIndices().getArray());
  const srcVerts = srcAttrs.POSITION.array.length / 3;
  const srcPos = new Float32Array(srcAttrs.POSITION.array);
  console.log(`source            ${srcIndices.length / 3} tris, ${srcVerts} verts`);

  const report = [];
  for (const level of LEVELS) {
    const target = level.tris * 3;
    const [simplified, error] =
      level.mode === "quality"
        ? MeshoptSimplifier.simplify(srcIndices, srcPos, 3, target, level.error, [])
        : MeshoptSimplifier.simplifySloppy(srcIndices, srcPos, 3, null, target, level.error);

    const packed = compact(simplified, srcAttrs, srcVerts);
    if (level.mode === "sloppy") {
      packed.attrs.NORMAL = {
        array: recomputeNormals(packed.indices, packed.attrs.POSITION.array, packed.vertexCount),
        itemSize: 3,
      };
    }

    // Rebuild a minimal single-primitive document for this level.
    const out = new (await import("@gltf-transform/core")).Document();
    const buffer = out.createBuffer();
    const outPrim = out.createPrimitive().setIndices(
      out.createAccessor().setType("SCALAR").setArray(packed.indices).setBuffer(buffer),
    );
    for (const [name, { array, itemSize }] of Object.entries(packed.attrs)) {
      outPrim.setAttribute(
        name,
        out
          .createAccessor()
          .setType(itemSize === 3 ? "VEC3" : "VEC2")
          .setArray(array)
          .setBuffer(buffer),
      );
    }
    const mesh = out.createMesh("container").addPrimitive(outPrim);
    const node = out.createNode("container").setMesh(mesh);
    out.createScene("scene").addChild(node);

    const bytes = await io.writeBinary(out);
    writeFileSync(resolve(MODELS, `${level.name}.glb`), bytes);

    const tris = packed.indices.length / 3;
    report.push({
      level: level.name,
      mode: level.mode,
      tris,
      verts: packed.vertexCount,
      kb: Math.round(bytes.length / 1024),
      error: Number(error.toFixed(4)),
    });
    console.log(
      `${level.name.padEnd(16)} ${level.mode.padEnd(8)} ${String(tris).padStart(6)} tris  ` +
        `${String(packed.vertexCount).padStart(6)} verts  ${String(Math.round(bytes.length / 1024)).padStart(5)} KB  err ${error.toFixed(4)}`,
    );
  }

  writeFileSync(
    resolve(MODELS, "lods.json"),
    JSON.stringify({ sourceTris: srcIndices.length / 3, levels: report }, null, 2),
  );
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
