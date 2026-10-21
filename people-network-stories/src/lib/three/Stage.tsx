import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { hexToRgb } from "../ease";

// Hex colours in the data files are the exact output values: no sRGB/linear conversion.
THREE.ColorManagement.enabled = false;

export type StageInfo = {
  // Drawing-buffer size in device pixels (1280x720 for previews, 3840x2160 at 4K).
  width: number;
  height: number;
  // Device pixels per "720p pixel": every pixel-sized value in the scenes is given at 720p
  // and multiplied by this, so the 4K render looks like the preview, only sharper.
  px: number;
};

export type SceneRuntime = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  update: (frame: number) => void;
  dispose?: () => void;
};

export type GlowOptions = {
  // Weights of the two blur levels added on top of the image.
  near: number;
  far: number;
};

export type StageProps = {
  create: (info: StageInfo) => SceneRuntime;
  // A fixed colour, or one per frame (People Link-Up cuts from white to black).
  background: string | ((frame: number) => string);
  glow?: GlowOptions;
};

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// 9-tap separable Gaussian with linear sampling (17 effective taps).
const BLUR_FRAG = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uDir;
uniform float uSigma;
varying vec2 vUv;
void main() {
  vec3 acc = texture2D(tInput, vUv).rgb;
  float wsum = 1.0;
  for (int i = 1; i <= 8; i++) {
    float o1 = float(2 * i - 1);
    float o2 = float(2 * i);
    float w1 = exp(-o1 * o1 / (2.0 * uSigma * uSigma));
    float w2 = exp(-o2 * o2 / (2.0 * uSigma * uSigma));
    float w = w1 + w2;
    float o = (o1 * w1 + o2 * w2) / max(w, 1e-6);
    vec2 d = uDir * o;
    acc += w * (texture2D(tInput, vUv + d).rgb + texture2D(tInput, vUv - d).rgb);
    wsum += 2.0 * w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}`;

const FINAL_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tNear;
uniform sampler2D tFar;
uniform float uNear;
uniform float uFar;
uniform vec3 uBg;
uniform float uFrame;
uniform vec2 uRes;
varying vec2 vUv;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texture2D(tScene, uv).rgb;
  c += uNear * texture2D(tNear, uv).rgb + uFar * texture2D(tFar, uv).rgb;
  c = clamp(c, 0.0, 1.0);
  // +-1/255 dither, only where something is drawn (more than 2% away from the
  // background), so pure black stays 0 and the light background stays flat.
  vec3 d = abs(c - uBg);
  float m = step(0.02, max(d.r, max(d.g, d.b)));
  float n = hash(gl_FragCoord.xy + vec2(uFrame * 17.0, uFrame * 31.0)) - 0.5;
  c += m * n * (2.0 / 255.0);
  gl_FragColor = vec4(c, 1.0);
}`;

const makeRT = (w: number, h: number, samples: number) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    samples,
    depthBuffer: samples > 0,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });

const Pipeline: React.FC<StageProps & { info: StageInfo }> = ({ create, background, glow, info }) => {
  const gl = useThree((s) => s.gl);
  const frame = useCurrentFrame();
  const { width: W, height: H } = info;

  const runtime = useMemo(() => create(info), [create, info]);

  const passes = useMemo(() => {
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const sceneRT = makeRT(W, H, 4);
    const nearA = makeRT(Math.round(W / 2), Math.round(H / 2), 0);
    const nearB = makeRT(Math.round(W / 2), Math.round(H / 2), 0);
    const farA = makeRT(Math.round(W / 4), Math.round(H / 4), 0);
    const farB = makeRT(Math.round(W / 4), Math.round(H / 4), 0);
    const blurMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: { tInput: { value: null }, uDir: { value: new THREE.Vector2() }, uSigma: { value: 1 } },
      depthTest: false,
      depthWrite: false,
    });
    const blurMesh = new THREE.Mesh(quadGeo, blurMat);
    blurMesh.frustumCulled = false;
    const blurScene = new THREE.Scene();
    blurScene.add(blurMesh);
    const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const finalMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: FINAL_FRAG,
      uniforms: {
        tScene: { value: sceneRT.texture },
        tNear: { value: nearB.texture },
        tFar: { value: farB.texture },
        uNear: { value: glow?.near ?? 0 },
        uFar: { value: glow?.far ?? 0 },
        uBg: { value: new THREE.Vector3() },
        uFrame: { value: 0 },
        uRes: { value: new THREE.Vector2(W, H) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const finalMesh = new THREE.Mesh(quadGeo, finalMat);
    finalMesh.frustumCulled = false;
    return { sceneRT, nearA, nearB, farA, farB, blurMat, blurScene, orthoCam, finalMat, finalMesh };
  }, [W, H, glow]);

  useLayoutEffect(() => {
    return () => {
      runtime.dispose?.();
    };
  }, [runtime]);

  useLayoutEffect(() => {
    const p = passes;
    runtime.update(frame);
    const bg = typeof background === "function" ? background(frame) : background;
    p.finalMat.uniforms.uBg.value.set(...hexToRgb(bg));
    gl.autoClear = true;
    gl.setClearColor(new THREE.Color(bg), 1);
    gl.setRenderTarget(p.sceneRT);
    gl.clear(true, true, true);
    gl.render(runtime.scene, runtime.camera);

    if (glow) {
      // Blur sigmas are in 720p pixels, so the glow keeps its size at 4K.
      const blur = (src: THREE.WebGLRenderTarget, tmp: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget, sigma720: number) => {
        const texelsPer720px = (info.px * dst.width) / W;
        p.blurMat.uniforms.uSigma.value = Math.max(0.5, sigma720 * texelsPer720px);
        p.blurMat.uniforms.tInput.value = src.texture;
        p.blurMat.uniforms.uDir.value.set(1 / src.width, 0);
        gl.setRenderTarget(tmp);
        gl.render(p.blurScene, p.orthoCam);
        p.blurMat.uniforms.tInput.value = tmp.texture;
        p.blurMat.uniforms.uDir.value.set(0, 1 / tmp.height);
        gl.setRenderTarget(dst);
        gl.render(p.blurScene, p.orthoCam);
      };
      blur(p.sceneRT, p.nearA, p.nearB, 1.6);
      blur(p.nearB, p.farA, p.farB, 4.0);
    }
    p.finalMat.uniforms.uFrame.value = frame;
    gl.setRenderTarget(null);
  }, [frame, gl, runtime, passes, background, glow, info, W]);

  // R3F's own render (advanced by <ThreeCanvas> after this layout effect) draws only
  // this fullscreen quad: the final composite.
  return <primitive object={passes.finalMesh} />;
};

export const Stage: React.FC<StageProps> = (props) => {
  const { width, height } = useVideoConfig();
  // Remotion's --scale sets the device pixel ratio; render the GL buffer at exactly the
  // output size so a 720p preview doesn't pay for 4K.
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const info = useMemo<StageInfo>(() => {
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    return { width: w, height: h, px: h / 720 };
  }, [width, height, dpr]);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      linear
      flat
      legacy
      gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      style={{ backgroundColor: typeof props.background === "string" ? props.background : "#000" }}
    >
      <Pipeline {...props} info={info} />
    </ThreeCanvas>
  );
};
