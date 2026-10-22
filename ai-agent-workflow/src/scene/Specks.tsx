import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { AdditiveBlending, BufferAttribute, BufferGeometry } from "three";
import type { Palette } from "../theme";
import { hexToRgb, mulberry32 } from "../util";

const COUNT = 300;

/** Tiny glowing squares hovering above the floor at varying heights. */
export const Specks: React.FC<{ pal: Palette }> = ({ pal }) => {
  const frame = useCurrentFrame();
  const specks = useMemo(() => {
    const rnd = mulberry32(1234);
    return Array.from({ length: COUNT }, () => ({
      u: -34 + rnd() * 84,
      v: -30 + rnd() * 56,
      z: rnd() < 0.55 ? 0.05 : rnd() * 7,
      s: 0.07 + rnd() * rnd() * 0.4,
      c: Math.floor(rnd() * pal.specks.length),
      phase: rnd() * Math.PI * 2,
      speed: 0.03 + rnd() * 0.08,
      drift: (rnd() - 0.5) * 0.01,
      base: 0.1 + rnd() * 0.45,
    }));
  }, [pal]);
  const colors = useMemo(() => pal.specks.map((h) => hexToRgb(h).map((x) => x / 255)), [pal]);
  const geometry = useMemo(() => new BufferGeometry(), []);

  const data = useMemo(() => {
    const pos = new Float32Array(COUNT * 18);
    const col = new Float32Array(COUNT * 18);
    specks.forEach((p, i) => {
      const x = p.u + p.drift * frame;
      const y = -(p.v + p.drift * 0.5 * frame);
      const z = p.z + 0.15 * Math.sin(frame * 0.02 + p.phase);
      const h = p.s / 2;
      const quad = [
        [x - h, y - h], [x + h, y - h], [x + h, y + h],
        [x - h, y - h], [x + h, y + h], [x - h, y + h],
      ];
      const tw = p.base * (0.45 + 0.55 * Math.max(0, Math.sin(frame * p.speed + p.phase)));
      const c = colors[p.c];
      quad.forEach(([qx, qy], k) => {
        pos.set([qx, qy, z], i * 18 + k * 3);
        col.set([c[0] * tw, c[1] * tw, c[2] * tw], i * 18 + k * 3);
      });
    });
    return { pos, col };
  }, [frame, specks, colors]);

  useLayoutEffect(() => {
    geometry.setAttribute("position", new BufferAttribute(data.pos, 3));
    geometry.setAttribute("color", new BufferAttribute(data.col, 3));
    geometry.computeBoundingSphere();
  }, [data, geometry]);

  return (
    <mesh geometry={geometry} renderOrder={6} frustumCulled={false}>
      <meshBasicMaterial
        vertexColors
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        fog={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
};
