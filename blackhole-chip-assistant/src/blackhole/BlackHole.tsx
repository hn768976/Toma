import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, getInputProps, useCurrentFrame, useVideoConfig } from "remotion";

/** Debug switch-off list (verify/loopcheck.sh, determinism bisecting): any of
 * "stars", "disc", "jet", "core", "bloom", "grain". Normal renders pass none. */
const HIDE: string[] = (getInputProps() as { hide?: string[] }).hide ?? [];
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  PerspectiveCamera,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from "three";
import { TAU } from "../common/glsl";
import { Post, usePostEffects } from "../common/Post";
import { mulberry32 } from "../common/random";
import { cosLoop, cyc, loopPhase, sinLoop, timeCircle } from "../common/time";
import { BLACK_HOLE_PALETTES, BlackHolePalette } from "../palettes";
import {
  discFragment,
  discVertex,
  jetFragment,
  jetVertex,
  spriteFragment,
  spriteVertex,
  starFragment,
  starVertex,
} from "./shaders";

export type BlackHoleProps = {
  palette: keyof typeof BLACK_HOLE_PALETTES;
  /** false only for the loop test (see src/common/time.ts) */
  wrap?: boolean;
};

/* Whole numbers of cycles per 600-frame loop. */
const DISC_TURNS = 1;
const JET_SCROLL = [3, 4, 5]; // repeats scrolled up the jet, per beam

const DISC_RADIUS = 14;
const CAM_DIST = 18;
const CAM_ELEVATION = (25 * Math.PI) / 180; // disc seen 65 deg from face-on
const CAM_AZIMUTH = 0.35;
const FOV = 40;
/** where the core sits in frame (fraction of width / height from top-left) */
const CORE_SCREEN = { x: 0.46, y: 0.57 };

/* Stars: generated once from a fixed seed. */
const STARS = (() => {
  const rand = mulberry32(0xb1ac4);
  const n = 1100;
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const bright = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // directions spread over the half of the sky behind the disc
    const u = rand() * 2 - 1;
    const a = rand() * TAU;
    const s = Math.sqrt(1 - u * u);
    const R = 320;
    pos[i * 3] = Math.cos(a) * s * R;
    pos[i * 3 + 1] = u * R;
    pos[i * 3 + 2] = Math.sin(a) * s * R;
    const b = Math.pow(rand(), 5);
    size[i] = 1.6 + b * 3.2;
    bright[i] = 0.02 + b * 0.5;
  }
  return { pos, size, bright };
})();

const baseCamera = () => {
  const cam = new PerspectiveCamera(FOV, 16 / 9, 0.1, 1000);
  placeCamera(cam, 0);
  return cam;
};

function placeCamera(cam: PerspectiveCamera, phase: number) {
  // closed path: every term is a whole number of cycles per loop
  const az = CAM_AZIMUTH + 0.06 * sinLoop(phase);
  const el = CAM_ELEVATION + 0.012 * sinLoop(phase, 2, 0.7 / TAU);
  const d = CAM_DIST + 0.45 * cosLoop(phase);
  cam.position.set(
    d * Math.cos(el) * Math.sin(az),
    d * Math.sin(el),
    d * Math.cos(el) * Math.cos(az),
  );
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);
  cam.fov = FOV;
  cam.aspect = 16 / 9;
  // shift the frame so the core sits off-centre without re-aiming the camera
  const W = 1600;
  const H = 900;
  cam.setViewOffset(W, H, (0.5 - CORE_SCREEN.x) * W, (0.5 - CORE_SCREEN.y) * H, W, H);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
}

const v3 = (c: [number, number, number]) => new Vector3(c[0], c[1], c[2]);

const useDiscMaterial = (pal: BlackHolePalette, seed: number, gain: number, coreGain: number, lite: boolean) =>
  useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: discVertex,
        fragmentShader: discFragment,
        defines: lite ? { LITE: 1 } : {},
        uniforms: {
          uRot: { value: 0 },
          uLoop: { value: [0, 0] },
          uPhase: { value: 0 },
          uSeed: { value: seed },
          uGain: { value: gain },
          uCoreGain: { value: coreGain },
          cCore: { value: v3(pal.core) },
          cInner: { value: v3(pal.inner) },
          cMid: { value: v3(pal.mid) },
          cOuter: { value: v3(pal.outer) },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [pal, seed, gain, coreGain, lite],
  );

type Beam = {
  w0: number;
  spread: number;
  gain: number;
  flare: number;
  height: number;
  dir: 1 | -1;
  rep: number;
  scroll: number;
  seed: number;
};

const BEAMS: Beam[] = [
  // bright narrow core of the jet
  { w0: 0.26, spread: 0.014, gain: 1.3, flare: 4.0, height: 50, dir: 1, rep: 7, scroll: JET_SCROLL[1], seed: 1.3 },
  // main beam
  { w0: 0.75, spread: 0.04, gain: 0.6, flare: 1.0, height: 50, dir: 1, rep: 9, scroll: JET_SCROLL[0], seed: 4.1 },
  // wide soft column
  { w0: 1.4, spread: 0.06, gain: 0.12, flare: 0.0, height: 50, dir: 1, rep: 12, scroll: JET_SCROLL[0], seed: 7.7 },
  // much fainter counter-jet going down
  { w0: 0.3, spread: 0.016, gain: 0.14, flare: 0.25, height: 20, dir: -1, rep: 7, scroll: JET_SCROLL[2], seed: 9.2 },
  { w0: 0.6, spread: 0.04, gain: 0.12, flare: 0.0, height: 20, dir: -1, rep: 9, scroll: JET_SCROLL[1], seed: 2.6 },
];

