import { useLayoutEffect, useRef } from "react";
import {
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { getCamera, Variant } from "./camera";
import { buildParticleGeometry, RIBBONS } from "./geometry";
import {
  blurFragment,
  particleFragment,
  particleVertex,
  quadVertex,
  toneFragment,
} from "./shaders";

type Ctx = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  material: THREE.RawShaderMaterial;
  hdr: THREE.WebGLRenderTarget;
  half: THREE.WebGLRenderTarget;
  quarter: THREE.WebGLRenderTarget;
  bloomA: THREE.WebGLRenderTarget;
  bloomB: THREE.WebGLRenderTarget;
  quadScene: THREE.Scene;
  quadCam: THREE.OrthographicCamera;
  quad: THREE.Mesh;
  blurMat: THREE.RawShaderMaterial;
  toneMat: THREE.RawShaderMaterial;
  dispose: () => void;
};

const makeTarget = (w: number, h: number) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });

export const ParticleField: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<Ctx | null>(null);
  const pxScale = height / 1080;

  // Set-up must be a layout effect so it runs before the per-frame layout
  // effect below on the very first frame.
  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.autoClear = false;

    const geo = buildParticleGeometry();
    const material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      uniforms: {
        uTime: { value: 0 },
        uPxScale: { value: pxScale },
        uFocus: { value: 12 },
        uAperture: { value: 95 },
        uViewH: { value: height },
        uA: { value: RIBBONS.A.ctrl },
        uAW0: { value: RIBBONS.A.w0 },
        uAW1: { value: RIBBONS.A.w1 },
        uB: { value: RIBBONS.B.ctrl },
        uBW0: { value: RIBBONS.B.w0 },
        uBW1: { value: RIBBONS.B.w1 },
      },
    });
    const points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(points);
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);

    const hdr = makeTarget(width, height);
    // 2x box-filter downsample chain (bilinear tap at the shared corner of
    // 4 source texels) so small sparks never alias into bloom flicker.
    const half = makeTarget(width / 2, height / 2);
    const quarter = makeTarget(width / 4, height / 4);
    const bloomA = makeTarget(width / 8, height / 8);
    const bloomB = makeTarget(width / 8, height / 8);

    const quadGeo = new THREE.BufferGeometry();
    quadGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    const blurMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: quadVertex,
      fragmentShader: blurFragment,
      uniforms: { uTex: { value: null }, uDir: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    });
    const toneMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: quadVertex,
      fragmentShader: toneFragment,
      uniforms: {
        uHdr: { value: hdr.texture },
        uBloom: { value: bloomA.texture },
        uExposure: { value: 1.0 },
        uBloomStrength: { value: 1.0 },
        // warmer halo than the cores, as in the reference
        uBloomTint: { value: new THREE.Vector3(1.0, 0.6, 0.28) },
        uFrame: { value: 0 },
        // 4 px period at 1080p so the mesh downsamples cleanly (no moire)
        uGrid: { value: 4 * pxScale },
        uGridW: { value: 1 * pxScale },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(quadGeo, toneMat);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    ctxRef.current = {
      renderer,
      scene,
      camera,
      material,
      hdr,
      half,
      quarter,
      bloomA,
      bloomB,
      quadScene,
      quadCam,
      quad,
      blurMat,
      toneMat,
      dispose: () => {
        geo.dispose();
        material.dispose();
        quadGeo.dispose();
        blurMat.dispose();
        toneMat.dispose();
        hdr.dispose();
        half.dispose();
        quarter.dispose();
        bloomA.dispose();
        bloomB.dispose();
        renderer.dispose();
      },
    };
    return () => {
      ctxRef.current?.dispose();
      ctxRef.current = null;
    };
  }, [width, height, pxScale]);

  useLayoutEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const handle = delayRender(`Rendering particles frame ${frame}`);
    const t = frame / fps;
    const cam = getCamera(variant, frame / (durationInFrames - 1));
    const { renderer, camera, material } = ctx;

    camera.fov = cam.fov;
    camera.aspect = width / height;
    camera.position.set(...cam.position);
    camera.up.set(Math.sin(cam.roll), Math.cos(cam.roll), 0);
    camera.lookAt(...cam.target);
    // frame the collision point off-centre by shifting the view window
    camera.setViewOffset(
      width,
      height,
      (0.5 - cam.screen[0]) * width,
      (0.5 - cam.screen[1]) * height,
      width,
      height,
    );
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    material.uniforms.uTime.value = t;
    material.uniforms.uFocus.value = cam.focus;

    // 1) particles -> HDR target
    renderer.setRenderTarget(ctx.hdr);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(ctx.scene, camera);

    // 2) bloom: box downsample to 1/8 res + separable gaussian
    const blurPass = (src: THREE.Texture, dst: THREE.WebGLRenderTarget, dx: number, dy: number) => {
      ctx.quad.material = ctx.blurMat;
      ctx.blurMat.uniforms.uTex.value = src;
      ctx.blurMat.uniforms.uDir.value.set(dx / dst.width, dy / dst.height);
      renderer.setRenderTarget(dst);
      renderer.render(ctx.quadScene, ctx.quadCam);
    };
    blurPass(ctx.hdr.texture, ctx.half, 0, 0);
    blurPass(ctx.half.texture, ctx.quarter, 0, 0);
    blurPass(ctx.quarter.texture, ctx.bloomA, 0, 0);
    for (let k = 1; k <= 3; k++) {
      blurPass(ctx.bloomA.texture, ctx.bloomB, k, 0);
      blurPass(ctx.bloomB.texture, ctx.bloomA, 0, k);
    }

    // 3) tone map to canvas
    ctx.quad.material = ctx.toneMat;
    ctx.toneMat.uniforms.uFrame.value = frame;
    // the reference fades up over its first ~4 s
    const ramp = Math.min(1, 0.8 + (0.2 * t) / 4);
    ctx.toneMat.uniforms.uExposure.value = 1.3 * ramp;
    ctx.toneMat.uniforms.uBloomStrength.value = 2.0;
    renderer.setRenderTarget(null);
    renderer.render(ctx.quadScene, ctx.quadCam);
    renderer.getContext().finish();
    continueRender(handle);
  }, [frame, fps, durationInFrames, variant, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width, height }}
    />
  );
};
