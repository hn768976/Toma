/**
 * Uses the same model/camera maths as the scene to find:
 *  - frames where an electron is hidden behind the nucleus (step 5 check)
 *  - frames where the electrons are well spread out (for the stills)
 * Run: npx tsx scripts/analyze-frames.ts
 */
import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import { LOOP_FRAMES } from "../src/lib/loop";
import { classicLook } from "../src/looks/classic";
import { energyLook } from "../src/looks/energy";
import { wispLook } from "../src/looks/wisp";
import type { LookConfig } from "../src/looks/types";
import { atomQuaternion, buildModel, cameraPosition, electronLocal } from "../src/scene/model";

const NUCLEUS_R: Record<LookConfig["nucleus"], number> = { cluster: 0.16, "energy-core": 0.085, "teal-sphere": 0.075 };

for (const look of [classicLook, energyLook, wispLook]) {
  const model = buildModel(look);
  const hidden: string[] = [];
  const spread: { f: number; minD: number }[] = [];
  for (let f = 0; f < LOOP_FRAMES; f++) {
    const cam = new PerspectiveCamera(look.fov, 16 / 9, 0.1, 200);
    cam.position.set(...cameraPosition(look, f));
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    const aq = atomQuaternion(look, f);
    const camDist = cam.position.length();
    const scr: [number, number][] = [];
    model.orbits.forEach((o, i) => {
      const w = new Vector3(...electronLocal(o, f)).applyQuaternion(new Quaternion(...o.quaternion)).applyQuaternion(aq);
      // perpendicular distance from the camera→centre line, and whether it's behind the centre
      const toCam = cam.position.clone().normalize();
      const along = w.dot(toCam);
      const perp = w.clone().sub(toCam.clone().multiplyScalar(along)).length();
      if (along < 0 && perp < NUCLEUS_R[look.nucleus] * 0.6 * (camDist - along) / camDist) hidden.push(`${f}:e${i}`);
      const p = w.clone().project(cam);
      scr.push([p.x * 16 / 9, p.y]);
    });
    let minD = Infinity;
    for (let i = 0; i < scr.length; i++) for (let j = i + 1; j < scr.length; j++) minD = Math.min(minD, Math.hypot(scr[i][0] - scr[j][0], scr[i][1] - scr[j][1]));
    spread.push({ f, minD });
  }
  spread.sort((a, b) => b.minD - a.minD);
  const picks: number[] = [];
  for (const s of spread) if (picks.every((p) => Math.abs(p - s.f) > 120)) { picks.push(s.f); if (picks.length === 3) break; }
  console.log(`${look.id}: electron hidden behind nucleus at frames ${hidden.slice(0, 12).join(", ")}${hidden.length > 12 ? ` … (${hidden.length} total)` : ""}`);
  console.log(`${look.id}: best-spread still frames ${picks.sort((a, b) => a - b).join(", ")}`);
}
