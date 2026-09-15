import React, { useMemo } from "react";
import * as THREE from "three";
import { mulberry32, range } from "./random";
import type { DustSpec } from "./types";

/**
 * Suspended micro-bubbles.
 *
 * In the references these are almost always defocused, so they are cheap
 * camera-facing sprites rather than geometry — the DOF pass turns them into the
 * soft discs you see drifting through frame. Positions are seeded, and motion is
 * a pure function of time, so every frame is reproducible in isolation.
 */

const makeSpriteTexture = (): THREE.Texture => {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Bubbles read as a bright rim with a hollow centre, not a solid dot.
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, "rgba(255,255,255,0.10)");
    g.addColorStop(0.62, "rgba(255,255,255,0.16)");
    g.addColorStop(0.85, "rgba(255,255,255,0.95)");
    g.addColorStop(1.0, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

type Mote = {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
  sway: number;
};

export const Dust: React.FC<{ spec: DustSpec; time: number }> = ({ spec, time }) => {
  const texture = useMemo(() => makeSpriteTexture(), []);

  const motes = useMemo<Mote[]>(() => {
    const rng = mulberry32(spec.seed);
    return Array.from({ length: spec.count }, () => ({
      x: range(rng, -spec.spread[0], spec.spread[0]),
      y: range(rng, -spec.spread[1], spec.spread[1]),
      z: range(rng, -spec.spread[2], spec.spread[2]),
      size: range(rng, spec.size[0], spec.size[1]),
      phase: rng() * Math.PI * 2,
      sway: range(rng, 0.2, 0.7),
    }));
  }, [spec]);

  if (spec.count === 0) {
    return null;
  }

  const span = spec.spread[1] * 2;

  return (
    <group>
      {motes.map((m, i) => {
        // Wrap vertically so the field never empties out on long versions.
        const y =
          ((((m.y + time * spec.rise + spec.spread[1]) % span) + span) % span) -
          spec.spread[1];
        const x = m.x + Math.sin(time * 0.25 + m.phase) * m.sway * 0.12;
        return (
          <sprite key={i} position={[x, y, m.z]} scale={[m.size, m.size, m.size]}>
            <spriteMaterial
              map={texture}
              color={spec.color}
              transparent
              opacity={spec.opacity}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        );
      })}
    </group>
  );
};
