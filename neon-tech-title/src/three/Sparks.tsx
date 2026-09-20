import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { mulberry32, range } from '../lib/rng';

const COUNT = 110;
const RISE = 9.0; // world units a spark travels before it wraps

/**
 * Tiny white points drifting upward around the processor.
 *
 * Each spark has an integer number of rises per loop, so the whole field
 * returns to its exact starting configuration on the last frame.
 */
export const Sparks: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const ref = useRef<THREE.Points>(null);

  const { geometry, seeds } = useMemo(() => {
    const rng = mulberry32(31337);
    const seeds: { r: number; a: number; y0: number; rises: number; drift: number }[] = [];
    for (let i = 0; i < COUNT; i++) {
      seeds.push({
        r: range(rng, 2.0, 7.0),
        a: rng() * Math.PI * 2,
        y0: rng(),
        // 1..3 whole rises across the loop keeps the motion periodic.
        rises: 1 + Math.floor(rng() * 3),
        drift: range(rng, -0.35, 0.35),
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(COUNT), 1));
    return { geometry: g, seeds };
  }, []);

  const t = frame / durationInFrames;
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;

  for (let i = 0; i < COUNT; i++) {
    const s = seeds[i];
    const phase = (s.y0 + t * s.rises) % 1;
    const a = s.a + t * Math.PI * 2 * s.drift * 0; // keep azimuth fixed for a clean loop
    pos.setXYZ(i, Math.cos(a) * s.r, 0.35 + phase * RISE, Math.sin(a) * s.r);
  }
  pos.needsUpdate = true;

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.05}
        color="#eaf2ff"
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
};
