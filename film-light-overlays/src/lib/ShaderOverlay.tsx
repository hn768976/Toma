import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  BufferAttribute,
  BufferGeometry,
  GLSL3,
  HalfFloatType,
  IUniform,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  RawShaderMaterial,
  RGBAFormat,
  Scene,
  Vector2,
  WebGLRenderTarget,
} from "three";
import { getBlueNoiseTexture } from "./blueNoise";
import { COMMON, FINAL_FRAGMENT, VERTEX } from "./glsl";

export type Uniforms = Record<string, IUniform>;

export type Look = {
  /** GLSL body (COMMON is prepended). Must write outColor. */
  fragment: string;
  /** Creates the uniform objects once. */
  createUniforms: () => Uniforms;
  /** Writes this frame's values into the uniforms. Pure function of `frame`. */
  update: (frame: number, u: Uniforms) => void;
  /** Dither is skipped where min(rgb) is above this (keeps pure white at 255). */
  ditherHi?: number;
};

// One big triangle covering the viewport.
const makeTriangle = () => {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
};

const Passes: React.FC<{ look: Look }> = ({ look }) => {
  const frame = useCurrentFrame();
  const { gl, size } = useThree();

  const state = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      format: RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false,
    });
    const uniforms: Uniforms = {
      uRes: { value: new Vector2(1, 1) },
      uFrame: { value: 0 },
      ...look.createUniforms(),
    };
    const effect = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: VERTEX,
      fragmentShader: COMMON + look.fragment,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const offScene = new Scene();
    const offMesh = new Mesh(makeTriangle(), effect);
    offMesh.frustumCulled = false;
    offScene.add(offMesh);
    const final = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FINAL_FRAGMENT,
      uniforms: {
        uSrc: { value: target.texture },
        uBlue: { value: getBlueNoiseTexture() },
        uDitherLo: { value: 0.02 },
        uDitherHi: { value: look.ditherHi ?? 2.0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const finalMesh = new Mesh(makeTriangle(), final);
    finalMesh.frustumCulled = false;
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { target, uniforms, offScene, camera, finalMesh };
  }, [look]);

  // Render the effect into the half-float target. This runs before
  // @remotion/three's frame renderer (a passive effect) draws the final pass.
  useLayoutEffect(() => {
    const buf = new Vector2();
    gl.getDrawingBufferSize(buf);
    if (state.target.width !== buf.x || state.target.height !== buf.y) {
      state.target.setSize(buf.x, buf.y);
    }
    state.uniforms.uRes.value.set(buf.x, buf.y);
    state.uniforms.uFrame.value = frame;
    look.update(frame, state.uniforms);
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(state.target);
    gl.render(state.offScene, state.camera);
    gl.setRenderTarget(prev);
  }, [frame, gl, size.width, size.height, state, look]);

  return <primitive object={state.finalMesh} />;
};

export const ShaderOverlay: React.FC<{ look: Look }> = ({ look }) => {
  const { width, height } = useVideoConfig();
  // Render the canvas at the output resolution (respects --scale); the small
  // bias keeps floor(width * dpr) from rounding down a pixel.
  const dpr = useMemo(() => {
    const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    return (Math.round(width * ratio) + 0.25) / width;
  }, [width]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      >
        <Passes look={look} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
