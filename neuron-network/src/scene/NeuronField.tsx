/**
 * The one component every composition uses.
 *
 * The branching generator, tube builder, pulse system, camera rig and post
 * chain are fixed here; palette, density, branch parameters, pulse style,
 * background and blur all arrive in the `look` row. Adding a look requires
 * no change to this file.
 *
 * Everything on screen is a pure function of `useCurrentFrame()`. There is no
 * `useFrame` clock, no `Date.now()`, no delta accumulation and no mutable
 * state carried between frames.
 */

import { Bloom, DepthOfField, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { ToneMappingMode } from "postprocessing";
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  AdditiveBlending,
  Color,
  HalfFloatType,
  NoToneMapping,
  Vector2,
  Vector3,
} from "three";
import { getField } from "../core/field";
import { DURATION_IN_FRAMES as LOOP_FRAMES } from "../looks/looks";
import type { Look } from "../looks/types";
import { BG_FRAGMENT, BG_VERTEX } from "../shaders/background";
import {
  PARTICLE_FRAGMENT,
  PARTICLE_VERTEX,
  SPARK_FRAGMENT,
  SPARK_VERTEX,
} from "../shaders/points";
import { SOMA_FRAGMENT, SOMA_VERTEX } from "../shaders/soma";
import { TUBE_FRAGMENT, TUBE_VERTEX } from "../shaders/tube";
import { GrainEffect } from "./GrainEffect";

/**
 * Loop position, 0..1.
 *
 * The period is the project constant, NOT `useVideoConfig().durationInFrames`.
 * They are the same number in normal use, but the loop-closure check renders
 * frame 600 from a composition temporarily extended to 601 frames -- if the
 * period came from the composition it would change to 601 under the test and
 * frame 600 would no longer land on zero.
 */
const loopT = (frame: number) => (frame % LOOP_FRAMES) / LOOP_FRAMES;

const useLoopT = () => loopT(useCurrentFrame());

/**
 * The camera moves on a closed path. It is not flown forward through the
 * network: a forward fly-through cannot loop without a visible wrap, and a
 * spatially periodic dendrite field costs far more than it is worth.
 *
 * Amplitudes give parallax, not travel -- near and far neurons shift against
 * each other without the composition changing. No roll at all.
 */
