import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { CAMERA, GRID } from "./config";
import { LOOK, PALETTES, PaletteName, hexToSrgb } from "./look";
import {
  AA_FRAG,
  BLUR_FRAG,
  COPY_FRAG,
  DOF_FRAG,
  FINAL_FRAG,
  FULLSCREEN_VERT,
  HEIGHT_FRAG,
  SHADE_FRAG,
  SURFACE_FRAG,
  SURFACE_VERT,
} from "./shaders";

const DOF_MAIN_TAPS = 24;
const DOF_FILL_TAPS = 12;

const fullscreenGeometry = () => {
  // One oversized triangle covering the viewport.
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
};

const gridGeometry = (cols: number, rows: number) => {
  const pos = new Float32Array(cols * rows * 3);
  let k = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      pos[k++] = i / (cols - 1);
      pos[k++] = j / (rows - 1);
      pos[k++] = 0;
    }
  }
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
  k = 0;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      idx[k++] = a;
      idx[k++] = a + 1;
      idx[k++] = a + cols;
      idx[k++] = a + 1;
      idx[k++] = a + cols + 1;
      idx[k++] = a + cols;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
};

const cameraUniforms = (aspect: number) => {
  const pitch = (CAMERA.pitchDeg * Math.PI) / 180;
  const tanY = Math.tan((CAMERA.fovDeg * Math.PI) / 360);
  const tanX = tanY * aspect;
  const pos = new THREE.Vector3(0, CAMERA.height, 0);
  const fwd = new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch));
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(right, fwd);
  // The over-scanned grid must stay below the horizon.
  const horizonNdc = Math.tan(pitch) / tanY;
  const ndcTop = Math.min(GRID.ndcTop, horizonNdc - 0.04);
  // Row spacing: slope inside the frame, normalised so rowMap(1) = 1.
  const inside = 1 / (GRID.sparse + (1 - GRID.sparse) * (1 - GRID.blendStart - GRID.blendWidth / 2));
  const cam = new THREE.PerspectiveCamera(CAMERA.fovDeg, aspect, 0.05, 400);
  cam.position.copy(pos);
  cam.lookAt(pos.clone().add(fwd));
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  const viewProj = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return {
    uNdc: { value: new THREE.Vector4(GRID.ndcLeft, GRID.ndcRight, GRID.ndcBottom, ndcTop) },
    uRows: { value: new THREE.Vector4(GRID.blendStart, GRID.blendWidth, inside * GRID.sparse, inside) },
    uCamPos: { value: pos },
    uCamRight: { value: right },
    uCamUp: { value: up },
    uCamFwd: { value: fwd },
    uTanHalf: { value: new THREE.Vector2(tanX, tanY) },
    uViewProj: { value: viewProj },
  };
};

type Pipeline = ReturnType<typeof createPipeline>;

