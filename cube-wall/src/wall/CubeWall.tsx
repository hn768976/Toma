import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { COLS, Palette, ROWS, TILE_GAP } from "./constants";
import { makeTileParams, tileDepth } from "./depth";

export type CubeWallProps = {
  palette: Palette;
  seed: number;
};

// Straight-on camera at the centre of the wall, like the reference.
const CAMERA_DISTANCE = 22;
const VISIBLE_ROWS = 10.05; // ~10 rows tall, ~18 columns wide at 16:9

const Camera: React.FC = () => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(0, 0, CAMERA_DISTANCE);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.fov =
      2 * Math.atan(VISIBLE_ROWS / 2 / CAMERA_DISTANCE) * (180 / Math.PI);
    camera.near = 1;
    camera.far = 100;
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
};

const Lights: React.FC<{ palette: Palette }> = ({ palette }) => {
  const key = useMemo(() => {
    const l = new THREE.DirectionalLight(
      palette.keyLight,
      palette.keyIntensity,
    );
    // Mostly frontal, slightly from the upper left: soft blue shadows fall
    // to the right of / below raised tiles, as in the reference.
    l.position.set(-4.5, 4.5, 20);
    l.target.position.set(0, 0, 0);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const cam = l.shadow.camera;
    cam.left = -COLS / 2 - 1;
    cam.right = COLS / 2 + 1;
    cam.top = ROWS / 2 + 1;
    cam.bottom = -ROWS / 2 - 1;
    cam.near = 1;
    cam.far = 60;
    l.shadow.bias = -0.0005;
    l.shadow.radius = 8;
    l.shadow.blurSamples = 16;
    return l;
  }, [palette.keyLight, palette.keyIntensity]);

  return (
    <>
      <primitive object={key} />
      <primitive object={key.target} />
      {/* Broad light near the camera: bright centre, natural fall-off. */}
      <pointLight
        position={[0.4, -1.6, 9]}
        color={palette.fillLight}
        intensity={palette.fillIntensity}
        decay={2}
        distance={0}
      />
      <hemisphereLight
        args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity]}
      />
      <ambientLight
        color={palette.ambient}
        intensity={palette.ambientIntensity}
      />
    </>
  );
};

const Tiles: React.FC<{ palette: Palette; seed: number; time: number }> = ({
  palette,
  seed,
  time,
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const params = useMemo(() => makeTileParams(seed), [seed]);
  const geometry = useMemo(() => {
    // Deep boxes: their back half always stays buried inside the wall.
    const g = new THREE.BoxGeometry(1 - TILE_GAP, 1 - TILE_GAP, 2);
    g.translate(0, 0, -1);
    return g;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    let i = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = col - COLS / 2 + 0.5;
        const y = row - ROWS / 2 + 0.5;
        m.makeTranslation(x, y, tileDepth(col, row, time, params[i]));
        mesh.setMatrixAt(i, m);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [params, time]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, COLS * ROWS]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      {/* BoxGeometry face groups: +x, -x, +y, -y, +z (front), -z (back). */}
      {[0, 1, 2, 3, 4, 5].map((face) => (
        <meshStandardMaterial
          key={face}
          attach={`material-${face}`}
          color={face === 4 ? palette.tile : palette.side}
          emissive={face === 4 ? "#000000" : palette.sideEmissive}
          emissiveIntensity={face === 4 ? 0 : palette.sideEmissiveIntensity}
          roughness={palette.roughness}
          metalness={palette.metalness}
          dithering
        />
      ))}
    </instancedMesh>
  );
};

export const CubeWall: React.FC<CubeWallProps> = ({ palette, seed }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const time = frame / fps;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows="variance"
        flat
        dpr={1}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={[palette.background]} />
        <Camera />
        <Lights palette={palette} />
        {/* Back plate so the hairline seams read as shadowed cracks. */}
        <mesh position={[0, 0, -1.2]} receiveShadow>
          <planeGeometry args={[COLS + 4, ROWS + 4]} />
          <meshStandardMaterial color={palette.tile} roughness={1} dithering />
        </mesh>
        <Tiles palette={palette} seed={seed} time={time} />
      </ThreeCanvas>
      {/* Lens-style vignette, as in the reference's darker corners. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: `radial-gradient(ellipse 75% 75% at 50% 58%, transparent 45%, ${palette.vignetteColor} 140%)`,
          opacity: palette.vignette,
        }}
      />
    </AbsoluteFill>
  );
};
