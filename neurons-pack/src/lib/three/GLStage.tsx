import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import * as THREE from "three";
import { DITHER, SRGB } from "../glsl";

export type StageContext = {
  renderer: THREE.WebGLRenderer;
  /** Drawing-buffer size in device pixels. */
  width: number;
  height: number;
  /** Device pixels per composition pixel (1 at 4K, 1/3 at 720p). */
  px: number;
};

export type Stage = {
  /** Render frame `frame` into `target` (half-float, 4x MSAA, linear). */
  render: (frame: number, target: THREE.WebGLRenderTarget) => void;
};

const FINAL_VERT = /* glsl */ `
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uSrc;
in vec2 vUv;
out vec4 outColor;
${SRGB}
${DITHER}
void main() {
  vec3 c = toSrgb(texture(uSrc, vUv).rgb);
  outColor = vec4(ditherOut(c, gl_FragCoord.xy, true), 1.0);
}
`;

/** A fullscreen triangle, reused for every screen-space pass. */
export const fullscreenTriangle = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2));
  return g;
};

const Pipeline: React.FC<{ build: (ctx: StageContext) => Stage; width: number; height: number }> = ({
  build,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const { gl } = useThree();
  const { delayRender, continueRender } = useDelayRender();

  const pipeline = useMemo(() => {
    // Exact device size: 3840 x 1/3 must land on 1280, not 1279.
    const px = window.devicePixelRatio || 1;
    const w = Math.round(width * px);
    const h = Math.round(height * px);
    gl.setPixelRatio(1);
    gl.setSize(w, h, false);
    gl.autoClear = false;
    gl.toneMapping = THREE.NoToneMapping;
    gl.setClearColor(0x000000, 1);
    const target = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: 4,
      depthBuffer: true,
      colorSpace: THREE.LinearSRGBColorSpace,
    });
    const finalMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FINAL_VERT,
      fragmentShader: FINAL_FRAG,
      uniforms: { uSrc: { value: target.texture } },
      depthTest: false,
      depthWrite: false,
    });
    const finalScene = new THREE.Scene();
    const quad = new THREE.Mesh(fullscreenTriangle(), finalMat);
    quad.frustumCulled = false;
    finalScene.add(quad);
    const finalCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const stage = build({ renderer: gl, width: w, height: h, px: w / width });
    return { target, finalScene, finalCam, stage, w, h };
  }, [gl, build, width, height]);

  const handle = useRef<number | null>(null);
  useLayoutEffect(() => {
    handle.current = delayRender(`GLStage frame ${frame}`);
    return () => {
      if (handle.current !== null) continueRender(handle.current);
      handle.current = null;
    };
  }, [frame, delayRender, continueRender]);

  useEffect(() => {
    const { target, finalScene, finalCam, stage, w, h } = pipeline;
    gl.setViewport(0, 0, w, h);
    stage.render(frame, target);
    gl.setRenderTarget(null);
    gl.setViewport(0, 0, w, h);
    gl.render(finalScene, finalCam);
    if (handle.current !== null) {
      continueRender(handle.current);
      handle.current = null;
    }
  }, [frame, pipeline, gl, continueRender]);

  return null;
};

/**
 * Hosts a three.js scene in @remotion/three's <ThreeCanvas>. The scene is
 * built once, imperatively; each frame is rendered from useCurrentFrame()
 * into a half-float 4x-MSAA target and resolved to the canvas through a
 * final sRGB + dither pass. The R3F default scene is empty and autoClear is
 * off, so R3F's own render draws nothing.
 */
export const GLStage: React.FC<{ build: (ctx: StageContext) => Stage; background?: string }> = ({
  build,
  background = "#000",
}) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={1}
        flat
        linear
        gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      >
        <Pipeline build={build} width={width} height={height} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
