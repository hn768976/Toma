import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  EffectComposerContext,
  ToneMapping,
} from "@react-three/postprocessing";
import { ThreeCanvas } from "@remotion/three";
import { EffectPass, ToneMappingMode } from "postprocessing";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { Color, NoToneMapping, PerspectiveCamera, Quaternion, Vector2 } from "three";
import { cycleFrac } from "../lib/loop";
import type { LookConfig } from "../looks/types";
import { Background, ndcZ, Stars } from "./Background";
import { Grain } from "./Grain";
import {
  atomQuaternion,
  cameraDistance,
  cameraPosition,
  electronLocal,
  electronPhase,
  type AtomModel,
} from "./model";
import { Nucleus } from "./Nucleus";
import { Strand } from "./Orbit";
import { Smoke } from "./Smoke";
import { Electron } from "./Sprites";

/**
 * Switch groups off for debugging (e.g. bisecting a loop mismatch):
 * electrons, trails, rotation, camera, nebula, stars, smoke, bokeh, grain,
 * bloom, dof, nucleus. Pass via --props='{"disable":["grain"]}'.
 */
export type SceneProps = { disable: string[] };

const NEAR = 0.1;
const FAR = 200;

/**
 * Holds the frame until @react-three/postprocessing has built its passes,
 * then draws once. Without this a cold-started render thread could capture
 * a frame before the composer exists.
 */
const ComposerReady: React.FC = () => {
  const ctx = useContext(EffectComposerContext);
  const advance = useThree((s) => s.advance);
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Waiting for postprocessing passes"));
  const done = useRef(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      if (done.current) return;
      const passes = ctx?.composer?.passes ?? [];
      if (passes.some((p) => p instanceof EffectPass)) {
        advance(performance.now());
        done.current = true;
        continueRender(handle);
      } else {
        raf = requestAnimationFrame(check);
      }
    };
    check();
    return () => cancelAnimationFrame(raf);
  });
  useEffect(() => () => continueRender(handle), [continueRender, handle]);
  return null;
};

const SceneContents: React.FC<{
  model: AtomModel;
  disable: string[];
  width: number;
  height: number;
  dpr: number;
}> = ({ model, disable, width, height, dpr }) => {
  const frame = useCurrentFrame();
  const look = model.look;
  const off = (k: string) => disable.includes(k);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;

  // Drawing-buffer size, from the composition size × pixel ratio (known
  // synchronously, so the first frame of a cold render is already right).
  const res = useMemo(() => new Vector2(Math.round(width * dpr), Math.round(height * dpr)), [width, height, dpr]);

  const colors = useMemo(() => {
    const c = look.colors;
    return {
      orbit: new Color(c.orbit),
      core: new Color(c.electronCore),
      halo: new Color(c.electronHalo),
      nucleus: new Color(c.nucleus),
      glow: new Color(c.nucleusGlow),
      smoke: new Color(c.smoke),
      smoke2: new Color(c.smoke2),
    };
  }, [look]);

  // Camera: framing derived from atomHeightFraction, drift on a closed path.
  const camPos = cameraPosition(look, frame, !off("camera"));
  camera.fov = look.fov;
  camera.aspect = width / height;
  camera.near = NEAR;
  camera.far = FAR;
  camera.position.set(...camPos);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  const dist = cameraDistance(look);
  const bgZ = ndcZ(dist + 5, NEAR, FAR);
  const shift: [number, number] = [-camPos[0] * 0.03, -camPos[1] * 0.03];

  const atomQ = atomQuaternion(look, frame, !off("rotation"));
  const time = cycleFrac(1, frame);
  const strandLook = {
    trail: look.trail,
    trailWidth: look.trailWidth,
    baseWidth: look.baseWidth,
    baseIntensity: look.baseIntensity,
    trailIntensity: look.trailIntensity,
    color: colors.orbit,
  };

  return (
    <>
      {look.background !== "black" ? (
        <>
          <Background model={model} frame={frame} res={res} z={bgZ} nebula={!off("nebula")} bokeh={!off("bokeh")} shift={shift} />
          {!off("stars") ? <Stars model={model} frame={frame} res={res} z={bgZ} shift={shift} /> : null}
        </>
      ) : null}

      <ambientLight intensity={0.25} />
      <pointLight position={[-3, 3.5, 5]} intensity={3.2} decay={0} color="#fff4e8" />
      <pointLight position={[2.5, -1.5, 2]} intensity={1.0} decay={0} color={look.colors.nucleus} />
      <pointLight position={[1.5, 2, -4]} intensity={2.0} decay={0} color="#ffd0a0" />

      {look.smoke && !off("smoke") ? (
        <Smoke frame={frame} size={look.smoke.size} intensity={look.smoke.intensity} breathCycles={look.smoke.breathCycles} a={colors.smoke} b={colors.smoke2} />
      ) : null}

      <group quaternion={atomQ}>
        {!off("nucleus") ? <Nucleus model={model} color={colors.nucleus} glow={colors.glow} /> : null}
        {model.orbits.map((o, i) => {
          const head = electronPhase(o, frame);
          const q = new Quaternion(...o.quaternion);
          return (
            <group key={i} quaternion={q}>
              {!off("trails")
                ? o.strands.map((s, j) => (
                    <Strand key={j} orbit={o} strand={s} frame={{ head, time, res }} look={strandLook} depthPrepass={!!look.dof && !off("dof")} />
                  ))
                : null}
              {!off("electrons") ? (
                <Electron
                  position={electronLocal(o, frame)}
                  size={look.electron.size}
                  core={colors.core}
                  halo={colors.halo}
                  coreIntensity={look.electron.coreIntensity}
                  haloIntensity={look.electron.haloIntensity}
                  star={look.electron.star}
                />
              ) : null}
            </group>
          );
        })}
      </group>

      <EffectComposer multisampling={4} enableNormalPass={false}>
        <>
          {look.dof && !off("dof") ? (
            <DepthOfField
              worldFocusDistance={dist + look.dof.focusOffset}
              worldFocusRange={look.dof.focusRange}
              bokehScale={(look.dof.bokehScale * res.y) / 1080}
              resolutionScale={1}
            />
          ) : null}
          {!off("bloom") ? (
            <Bloom
              mipmapBlur
              levels={look.bloom.levels}
              luminanceThreshold={look.bloom.threshold}
              luminanceSmoothing={look.bloom.smoothing}
              intensity={look.bloom.intensity}
              radius={look.bloom.radius}
            />
          ) : null}
          <ToneMapping mode={look.toneMapping === "aces" ? ToneMappingMode.ACES_FILMIC : ToneMappingMode.AGX} />
          <Grain frame={frame} amount={off("grain") ? 0 : look.grain} blackSafe={look.blackSafe} />
          <ComposerReady />
        </>
      </EffectComposer>
    </>
  );
};

export const AtomScene: React.FC<{ model: AtomModel; disable: string[] }> = ({ model, disable }) => {
  const { width, height } = useVideoConfig();
  // Remotion's --scale sets devicePixelRatio; render at exactly that size.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        gl={{
          antialias: false,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          toneMapping: NoToneMapping,
        }}
        camera={{ fov: model.look.fov, near: NEAR, far: FAR, position: [0, 0, cameraDistance(model.look)] }}
        onCreated={({ gl }) => gl.setClearColor("#000000", 1)}
      >
        <SceneContents model={model} disable={disable} width={width} height={height} dpr={dpr} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
