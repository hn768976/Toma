import React, { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { hexToRgb } from "../lib/color";
import { INTER } from "../lib/fonts";
import { applyDof, DofParams, makeDots, makeLines } from "../lib/gl/primitives";
import { PostParams } from "../lib/gl/post";
import { GLStage, SceneFactory } from "../lib/gl/Stage";
import { makePerlin2, ridged } from "../lib/noise";
import { hash01, loopFrame, mulberry32, TAU } from "../lib/random";
import type { WirePeaksRow } from "../versions";

// Procedural heightfield (not a real place): ridged noise shaped by a main
// massif a little left of centre and a lower ridge on the right.
const NX = 160;
const NZ = 80;
const X0 = -15;
const X1 = 15;
const Z0 = -10;
const Z1 = 5;
// The grid is turned slightly about the vertical axis so no grid line runs
// straight along the view direction (those collapse into bright stripes).
const YAW = (18 * Math.PI) / 180;
const LEADERS = 20;
const GROUPS = 13;
const W = 3840;
const H = 2160;

type Terrain = {
  heights: Float32Array; // (NX+1)*(NZ+1)
  leaders: { base: THREE.Vector3; top: THREE.Vector3; big: boolean; period: number; offset: number }[];
};

const gx = (i: number) => X0 + ((X1 - X0) * i) / NX;
const gz = (j: number) => Z0 + ((Z1 - Z0) * j) / NZ;
const vx = (i: number, j: number) => gx(i) * Math.cos(YAW) - gz(j) * Math.sin(YAW);
const vz = (i: number, j: number) => gx(i) * Math.sin(YAW) + gz(j) * Math.cos(YAW);

const FOV = 27;
// Slow sideways cosine drift, one whole cycle per loop.
const cameraAt = (frame: number) => {
  const ph = (frame / 600) * TAU;
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 200);
  cam.position.set(0.9 * Math.cos(ph), 2.9, 15.5);
  cam.lookAt(0.55 * Math.cos(ph), 2.6, -2);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
};

