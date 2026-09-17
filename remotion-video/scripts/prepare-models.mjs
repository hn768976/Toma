/**
 * Turns the two raw Meshy exports in public/models-src into render-ready GLBs.
 *
 * The raw meshes are unwelded ~190k-triangle soups with no materials. For the
 * container we need two versions: a hero mesh for the few boxes that fill the
 * frame, and a much lighter one for the hundreds of instances stacked behind
 * them. Corrugation ridges are the container's whole visual signature, so the
 * LOD target is tuned to keep the silhouette rather than to hit a poly budget.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { weld, simplify, dedup, prune } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

await MeshoptSimplifier.ready;

const triangleCount = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce(
      (n, p) =>
        n + (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3,
      0,
    );

const build = async ({ src, dst, ratio, error }) => {
  const doc = await io.read(src);
  const before = triangleCount(doc);
  const steps = [dedup(), weld({ tolerance: 0.0001 })];
  if (ratio < 1) {
    steps.push(simplify({ simplifier: MeshoptSimplifier, ratio, error, lockBorder: false }));
  }
  steps.push(prune());
  await doc.transform(...steps);
  mkdirSync(dirname(dst), { recursive: true });
  await io.write(dst, doc);
  const after = triangleCount(await io.read(dst));
  console.log(
    `${dst.padEnd(34)} ${Math.round(before)} -> ${Math.round(after)} tris ` +
      `(${((after / before) * 100).toFixed(1)}%)`,
  );
};

const SRC = "public/models-src";
await build({ src: `${SRC}/container-raw.glb`, dst: "public/models/container-hero.glb", ratio: 0.32, error: 0.0008 });
await build({ src: `${SRC}/container-raw.glb`, dst: "public/models/container-lod.glb", ratio: 0.13, error: 0.0025 });
// The airliner arrives with base colour, metallic-roughness and normal maps, so
// simplification has to preserve its UVs — meshopt carries every attribute
// through, and welding only merges vertices identical in all of them.
//
// There is deliberately no reduced copy of the aircraft. A second GLB would
// duplicate 22MB of texture for a subject that is never more than a few hundred
// pixels across, and 85k triangles is not worth optimising for when a shot
// contains exactly one of them.
await build({ src: `${SRC}/skyliner-raw.glb`, dst: "public/models/skyliner.glb", ratio: 0.45, error: 0.0006 });