const JetBeam: React.FC<{ beam: Beam; color: Vector3; phase: number }> = ({ beam, color, phase }) => {
  const geom = useMemo(() => new PlaneGeometry(1, 1, 1, 64), []);
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: jetVertex,
        fragmentShader: jetFragment,
        uniforms: {
          uPhase: { value: 0 },
          uHeight: { value: beam.height },
          uDir: { value: beam.dir },
          uW0: { value: beam.w0 },
          uSpread: { value: beam.spread },
          uGain: { value: beam.gain },
          uFlare: { value: beam.flare },
          uScroll: { value: beam.scroll },
          uRep: { value: beam.rep },
          uSeed: { value: beam.seed },
          uColor: { value: color },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [beam, color],
  );
  mat.uniforms.uPhase.value = phase;
  return <mesh geometry={geom} material={mat} frustumCulled={false} renderOrder={2} visible={!HIDE.includes("jet")} />;
};

const Scene: React.FC<BlackHoleProps> = ({ palette, wrap = true }) => {
  const frame = useCurrentFrame();
  const pal = BLACK_HOLE_PALETTES[palette];
  const { camera, size, viewport } = useThree();
  const phase = loopPhase(frame, wrap);
  const loop = timeCircle(phase, 0.9);

  placeCamera(camera as PerspectiveCamera, phase);

  const discs = [
    useDiscMaterial(pal, 0.0, 1.0, 1.0, false),
    useDiscMaterial(pal, 3.7, 0.42, 0.0, true),
    useDiscMaterial(pal, 8.3, 0.42, 0.0, true),
  ];
  for (const m of discs) {
    m.uniforms.uRot.value = TAU * cyc(DISC_TURNS * phase);
    m.uniforms.uLoop.value = loop;
    m.uniforms.uPhase.value = phase;
  }
  const discGeom = useMemo(() => new PlaneGeometry(DISC_RADIUS * 2, DISC_RADIUS * 2, 1, 1), []);

  const jetColor = useMemo(() => v3(pal.jet), [pal]);

  const sprite = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: spriteVertex,
        fragmentShader: spriteFragment,
        uniforms: {
          uColor: { value: v3(pal.core) },
          uHaloColor: { value: v3(pal.mid) },
          uCore: { value: 1.0 },
          uHalo: { value: 0.12 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      }),
    [pal],
  );

  const starGeom = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(STARS.pos, 3));
    g.setAttribute("aSize", new BufferAttribute(STARS.size, 1));
    g.setAttribute("aBright", new BufferAttribute(STARS.bright, 1));
    return g;
  }, []);
  const starMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: starVertex,
        fragmentShader: starFragment,
        uniforms: { uPx: { value: 1 }, uColor: { value: v3(pal.star) } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [pal],
  );
  // point sizes are set in 1080p pixels and scaled to the real buffer height
  starMat.uniforms.uPx.value = (size.height * viewport.dpr) / 1080;

  // the one brighter star, top-left: fixed direction from the base camera
  const brightStar = useMemo(() => {
    const cam = baseCamera();
    const p = new Vector3(-0.8, 0.78, 0.5).unproject(cam);
    const dir = p.sub(cam.position).normalize();
    const pos = cam.position.clone().add(dir.multiplyScalar(300));
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array([pos.x, pos.y, pos.z]), 3));
    g.setAttribute("aSize", new BufferAttribute(new Float32Array([16]), 1));
    g.setAttribute("aBright", new BufferAttribute(new Float32Array([2.6]), 1));
    return g;
  }, []);

  const bg = useMemo(() => new Color(pal.space[0], pal.space[1], pal.space[2]), [pal]);

  const fx = usePostEffects({ bloomThreshold: 0.9, bloomIntensity: 1.1, bloomRadius: 0.78, grain: 0.02 });
  fx.grain.setFrame(frame);

  return (
    <>
      <primitive attach="background" object={bg} />
      <points geometry={starGeom} material={starMat} frustumCulled={false} renderOrder={0} visible={!HIDE.includes("stars")} />
      <points geometry={brightStar} material={starMat} frustumCulled={false} renderOrder={0} visible={!HIDE.includes("stars")} />
      {discs.map((m, i) => (
        <mesh
          key={i}
          geometry={discGeom}
          material={m}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, (i === 0 ? 0 : i === 1 ? 1 : -1) * 0.13, 0]}
          renderOrder={1}
          visible={!HIDE.includes("disc")}
        />
      ))}
      {BEAMS.map((b, i) => (
        <JetBeam key={i} beam={b} color={jetColor} phase={phase} />
      ))}
      <mesh
        material={sprite}
        // a fresh copy every frame: R3F only applies a prop whose value changed,
        // and camera.quaternion is the same object every frame — passing it
        // directly froze the sprite at the first frame each tab rendered
        quaternion={camera.quaternion.clone()}
        renderOrder={3}
        frustumCulled={false}
        visible={!HIDE.includes("core")}
      >
        <planeGeometry args={[18, 18]} />
      </mesh>
      <Post
        multisampling={0}
        bloom={HIDE.includes("bloom") ? null : fx.bloom}
        tone={fx.tone}
        grain={HIDE.includes("grain") ? null : fx.grain}
      />
    </>
  );
};

export const BlackHole: React.FC<BlackHoleProps> = (props) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        flat
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      >
        <Scene {...props} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
