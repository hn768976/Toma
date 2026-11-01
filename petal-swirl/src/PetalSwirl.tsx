import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { z } from "zod";
import { buildDiscGeometry, buildHoleGeometry, DEFAULT_SHAPE } from "./discGeometry";
import { PALETTES } from "./palettes";

export const petalSwirlSchema = z.object({
  palette: z.enum(["pearl", "blush"]),
});

type Props = z.infer<typeof petalSwirlSchema>;

/**
 * Layout traced from the reference frame (768 x 432 px). Each entry is
 * [x px, y px, radius px, height above ground, spin direction, phase].
 */
type DiscSpec = [number, number, number, number, 1 | -1, number];

const FRONT: DiscSpec[] = [
  [562, 275, 178, 4.0, 1, 0.0],
  [238, 0, 150, 3.4, -1, 0.7],
  [268, 222, 182, 2.6, 1, 1.9],
  [740, 40, 152, 2.2, -1, 2.6],
  [482, 15, 138, 1.4, 1, 0.4],
  [778, 332, 150, 1.5, -1, 1.3],
  [55, 170, 168, 1.2, 1, 2.2],
  [160, 430, 138, 1.9, -1, 3.0],
  [430, 482, 130, 0.8, 1, 1.1],
];

// Deterministic pseudo-random filler layer that closes every gap.
const rand = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const BACK: DiscSpec[] = (() => {
  const out: DiscSpec[] = [];
  let k = 0;
  for (let gy = -90; gy <= 540; gy += 125) {
    for (let gx = -110; gx <= 890; gx += 135) {
      const off = (Math.round((gy + 90) / 125) % 2) * 65;
      out.push([
        gx + off + (rand(k) - 0.5) * 50,
        gy + (rand(k + 50) - 0.5) * 40,
        128 + rand(k + 100) * 26,
        0, // height assigned below so overlapping discs never intersect
        rand(k + 200) > 0.5 ? 1 : -1,
        rand(k + 250) * 6.28,
      ]);
      k++;
    }
  }
  // Greedy colouring of the overlap graph onto 8 height levels.
  const LEVELS = 8;
  out.forEach((d, i) => {
    const used = new Set<number>();
    for (let j = 0; j < i; j++) {
      const o = out[j];
      if (Math.hypot(d[0] - o[0], d[1] - o[1]) < d[2] + o[2]) {
        used.add(Math.round((o[3] + 3.6) / 0.5));
      }
    }
    let level = Math.floor(rand(i + 300) * LEVELS);
    for (let t = 0; t < LEVELS && used.has(level); t++) {
      level = (level + 1) % LEVELS;
    }
    d[3] = -3.6 + level * 0.5;
  });
  return out;
})();

const CAM_Z = 30;
const VIEW_H = 9; // world units visible at ground level
const PX = 432 / VIEW_H;
const LOOP_FLUTES = 3; // flute periods travelled per loop -> seamless loop

const Disc: React.FC<{
  spec: DiscSpec;
  geometry: THREE.BufferGeometry;
  hole: THREE.BufferGeometry;
  material: THREE.Material;
  holeMaterial: THREE.Material;
  progress: number;
}> = ({ spec, geometry, hole, material, holeMaterial, progress }) => {
  const [px, py, rpx, h, dir, phase] = spec;
  const persp = (CAM_Z - h) / CAM_Z; // keep traced screen size at height h
  const x = ((px - 384) / PX) * persp;
  const y = (-(py - 216) / PX) * persp;
  const r = (rpx / PX) * persp;
  const rot =
    phase + dir * ((Math.PI * 2) / DEFAULT_SHAPE.flutes) * LOOP_FLUTES * progress;
  return (
    <group position={[x, y, h]} rotation={[0, 0, rot]} scale={[r, r, r]}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <mesh
        geometry={hole}
        material={holeMaterial}
        position={[0, 0, -0.045]}
      />
    </group>
  );
};

const Lights: React.FC<{ palette: Props["palette"] }> = ({ palette }) => {
  const p = PALETTES[palette];
  const key = useMemo(() => {
    const l = new THREE.DirectionalLight(p.key, p.keyIntensity);
    l.position.set(-7, 9, 14);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -13;
    c.right = 13;
    c.top = 9;
    c.bottom = -9;
    c.near = 1;
    c.far = 50;
    l.shadow.radius = 14;
    l.shadow.blurSamples = 20;
    l.shadow.bias = -0.0008;
    l.shadow.normalBias = 0.02;
    return l;
  }, [p.key, p.keyIntensity]);
  return (
    <>
      <hemisphereLight args={[p.sky, p.ground, p.hemiIntensity]} />
      <primitive object={key} />
      <directionalLight
        color={p.fill}
        intensity={p.fillIntensity}
        position={[8, -7, 6]}
      />
    </>
  );
};

export const PetalSwirl: React.FC<Props> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const p = PALETTES[palette];
  const progress = frame / durationInFrames;

  const geometry = useMemo(() => buildDiscGeometry(), []);
  const hole = useMemo(() => buildHoleGeometry(), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: p.disc,
        roughness: 0.52,
        metalness: 0,
        vertexColors: true,
        side: THREE.DoubleSide,
      }),
    [p.disc],
  );
  const holeMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: p.hole, roughness: 0.8 }),
    [p.hole],
  );

  const fov = (2 * Math.atan(VIEW_H / 2 / CAM_Z) * 180) / Math.PI;

  return (
    <AbsoluteFill style={{ backgroundColor: p.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows="variance"
        // Render at the device pixel ratio so `--scale=0.5` of the 4K
        // composition renders natively at 1920x1080.
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio || 1}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [0, 0, CAM_Z], fov, near: 1, far: 100 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping;
          gl.toneMappingExposure = p.exposure;
        }}
      >
        <color attach="background" args={[p.background]} />
        <Lights palette={palette} />
        {/* Ground plane catches the deepest shadows */}
        <mesh position={[0, 0, -4.5]} receiveShadow>
          <planeGeometry args={[40, 30]} />
          <meshStandardMaterial color={p.background} roughness={1} />
        </mesh>
        {[...BACK, ...FRONT].map((spec, i) => (
          <Disc
            key={i}
            spec={spec}
            geometry={geometry}
            hole={hole}
            material={material}
            holeMaterial={holeMaterial}
            progress={progress}
          />
        ))}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
