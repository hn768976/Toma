import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CLOUD_SHOTS, CloudShotId } from "./cameraPaths";
import { buildCloudField, Puff, TILE_LENGTH } from "./field";
import { ATLAS_CELLS, getPuffAtlas } from "./puffTexture";
import {
  CLOUD_FRAGMENT,
  CLOUD_VERTEX,
  SKY_FRAGMENT,
  SKY_VERTEX,
} from "./shaders";
import { CloudPalette } from "./palettes";

// Colours are authored as display (sRGB) values and written straight to the
// canvas, so disable three's linear-workflow conversion.
THREE.ColorManagement.enabled = false;

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sky: THREE.ShaderMaterial;
  clouds: THREE.ShaderMaterial;
  geometry: THREE.InstancedBufferGeometry;
  posSize: THREE.InstancedBufferAttribute;
  data: THREE.InstancedBufferAttribute;
};

const deg = Math.PI / 180;
const BEHIND_MARGIN = 8;
const FOG_NEAR = 30;
const FAR_FADE = 22;

const createScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  maxInstances: number,
): SceneState => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: true,
    alpha: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 400);
  camera.rotation.order = "YXZ";

  const skyGeo = new THREE.BufferGeometry();
  skyGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  const sky = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uMoonDir: { value: new THREE.Vector3() },
      uMoonRadius: { value: 0.1 },
      uPixelAngle: { value: 0.001 },
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBelow: { value: new THREE.Color() },
      uMilkyWay: { value: new THREE.Color() },
      uMilkyWayNormal: { value: new THREE.Vector3() },
      uMoonGlow: { value: new THREE.Color() },
      uMoonLight: { value: new THREE.Color() },
      uMoonShadow: { value: new THREE.Color() },
    },
  });
  const skyMesh = new THREE.Mesh(skyGeo, sky);
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = 0;
  scene.add(skyMesh);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
      3,
    ),
  );
  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const posSize = new THREE.InstancedBufferAttribute(
    new Float32Array(maxInstances * 4),
    4,
  );
  const data = new THREE.InstancedBufferAttribute(
    new Float32Array(maxInstances * 4),
    4,
  );
  posSize.setUsage(THREE.DynamicDrawUsage);
  data.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("iPosSize", posSize);
  geometry.setAttribute("iData", data);

  const clouds = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERTEX,
    fragmentShader: CLOUD_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      uAtlas: { value: getPuffAtlas() },
      uAtlasCells: { value: ATLAS_CELLS },
      uMoonDir: { value: new THREE.Vector3() },
      uCloudDark: { value: new THREE.Color() },
      uCloudLit: { value: new THREE.Color() },
      uMoonColor: { value: new THREE.Color() },
      uFogColor: { value: new THREE.Color() },
      uFogGlow: { value: new THREE.Color() },
      uFogNear: { value: FOG_NEAR },
      uFogFar: { value: TILE_LENGTH - BEHIND_MARGIN - FAR_FADE },
      uBacklight: { value: 1 },
    },
  });
  const cloudMesh = new THREE.Mesh(geometry, clouds);
  cloudMesh.frustumCulled = false;
  cloudMesh.renderOrder = 1;
  scene.add(cloudMesh);

  return { renderer, scene, camera, sky, clouds, geometry, posSize, data };
};

export type MoonlitCloudsProps = {
  shotId: CloudShotId;
  palette: CloudPalette;
};

type Visible = { p: Puff; x: number; y: number; z: number; d: number; a: number };

