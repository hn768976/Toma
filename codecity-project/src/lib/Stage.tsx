import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BloomEffect,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  RenderPass,
} from "postprocessing";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

export type PostConfig = {
  // Loop length (or story length). Grain is driven by frame % period.
  period: number;
  background: string;
  exposure: number;
  bloom: { intensity: number; threshold: number; smoothing: number; radius: number };
  // World-space focus distance/range. Bokeh is given for a 1080-px-tall frame
  // and scaled with the real drawing-buffer height, so 720p and 4K match.
  dof?: { focus: number; range: number; bokeh: number };
  grain: number;
  // Fade grain and dither to zero below ~3% luminance (keeps pure black clean).
  blackFade?: boolean;
};

// Final pass: soft tone curve, then grain + ±1 LSB triangular dither applied in
// display (sRGB) space, from a fixed hash of pixel position and frame.
const FINAL_FRAG = /* glsl */ `
uniform float uFrame;
uniform float uGrain;
uniform float uBlackFade;
uniform float uExposure;

float h12(vec2 p, float f) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + f * vec3(0.1173, 0.2131, 0.3197));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 toLinear(vec3 c) {
  c = max(c, 0.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb * uExposure;
  // Filmic-ish shoulder that keeps hue: compress by the max channel.
  float m = max(max(c.r, c.g), c.b);
  float k = m > 0.6 ? (0.6 + (1.0 - exp(-(m - 0.6) * 2.5)) * 0.4) / m : 1.0;
  c *= k;
  vec3 s = toSRGB(c);
  float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float fade = uBlackFade > 0.5 ? smoothstep(0.015, 0.035, lum) : 1.0;
  vec2 px = floor(gl_FragCoord.xy);
  float g = (h12(px, uFrame) - 0.5) * 2.0 * uGrain;
  float d = (h12(px + 91.7, uFrame) + h12(px + 17.3, uFrame + 7.0) - 1.0) / 255.0;
  s += (g + d) * fade;
  outputColor = vec4(toLinear(clamp(s, 0.0, 1.0)), 1.0);
}
`;

class FinalEffect extends Effect {
  constructor() {
    super("FinalEffect", FINAL_FRAG, {
      uniforms: new Map<string, THREE.Uniform>([
        ["uFrame", new THREE.Uniform(0)],
        ["uGrain", new THREE.Uniform(0.015)],
        ["uBlackFade", new THREE.Uniform(0)],
        ["uExposure", new THREE.Uniform(1)],
      ]),
    });
  }
}

export const Stage: React.FC<{
  fov: number;
  near: number;
  far: number;
  children: React.ReactNode;
}> = ({ fov, near, far, children }) => {
  const { width, height } = useVideoConfig();
  const env = getRemotionEnvironment();
  // During render the page's devicePixelRatio is Remotion's --scale, so the
  // drawing buffer is exactly the output size. In the Studio cap it.
  const dpr =
    typeof window === "undefined"
      ? 1
      : env.isRendering
        ? window.devicePixelRatio
        : Math.min(0.5, window.devicePixelRatio);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      gl={{
        antialias: false,
        alpha: false,
        stencil: false,
        depth: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      camera={{ fov, near, far, position: [0, 0, 0] }}
      style={{ background: "#000" }}
    >
      {children}
    </ThreeCanvas>
  );
};

export type FrameCtx = {
  scene: THREE.Scene;
  buffer: THREE.Vector2;
  // Per-frame depth of field (pre-filled from post.dof; looks may change it).
  dof: { focus: number; range: number; bokeh: number };
};

// Renders one frame through the post chain. `update` gets the Remotion frame
// (read from useCurrentFrame during React render) and must set every animated
// value from it. useFrame is used only as the "render now" hook that
// ThreeCanvas triggers per frame; its clock is never read.
export const Driver: React.FC<{
  post: PostConfig;
  update: (frame: number, camera: THREE.PerspectiveCamera, ctx: FrameCtx) => void;
}> = ({ post, update }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const updateRef = useRef(update);
  updateRef.current = update;
  const { gl, scene, camera, size } = useThree();

  const chain = useMemo(() => {
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    const composer = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: 4,
    });
    composer.addPass(new RenderPass(scene, camera));
    let dof: DepthOfFieldEffect | null = null;
    if (post.dof) {
      dof = new DepthOfFieldEffect(camera, {
        worldFocusDistance: post.dof.focus,
        worldFocusRange: post.dof.range,
        bokehScale: post.dof.bokeh,
        resolutionScale: 0.5,
      });
      composer.addPass(new EffectPass(camera, dof));
    }
    const bloom = new BloomEffect({
      intensity: post.bloom.intensity,
      luminanceThreshold: post.bloom.threshold,
      luminanceSmoothing: post.bloom.smoothing,
      mipmapBlur: true,
      radius: post.bloom.radius,
      levels: 8,
    });
    const final = new FinalEffect();
    const pass = new EffectPass(camera, bloom, final);
    pass.dithering = false;
    composer.addPass(pass);
    return { composer, dof, final };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useLayoutEffect(() => {
    chain.composer.setSize(size.width, size.height, false);
  }, [chain, size.width, size.height]);

  useLayoutEffect(() => () => chain.composer.dispose(), [chain]);

  useFrame(() => {
    const f = frameRef.current;
    scene.background = new THREE.Color(post.background);
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    const dofNow = { ...(post.dof ?? { focus: 10, range: 10, bokeh: 0 }) };
    updateRef.current(f, camera as THREE.PerspectiveCamera, { scene, buffer: buf, dof: dofNow });
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    (camera as THREE.PerspectiveCamera).updateMatrixWorld();
    if (chain.dof) {
      chain.dof.bokehScale = dofNow.bokeh * (buf.y / 1080);
      chain.dof.cocMaterial.worldFocusDistance = dofNow.focus;
      chain.dof.cocMaterial.worldFocusRange = dofNow.range;
    }
    const u = chain.final.uniforms;
    u.get("uFrame")!.value = ((f % post.period) + post.period) % post.period;
    u.get("uGrain")!.value = post.grain;
    u.get("uBlackFade")!.value = post.blackFade ? 1 : 0;
    u.get("uExposure")!.value = post.exposure;
    chain.composer.render();
  }, 1);

  return null;
};