const terrainCache = new Map<number, Terrain>();
const buildTerrain = (seed: number): Terrain => {
  const cached = terrainCache.get(seed);
  if (cached) return cached;
  const noise = makePerlin2(seed);
  const warpN = makePerlin2(seed + 17);
  const rng = mulberry32(seed + 99);
  const heights = new Float32Array((NX + 1) * (NZ + 1));
  const bump = (x: number, z: number, cx: number, cz: number, sx: number, sz: number) =>
    Math.exp(-(((x - cx) / sx) ** 2) - ((z - cz) / sz) ** 2);
  for (let j = 0; j <= NZ; j++) {
    for (let i = 0; i <= NX; i++) {
      const x = vx(i, j);
      const z = vz(i, j);
      const wx = x + warpN(x * 0.15, z * 0.15) * 1.2;
      const wz = z + warpN(x * 0.15 + 5.2, z * 0.15 + 1.3) * 1.2;
      const r = ridged(noise, wx * 0.27 + 3.1, wz * 0.27 + 7.7, 4);
      const mass =
        // broad left massif + pointed summit
        0.7 * bump(x, z, -3.2, -2.4, 3.4, 2.6) +
        0.4 * Math.exp(-Math.hypot((x + 2.2) / 1.7, (z + 2.4) / 1.7)) +
        // raised right range
        0.5 * bump(x, z, 6.2, -3.0, 3.2, 2.2) +
        0.3 * bump(x, z, 3.0, -3.4, 1.4, 1.6) +
        // rise from the left edge
        0.4 * bump(x, z, -8.0, -2.6, 2.6, 2.6) -
        // deep valley between the ranges
        0.35 * bump(x, z, 1.1, -2.2, 1.0, 3.0);
      const base = 0.35 + 0.25 * noise(x * 0.3 + 11, z * 0.3);
      heights[j * (NX + 1) + i] = 0.95 * Math.max(0, base * 0.5 + r * (0.55 + 1.5 * Math.max(0, mass)) + 2.2 * mass * Math.abs(mass));
    }
  }
  // Leader bases: local maxima, highest first, spread apart.
  const hAt = (i: number, j: number) => heights[j * (NX + 1) + i];
  const cands: { i: number; j: number; h: number }[] = [];
  const R = 2;
  for (let j = 4; j <= NZ - 4; j++) {
    for (let i = 4; i <= NX - 4; i++) {
      const h = hAt(i, j);
      let isMax = true;
      for (let dj = -R; dj <= R && isMax; dj++)
        for (let di = -R; di <= R; di++) if ((di || dj) && hAt(i + di, j + dj) > h) { isMax = false; break; }
      if (isMax) cands.push({ i, j, h });
    }
  }
  cands.sort((a, b) => b.h - a.h);
  // Pick in screen space (camera at mid-drift) so all 20 stay in frame and
  // spread across the width, highest first.
  const cam = cameraAt(150);
  const scr = (x: number, y: number, z: number) => {
    const p = new THREE.Vector3(x, y, z).project(cam);
    return { x: p.x * 0.5 + 0.5, y: 1 - (p.y * 0.5 + 0.5) };
  };
  const picked: { i: number; j: number; h: number; sx: number; sy: number }[] = [];
  for (const gap of [0.04, 0.034, 0.029, 0.025]) {
    for (const c of cands) {
      if (picked.length >= LEADERS) break;
      const s0 = scr(vx(c.i, c.j), c.h, vz(c.i, c.j));
      if (s0.x < 0.08 || s0.x > 0.975 || s0.y > 0.86 || s0.y < 0.38) continue;
      if (picked.every((p) => Math.abs(p.sx - s0.x) > gap))
        picked.push({ ...c, sx: s0.x, sy: s0.y });
    }
  }
  const periods = [60, 75, 100, 120, 150];
  // Label boxes (screen units) must not overlap: for each leader try a few
  // seeded top heights / sizes until its label is clear of the others.
  const boxes: [number, number, number, number][] = [];
  const leaders = picked.map((c) => {
    const base = new THREE.Vector3(vx(c.i, c.j), c.h, vz(c.i, c.j));
    let target = 0;
    let big = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      big = attempt < 16 && rng() < 0.4;
      target = Math.min(c.sy - 0.06, 0.31 + rng() * 0.29);
      const w = big ? 0.082 : 0.052;
      const h = big ? 0.05 : 0.034;
      const box: [number, number, number, number] = [c.sx - w / 2, target - 0.012 - h, w, h];
      const clear = boxes.every(([x, y, bw, bh]) => box[0] + box[2] < x || x + bw < box[0] || box[1] + box[3] < y || y + bh < box[1]);
      if (clear || attempt === 23) {
        boxes.push(box);
        break;
      }
    }
    let lo = c.h;
    let hi = c.h + 30;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (scr(base.x, mid, base.z).y > target) lo = mid;
      else hi = mid;
    }
    return {
      base,
      top: new THREE.Vector3(base.x, (lo + hi) / 2, base.z),
      big,
      period: 0,
      offset: 0,
    };
  });
  // Leaders share a value source in groups (as in the reference, a few
  // readings appear twice); each group has its own period and offset.
  const groups = Array.from({ length: GROUPS }, () => ({
    period: periods[Math.floor(rng() * periods.length)],
    offset: Math.floor(rng() * 600),
  }));
  leaders.forEach((l, i) => {
    l.period = groups[i % GROUPS].period;
    l.offset = groups[i % GROUPS].offset;
  });
  const t: Terrain = { heights, leaders };
  terrainCache.set(seed, t);
  return t;
};

// Value shown by leader i at a frame: changes every `period` frames
// (period divides 600) with a 7-frame scramble before each change.
const SCRAMBLE = 7;
const valueText = (i: number, period: number, offset: number, frame: number) => {
  const f = loopFrame(frame + offset);
  const k = Math.floor(f / period) % (600 / period);
  const into = f % period;
  const g = i % GROUPS;
  const v = hash01(g, k, 77) * 99.9999;
  // Mostly four decimals; some readings drop a trailing digit.
  let s = hash01(g, k, 5) < 0.25 ? String(Number(v.toFixed(3))) : v.toFixed(4);
  if (into >= period - SCRAMBLE) {
    s = s
      .split("")
      .map((ch, n) => (ch === "." ? "." : String(Math.floor(hash01(g, f, n) * 10))))
      .join("");
  }
  return s;
};