export const MoonlitClouds: React.FC<MoonlitCloudsProps> = ({ shotId, palette }) => {
  const shot = CLOUD_SHOTS[shotId];
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const puffs = useMemo(() => buildCloudField(20240611, shot.heroes), [shot]);

  useLayoutEffect(() => {
    return () => {
      stateRef.current?.renderer.dispose();
      stateRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!stateRef.current) {
      stateRef.current = createScene(canvas, width, height, puffs.length);
    }
    const s = stateRef.current;
    const t = frame / fps;
    const pose = shot.pose(t, durationInFrames / fps);

    const cam = s.camera;
    cam.fov = shot.fovY;
    cam.aspect = width / height;
    cam.position.set(pose.x, pose.y, pose.z);
    cam.rotation.set(pose.pitch, -pose.yaw, -pose.roll);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    const az = shot.moonAzimuth * deg;
    const el = shot.moonElevation * deg;
    const moonDir = new THREE.Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      -Math.cos(az) * Math.cos(el),
    ).normalize();

    // --- sky uniforms ---------------------------------------------------
    const su = s.sky.uniforms;
    su.uInvProj.value.copy(cam.projectionMatrixInverse);
    su.uCamWorld.value.copy(cam.matrixWorld);
    su.uMoonDir.value.copy(moonDir);
    su.uMoonRadius.value = palette.moonRadiusDeg * deg;
    su.uPixelAngle.value = (2 * Math.tan((shot.fovY * deg) / 2)) / height;
    su.uTime.value = t;
    su.uZenith.value.set(palette.zenith);
    su.uHorizon.value.set(palette.horizon);
    su.uBelow.value.set(palette.below);
    su.uMilkyWay.value.set(palette.milkyWay);
    // milky way band runs from the upper left down towards the moon
    const mwA = new THREE.Vector3().setFromSphericalCoords(1, (90 - 19) * deg, (180 + 45) * deg);
    const mwB = new THREE.Vector3().setFromSphericalCoords(1, (90 - 2) * deg, (180 - 25) * deg);
    su.uMilkyWayNormal.value.crossVectors(mwA, mwB).normalize();
    su.uMoonGlow.value.set(palette.moonGlow);
    su.uMoonLight.value.set(palette.moonLight);
    su.uMoonShadow.value.set(palette.moonShadow);

    // --- cloud uniforms -------------------------------------------------
    const cu = s.clouds.uniforms;
    cu.uMoonDir.value.copy(moonDir);
    cu.uCloudDark.value.set(palette.cloudDark);
    cu.uCloudLit.value.set(palette.cloudLit);
    cu.uMoonColor.value.set(palette.moonLightOnClouds);
    cu.uFogColor.value.set(palette.fog);
    cu.uFogGlow.value.set(palette.fogGlow);
    cu.uBacklight.value = palette.backlight;

    // --- place, cull and depth-sort puffs ---------------------------------
    const view = cam.matrixWorldInverse.elements;
    const tanY = Math.tan((shot.fovY * deg) / 2);
    const tanX = tanY * (width / height);
    const far = TILE_LENGTH - BEHIND_MARGIN;
    const visible: Visible[] = [];
    for (const p of puffs) {
      let z = p.z;
      if (p.wraps) {
        const ref = pose.z + BEHIND_MARGIN;
        z = ref - ((((ref - p.z) % TILE_LENGTH) + TILE_LENGTH) % TILE_LENGTH);
      }
      const x = p.x;
      const y = p.y;
      // view-space position
      const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
      const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
      const vz = view[2] * x + view[6] * y + view[10] * z + view[14];
      const depth = -vz;
      if (depth < -p.size) continue;
      const pad = p.size * 1.5;
      if (Math.abs(vx) > depth * tanX + pad) continue;
      if (Math.abs(vy) > depth * tanY + pad) continue;
      const dist = Math.hypot(x - pose.x, y - pose.y, z - pose.z);
      // fade puffs the camera is about to fly through, and at the far edge
      const nearA = Math.min(1, Math.max(0, (dist - p.size * 0.55) / (p.size * 1.1)));
      // optionally also dissolve puffs whose billboard would cut the lens plane
      const lensA = shot.lensFade
        ? Math.min(1, Math.max(0, (depth - p.size * 1.1) / (p.size * 1.4)))
        : 1;
      const farA = Math.min(1, Math.max(0, (far - (pose.z - z)) / FAR_FADE));
      const a = nearA * lensA * farA;
      if (a <= 0.002) continue;
      visible.push({ p, x, y, z, d: dist, a });
    }
    visible.sort((a, b) => b.d - a.d);

    const ps = s.posSize.array as Float32Array;
    const da = s.data.array as Float32Array;
    for (let i = 0; i < visible.length; i++) {
      const v = visible[i];
      ps[i * 4] = v.x;
      ps[i * 4 + 1] = v.y;
      ps[i * 4 + 2] = v.z;
      ps[i * 4 + 3] = v.p.size;
      da[i * 4] = v.p.cell;
      da[i * 4 + 1] = v.p.flip;
      da[i * 4 + 2] = v.p.shade;
      da[i * 4 + 3] = v.a;
    }
    s.posSize.needsUpdate = true;
    s.data.needsUpdate = true;
    s.geometry.instanceCount = visible.length;

    s.renderer.render(s.scene, cam);
    s.renderer.getContext().finish();
  }, [frame, fps, width, height, durationInFrames, shot, palette, puffs]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
