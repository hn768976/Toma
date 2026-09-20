import React, { useMemo } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../lib/palette';
import { mulberry32, range } from '../lib/rng';

const LENGTH = 62; // long enough to run clean off both sides of frame

type Trace = {
  key: string;
  colour: string;
  /** Offset perpendicular to the run direction. */
  offset: number;
  /** true => runs along X, false => runs along Z. */
  alongX: boolean;
  y: number;
  width: number;
};

/**
 * The thin red and blue light lines that cross the board diagonally and
 * converge near the processor. They sit just above the plate tops so the
 * scattered blocks occlude them, exactly as in the reference.
 */
export const Traces: React.FC = () => {
  const traces = useMemo<Trace[]>(() => {
    const rng = mulberry32(776644);
    const out: Trace[] = [];
    const offsets = [-11.6, -2.4, 6.9];

    offsets.forEach((offset, i) => {
      out.push({
        key: `x${i}`,
        colour: i % 2 === 0 ? PALETTE.traceRed : PALETTE.traceBlue,
        offset,
        alongX: true,
        y: range(rng, 0.36, 0.44),
        width: range(rng, 0.018, 0.024),
      });
    });

    [-8.1, 0.9, 10.4].forEach((offset, i) => {
      out.push({
        key: `z${i}`,
        colour: i % 2 === 0 ? PALETTE.traceBlue : PALETTE.traceRed,
        offset,
        alongX: false,
        y: range(rng, 0.36, 0.44),
        width: range(rng, 0.018, 0.024),
      });
    });

    return out;
  }, []);

  return (
    <group>
      {traces.map((t) => {
        const pos: [number, number, number] = t.alongX
          ? [0, t.y, t.offset]
          : [t.offset, t.y, 0];
        const args: [number, number, number] = t.alongX
          ? [LENGTH, t.width, t.width]
          : [t.width, t.width, LENGTH];
        return (
          <mesh key={t.key} position={pos}>
            <boxGeometry args={args} />
            <meshStandardMaterial
              color={t.colour}
              emissive={new THREE.Color(t.colour)}
              emissiveIntensity={0.62}
              roughness={0.4}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};
