import {
  BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Sphere,
  Vector3,
} from "three";
import { ARRAY_OVERSCAN, VIEW_W } from "./constants";
import { mulberry32 } from "./random";
import type { BladeArrayConfig } from "./types";

/**
 * One blade is a thin vertical ribbon with a shallow cylindrical cross-section.
 * The arc is the point: a dead-flat blade reflects a single colour and the look
 * collapses. The thickness is small but never zero, so the thin edge catches a
 * bright line where a blade turns.
 *
 * The whole array is one InstancedBufferGeometry - one draw call. Position,
 * width and twist come from per-instance attributes and are resolved in the
 * vertex shader.
 */

/** ±4% width variation, drawn once at build time. Identical blades read as a render test. */
const WIDTH_JITTER = 0.04;

type Ring = { x: number; z: number; nx: number; nz: number }[];

function crossSection(arcDeg: number, thickness: number, arcPoints: number): Ring {
  const aMax = ((arcDeg * Math.PI) / 180) / 2;
  const radius = 0.5 / Math.sin(aMax);
  const z0 = radius * Math.cos(aMax);

  const front: Ring = [];
  for (let i = 0; i < arcPoints; i++) {
    const a = -aMax + (2 * aMax * i) / (arcPoints - 1);
    front.push({
      x: radius * Math.sin(a),
      z: radius * Math.cos(a) - z0,
      nx: Math.sin(a),
      nz: Math.cos(a),
    });
  }

  const ring: Ring = [];
  // Front (camera-facing) arc.
  for (const p of front) ring.push({ ...p });
  // Right edge face - its own hard normal, tangent to the arc.
  const rightN = { nx: Math.cos(aMax), nz: -Math.sin(aMax) };
  const rEnd = front[arcPoints - 1];
  ring.push({ x: rEnd.x, z: rEnd.z, ...rightN });
  ring.push({ x: rEnd.x - thickness * rEnd.nx, z: rEnd.z - thickness * rEnd.nz, ...rightN });
  // Back arc, reversed.
  for (let i = arcPoints - 1; i >= 0; i--) {
    const p = front[i];
    ring.push({ x: p.x - thickness * p.nx, z: p.z - thickness * p.nz, nx: -p.nx, nz: -p.nz });
  }
  // Left edge face.
  const leftN = { nx: -Math.cos(aMax), nz: -Math.sin(aMax) };
  const lEnd = front[0];
  ring.push({ x: lEnd.x - thickness * lEnd.nx, z: lEnd.z - thickness * lEnd.nz, ...leftN });
  ring.push({ x: lEnd.x, z: lEnd.z, ...leftN });

  return ring;
}

export function buildBladeGeometry(cfg: BladeArrayConfig, seed: number): InstancedBufferGeometry {
  const arcPoints = Math.max(4, Math.round(cfg.arcDeg / 2) + 4);
  const ring = crossSection(cfg.arcDeg, cfg.thickness, arcPoints);
  const m = ring.length;
  const rows = cfg.segY + 1;

  const positions = new Float32Array(m * rows * 3);
  const normals = new Float32Array(m * rows * 3);
  for (let r = 0; r < rows; r++) {
    const y = r / cfg.segY - 0.5;
    for (let i = 0; i < m; i++) {
      const o = (r * m + i) * 3;
      positions[o] = ring[i].x;
      positions[o + 1] = y;
      positions[o + 2] = ring[i].z;
      normals[o] = ring[i].nx;
      normals[o + 1] = 0;
      normals[o + 2] = ring[i].nz;
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    // Skip the zero-area quads sitting at the duplicated hard edges.
    if (Math.abs(ring[i].x - ring[j].x) < 1e-9 && Math.abs(ring[i].z - ring[j].z) < 1e-9) continue;
    for (let r = 0; r < cfg.segY; r++) {
      const a = r * m + i;
      const b = r * m + j;
      const c = (r + 1) * m + j;
      const d = (r + 1) * m + i;
      indices.push(a, b, c, a, c, d);
    }
  }

  const pitch = VIEW_W / cfg.bladesPerFrame;
  const span = VIEW_W * ARRAY_OVERSCAN;
  const count = Math.ceil(span / pitch);
  const rand = mulberry32(seed);

  const aXn = new Float32Array(count);
  const aX = new Float32Array(count);
  const aW = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Uniform spacing. These are not randomly placed.
    aX[i] = (i - (count - 1) / 2) * pitch;
    aXn[i] = count === 1 ? 0.5 : i / (count - 1);
    aW[i] = pitch * cfg.fill * (1 + (rand() * 2 - 1) * WIDTH_JITTER);
  }

  const geo = new InstancedBufferGeometry();
  geo.setAttribute("position", new BufferAttribute(positions, 3));
  geo.setAttribute("normal", new BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.setAttribute("aXn", new InstancedBufferAttribute(aXn, 1));
  geo.setAttribute("aX", new InstancedBufferAttribute(aX, 1));
  geo.setAttribute("aW", new InstancedBufferAttribute(aW, 1));
  geo.instanceCount = count;
  // The array runs past both side edges. Give it a bounding sphere that
  // covers the whole row so nothing is culled at the frame edges.
  geo.boundingSphere = new Sphere(new Vector3(0, 0, 0), span);
  geo.computeBoundingSphere = () => {};
  return geo;
}

export function bladeCount(cfg: BladeArrayConfig): number {
  return Math.ceil((VIEW_W * ARRAY_OVERSCAN) / (VIEW_W / cfg.bladesPerFrame));
}
