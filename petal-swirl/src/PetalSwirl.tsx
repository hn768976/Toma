import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo } from "react";
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
 * [x px, y px, radius px, height above ground, (unused), orientation].
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
// The reference undulates in place with a 90-frame period (3 cycles per
// 270-frame clip), so the loop is seamless.
const SWAY_CYCLES = 3;
// All discs sway in unison, as in the reference.
const SWAY_VARIANTS = 1;
// Tint multipliers from the deepest layer to the top layer.
const DEPTH_TINTS = ["#b2b4c0", "#c8cad4", "#dddee5", "#f0f0f3", "#ffffff"];
const depthBucket = (h: number) =>
  Math.max(0, Math.min(DEPTH_TINTS.length - 1, Math.floor(((h + 3.6) / 6.5) * DEPTH_TINTS.length)));

const Disc: React.FC<{
  spec: DiscSpec;
  geometry: THREE.BufferGeometry;
  hole: THREE.BufferGeometry;
  material: THREE.Material;
  holeMaterial: THREE.Material;
}> = ({ spec, geometry, hole, material, holeMaterial }) => {
  const [px, py, rpx, h, , phase] = spec;
  const persp = (CAM_Z - h) / CAM_Z; // keep traced screen size at height h
  const x = ((px - 384) / PX) * persp;
  const y = (-(py - 216) / PX) * persp;
  const r = (rpx / PX) * persp;
  // Static orientation: the reference discs do not rotate, they sway in place.
  const rot = phase;
  return (
    <group position={[x, y, h]} rotation={[0, 0, rot]} scale={[r, r, r]}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <mesh
        geometry={hole}
        material={holeMaterial}
        position={[0, 0, -0.02]}
      />
    </group>
  );
};

const Lights: React.FC<{ palette: Props["palette"] }> = ({ palette }) => {
  const p = PALETTES[palette];
  const key = useMemo(() => {
    const l = new THREE.DirectionalLight(p.key, p.keyIntensity);
    l.position.set(-9, 11, 10.5);
    l.castShadow = true;
    l.shadow.mapSize.set(3072, 3072);
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -13;
    c.right = 13;
    c.top = 9;
    c.bottom = -9;
    c.near = 1;
    c.far = 50;
    l.shadow.radius = 34;
    l.shadow.blurSamples = 32;
    l.shadow.bias = -0.002;
    l.shadow.normalBias = 0.05;
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

  const sway = progress * SWAY_CYCLES * Math.PI * 2;
  const geometries = useMemo(
    () =>
      Array.from({ length: SWAY_VARIANTS }, (_, k) =>
        buildDiscGeometry(DEFAULT_SHAPE, sway + (k * Math.PI * 2) / SWAY_VARIANTS),
      ),
    [sway],
  );
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  const hole = useMemo(() => buildHoleGeometry(), []);
  // Satin, slightly pearlescent finish like the reference. Deeper discs get
  // a slightly darker, cooler tint (as in the reference, where the lower
  // layers read grey-lavender), bucketed into a few shared materials.
  const materials = useMemo(
    () =>
      DEPTH_TINTS.map((t) => new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(p.disc).multiply(new THREE.Color(t)),
        roughness: 0.42,
        metalness: 0,
        clearcoat: 0.45,
        clearcoatRoughness: 0.35,
        sheen: 0.6,
        sheenColor: new THREE.Color(p.sheen),
        vertexColors: true,
        side: THREE.DoubleSide,
      })),
    [p.disc, p.sheen],
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
            geometry={geometries[i % SWAY_VARIANTS]}
            hole={hole}
            material={materials[depthBucket(spec[3])]}
            holeMaterial={holeMaterial}
          />
        ))}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
