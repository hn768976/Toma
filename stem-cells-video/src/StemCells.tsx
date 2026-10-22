import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  AdditiveBlending,
  Color,
  IcosahedronGeometry,
  Matrix3,
  NormalBlending,
  ShaderMaterial,
  Vector3,
} from "three";
import { CELLS, CellDef, sampleCell } from "./cells";
import { SPACE_H, SPACE_W } from "./constants";
import { Palette } from "./palettes";
import {
  backgroundFragment,
  backgroundVertex,
  cellFragment,
  cellVertex,
  haloFragment,
  haloVertex,
  membraneFragment,
  membraneVertex,
} from "./shaders";

export type StemCellsProps = {
  palette: Palette;
};

// Separates cells along the view axis so membranes never intersect.
const DEPTH_STEP = 700;

const backdropUniforms = (palette: Palette) => ({
  uBgDark: { value: new Color(palette.bgDark) },
  uBgMid: { value: new Color(palette.bgMid) },
  uBgGlow: { value: new Color(palette.bgGlow) },
  uBgStrip: { value: new Color(palette.bgStrip) },
  uTime: { value: 0 },
});

const spinMatrix = (cell: CellDef, t: number) => {
  // Each cell tumbles slowly about its own random axis.
  const axis = new Vector3(
    Math.sin(cell.seed * 3.1),
    Math.cos(cell.seed * 1.7),
    Math.sin(cell.seed * 5.3),
  ).normalize();
  const angle = t * (0.1 + 0.04 * Math.sin(cell.seed)) + cell.seed;
  const m = new Matrix3();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const oc = 1 - c;
  const { x, y, z } = axis;
  m.set(
    oc * x * x + c, oc * x * y - z * s, oc * z * x + y * s,
    oc * x * y + z * s, oc * y * y + c, oc * y * z - x * s,
    oc * z * x - y * s, oc * y * z + x * s, oc * z * z + c,
  );
  return m;
};

const Cell: React.FC<{
  cell: CellDef;
  palette: Palette;
  geometry: IcosahedronGeometry;
  smoothGeometry: IcosahedronGeometry;
  t: number;
}> = ({ cell, palette, geometry, smoothGeometry, t }) => {
  const body = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: cellVertex,
        fragmentShader: cellFragment,
        transparent: true,
        uniforms: {
          ...backdropUniforms(palette),
          uCore: { value: new Color(palette.core) },
          uBody: { value: new Color(palette.body) },
          uRim: { value: new Color(palette.rim) },
          uSeam: { value: new Color(palette.seam) },
          uHaze: { value: cell.haze },
          uSeed: { value: cell.seed },
          uSpin: { value: new Matrix3() },
          uAmp: { value: 0.1 },
          uBump: { value: 0.01 },
          uSoft: { value: cell.soft },
        },
      }),
    [cell, palette],
  );

  const halo = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: haloVertex,
        fragmentShader: haloFragment,
        uniforms: {
          uRim: { value: new Color(palette.rim) },
          uStrength: { value: 0.55 },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [palette],
  );

  const membrane = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: membraneVertex,
        fragmentShader: membraneFragment,
        uniforms: {
          ...backdropUniforms(palette),
          uMembrane: { value: new Color(palette.membrane) },
          uOpacity: { value: 0.9 },
          uSeed: { value: cell.seed },
          uCoreRatio: { value: 1 / cell.membrane },
        },
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      }),
    [cell, palette],
  );

  const { x, y, r } = sampleCell(cell, t);
  body.uniforms.uSpin.value = spinMatrix(cell, t);
  body.uniforms.uTime.value = t;
  membrane.uniforms.uTime.value = t;

  // Gentle breathing of the outer membrane.
  const membraneScale = r * cell.membrane * (1 + 0.02 * Math.sin(t * 0.9 + cell.seed));
  const z = cell.depth * DEPTH_STEP;

  return (
    <group position={[x, y, z]}>
      <mesh geometry={geometry} material={body} scale={r} renderOrder={cell.depth * 3 + 1} />
      <mesh
        geometry={smoothGeometry}
        material={halo}
        scale={r * 1.07}
        renderOrder={cell.depth * 3 + 2}
      />
      <mesh
        material={membrane}
        scale={membraneScale}
        position={[0, 0, -r * 1.2]}
        renderOrder={cell.depth * 3}
      >
        <planeGeometry args={[2.2, 2.2]} />
      </mesh>
    </group>
  );
};

const Scene: React.FC<{ palette: Palette; t: number }> = ({ palette, t }) => {
  const geometry = useMemo(() => new IcosahedronGeometry(1, 64), []);
  const smoothGeometry = useMemo(() => new IcosahedronGeometry(1, 24), []);
  const background = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: backgroundVertex,
        fragmentShader: backgroundFragment,
        uniforms: backdropUniforms(palette),
        depthWrite: false,
      }),
    [palette],
  );
  background.uniforms.uTime.value = t;

  return (
    <>
      <mesh position={[0, 0, -2000]} material={background} renderOrder={-1}>
        <planeGeometry args={[SPACE_W, SPACE_H]} />
      </mesh>
      {CELLS.map((cell) => (
        <Cell
          key={cell.id}
          cell={cell}
          palette={palette}
          geometry={geometry}
          smoothGeometry={smoothGeometry}
          t={t}
        />
      ))}
    </>
  );
};

export const StemCells: React.FC<StemCellsProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bgDark }}>
      <ThreeCanvas
        width={width}
        height={height}
        orthographic
        dpr={[0.25, 2]}
        gl={{ antialias: true }}
        camera={{
          position: [0, 0, 10000],
          near: 1,
          far: 20000,
          zoom: width / SPACE_W,
        }}
      >
        <Scene palette={palette} t={t} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