const makeFactory = (row: WirePeaksRow): SceneFactory => () => {
  const terrain = buildTerrain(row.seed);
  const [r, g, b] = hexToRgb(row.mesh);
  const segCount = NX * (NZ + 1) + (NX + 1) * NZ;
  const lines = makeLines(segCount + LEADERS);
  let n = 0;
  const hAt = (i: number, j: number) => terrain.heights[j * (NX + 1) + i];
  const put = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, a: number, w: number) => {
    lines.a.set([ax, ay, az], n * 3);
    lines.b.set([bx, by, bz], n * 3);
    lines.color.set([r, g, b, a], n * 4);
    lines.width[n] = w;
    n++;
  };
  // Fade the mesh out at its left/right/back borders so it has no hard edge.
  const edge = (i: number, j: number) => {
    const ex = Math.min(i, NX - i) / 14;
    const ez = j / 18;
    return Math.min(1, ex) * Math.min(1, ez);
  };
  for (let j = 0; j <= NZ; j++)
    for (let i = 0; i < NX; i++)
      put(vx(i, j), hAt(i, j), vz(i, j), vx(i + 1, j), hAt(i + 1, j), vz(i + 1, j), row.meshAlpha * edge(i + 0.5, j), 2.2);
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i <= NX; i++)
      put(vx(i, j), hAt(i, j), vz(i, j), vx(i, j + 1), hAt(i, j + 1), vz(i, j + 1), row.meshAlpha * edge(i, j + 0.5), 2.2);
  const [nr, ng, nb] = hexToRgb(row.numbers);
  for (const l of terrain.leaders) {
    lines.a.set([l.base.x, l.base.y, l.base.z], n * 3);
    lines.b.set([l.top.x, l.top.y, l.top.z], n * 3);
    lines.color.set([nr, ng, nb, 1], n * 4);
    lines.width[n] = 3;
    n++;
  }
  lines.touch();
  const dots = makeDots(LEADERS * 2);
  terrain.leaders.forEach((l, i) => {
    dots.p.set([l.base.x, l.base.y, l.base.z], i * 6);
    dots.p.set([l.top.x, l.top.y, l.top.z], i * 6 + 3);
    dots.color.set([nr, ng, nb, 1, nr, ng, nb, 1], i * 8);
    dots.size[i * 2] = 12;
    dots.size[i * 2 + 1] = 10;
  });
  dots.touch();

  const scene = new THREE.Scene();
  scene.add(lines.mesh, dots.mesh);
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 200);
  const dof: DofParams = { focus: 12, coc: 0, cocMax: 1, fade: [-1, 0, 14, 26], farFloor: 0.25, near: 0.1 };
  return {
    scene,
    camera,
    update: (frame, res) => {
      const c = cameraAt(frame);
      camera.position.copy(c.position);
      camera.quaternion.copy(c.quaternion);
      camera.updateMatrixWorld();
      camera.projectionMatrix.copy(c.projectionMatrix);
      applyDof(lines.material, dof, res);
      applyDof(dots.material, dof, res);
    },
  };
};

const Overlay: React.FC<{ row: WirePeaksRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const terrain = buildTerrain(row.seed);
  const cam = cameraAt(loopFrame(frame));
  const proj = (v: THREE.Vector3) => {
    const p = v.clone().project(cam);
    return [(p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H];
  };
  const glow = row.glow > 0 ? `0 0 ${18 * row.glow}px ${row.numbers}` : "none";
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {terrain.leaders.map((l, i) => {
        const [x, y] = proj(l.top);
        const size = l.big ? 64 : 42;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y - size * 0.62 - 16,
              transform: "translate(-50%, -50%)",
              fontFamily: INTER,
              fontWeight: 300,
              fontSize: size,
              color: row.numbers,
              letterSpacing: "0.01em",
              fontVariantNumeric: "tabular-nums",
              textShadow: glow,
              whiteSpace: "nowrap",
            }}
          >
            {valueText(i, l.period, l.offset, frame)}
          </div>
        );
      })}
    </div>
  );
};

export const WirePeaks: React.FC<{ row: WirePeaksRow }> = ({ row }) => {
  const build = useMemo(() => makeFactory(row), [row]);
  const post = useMemo<PostParams>(
    () => ({
      bgTop: row.bgTop,
      bgBottom: row.bg,
      vignette: 0.25,
      grain: 0.01,
      bloom: row.glow > 0 ? { strength: row.glow, threshold: 0.12, radius: 1.0 } : undefined,
    }),
    [row],
  );
  return (
    <GLStage build={build} post={post}>
      <Overlay row={row} />
    </GLStage>
  );
};
