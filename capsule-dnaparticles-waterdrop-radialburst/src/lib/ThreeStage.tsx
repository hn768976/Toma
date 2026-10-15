import React, { useLayoutEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { ThreeCanvas } from '@remotion/three';
import * as THREE from 'three';
import { getRemotionEnvironment, useCurrentFrame, useDelayRender, useVideoConfig } from 'remotion';

export type ThreeScene = {
  // Draw frame `frame` completely into the canvas. Pure function of `frame`.
  render: (frame: number) => void;
  dispose: () => void;
};

export type ThreeSceneFactory = (renderer: THREE.WebGLRenderer, pixelWidth: number, pixelHeight: number) => ThreeScene;

// Runs inside <ThreeCanvas>. The R3F scene stays empty and autoClear is off,
// so the R3F render that @remotion/three triggers on every frame draws
// nothing; the scene's own pipeline (half-float targets, blur, final pass)
// is rendered here, once per Remotion frame, from useCurrentFrame() only.
const Driver: React.FC<{ create: ThreeSceneFactory }> = ({ create }) => {
  const { gl } = useThree();
  const frame = useCurrentFrame();
  const { delayRender, continueRender } = useDelayRender();
  const [scene] = useState(() => {
    gl.autoClear = false;
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    return create(gl, size.x, size.y);
  });
  const disposed = useRef(false);
  useLayoutEffect(() => {
    return () => {
      disposed.current = true;
      scene.dispose();
    };
  }, [scene]);
  useLayoutEffect(() => {
    if (disposed.current) return;
    const h = delayRender(`three frame ${frame}`);
    scene.render(frame);
    continueRender(h);
  }, [frame, scene, delayRender, continueRender]);
  return null;
};

export const ThreeStage: React.FC<{ create: ThreeSceneFactory }> = ({ create }) => {
  const { width, height } = useVideoConfig();
  const env = getRemotionEnvironment();
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const resolution = env.isRendering ? dpr : Math.min(dpr, 0.5);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={resolution}
      flat
      linear
      frameloop="demand"
      gl={{ preserveDrawingBuffer: true, antialias: false, alpha: false, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Driver create={create} />
    </ThreeCanvas>
  );
};

// ---------- small pipeline helpers ----------

export const makeTarget = (w: number, h: number, samples = 0) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.LinearSRGBColorSpace,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    samples,
  });

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export class FullscreenPass {
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  constructor(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    // one big triangle covering the viewport
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

// Separable gaussian blur, radius in pixels of the target it runs on.
const BLUR_FRAG = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uDir;
uniform float uSigma;
varying vec2 vUv;
void main() {
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = -24; i <= 24; i++) {
    float x = float(i) * max(uSigma / 8.0, 1.0);
    float w = exp(-0.5 * x * x / (uSigma * uSigma));
    acc += texture2D(tInput, vUv + uDir * x) * w;
    wsum += w;
  }
  gl_FragColor = acc / wsum;
}
`;

export class GaussianBlur {
  pass = new FullscreenPass(BLUR_FRAG, {
    tInput: { value: null },
    uDir: { value: new THREE.Vector2() },
    uSigma: { value: 1 },
  });
  tmp: THREE.WebGLRenderTarget;
  constructor(w: number, h: number) {
    this.tmp = makeTarget(w, h);
  }
  // blur src into dst (same size); sigma in pixels
  run(renderer: THREE.WebGLRenderer, src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget, sigma: number) {
    const u = this.pass.material.uniforms;
    u.uSigma.value = sigma;
    u.tInput.value = src.texture;
    u.uDir.value.set(1 / src.width, 0);
    this.pass.render(renderer, this.tmp);
    u.tInput.value = this.tmp.texture;
    u.uDir.value.set(0, 1 / src.height);
    this.pass.render(renderer, dst);
  }
  dispose() {
    this.pass.dispose();
    this.tmp.dispose();
  }
}

// Linear -> sRGB, Khronos PBR Neutral tone mapping and the blue-noise
// dither lookup, shared by the three.js final passes.
export const DISPLAY_GLSL = /* glsl */ `
vec3 linToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 srgbToLin(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 neutralTonemap(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, newPeak * vec3(1.0), g);
}
`;

export const blueNoiseTexture = (data: Uint8Array, size: number) => {
  const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
};