const createPipeline = (bufW: number, bufH: number, paletteName: PaletteName) => {
  const aspect = bufW / bufH;
  const cam = cameraUniforms(aspect);
  const ndc = cam.uNdc.value;
  // Height map: one texel per output pixel inside the frame.
  const hW = Math.round(((ndc.y - ndc.x) / 2) * bufW * GRID.heightMapScale);
  const hH = Math.round(((ndc.w - ndc.z) / 2) * cam.uRows.value.w * bufH * GRID.heightMapScale);
  const rt = (w: number, h: number, opts: Partial<THREE.RenderTargetOptions> = {}) =>
    new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      generateMipmaps: false,
      colorSpace: THREE.NoColorSpace,
      ...opts,
    });
  const heightRT = rt(hW, hH);
  const shadeRT = rt(hW, hH);
  const sceneRT = rt(bufW, bufH, { depthBuffer: true, samples: GRID.samples });
  const aaA = rt(bufW, bufH);
  const aaB = rt(bufW, bufH);
  const halfW = Math.ceil(bufW / 2);
  const halfH = Math.ceil(bufH / 2);
  const halfA = rt(halfW, halfH);
  const halfB = rt(halfW, halfH);
  const qW = Math.ceil(bufW / 4);
  const qH = Math.ceil(bufH / 4);
  const glowA = rt(qW, qH);
  const glowB = rt(qW, qH);

  const mat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, vertexShader = FULLSCREEN_VERT) =>
    new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });

  const palette = PALETTES[paletteName];
  const heightTexel = new THREE.Vector2(1 / hW, 1 / hH);
  const aspectUv = new THREE.Vector2(bufH / bufW, 1);
  const dof = new THREE.Vector4(LOOK.dof.focusDistance, LOOK.dof.nearBlur, LOOK.dof.farBlur, LOOK.dof.maxBlur);

  const heightMat = mat(HEIGHT_FRAG, { ...cam, uTime: { value: 0 }, uTexel: { value: heightTexel } });
  const shadeMat = mat(SHADE_FRAG, {
    ...cam,
    tHeight: { value: heightRT.texture },
    uTexel: { value: heightTexel },
    uBufferHeight: { value: bufH },
    uFresnelPower: { value: LOOK.light.fresnelPower },
    uLight: { value: new THREE.Vector3(LOOK.light.nearLevel, LOOK.light.falloffStart, LOOK.light.falloffEnd) },
    uFar: { value: new THREE.Vector3(LOOK.light.farLevel, LOOK.light.farStart, LOOK.light.farEnd) },
    uHaze: { value: new THREE.Vector3(LOOK.haze.amount, LOOK.haze.start, LOOK.haze.end) },
  });
  const surfaceMat = mat(
    SURFACE_FRAG.replace("FOOTPRINT_TAPS", String(GRID.footprintTaps)),
    {
      ...cam,
      tHeight: { value: heightRT.texture },
      tShade: { value: shadeRT.texture },
      uTexel: { value: heightTexel },
    },
    SURFACE_VERT,
  );
  surfaceMat.depthTest = true;
  surfaceMat.depthWrite = true;
  // Slopes facing away from the camera are never visible on a height field;
  // culling them stops edge-on slivers leaking through at crest silhouettes.
  surfaceMat.side = THREE.FrontSide;

  const copyMat = mat(COPY_FRAG, { tColor: { value: null } });
  const aaSigma = Math.max(LOOK.dof.minBlur * bufH, 0.3);
  const aaMat = mat(AA_FRAG.replace("AA_RADIUS", String(Math.ceil(aaSigma * 2.5))), {
    tColor: { value: null },
    uStep: { value: new THREE.Vector2() },
    uSigma: { value: aaSigma },
  });
  const dofUniforms = (src: THREE.Texture, radiusScale: number, rotate: number) => ({
    tColor: { value: src },
    uAspect: { value: aspectUv },
    uDof: { value: dof },
    uRadiusScale: { value: radiusScale },
    uRotate: { value: rotate },
  });
  const dofMain = mat(DOF_FRAG.replace("TAP_COUNT", String(DOF_MAIN_TAPS)), dofUniforms(halfA.texture, 1, 0));
  const dofFill = mat(
    DOF_FRAG.replace("TAP_COUNT", String(DOF_FILL_TAPS)),
    dofUniforms(halfB.texture, Math.sqrt(Math.PI / DOF_MAIN_TAPS) * 0.9, 1.1),
  );
  const blurMat = mat(BLUR_FRAG, { tColor: { value: null }, uStep: { value: new THREE.Vector2() } });
  const finalMat = mat(FINAL_FRAG.replace(/RAMP_STOPS/g, String(palette.ramp.length)), {
    uRampColor: { value: palette.ramp.map((s) => new THREE.Vector3(...hexToSrgb(s.color))) },
    uRampAt: { value: palette.ramp.map((s) => s.at) },
    uExposure: { value: LOOK.exposure },
    uBlackPoint: { value: LOOK.blackPoint },
    tScene: { value: aaB.texture },
    tDof: { value: halfA.texture },
    tGlow: { value: glowA.texture },
    uDof: { value: dof },
    uBlend: { value: new THREE.Vector2(LOOK.dof.blendStart, LOOK.dof.blendEnd) },
    uGlow: { value: LOOK.glow.strength },
    uVignette: { value: LOOK.vignette },
    uGrain: { value: LOOK.grain },
    uDither: { value: LOOK.dither },
    uFrame: { value: 0 },
    uResolution: { value: new THREE.Vector2(bufW, bufH) },
  });

  const tri = fullscreenGeometry();
  const quad = new THREE.Mesh(tri, heightMat);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  // Mesh density follows the output size so 1080p and 4K look the same.
  const cols = Math.round((((ndc.y - ndc.x) / 2) * bufW) / GRID.pixelsPerColumn);
  const rows = Math.round(hH / GRID.heightMapScale / GRID.pixelsPerRow);
  const surface = new THREE.Mesh(gridGeometry(cols, rows), surfaceMat);
  surface.frustumCulled = false;
  const surfaceScene = new THREE.Scene();
  surfaceScene.add(surface);
  const dummyCam = new THREE.Camera();
  const black = new THREE.Color(0, 0, 0);

  const pass = (
    gl: THREE.WebGLRenderer,
    material: THREE.RawShaderMaterial,
    target: THREE.WebGLRenderTarget,
    source?: THREE.Texture,
  ) => {
    if (source) material.uniforms.tColor.value = source;
    quad.material = material;
    gl.setRenderTarget(target);
    gl.render(quadScene, dummyCam);
  };

  const render = (gl: THREE.WebGLRenderer, time: number, frame: number) => {
    const prevAutoClear = gl.autoClear;
    gl.autoClear = true;
    // 1. wave heights, 2. shading in texture space
    heightMat.uniforms.uTime.value = time;
    pass(gl, heightMat, heightRT);
    pass(gl, shadeMat, shadeRT);

    // 3. the displaced surface. Empty pixels: black, and far (takes far blur).
    gl.setRenderTarget(sceneRT);
    gl.setClearColor(black, 400);
    gl.render(surfaceScene, dummyCam);
    gl.setClearColor(black, 1);

    // 4a. anti-alias the in-focus picture (small gaussian, H then V)
    aaMat.uniforms.uStep.value.set(1 / bufW, 0);
    pass(gl, aaMat, aaA, sceneRT.texture);
    aaMat.uniforms.uStep.value.set(0, 1 / bufH);
    pass(gl, aaMat, aaB, aaA.texture);

    // 4b. depth of field at half resolution: halfA -> halfB -> halfA
    pass(gl, copyMat, halfA, sceneRT.texture);
    pass(gl, dofMain, halfB);
    pass(gl, dofFill, halfA);

    // 5. glow: quarter size, three widening gaussian rounds.
    pass(gl, copyMat, glowA, halfA.texture);
    const sigmaTexels = (LOOK.glow.radius * bufH) / 4;
    const unit = sigmaTexels / (1.8 * Math.sqrt(1 + 4 + 9));
    for (let i = 1; i <= 3; i++) {
      blurMat.uniforms.uStep.value.set((unit * i) / qW, 0);
      pass(gl, blurMat, glowB, glowA.texture);
      blurMat.uniforms.uStep.value.set(0, (unit * i) / qH);
      pass(gl, blurMat, glowA, glowB.texture);
    }
    // 6. the final pass is drawn by <ThreeCanvas> itself.
    finalMat.uniforms.uFrame.value = frame;
    gl.setRenderTarget(null);
    gl.autoClear = prevAutoClear;
  };

  const dispose = () => {
    [heightRT, shadeRT, sceneRT, aaA, aaB, halfA, halfB, glowA, glowB].forEach((t) => t.dispose());
    [heightMat, shadeMat, surfaceMat, copyMat, aaMat, dofMain, dofFill, blurMat, finalMat].forEach((m) => m.dispose());
    tri.dispose();
    surface.geometry.dispose();
  };

  return { render, dispose, finalMat, tri };
};

/**
 * Renders the wave pipeline for the current frame.
 *
 * No useFrame / requestAnimationFrame: the off-screen passes run in a layout
 * effect keyed on useCurrentFrame(); <ThreeCanvas> then draws the scene graph
 * below (one full-screen triangle holding the final pass) exactly once.
 */
export const WavesScene: React.FC<{ palette: PaletteName; frameOverride?: number }> = ({
  palette,
  frameOverride,
}) => {
  const currentFrame = useCurrentFrame();
  const frame = frameOverride ?? currentFrame;
  const { fps } = useVideoConfig();
  const gl = useThree((s) => s.gl);
  const size = useMemo(() => {
    const v = gl.getDrawingBufferSize(new THREE.Vector2());
    return [v.x, v.y] as const;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, gl.domElement.width, gl.domElement.height]);
  const pipeline: Pipeline = useMemo(() => createPipeline(size[0], size[1], palette), [size, palette]);
  useEffect(() => () => pipeline.dispose(), [pipeline]);

  useLayoutEffect(() => {
    pipeline.render(gl, frame / fps, frame);
  }, [pipeline, gl, frame, fps]);

  return <mesh frustumCulled={false} geometry={pipeline.tri} material={pipeline.finalMat} />;
};
