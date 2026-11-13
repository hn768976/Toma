import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { PALETTES } from "./scene/constants";
import {
  buildCubeGeometry,
  cubeFragmentShader,
  cubeVertexShader,
  FIELD_FAR_Z,
  FIELD_NEAR_Z,
  generateBoxes,
} from "./scene/cubeField";
import {
  ATLAS_GRID,
  createBackground,
  createDataAtlas,
} from "./scene/dataAtlas";
import { createWaveObjects, generateWaves, updateWaveObject } from "./scene/waves";

// Colours are authored as display (sRGB) values and written straight to the
// canvas, so Three.js colour management is disabled (see also `linear`/`flat`).
THREE.ColorManagement.enabled = false;

export const glassDataCubesSchema = z.object({
  variant: z.enum(["reference", "blueprint"]),
});

type Props = z.infer<typeof glassDataCubesSchema>;

// Camera flight: a steady push forward down the cube corridor with a slow,
// breathing drift in position, aim and roll (hand-held "drone" feel).
const CAMERA_START_Z = 9;
const CAMERA_SPEED = 4.6; // world units per second
const FOV = 36;

const cameraAt = (t: number) => {
  const pos = new THREE.Vector3(
    0.35 * Math.sin(t * 0.31 + 0.4) + 0.15 * Math.sin(t * 0.83),
    0.22 * Math.sin(t * 0.27 + 1.3) + 0.08 * Math.sin(t * 0.9 + 2),
    CAMERA_START_Z - CAMERA_SPEED * t,
  );
  const target = new THREE.Vector3(
    pos.x + 1.1 * Math.sin(t * 0.21 + 0.8),
    pos.y + 0.7 * Math.sin(t * 0.17 + 2.1),
    pos.z - 12,
  );
  const roll = 0.045 * Math.sin(t * 0.19 + 0.5);
  return { pos, target, roll };
};

const SceneContents: React.FC<Props> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const palette = PALETTES[variant];
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  // Line widths are authored for 1080p and scaled with the composition size.
  const pxScale = height / 1080;

  const { cubeMesh, waves, background } = useMemo(() => {
    const atlas = new THREE.CanvasTexture(createDataAtlas(7));
    atlas.anisotropy = 8;
    atlas.generateMipmaps = true;
    atlas.minFilter = THREE.LinearMipmapLinearFilter;
    atlas.magFilter = THREE.LinearFilter;

    const boxes = generateBoxes(1234, 380);
    const geo = buildCubeGeometry(boxes, 4321);
    const mat = new THREE.ShaderMaterial({
      vertexShader: cubeVertexShader,
      fragmentShader: cubeFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: palette.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uAtlas: { value: atlas },
        uGrid: { value: ATLAS_GRID },
        uFace: { value: new THREE.Color(palette.face) },
        uFaceAlpha: { value: palette.faceAlpha },
        uEdge: { value: new THREE.Color(palette.edge) },
        uEdgeAlpha: { value: palette.edgeAlpha },
        uInk: { value: new THREE.Color(palette.ink) },
        uInkAlpha: { value: palette.inkAlpha },
        uLineWidth: { value: 1.5 * pxScale },
        uFogNear: { value: 8 },
        uFogFar: { value: 30 },
        uAdditive: { value: palette.additive ? 1 : 0 },
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;

    const specs = generateWaves(77, 18, FIELD_NEAR_Z - 12, FIELD_FAR_Z + 40);
    const waveObjs = createWaveObjects(
      specs,
      palette.wave,
      palette.additive,
      1.6 * pxScale,
      4.6 * pxScale,
      new THREE.Vector2(width, height),
    );

    const bgTex = new THREE.CanvasTexture(
      createBackground(palette.background, palette.hotspot),
    );
    return { cubeMesh: mesh, waves: waveObjs, background: bgTex };
  }, [palette, pxScale, width, height]);

  useLayoutEffect(() => {
    scene.background = background;
    return () => {
      scene.background = null;
    };
  }, [scene, background]);

  // Drive camera + animated data for the current frame (runs before R3F renders).
  useLayoutEffect(() => {
    const t = frame / fps;
    const { pos, target, roll } = cameraAt(t);
    camera.fov = FOV;
    camera.near = 0.05;
    camera.far = 200;
    camera.aspect = width / height;
    camera.position.copy(pos);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    for (const w of waves) {
      updateWaveObject(w, t);
      // Same distance fade as the cubes.
      const depth = pos.z - (w.spec.origin.z);
      const fog = 1 - THREE.MathUtils.smoothstep(depth, 8, 30);
      const near = THREE.MathUtils.smoothstep(depth, 0.4, 2.5);
      const o = palette.waveAlpha * fog * near;
      w.lineMat.opacity = o;
      w.pointsMat.opacity = o;
      w.line.visible = o > 0.003;
      w.points.visible = o > 0.003;
    }
  }, [frame, fps, camera, waves, width, height, palette.waveAlpha]);

  return (
    <>
      <primitive object={cubeMesh} />
      {waves.map((w, i) => (
        <React.Fragment key={i}>
          <primitive object={w.line} />
          <primitive object={w.points} />
        </React.Fragment>
      ))}
    </>
  );
};

export const GlassDataCubes: React.FC<Props> = ({ variant }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: PALETTES[variant].background[1] }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={1}
        linear
        flat
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: FOV, near: 0.05, far: 200, position: [0, 0, CAMERA_START_Z] }}
      >
        <SceneContents variant={variant} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
