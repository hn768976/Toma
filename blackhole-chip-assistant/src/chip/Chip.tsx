import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { DepthOfFieldEffect } from "postprocessing";
import React, { useMemo } from "react";
import { AbsoluteFill, getInputProps, useCurrentFrame, useVideoConfig } from "remotion";
const HIDE: string[] = (getInputProps() as {hide?: string[]}).hide ?? [];
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  FloatType,
  FrontSide,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LOOP_FRAMES } from "../common/constants";
import { Post, usePostEffects } from "../common/Post";
import { cosLoop, loopPhase, sinLoop } from "../common/time";
import { CHIP_PALETTES } from "../palettes";
import { ATLAS_H, ATLAS_W, CELL_DATA, CHIP, FILAMENTS, RibbonBuffers, SPARKS, TRACES } from "./layout";
import {
  boardFragment,
  boardVertex,
  filamentFragment,
  innerFragment,
  ribbonVertex,
  shellFragment,
  shellVertex,
  sparkFragment,
  sparkVertex,
  traceFragment,
} from "./shaders";

export type ChipProps = {
  palette: keyof typeof CHIP_PALETTES;
  /** false only for the loop test (see src/common/time.ts) */
  wrap?: boolean;
};

const v3 = (c: [number, number, number]) => new Vector3(c[0], c[1], c[2]);

/* The cell schedule as a texture. Generated in memory at module load (no
 * file to fetch), so it exists before the first frame renders. */
