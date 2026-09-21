import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { KernelSize } from "postprocessing";
import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  DoubleSide,
  UnsignedByteType,
  NoToneMapping,
  SRGBColorSpace,
  ShaderMaterial,
  Vector3,
} from "three";
import { buildBladeGeometry } from "./blade-geometry";
import { BLADE_HEIGHT, CAMERA_Z, FOV_DEG, LOOP_FRAMES, VIEW_W } from "./constants";
import { GradeEffect } from "./GradeEffect";
import { buildEnvLut } from "./gradient";
import {
  backdropFragmentShader,
  backdropVertexShader,
  bladeFragmentShader,
  bladeVertexShader,
} from "./shaders/blade";
import type { BladeArrayConfig } from "./types";

/** Seeded once, at module level. The per-blade width variation is drawn from it. */
const SEED = 0x5eed1a7e;

const DEG = Math.PI / 180;

const Blades: React.FC<{ cfg: BladeArrayConfig }> = ({ cfg }) => {
  const frame = useCurrentFrame();
  // Everything periodic runs off frame % LOOP_FRAMES, so frame 600 == frame 0.
  const f = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  const t = f / LOOP_FRAMES;

  const geometry = useMemo(() => buildBladeGeometry(cfg, SEED), [cfg]);
  const lut = useMemo(
    () => buildEnvLut(cfg.id, cfg.stops, cfg.specBlur, cfg.diffBlur),
    [cfg],
  );

  const material = useMemo(() => {
    const band = cfg.band;
    return new ShaderMaterial({
      vertexShader: bladeVertexShader,
      fragmentShader: bladeFragmentShader,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uHeight: { value: BLADE_HEIGHT },
        uTwistAmp: { value: cfg.twistAmpDeg * DEG },
        uTwistC: { value: cfg.twistC },
        uTwistK: { value: cfg.twistK },
        uTwistF: { value: cfg.twistF },
        uTwistW: { value: cfg.twistW },
        uBowAmp: { value: cfg.bowAmp * VIEW_W },
        uBowWidth: { value: cfg.bowWidth },
        uBowCount: { value: cfg.bowCenters.length },
        uBowC0: { value: cfg.bowCenters[0] ?? 0.5 },
        uBowC1: { value: cfg.bowCenters[1] ?? 0.5 },
        uLut: { value: lut.texture },
        uLutMax: { value: lut.max },
        uAzimZoom: { value: cfg.azimZoom },
        uParallax: { value: cfg.parallax },
        uWallRadius: { value: cfg.wallRadius },
        uBaseColor: { value: new Vector3(0.949, 0.949, 0.957) }, // #f2f2f4
        uSpecGain: { value: cfg.specGain },
        uDiffGain: { value: cfg.diffGain },
        uKeyInt: { value: cfg.keyIntensity },
        uKeyDir: { value: new Vector3(0.55, 0.18, 0.82).normalize() },
        uAmbient: { value: cfg.ambient },
        uExposure: { value: cfg.exposure },
        uGrainFrame: { value: 0 },
        uF0: { value: 0.78 },
        uElevLo: { value: cfg.elevLo },
        uElevHi: { value: cfg.elevHi },
        uElevTilt: { value: cfg.elevTilt },
        uElevFreq: { value: cfg.elevFreq },
        uElevSym: { value: cfg.elevSym },
        uShadeMix: { value: cfg.shadeMix },
        uShadePow: { value: cfg.shadePow },
        uFillSharp: { value: cfg.fillSharp },
        uBandHalf: { value: band ? band.half : 0 },
        uBandSoft: { value: band ? band.soft : 1 },
        uBandAmp: { value: band ? band.amp : 0 },
        uBandFreq: { value: band ? band.freq : 1 },
        uBandZoom: { value: band ? band.zoom : 1 },
        uBandElev: { value: band ? band.elev : 1 },
      },
    });
  }, [cfg, lut]);

  // Pure functions of the frame. Nothing here is advanced from a previous value.
  material.uniforms.uTime.value = t;
  material.uniforms.uScroll.value = cfg.scrollN * t;
  material.uniforms.uGrainFrame.value = f;

  const backdrop = useMemo(() => {
    if (cfg.backdrop <= 0) return null;
    return new ShaderMaterial({
      vertexShader: backdropVertexShader,
      fragmentShader: backdropFragmentShader,
      uniforms: {
        uLut: { value: lut.texture },
        uLutMax: { value: lut.max },
        uScroll: { value: 0 },
        uAzimZoom: { value: cfg.azimZoom },
        uWallRadius: { value: cfg.wallRadius },
        uGain: { value: cfg.backdrop },
        uExposure: { value: cfg.exposure },
        uElevLo: { value: cfg.elevLo },
        uElevHi: { value: cfg.elevHi },
        uElevSym: { value: cfg.elevSym },
      },
    });
  }, [cfg, lut]);
  if (backdrop) backdrop.uniforms.uScroll.value = cfg.scrollN * t;

  return (
    <>
      {backdrop ? (
        <mesh position={[0, 0, -0.9]} material={backdrop} frustumCulled={false}>
          <planeGeometry args={[VIEW_W * 2.2, BLADE_HEIGHT * 1.6]} />
        </mesh>
      ) : null}
      <mesh geometry={geometry} material={material} frustumCulled={false} />
    </>
  );
};

const Grade: React.FC<{ grain: number; grainFloor: number; frame: number }> = ({
  grain,
  grainFloor,
  frame,
}) => {
  const effect = useMemo(() => new GradeEffect(grain, grainFloor), [grain, grainFloor]);
  effect.setFrame(frame);
  return <primitive object={effect} dispose={null} />;
};

const Post: React.FC<{ cfg: BladeArrayConfig }> = ({ cfg }) => {
  const frame = useCurrentFrame();
  const f = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  return (
    <EffectComposer frameBufferType={UnsignedByteType} multisampling={0} enableNormalPass={false}>
      {/* Kawase blur at a fifth of the frame height. Mipmap bloom looks a
          touch nicer but costs about as much as the whole rest of the frame
          in software rasterisation, and this batch is meant to be cheap. */}
      <Bloom
        intensity={cfg.bloomIntensity}
        luminanceThreshold={cfg.bloomThreshold}
        luminanceSmoothing={0.12}
        kernelSize={KernelSize.LARGE}
        resolutionY={216}
      />
      <Grade grain={cfg.grain} grainFloor={cfg.grainFloor} frame={f} />
    </EffectComposer>
  );
};

export const BladeArray: React.FC<{ cfg: BladeArrayConfig }> = ({ cfg }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        linear
        flat
        dpr={1}
        gl={{ antialias: false, alpha: false, stencil: false, depth: true }}
        camera={{ fov: FOV_DEG, position: [0, 0, CAMERA_Z], near: 0.1, far: 60 }}
        onCreated={({ gl }) => {
          gl.toneMapping = NoToneMapping;
          gl.outputColorSpace = SRGBColorSpace;
          gl.shadowMap.enabled = false; // thin, evenly spaced blades: shadows buy nothing
        }}
      >
        <color attach="background" args={["#000000"]} />
        <Blades cfg={cfg} />
        <Post cfg={cfg} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
