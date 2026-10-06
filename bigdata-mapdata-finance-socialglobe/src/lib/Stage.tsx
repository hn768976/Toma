import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import { AbsoluteFill, getInputProps, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Assets, useAssets } from "./assets";
import { Grade, LayerSpec, PERF, Pipeline, PipelineOptions, PostParams } from "./pipeline";
import { syncProjection } from "./prims3d";
import { PERF_TEX } from "./canvas";

const perf = (getInputProps() as { perf?: { msaa?: number; dof?: boolean; aniso?: number } }).perf;
if (perf) {
  if (perf.msaa !== undefined) PERF.msaa = perf.msaa;
  if (perf.dof !== undefined) PERF.dof = perf.dof;
  if (perf.aniso !== undefined) PERF_TEX.aniso = perf.aniso;
}

// A "World" is built once per tab (deterministically: module-level seeds,
// fixed build order) and then updated from the frame number alone.
export type World = {
  camera: THREE.PerspectiveCamera;
  layers: LayerSpec[];
  pipeline: PipelineOptions;
  /** Set every animated value for `frame`. Must not read any other state. */
  update: (frame: number) => Omit<PostParams, "grainFrame"> & { grainFrame?: number };
};

export type BuildFn = (assets: Assets) => World;

const Director: React.FC<{ build: BuildFn; assets: Assets; grade?: Grade }> = ({ build, assets, grade }) => {
  const { gl, size } = useThree();
  const frame = useCurrentFrame();
  const world = useMemo(() => build(assets), [build, assets]);
  const pipeline = useMemo(() => {
    gl.autoClear = false;
    gl.debug.onShaderError = (glc, prog, vs, fs) => {
      const msg = `Shader error: ${glc.getProgramInfoLog(prog)} VS: ${glc.getShaderInfoLog(vs)} FS: ${glc.getShaderInfoLog(fs)}`;
      console.error(msg);
      throw new Error(msg);
    };
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    return new Pipeline(gl, world.pipeline);
  }, [gl, world]);

  useEffect(() => () => pipeline.dispose(), [pipeline]);
  useMemo(() => pipeline.setGrade(grade), [pipeline, grade]);

  // Runs after @remotion/three's own frame effect in the same commit, so the
  // frame is fully drawn before Remotion takes the screenshot.
  useEffect(() => {
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    const cam = world.camera;
    cam.aspect = buf.x / buf.y;
    cam.updateProjectionMatrix();
    const post = world.update(frame);
    for (const L of world.layers) {
      syncProjection(L.scene, (L.camera as THREE.PerspectiveCamera) ?? cam, buf.x, buf.y);
    }
    pipeline.render(world.layers, cam, { ...post, grainFrame: post.grainFrame ?? frame });
  }, [frame, world, pipeline, gl, size]);

  return null;
};

export type LookProps = { frames?: number; grade?: Grade };

export const Stage: React.FC<{ build: BuildFn; grade?: Grade }> = ({ build, grade }) => {
  const { width, height } = useVideoConfig();
  const assets = useAssets();
  // Render at the composition size times Remotion's --scale (= devicePixelRatio
  // while rendering). In the Studio, cap the buffer to keep scrubbing fluid.
  const env = getRemotionEnvironment();
  const dpr = env.isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {assets ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          frameloop="never"
          gl={{
            antialias: false,
            preserveDrawingBuffer: true,
            alpha: false,
            powerPreference: "high-performance",
            stencil: false,
            depth: false,
          }}
        >
          <Director build={build} assets={assets} grade={grade} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