const CELL_TEXTURE = (() => {
  const t = new DataTexture(CELL_DATA, ATLAS_W, ATLAS_H, RGBAFormat, FloatType);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

const ribbonGeometry = (b: RibbonBuffers) => {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(b.position, 3));
  g.setAttribute("aDist", new BufferAttribute(b.dist, 1));
  g.setAttribute("aTotal", new BufferAttribute(b.total, 1));
  g.setAttribute("aSide", new BufferAttribute(b.side, 1));
  g.setAttribute("aSeed", new BufferAttribute(b.seed, 1));
  g.setAttribute("aPulse", new BufferAttribute(b.pulse, 4));
  g.setIndex(new BufferAttribute(b.index, 1));
  return g;
};

/* Camera: a slow glide along the chip on a closed path (never orbits). */
const FOV = 30;
function placeCamera(cam: PerspectiveCamera, phase: number) {
  const s = sinLoop(phase);
  const c = cosLoop(phase);
  const s2 = sinLoop(phase, 2);
  cam.position.set(-1.4 + 1.9 * s, 3.3 + 0.12 * s2, 6.4 + 0.35 * c);
  cam.up.set(0, 1, 0);
  cam.lookAt(-0.2 + 1.6 * s, 0.5, 0.6);
  cam.fov = FOV;
  cam.aspect = 16 / 9;
  cam.near = 0.1;
  cam.far = 200;
  cam.clearViewOffset();
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  // the sharp band: a line across the top face near its front edge
  const focus = new Vector3(-0.2 + 1.6 * s, CHIP.h, 1.1);
  return cam.position.distanceTo(focus);
}

const Scene: React.FC<ChipProps> = ({ palette, wrap = true }) => {
  const frame = useCurrentFrame();
  const pal = CHIP_PALETTES[palette];
  const { camera, size, viewport } = useThree();
  const phase = loopPhase(frame, wrap);
  const focusDist = placeCamera(camera as PerspectiveCamera, phase);
  const px = (size.height * viewport.dpr) / 1080; // 1080p pixel -> buffer pixel

  const shellGeom = useMemo(() => {
    const g = new RoundedBoxGeometry(CHIP.w, CHIP.h, CHIP.d, 4, CHIP.radius);
    g.translate(0, CHIP.h / 2, 0);
    return g;
  }, []);
  const innerGeom = useMemo(() => {
    const g = new RoundedBoxGeometry(CHIP.w * 0.96, CHIP.h * 0.88, CHIP.d * 0.94, 2, CHIP.radius);
    g.translate(0, (CHIP.h * 0.88) / 2 + 0.02, 0);
    return g;
  }, []);

  const mats = useMemo(() => {
    const shellUniforms = (gain: number) => ({
      uCells: { value: CELL_TEXTURE },
      uFrame: { value: 0 },
      uGain: { value: gain },
      uMirror: { value: 1 },
      cDim: { value: v3(pal.cellDim) },
      cLine: { value: v3(pal.cellLine) },
      cLit: { value: v3(pal.cellLit) },
      cEdge: { value: v3(pal.edge) },
    });
    const shell = new ShaderMaterial({
      vertexShader: shellVertex,
      fragmentShader: shellFragment,
      uniforms: shellUniforms(1),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: FrontSide,
    });
    // reflection in the glossy board: same shell, mirrored, dimmer
    const mirror = new ShaderMaterial({
      vertexShader: shellVertex,
      fragmentShader: shellFragment,
      uniforms: shellUniforms(0.07),
      defines: { MIRROR: 1 },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: BackSide,
    });
    // opaque dark body (gives the depth for the depth of field and hides
    // the board reflection behind the chip)
    const core = new ShaderMaterial({
      vertexShader: shellVertex,
      fragmentShader: `uniform vec3 cBase; void main() { gl_FragColor = vec4(cBase, 1.0); }`,
      uniforms: { cBase: { value: v3(pal.board).multiplyScalar(1.5) } },
    });
    // fainter grid layer slightly inside the block: the layered-glass look
    const inner = new ShaderMaterial({
      vertexShader: shellVertex,
      fragmentShader: innerFragment,
      uniforms: {
        cGrid: { value: v3(pal.innerGrid) },
        cBase: { value: new Vector3(0, 0, 0) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    const trace = new ShaderMaterial({
      vertexShader: ribbonVertex,
      fragmentShader: traceFragment,
      uniforms: {
        uPhase: { value: 0 },
        uGain: { value: 1 },
        uMirror: { value: 1 },
        cTrace: { value: v3(pal.trace) },
        cPulse: { value: v3(pal.pulse) },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: 2,
    });
    const filament = new ShaderMaterial({
      vertexShader: ribbonVertex,
      fragmentShader: filamentFragment,
      uniforms: {
        uFrame: { value: 0 },
        uGain: { value: 1 },
        uMirror: { value: 1 },
        cSpark: { value: v3(pal.spark) },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: 2,
    });
    const spark = new ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      uniforms: { uFrame: { value: 0 }, uPx: { value: 1 }, cSpark: { value: v3(pal.spark) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const board = new ShaderMaterial({
      vertexShader: boardVertex,
      fragmentShader: boardFragment,
      uniforms: {
        cBoard: { value: v3(pal.board) },
        cGlow: { value: v3(pal.boardGlow) },
        cGrid: { value: v3(pal.trace) },
      },
    });
    return { shell, mirror, core, inner, trace, filament, spark, board };
  }, [pal]);

  // schedules (cell twinkle, filaments, sparks) are looked up by frame % 600
  const sched = frame % LOOP_FRAMES;
  mats.shell.uniforms.uFrame.value = sched;
  mats.mirror.uniforms.uFrame.value = sched;
  mats.trace.uniforms.uPhase.value = phase;
  mats.filament.uniforms.uFrame.value = sched;
  mats.spark.uniforms.uFrame.value = sched;
  mats.spark.uniforms.uPx.value = px;

  const traceGeom = useMemo(() => ribbonGeometry(TRACES), []);
  const filamentGeom = useMemo(() => ribbonGeometry(FILAMENTS), []);
  const sparkGeom = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(SPARKS.pos, 3));
    g.setAttribute("aSched", new BufferAttribute(SPARKS.sched, 4));
    return g;
  }, []);
  const boardGeom = useMemo(() => new PlaneGeometry(80, 80, 1, 1), []);
  const bg = useMemo(() => new Color(pal.background[0], pal.background[1], pal.background[2]), [pal]);

  const fx = usePostEffects({ bloomThreshold: 1.1, bloomIntensity: 0.55, bloomRadius: 0.5, grain: 0.018 });
  fx.grain.setFrame(frame);
  const dof = useMemo(
    () => new DepthOfFieldEffect(camera, { focusDistance: 6, focusRange: 1.0, bokehScale: 6, resolutionScale: 0.35 }),
    [camera],
  );
  dof.cocMaterial.focusDistance = focusDist;
  dof.cocMaterial.focusRange = 0.75;
  dof.bokehScale = 5.5 * px * (0.35 / 0.5);
  const pre = useMemo(() => (HIDE.includes("dof") ? [] : [dof]), [dof]);

  return (
    <>
      <primitive attach="background" object={bg} />
      <mesh geometry={boardGeom} material={mats.board} visible={!HIDE.includes("board")} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0} />
      <mesh geometry={shellGeom} material={mats.mirror} visible={!HIDE.includes("mirror")} scale={[1, -1, 1]} renderOrder={1} />
      <mesh geometry={shellGeom} material={mats.core} visible={!HIDE.includes("core")} scale={0.996} renderOrder={2} />
      <mesh geometry={innerGeom} material={mats.inner} visible={!HIDE.includes("inner")} renderOrder={2.5} />
      <mesh geometry={shellGeom} material={mats.shell} visible={!HIDE.includes("shell")} renderOrder={3} />
      <mesh geometry={traceGeom} material={mats.trace} visible={!HIDE.includes("trace")} renderOrder={4} frustumCulled={false} />
      <mesh geometry={filamentGeom} material={mats.filament} visible={!HIDE.includes("filament")} renderOrder={5} frustumCulled={false} />
      <points geometry={sparkGeom} material={mats.spark} visible={!HIDE.includes("spark")} renderOrder={6} frustumCulled={false} />
      <Post multisampling={2} pre={pre} bloom={fx.bloom} tone={fx.tone} grain={fx.grain} />
    </>
  );
};

export const ProcessorChip: React.FC<ChipProps> = (props) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas width={width} height={height} flat gl={{ antialias: false, alpha: false }}>
        <Scene {...props} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
