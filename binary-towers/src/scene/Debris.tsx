import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { DURATION_IN_FRAMES } from "../constants";
import { mulberry32, range } from "../lib/random";
import { hexToRgb, Palette } from "./palette";
import { DEBRIS_TILES, debrisAtlasTexture, tileUv } from "./sprites";

const TAU = Math.PI * 2;
/** Quad corners as (alongAxis, acrossAxis) signs. */
const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

const STREAKS = 78;
const GLYPHS = 46;

type Bit = {
  base: THREE.Vector3;
  /** Direction of a streak, or the billboard axis of a glyph fragment. */
  dir: THREE.Vector3;
  isGlyph: boolean;
  tile: number;
  length: number;
  thickness: number;
  /** Drift: integer harmonics of the loop, so it returns exactly. */
  amp: THREE.Vector3;
  harm: [number, number, number];
  phase: [number, number, number];
  brightness: number;
  soft: boolean;
};

const buildBits = (seed: number): Bit[] => {
  const rand = mulberry32(seed);
  const bits: Bit[] = [];
  const total = STREAKS + GLYPHS;
  for (let i = 0; i < total; i++) {
    const isGlyph = i >= STREAKS;
    const radius = range(rand, 3, 46);
    const theta = rand() * Math.PI * 2;
    const soft = rand() < 0.4;
    bits.push({
      base: new THREE.Vector3(
        Math.cos(theta) * radius,
        range(rand, 0.5, 26),
        Math.sin(theta) * radius,
      ),
      dir: new THREE.Vector3(
        range(rand, -1, 1),
        range(rand, -0.35, 0.35),
        range(rand, -1, 1),
      ).normalize(),
      isGlyph,
      tile: isGlyph
        ? rand() < 0.5
          ? DEBRIS_TILES.zero
          : DEBRIS_TILES.one
        : soft
          ? DEBRIS_TILES.streakSoft
          : DEBRIS_TILES.streak,
      length: isGlyph ? range(rand, 0.07, 0.2) : range(rand, 1.1, 5.4),
      thickness: isGlyph ? 0 : range(rand, 0.012, 0.055),
      amp: new THREE.Vector3(range(rand, 0.2, 1.5), range(rand, 0.3, 2.4), range(rand, 0.2, 1.5)),
      harm: [
        1 + Math.floor(rand() * 3),
        1 + Math.floor(rand() * 3),
        1 + Math.floor(rand() * 3),
      ],
      phase: [rand(), rand(), rand()],
      brightness: isGlyph ? range(rand, 0.15, 0.6) : range(rand, 0.3, 1),
      soft,
    });
  }
  return bits;
};

/**
 * All debris lives in one geometry rebuilt per frame: streaks are ribbons laid
 * along a fixed 3D direction and turned edge-on to the camera, glyph fragments
 * are billboards. One draw call, no per-character meshes.
 */
export const Debris: React.FC<{ palette: Palette; frame: number; seed: number }> = ({
  palette,
  frame,
  seed,
}) => {
  const camera = useThree((s) => s.camera);
  const bits = useMemo(() => buildBits(seed), [seed]);
  const map = useMemo(() => debrisAtlasTexture(), []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = bits.length;
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 12), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 8), 2));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 16), 4));
    const index = new Uint16Array(n * 6);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      index.set([o, o + 1, o + 2, o, o + 2, o + 3], i * 6);
    }
    g.setIndex(new THREE.BufferAttribute(index, 1));
    return g;
  }, [bits.length]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        vertexColors: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [map],
  );
  useEffect(() => () => material.dispose(), [material]);

  const t = frame / DURATION_IN_FRAMES;
  const [dimR, dimG, dimB] = hexToRgb(palette.debrisDim);
  const [hotR, hotG, hotB] = hexToRgb(palette.debrisHot);

  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  const col = geometry.getAttribute("color") as THREE.BufferAttribute;

  const camPos = camera.position;
  const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const p = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const side = new THREE.Vector3();

  bits.forEach((bit, i) => {
    p.set(
      bit.base.x + Math.sin(TAU * (t * bit.harm[0] + bit.phase[0])) * bit.amp.x,
      bit.base.y + Math.sin(TAU * (t * bit.harm[1] + bit.phase[1])) * bit.amp.y,
      bit.base.z + Math.sin(TAU * (t * bit.harm[2] + bit.phase[2])) * bit.amp.z,
    );

    if (bit.isGlyph) {
      axis.copy(camRight).multiplyScalar(bit.length);
      side.copy(camUp).multiplyScalar(bit.length);
    } else {
      axis.copy(bit.dir).multiplyScalar(bit.length * 0.5);
      toCam.copy(camPos).sub(p).normalize();
      side.copy(bit.dir).cross(toCam).normalize().multiplyScalar(bit.thickness);
      if (!isFinite(side.x)) side.copy(camUp).multiplyScalar(bit.thickness);
    }

    const o = i * 4;
    CORNERS.forEach(([sx, sy], k) => {
      pos.setXYZ(
        o + k,
        p.x + axis.x * sx + side.x * sy,
        p.y + axis.y * sx + side.y * sy,
        p.z + axis.z * sx + side.z * sy,
      );
    });

    const [u0, v0, u1, v1] = tileUv(bit.tile);
    uv.setXY(o + 0, u0, v0);
    uv.setXY(o + 1, u1, v0);
    uv.setXY(o + 2, u1, v1);
    uv.setXY(o + 3, u0, v1);

    // Fog + a soft-focus dimming stand-in for out-of-focus debris.
    const d = p.distanceTo(camPos);
    const fogged = Math.exp(-Math.pow(palette.fogDensity * d, 2));
    const b = bit.brightness;
    const alpha = fogged * (bit.soft ? 0.4 : 1) * (0.25 + b * 0.75) * (d < 1.2 ? 0.15 : 1);
    const r = (dimR + (hotR - dimR) * b) / 255;
    const gch = (dimG + (hotG - dimG) * b) / 255;
    const bch = (dimB + (hotB - dimB) * b) / 255;
    for (let k = 0; k < 4; k++) col.setXYZW(o + k, r, gch, bch, alpha);
  });

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  col.needsUpdate = true;
  geometry.computeBoundingSphere();

  return <mesh geometry={geometry} material={material} renderOrder={30} frustumCulled={false} />;
};