const CameraRig: React.FC<{ look: Look }> = ({ look }) => {
  const t = useLoopT();
  const camera = useThree((s) => s.camera);
  const { fov, position, target, amplitude, frequency, phase } = look.camera;

  const tau = Math.PI * 2;
  camera.position.set(
    position[0] + amplitude[0] * Math.sin(tau * (frequency[0] * t + phase[0])),
    position[1] + amplitude[1] * Math.sin(tau * (frequency[1] * t + phase[1])),
    position[2] + amplitude[2] * Math.sin(tau * (frequency[2] * t + phase[2])),
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(target[0], target[1], target[2]);
  if ("fov" in camera && camera.fov !== fov) {
    camera.fov = fov;
  }
  camera.near = look.camera.near;
  camera.far = look.camera.far;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  return null;
};

const Background: React.FC<{ look: Look; heroCenter: Vector3 | null }> = ({
  look,
  heroCenter,
}) => {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const uniforms = useMemo(
    () => ({
      uInner: { value: new Color(look.palette.bgInner) },
      uOuter: { value: new Color(look.palette.bgOuter) },
      uCenter: { value: new Vector2(0.5, 0.5) },
      uLift: { value: look.post.bgLift },
      uGain: { value: look.post.bgGain },
      uAspect: { value: 1 },
      uExposure: { value: look.post.exposure },
    }),
    [look],
  );

  // On a hero look the lift sits behind the dominant neuron; on a network
  // look there is no dominant cell, so it stays centred rather than following
  // whichever neuron happened to be placed first.
  if (heroCenter) {
    const projected = heroCenter.clone().project(camera);
    uniforms.uCenter.value.set(0.5 + projected.x * 0.5, 0.5 + projected.y * 0.5);
  } else {
    uniforms.uCenter.value.set(0.5, 0.5);
  }
  uniforms.uAspect.value = size.width / Math.max(1, size.height);

  return (
    <mesh renderOrder={-1000} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={BG_VERTEX}
        fragmentShader={BG_FRAGMENT}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

const Scene: React.FC<{ look: Look }> = ({ look }) => {
  const t = useLoopT();
  const frame = useCurrentFrame();
  const gl = useThree((s) => s.gl);

  // Built once at module level and cached; never rebuilt per frame.
  const field = useMemo(() => getField(look), [look]);

  // Whole-cell activation, exactly `cellPulseCycles` times over the loop.
  const cellPulse =
    look.pulse.cellPulseCycles > 0
      ? 0.5 + 0.5 * Math.sin(Math.PI * 2 * look.pulse.cellPulseCycles * t)
      : 0;

  const tubeUniforms = useMemo(
    () => ({
      uT: { value: 0 },
      uTube: { value: new Color(look.palette.tube) },
      uRim: { value: new Color(look.palette.rim) },
      uPulseColor: { value: new Color(look.palette.pulse) },
      uNodeColor: { value: new Color(look.palette.node) },
      uAmbient: { value: look.tube.ambient },
      uRimStrength: { value: look.tube.rimStrength },
      uRimPower: { value: look.tube.rimPower },
      uSigma: { value: look.pulse.sigma },
      uHardness: { value: look.pulse.hardness },
      uJunctionFlare: { value: look.pulse.junctionFlare },
      uNodeStrength: { value: look.pulse.nodeStrength },
      uNodeGate: { value: new Vector2(...look.pulse.nodeGate) },
      uFlashCycles: { value: look.pulse.flashCycles },
      uFlashStrength: { value: look.pulse.flashStrength },
      uCellPulse: { value: 0 },
      uCellPulseDepth: { value: look.pulse.cellPulseDepth },
      uTransparent: { value: look.tube.transparent ? 1 : 0 },
      uMinAlpha: { value: look.tube.minAlpha },
      uSomaGlow: { value: new Color(look.palette.somaGlow) },
      uSomaBleed: { value: look.tube.somaBleed },
      uSomaBleedFalloff: { value: look.tube.somaBleedFalloff },
      uExposure: { value: look.post.exposure },
    }),
    [look],
  );

  const somaUniforms = useMemo(
    () => ({
      uT: { value: 0 },
      uCore: { value: new Color(look.palette.somaCore) },
      uGlow: { value: new Color(look.palette.somaGlow) },
      uBrightness: { value: look.emissive.soma },
      uRimStrength: { value: look.emissive.somaRim },
      uCorePower: { value: look.emissive.corePower },
      uGrain: { value: look.soma.displacement * 2.2 },
      uCellPulse: { value: 0 },
      uCellPulseDepth: { value: look.pulse.cellPulseDepth },
      uExposure: { value: look.post.exposure },
    }),
    [look],
  );

  const particleUniforms = useMemo(
    () => ({
      uT: { value: 0 },
      uPixelScale: { value: 1 },
      uColor: { value: new Color(look.palette.particle) },
      uExposure: { value: look.post.exposure },
    }),
    [look],
  );

  const sparkUniforms = useMemo(
    () => ({
      uT: { value: 0 },
      uPixelScale: { value: 1 },
      uCycles: { value: look.sparks.cycles },
      uStrength: { value: look.sparks.strength },
      uColor: { value: new Color(look.palette.node) },
      uExposure: { value: look.post.exposure },
    }),
    [look],
  );

  // Point sizes as a fraction of frame height, so they hold at any scale.
  const buffer = gl.getDrawingBufferSize(new Vector2());
  const pixelScale =
    buffer.y / (2 * Math.tan(((look.camera.fov / 2) * Math.PI) / 180)) / 100;

  // Depth of field is authored in world units and converted here. The
  // effect's own parameters are normalised over the clip range, which makes
  // them meaningless to tune by hand and silently wrong if near/far change.
  const { near, far } = look.camera;
  const span = Math.max(1e-6, far - near);
  const focusDistance = (look.post.focusWorld - near) / span;
  const focalLength = look.post.focusRangeWorld / span;
  // Blur kernels are in texels, so the same bokehScale is half as soft at 4K
  // as at 1080p. Scaling with frame height keeps the preview honest about
  // what the 4K render will look like.
  const bokehScale = look.post.bokehScale * (buffer.y / 1080);

  tubeUniforms.uT.value = t;
  tubeUniforms.uCellPulse.value = cellPulse;
  somaUniforms.uT.value = t;
  somaUniforms.uCellPulse.value = cellPulse;
  particleUniforms.uT.value = t;
  particleUniforms.uPixelScale.value = pixelScale;
  sparkUniforms.uT.value = t;
  sparkUniforms.uPixelScale.value = pixelScale;

  const grain = useMemo(
    () => new GrainEffect(look.post.grain, 0),
    [look.post.grain],
  );
  // Periodic over the loop, so grain at frame 600 matches frame 0.
  grain.frame = frame % LOOP_FRAMES;

  const heroCenter = look.field.hero ? (field.neurons[0]?.center ?? null) : null;

  return (
    <>
      <CameraRig look={look} />
      <Background look={look} heroCenter={heroCenter} />

      <mesh frustumCulled={false}>
        <primitive object={field.tubes} attach="geometry" />
        <shaderMaterial
          vertexShader={TUBE_VERTEX}
          fragmentShader={TUBE_FRAGMENT}
          uniforms={tubeUniforms}
          transparent={look.tube.transparent}
        />
      </mesh>

      <mesh frustumCulled={false}>
        <primitive object={field.somas} attach="geometry" />
        <shaderMaterial
          vertexShader={SOMA_VERTEX}
          fragmentShader={SOMA_FRAGMENT}
          uniforms={somaUniforms}
        />
      </mesh>

      {field.particles ? (
        <points frustumCulled={false}>
          <primitive object={field.particles} attach="geometry" />
          <shaderMaterial
            vertexShader={PARTICLE_VERTEX}
            fragmentShader={PARTICLE_FRAGMENT}
            uniforms={particleUniforms}
            blending={AdditiveBlending}
            transparent
            depthWrite
          />
        </points>
      ) : null}

      {field.sparks ? (
        <points frustumCulled={false}>
          <primitive object={field.sparks} attach="geometry" />
          <shaderMaterial
            vertexShader={SPARK_VERTEX}
            fragmentShader={SPARK_FRAGMENT}
            uniforms={sparkUniforms}
            blending={AdditiveBlending}
            transparent
            depthWrite
          />
        </points>
      ) : null}

      {/*
        Depth of field is a pure spatial shader, so it stays deterministic.
        Bloom runs with a high threshold: if the whole dendrite network glows
        the threshold is too low and the image turns to mush. No TAA, no
        temporal blur, nothing that accumulates across frames.
      */}
      <EffectComposer
        multisampling={look.post.multisampling}
        frameBufferType={HalfFloatType}
        enableNormalPass={false}
      >
        <DepthOfField
          focusDistance={focusDistance}
          focalLength={focalLength}
          bokehScale={bokehScale}
        />
        <Bloom
          intensity={look.post.bloomIntensity}
          luminanceThreshold={look.post.bloomThreshold}
          luminanceSmoothing={look.post.bloomSmoothing}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <primitive object={grain} />
      </EffectComposer>
    </>
  );
};

export const NeuronField: React.FC<{ look: Look }> = ({ look }) => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: look.palette.bgOuter }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: look.camera.fov,
          position: look.camera.position,
          near: look.camera.near,
          far: look.camera.far,
        }}
        gl={{ antialias: false, toneMapping: NoToneMapping }}
        /*
          Remotion's --scale is a browser device-scale factor. r3f would
          otherwise clamp dpr to at least 1 and allocate a full 3840x2160
          backing store for a 1080p render -- four times the pixels for the
          same output. Following devicePixelRatio keeps the buffer at the
          resolution actually being written out.
        */
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio}
      >
        <Scene look={look} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
