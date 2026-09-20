import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useTheme } from './theme';
import { mulberry32, range, type Rng } from '../lib/rng';

const GRID = 74; // cells across, centred on the processor
const CELL = 1.0; // world units per cell
const SEAM = 0.1; // dark gap left between neighbouring plates
const CLEAR_RADIUS = 4.6; // keep blocks off the processor apron

type Rect = { x: number; z: number; w: number; d: number };

/**
 * Greedy rectangle packing over a square grid. Produces the irregular
 * "cut from one sheet" plate tiling the reference board is built from:
 * mostly small rectangles, occasionally a long one, all sharing seam lines.
 */
const packPlates = (rng: Rng): Rect[] => {
  const used = new Uint8Array(GRID * GRID);
  const at = (x: number, z: number) => used[z * GRID + x];
  const rects: Rect[] = [];

  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (at(x, z)) continue;

      // Bias toward small plates, with a long run now and then.
      const maxW = rng() < 0.14 ? 5 : 3;
      const maxD = rng() < 0.14 ? 4 : 3;

      let w = 1;
      while (w < maxW && x + w < GRID && !at(x + w, z) && rng() < 0.62) w++;

      let d = 1;
      outer: while (d < maxD && z + d < GRID) {
        for (let i = 0; i < w; i++) {
          if (at(x + i, z + d)) break outer;
        }
        if (rng() > 0.55) break;
        d++;
      }

      for (let dz = 0; dz < d; dz++) {
        for (let dx = 0; dx < w; dx++) used[(z + dz) * GRID + (x + dx)] = 1;
      }
      rects.push({ x, z, w, d });
    }
  }
  return rects;
};

const toWorld = (cell: number) => (cell - GRID / 2) * CELL;

export const Board: React.FC = () => {
  const { palette, blockGlowIntensity } = useTheme();
  const { plates, blocks, glowBlocks } = useMemo(() => {
    const rng = mulberry32(20260920);
    const rects = packPlates(rng);

    // ---- plates -------------------------------------------------------
    const plates = rects.map((r) => {
      const w = r.w * CELL - SEAM;
      const d = r.d * CELL - SEAM;
      // A few discrete step heights read as machined layers rather than noise.
      const h = ([0.16, 0.16, 0.22, 0.28, 0.34] as const)[Math.floor(rng() * 5)];
      const cx = toWorld(r.x) + (r.w * CELL) / 2;
      const cz = toWorld(r.z) + (r.d * CELL) / 2;
      const alt = rng() < 0.3;
      return { key: `${r.x}-${r.z}`, w, d, h, cx, cz, alt };
    });

    // ---- scattered blocks --------------------------------------------
    const blocks: {
      key: string;
      w: number;
      d: number;
      h: number;
      cx: number;
      cz: number;
      alt: boolean;
    }[] = [];
    const glowBlocks: { key: string; s: number; cx: number; cz: number; h: number }[] = [];

    for (const r of rects) {
      const cx = toWorld(r.x) + (r.w * CELL) / 2;
      const cz = toWorld(r.z) + (r.d * CELL) / 2;
      const dist = Math.hypot(cx, cz);
      if (dist < CLEAR_RADIUS) continue;

      // Density falls off far from the hub so the frame edges stay calm.
      const p = dist < 12 ? 0.17 : dist < 20 ? 0.13 : 0.09;
      if (rng() > p) continue;

      const roll = rng();
      if (roll < 0.06 && dist > 6.0) {
        const s = range(rng, 0.6, 0.92);
        glowBlocks.push({ key: `g${r.x}-${r.z}`, s, cx, cz, h: range(rng, 0.16, 0.26) });
        continue;
      }

      const big = roll > 0.88;
      const w = big ? range(rng, 1.4, 2.2) : range(rng, 0.5, 1.15);
      const d = big ? range(rng, 1.4, 2.2) : range(rng, 0.5, 1.15);
      const h = big ? range(rng, 0.85, 1.7) : range(rng, 0.2, 0.62);
      blocks.push({ key: `b${r.x}-${r.z}`, w, d, h, cx, cz, alt: rng() < 0.35 });
    }

    return { plates, blocks, glowBlocks };
  }, []);

  return (
    <group>
      {/* Substrate the plates sit on, so seams read as dark cuts not holes. */}
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <boxGeometry args={[GRID * CELL + 6, 0.24, GRID * CELL + 6]} />
        <meshStandardMaterial color="#070b12" roughness={0.95} metalness={0} />
      </mesh>

      {plates.map((p) => (
        <mesh key={p.key} position={[p.cx, p.h / 2, p.cz]} castShadow receiveShadow>
          <boxGeometry args={[p.w, p.h, p.d]} />
          <meshStandardMaterial
            color={p.alt ? palette.boardPlateAlt : palette.boardPlate}
            roughness={0.72}
            metalness={0.18}
          />
        </mesh>
      ))}

      {blocks.map((b) => (
        <mesh key={b.key} position={[b.cx, 0.3 + b.h / 2, b.cz]} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial
            color={b.alt ? palette.blockAlt : palette.block}
            roughness={0.66}
            metalness={0.22}
          />
        </mesh>
      ))}

      {glowBlocks.map((g) => (
        <mesh key={g.key} position={[g.cx, 0.3 + g.h / 2, g.cz]}>
          <boxGeometry args={[g.s, g.h, g.s]} />
          <meshStandardMaterial
            color={palette.blockGlow}
            emissive={new THREE.Color(palette.blockGlow)}
            emissiveIntensity={blockGlowIntensity}
            roughness={0.5}
            metalness={0.05}
          />
        </mesh>
      ))}
    </group>
  );
};
