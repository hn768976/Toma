import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";
import * as THREE from "three";
import { failOnShaderError } from "../lib/shaderErrors";
import { loopFrame } from "../lib/timing";
import { mulberry32 } from "../lib/random";
import { useAsyncResource } from "../lib/useAsyncResource";
import { basisOf, cameraAt, depthAt, MAP_CAMERA, tanHalfH, tanHalfV } from "./camera";
import { getMapTexture, type MapTexture } from "./buildTexture";
import { MAP_REGIONS } from "./regions";
import { paperFragment, paperVertex, postFragment, postVertex } from "./shaders";

export type VintageMapProps = { region: string };

// Pixel ratio: the real one while rendering (so --scale works), capped in the
// Studio preview so a 4K composition stays interactive.
export const useRenderDpr = () => {
  const { isRendering } = useRemotionEnvironment();
  return isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);
};

export const VintageMap: React.FC<VintageMapProps> = ({ region }) => {
  const { width, height } = useVideoConfig();
  const dpr = useRenderDpr();
  const r = MAP_REGIONS[region];
  const screenW = Math.round(width * dpr);
  const tex = useAsyncResource(`${region}@${screenW}`, () => getMapTexture(r, screenW), `Building map texture ${region}`);
  return (
    <AbsoluteFill style={{ backgroundColor: "#2a1408" }}>
      {tex ? (
        <ThreeCanvas
          onCreated={(state) => failOnShaderError(state.gl)}
          width={width}
          height={height}
          dpr={dpr}
          linear
          flat
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        >
          <MapScene tex={tex} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};

const MapScene: React.FC<{ tex: MapTexture }> = ({ tex }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);

  const res = useMemo(() => {
    const scene = new THREE.Scene();
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    const k = tex.texelsPerUnit;
    // Seeded crease lines across the paper.
    const rnd = mulberry32(4242 + tex.regionId.length);
    const creases = Array.from({ length: 4 }, () => {
      const a = rnd() * Math.PI;
      return new THREE.Vector4(Math.cos(a), Math.sin(a), (rnd() - 0.5) * 1.6, 0.6 + rnd() * 0.6);
    });
    const textures: THREE.Texture[] = [];
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];
    for (const t of tex.tiles) {
      const texture = new THREE.CanvasTexture(t.canvas);
      texture.colorSpace = THREE.NoColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = Math.min(16, maxAniso);
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      textures.push(texture);
      const cw = t.canvas.width, ch = t.canvas.height;
      const material = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: paperVertex,
        fragmentShader: paperFragment,
        uniforms: {
          uMap: { value: texture },
          // flipY: canvas row 0 is uv.y = 1
          uUvMin: { value: new THREE.Vector2(t.gutter / cw, t.gutter / ch) },
          uUvMax: { value: new THREE.Vector2((t.gutter + t.w) / cw, (t.gutter + t.h) / ch) },
          uPaperOrigin: { value: new THREE.Vector2((tex.minX + tex.maxX) / 2, (tex.minY + tex.maxY) / 2) },
          uViewWidth: { value: tex.path.viewWidth },
          uCreases: { value: creases },
        },
      });
      materials.push(material);
      const w = t.w / k, h = t.h / k;
      const geometry = new THREE.PlaneGeometry(w, h);
      geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(tex.minX + (t.x + t.w / 2) / k, tex.maxY - (t.y + t.h / 2) / k, 0);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
    const camera = new THREE.PerspectiveCamera(MAP_CAMERA.verticalFovDeg, MAP_CAMERA.aspect, tex.path.distance * 0.05, tex.path.distance * 20);

    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    });
    const postMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: postVertex,
      fragmentShader: postFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uScene: { value: target.texture },
        uResolution: { value: new THREE.Vector2() },
        uCamPos: { value: new THREE.Vector3() },
        uFwd: { value: new THREE.Vector3() },
        uRight: { value: new THREE.Vector3() },
        uUp: { value: new THREE.Vector3() },
        uTanHalf: { value: new THREE.Vector2(tanHalfH(), tanHalfV()) },
        uFocusDepth: { value: 1 },
        uBand: { value: new THREE.Vector4() },
        uMaxBlur: { value: new THREE.Vector2() },
        uExposure: { value: 1 },
        uGrainFrame: { value: 0 },
        uGrainAmount: { value: 0.03 },
      },
    });
    const postGeometry = new THREE.BufferGeometry();
    postGeometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const postMesh = new THREE.Mesh(postGeometry, postMaterial);
    postMesh.frustumCulled = false;
    const postScene = new THREE.Scene();
    postScene.add(postMesh);
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { scene, camera, target, postMaterial, postScene, postCamera, textures, materials, geometries, postGeometry };
  }, [gl, tex]);

  useEffect(
    () => () => {
      res.textures.forEach((t) => t.dispose());
      res.materials.forEach((m) => m.dispose());
      res.geometries.forEach((g) => g.dispose());
      res.target.dispose();
      res.postMaterial.dispose();
      res.postGeometry.dispose();
    },
    [res],
  );

  // Priority 1: we render the passes ourselves. The frame comes from Remotion.
  useFrame(() => {
    const f = frameRef.current;
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    if (res.target.width !== buf.x || res.target.height !== buf.y) res.target.setSize(buf.x, buf.y);

    const cam = cameraAt(tex.path, f);
    const b = basisOf(cam);
    res.camera.position.set(...cam.position);
    res.camera.up.set(...b.up);
    res.camera.lookAt(...cam.target);
    res.camera.updateMatrixWorld();
    res.camera.updateProjectionMatrix();

    const u = res.postMaterial.uniforms;
    u.uResolution.value.set(buf.x, buf.y);
    u.uCamPos.value.set(...b.pos);
    u.uFwd.value.set(...b.fwd);
    u.uRight.value.set(...b.right);
    u.uUp.value.set(...b.up);
    const zf = depthAt(b, 0, 0);
    u.uFocusDepth.value = zf;
    // sharp band through the middle third of the frame
    u.uBand.value.set(depthAt(b, 0, -0.3) / zf - 1, depthAt(b, 0, 0.3) / zf - 1, depthAt(b, 0, -1) / zf - 1, depthAt(b, 0, 1) / zf - 1);
    u.uMaxBlur.value.set(0.0022 * buf.x, 0.0065 * buf.x);
    // old-film exposure breathing, about 1.5%
    u.uExposure.value = 1.2 + 0.008 * Math.sin((f / 30) * 2.1) + 0.006 * Math.sin((f / 30) * 5.3 + 1.3) + 0.003 * Math.sin((f / 30) * 11.7 + 0.4);
    u.uGrainFrame.value = loopFrame(f);

    gl.setRenderTarget(res.target);
    gl.clear();
    gl.render(res.scene, res.camera);
    gl.setRenderTarget(null);
    gl.render(res.postScene, res.postCamera);
  }, 1);

  return null;
};
