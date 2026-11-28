import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useRemotionEnvironment,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { makeFullscreenTriangle, makeOutputMaterial } from "./output";
import { Pipeline } from "./pipeline";
import type { Look, World } from "./types";

const TONE: Record<string, number> = { aces: 0, agx: 1, none: 2 };

type Props = {
  /** builds the scene once; must be deterministic */
  readonly createWorld: (gl: THREE.WebGLRenderer) => World;
  readonly look: Look;
  /** maps the Remotion frame to the frame the world should show */
  readonly frameMap?: (frame: number) => number;
  readonly hueShift?: number;
};

type InnerProps = Props & {
  /** device pixels per composition pixel (Remotion's --scale while rendering) */
  readonly dpr: number;
};

/**
 * Lives inside <ThreeCanvas>. For every Remotion frame it
 *   1. sets the scene to that frame and renders it through the pipeline, and
 *   2. draws the result to the canvas with the output (lens + film) material.
 * Both happen synchronously in a layout effect keyed on useCurrentFrame(), so
 * nothing depends on a clock, on useFrame(), or on an earlier frame.
 */
const StageInner: React.FC<InnerProps> = ({
  createWorld,
  look,
  frameMap,
  hueShift,
  dpr,
}) => {
  const frame = useCurrentFrame();
  const gl = useThree((s) => s.gl);
  const rootScene = useThree((s) => s.scene);
  const rootCamera = useThree((s) => s.camera);
  const { width, height } = useVideoConfig();
  // The pipeline size comes from the composition and the render scale only.
  // (Reading it back from the renderer is not safe: on the first frame of a
  // browser tab React Three Fiber has not applied the pixel ratio yet, and
  // that frame would be drawn at a different internal resolution.)
  const pw = Math.round(width * dpr);
  const ph = Math.round(height * dpr);

  const world = useMemo(() => createWorld(gl), [createWorld, gl]);
  const pipeline = useMemo(
    () => new Pipeline(gl, world, look, pw, ph),
    [gl, world, look, pw, ph],
  );
  const material = useMemo(() => makeOutputMaterial(), []);
  const geometry = useMemo(() => makeFullscreenTriangle(), []);

  useLayoutEffect(() => {
    const f = frameMap ? frameMap(frame) : frame;
    const out = pipeline.render(f);
    const fl = out.frameLook;
    const u = material.uniforms;
    u.tHdr.value = out.hdr;
    u.tBloomCore.value = out.bloomCore;
    u.tBloomHalo.value = out.bloomHalo;
    const bm = fl.bloomMul ?? 1;
    u.uBloomCore.value = look.bloom.coreIntensity * bm;
    u.uBloomHalo.value = look.bloom.haloIntensity * bm;
    u.uRes.value.set(pw, ph);
    u.uFrame.value = f;
    u.uExposure.value = look.exposure * (fl.exposureMul ?? 1);
    u.uToneMap.value = TONE[look.toneMap];
    u.uFringe.value = look.fringe.amount;
    u.uFringePow.value = look.fringe.power;
    u.uFlash.value = fl.flash ?? 0;
    u.uVigStrength.value = look.vignette.strength * (fl.vignetteMul ?? 1);
    u.uVigInner.value = look.vignette.inner;
    u.uVigOuter.value = look.vignette.outer;
    u.uVigCenter.value.set(look.vignette.center[0], look.vignette.center[1]);
    u.uVigAspect.value = look.vignette.aspect;
    u.uContrast.value = look.grade.contrast;
    u.uSaturation.value = look.grade.saturation;
    u.uGamma.value = look.grade.gamma;
    u.uLift.value.set(...look.grade.lift);
    u.uGain.value.set(...look.grade.gain);
    u.uGrain.value = look.grain * (fl.grainMul ?? 1);
    u.uGrainCell.value = Math.max(1, ph / 1080);
    u.uDither.value = look.dither;
    u.uSharpen.value = look.sharpen;
    u.uSharpenPx.value = Math.max(1, ph / 1080);
    u.uHueShift.value = hueShift ?? 0;
    // draw to the canvas now; R3F's own render that follows is identical
    gl.setRenderTarget(null);
    gl.render(rootScene, rootCamera);
  }, [
    frame,
    frameMap,
    pipeline,
    material,
    look,
    gl,
    rootScene,
    rootCamera,
    pw,
    ph,
    hueShift,
  ]);

  useLayoutEffect(
    () => () => {
      pipeline.dispose();
    },
    [pipeline],
  );

  return <mesh frustumCulled={false} geometry={geometry} material={material} />;
};

export const Stage: React.FC<Props> = (props) => {
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  // While rendering, the device pixel ratio is Remotion's --scale
  // (0.5 -> 1920x1080, 1 -> 3840x2160). In the Studio preview half
  // resolution keeps scrubbing responsive.
  const dpr =
    typeof window === "undefined"
      ? 1
      : isRendering
        ? window.devicePixelRatio
        : Math.min(window.devicePixelRatio, 0.5);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        // Shadows must be switched on here: React Three Fiber re-applies this
        // setting on every update, and would otherwise turn the shadow maps a
        // scene enabled itself back off after the first frame.
        shadows="soft"
        flat
        gl={{
          antialias: false,
          alpha: false,
          depth: false,
          stencil: false,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
        }}
      >
        <StageInner {...props} dpr={dpr} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
