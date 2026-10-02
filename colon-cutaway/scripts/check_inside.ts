// Step 5 check: run every story frame by frame (no WebGL needed) and verify that
//  - every visible clump / bacterium / molecule / irritant sits inside the
//    measured inner wall of the colon (bounding sphere, nearest centreline point)
//  - nothing pops in or out mid-colon (visibility = alpha * scale may only
//    change abruptly within 5% of either end; clump break-up swaps are listed)
// usage: npx esbuild scripts/check_inside.ts --bundle --platform=node --format=esm --outfile=out/check_inside.mjs && node out/check_inside.mjs
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import fs from "node:fs";
import path from "node:path";
import { ColonWorld } from "../src/three/ColonWorld";
import type { InstancedGroup } from "../src/three/particles";
import { constipationStory } from "../src/stories/constipation";
import { floraStory } from "../src/stories/flora";
import { inflammationStory } from "../src/stories/inflammation";

const root = process.cwd(); // run from the project root
const loadGlb = (file: string) =>
  new Promise<THREE.Group>((resolve, reject) => {
    const buf = fs.readFileSync(path.join(root, "public/models", file));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    new GLTFLoader().parse(ab, "", (g) => resolve(g.scene), reject);
  });

const main = async () => {
  const colon = await loadGlb("colon.glb");
  const clumpScene = await loadGlb("clump.glb");
  let clumpGeo: THREE.BufferGeometry | null = null;
  clumpScene.updateMatrixWorld(true);
  clumpScene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !clumpGeo) clumpGeo = m.geometry.clone().applyMatrix4(m.matrixWorld);
  });
  const centreline = JSON.parse(fs.readFileSync(path.join(root, "public/models/centreline.json"), "utf8"));
  const world = new ColonWorld({ colon, clump: clumpGeo!, centreline });
  const cl = world.cl;
  const groups: [string, InstancedGroup][] = [
    ...world.molecules.map((g, i) => [`molecule${i}`, g] as [string, InstancedGroup]),
    ...world.cool.map((g, i) => [`cool${i}`, g] as [string, InstancedGroup]),
    ["rod", world.rods],
    ["coccus", world.cocci],
    ["spike", world.spikes],
    ["clump", world.clumps],
  ];
  const radiusOf = (g: InstancedGroup) => {
    const geo = g.mesh.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    // furthest vertex from the local origin (instances are placed by origin)
    return Math.max(bb.min.length(), bb.max.length(), ...[0, 1, 2].map(() => 0));
  };
  const maxVertexRadius = (g: InstancedGroup) => {
    const p = g.mesh.geometry.getAttribute("position");
    let r = 0;
    for (let i = 0; i < p.count; i++) r = Math.max(r, Math.hypot(p.getX(i), p.getY(i), p.getZ(i)));
    return r || radiusOf(g);
  };
  const gRad = new Map(groups.map(([n, g]) => [n, maxVertexRadius(g)]));

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const c = new THREE.Vector3();
  const t = new THREE.Vector3();
  const report: Record<string, unknown> = {};

  for (const story of [constipationStory, floraStory, inflammationStory]) {
    let worst = { ratio: 0, frame: -1, group: "", u: 0 };
    let checked = 0;
    let outside = 0;
    const prev = new Map<string, number>();
    const pops: string[] = [];
    const swaps = new Set<number>();
    for (let f = 0; f < story.durationInFrames; f++) {
      story.update(world, f);
      for (const [name, g] of groups) {
        const inst = g.inst;
        for (let i = 0; i < g.count; i++) {
          const alpha = inst.getX(i);
          g.mesh.getMatrixAt(i, m);
          m.decompose(pos, quat, scl);
          const s = scl.x;
          const key = `${name}:${i}`;
          const vis = alpha > 0.002 && s > 1e-5 ? alpha * s : 0;
          const k = cl.nearest(pos.x, pos.y, pos.z, false);
          const u = k / 1023;
          const before = prev.get(key) ?? 0;
          // a jump bigger than half the object's own size in one frame is a pop
          const jump = Math.abs(vis - before);
          if (jump > 0.5 * Math.max(vis, before) && Math.max(vis, before) > 0.02) {
            const nearEnd = u < 0.05 || u > 0.95;
            if (name === "clump") swaps.add(f);
            else if (!nearEnd && !(f === 0)) pops.push(`${key} f${f} u=${u.toFixed(3)} ${before.toFixed(3)}->${vis.toFixed(3)}`);
          }
          prev.set(key, vis);
          if (vis === 0) continue;
          if (f % 10 !== 0) continue; // containment: 1 frame in 10, as specified
          checked++;
          cl.point(u, c);
          cl.tangent(u, t);
          const d = pos.clone().sub(c);
          d.addScaledVector(t, -d.dot(t));
          const reach = d.length() + s * gRad.get(name)!;
          const ratio = reach / cl.wallRadius(u);
          if (ratio > 1) outside++;
          if (ratio > worst.ratio) worst = { ratio, frame: f, group: name, u };
        }
      }
    }
    report[story.id] = {
      instancesChecked: checked,
      outsideWall: outside,
      worstReachOverWallRadius: Number(worst.ratio.toFixed(3)),
      worstAt: { frame: worst.frame, group: worst.group, u: Number(worst.u.toFixed(3)) },
      midColonPops: pops.length,
      popExamples: pops.slice(0, 5),
      clumpBreakSwapFrames: swaps.size,
    };
    console.log(story.id, JSON.stringify(report[story.id]));
  }
  fs.mkdirSync(path.join(root, "out"), { recursive: true });
  fs.writeFileSync(path.join(root, "out/check_inside.json"), JSON.stringify(report, null, 2));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
