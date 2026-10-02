import { ThreeCanvas } from "@remotion/three";
import { useThree, useFrame } from "@react-three/fiber";
import {
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  DirectionalLight,
  HalfFloatType,
  HemisphereLight,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  SpotLight,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ACRONYMS, type AcronymRow } from "../data/acronyms";
import { planCubes, poseAt, type CubePlan } from "../lib/motion";
import {
  BEVEL,
  CUBE,
  PAPER_H,
  PAPER_W,
  PAPER_Z0,
  cameraAt,
  keyLightAt,
} from "../lib/world";
import { PAPER_RGB } from "../textures/paper";
import { CONTACT_SIZE } from "../textures/wood";
import { loadSceneAssets, type SceneAssets } from "./assets";
import { addShaderDither, GrainEffect } from "./grain";
import { installPCSS, PCSS_SHADOW_TYPE } from "./pcss";

// Patch the shadow shader before anything compiles (see pcss.ts).
installPCSS(14, 16);

// Lighting levels (physically based units, linear).
// Irradiance budget on bare paper (relative): spot 0.8, gap between spots
// ~0.53, cube shadow 0.3 (= fill + ambient), as measured off the reference.
const KEY_COLOR = new Color(1.0, 0.64, 0.38);
const KEY_INTENSITY = 5.3; // candela, decay 0 (no distance falloff)
const KEY_ANGLE = 0.64; // cone half-angle (rad), covers the whole sheet
const FILL_COLOR = new Color(1.0, 0.95, 0.88);
const FILL_INTENSITY = 0.4 * KEY_INTENSITY; // 40% of the key
const AMBIENT = 0.3;
const EXPOSURE = 1.0;

const DOF_FOCUS_RANGE = 3.4;
const DOF_BOKEH_AT_2160 = 1.8;
const GRAIN = 0.0175; // 1.75% film grain (sd, display space)


type Props = { row: AcronymRow; assets: SceneAssets };

const Scene: React.FC<Props> = ({ row, assets }) => {
  const frame = useCurrentFrame();
  const { gl, scene, camera, size } = useThree();
  const plans = useMemo(() => planCubes(row), [row]);
  const frameUniform = useMemo(() => ({ value: 0 }), []);

  // --- textures & materials (built once) ---------------------------------
  // Near top-down view: 4x anisotropic filtering is plenty (and cheaper).
  const maxAniso = Math.min(4, gl.capabilities.getMaxAnisotropy());
  const paperMat = useMemo(() => {
    const t = new CanvasTexture(assets.paper);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = maxAniso;
    t.minFilter = LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    const m = new MeshStandardMaterial({ map: t, roughness: 0.93, metalness: 0 });
    addShaderDither(m, frameUniform);
    return m;
  }, [assets.paper, maxAniso, frameUniform]);

  const cubeGeom = useMemo(() => new RoundedBoxGeometry(CUBE, CUBE, CUBE, 6, BEVEL), []);
  const cubeMats = useMemo(
    () =>
      assets.faces.map((faces) =>
        faces.map((canvas) => {
          const t = new CanvasTexture(canvas);
          t.colorSpace = SRGBColorSpace;
          t.anisotropy = maxAniso;
          t.minFilter = LinearMipmapLinearFilter;
          const m = new MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0 });
          addShaderDither(m, frameUniform);
          return m;
        }),
      ),
    [assets.faces, maxAniso, frameUniform],
  );

  const contact = useMemo(() => {
    const t = new CanvasTexture(assets.contact);
    const geom = new PlaneGeometry(CONTACT_SIZE * CUBE, CONTACT_SIZE * CUBE);
    geom.rotateX(-Math.PI / 2);
    return { t, geom };
  }, [assets.contact]);
  const contactMats = useMemo(
    () =>
      plans.map(
        () =>
          new MeshBasicMaterial({
            color: 0x000000,
            map: contact.t,
            transparent: true,
            depthWrite: false,
            opacity: 0,
          }),
      ),
    [plans, contact.t],
  );

  const paperGeom = useMemo(() => {
    const g = new PlaneGeometry(PAPER_W, PAPER_H);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  // --- lights ---------------------------------------------------------------
  const key = useMemo(() => {
    const t = new CanvasTexture(assets.pattern);
    t.colorSpace = NoColorSpace; // linear transmission values
    t.wrapS = ClampToEdgeWrapping;
    t.wrapT = ClampToEdgeWrapping;
    t.minFilter = LinearMipmapLinearFilter;
    const l = new SpotLight(KEY_COLOR, KEY_INTENSITY, 0, KEY_ANGLE, 0.18, 0);
    l.map = t;
    l.castShadow = true;
    l.shadow.mapSize.set(4096, 4096);
    l.shadow.bias = -0.00035;
    l.shadow.normalBias = 0.012;
    l.shadow.camera.near = 10;
    l.shadow.camera.far = 40;
    return l;
  }, [assets.pattern]);

  const fill = useMemo(() => {
    const l = new DirectionalLight(FILL_COLOR, FILL_INTENSITY);
    l.position.set(9, 12, 7);
    return l;
  }, []);
  const ambient = useMemo(
    () => new HemisphereLight(new Color(0.84, 0.92, 1.0), new Color(0.96, 0.93, 0.88), AMBIENT),
    [],
  );

  // --- post: DoF -> ACES tone mapping -> grain (synchronous, no state) ------
  const post = useMemo(() => {
    gl.toneMapping = NoToneMapping;
    gl.toneMappingExposure = EXPOSURE;
    const composer = new EffectComposer(gl, {
      frameBufferType: HalfFloatType,
      multisampling: 4,
    });
    composer.addPass(new RenderPass(scene, camera));
    const dof = new DepthOfFieldEffect(camera, {
      focusDistance: cameraAt(0).distance,
      focusRange: DOF_FOCUS_RANGE,
      bokehScale: DOF_BOKEH_AT_2160,
      resolutionScale: 0.5,
    });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const grain = new GrainEffect(GRAIN);
    composer.addPass(new EffectPass(camera, dof, tone, grain));
    composer.setSize(size.width, size.height, false);
    const bufH = gl.getDrawingBufferSize(new Vector2()).y;
    // Blur radius scales with output resolution, so 1080p, 4K and 6000 px
    // stills get the same look.
    dof.bokehScale = DOF_BOKEH_AT_2160 * (bufH / 2160);
    return { composer, dof, grain };
  }, [gl, scene, camera, size.width, size.height]);

  useEffect(() => () => post.composer.dispose(), [post]);

  // --- per-frame state: everything derived from `frame` ----------------------
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    const c = cameraAt(frame);
    cam.fov = c.fov;
    cam.near = 2;
    cam.far = 60;
    cam.aspect = size.width / size.height;
    cam.position.set(...c.position);
    cam.up.set(0, 1, 0);
    cam.lookAt(new Vector3(...c.lookAt));
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    const k = keyLightAt(frame);
    key.position.set(...k.position);
    key.target.position.set(...k.target);
    key.target.updateMatrixWorld();

    frameUniform.value = frame;
    post.grain.frame = frame;
    // Focus on the cube tops; the far edge of the sheet goes slightly soft.
    post.dof.cocMaterial.focusDistance = c.distance;
    post.dof.cocMaterial.focusRange = DOF_FOCUS_RANGE;
  }, [frame, camera, size, key, post, frameUniform]);

  // Remotion's ThreeCanvas calls advance() once per frame; we render through
  // the composer (priority 1 replaces R3F's default render).
  useFrame(() => {
    post.composer.render();
  }, 1);

  return (
    <>
      <primitive object={key} />
      <primitive object={key.target} />
      <primitive object={fill} />
      <primitive object={ambient} />
      <mesh geometry={paperGeom} material={paperMat} position={[0, 0, PAPER_Z0]} receiveShadow />
      {plans.map((plan, i) => (
        <Cube
          key={plan.index}
          plan={plan}
          frame={frame}
          geometry={cubeGeom}
          materials={cubeMats[i]}
          contactGeom={contact.geom}
          contactMat={contactMats[i]}
        />
      ))}
    </>
  );
};

const Cube: React.FC<{
  plan: CubePlan;
  frame: number;
  geometry: RoundedBoxGeometry;
  materials: MeshStandardMaterial[];
  contactGeom: PlaneGeometry;
  contactMat: MeshBasicMaterial;
}> = ({ plan, frame, geometry, materials, contactGeom, contactMat }) => {
  const pose = poseAt(plan, frame);
  // Contact darkening: strongest when the cube sits flat on the paper,
  // fading as it tips onto an edge or lifts off.
  const up = new Vector3(0, 1, 0);
  const align = Math.max(
    ...[new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].map((a) =>
      Math.abs(a.applyQuaternion(pose.quaternion).dot(up)),
    ),
  );
  const flat = Math.pow(Math.min(Math.max((align - 0.9) / 0.1, 0), 1), 1.5);
  const ground = Math.max(0, 1 - pose.lift / 0.25);
  contactMat.opacity = pose.visible ? 0.62 * flat * ground : 0;
  return (
    <>
      <mesh
        geometry={geometry}
        material={materials}
        position={pose.position}
        quaternion={pose.quaternion}
        visible={pose.visible}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={contactGeom}
        material={contactMat}
        position={[pose.position.x, 0.002, pose.position.z]}
        visible={pose.visible && contactMat.opacity > 0.001}
        renderOrder={1}
      />
    </>
  );
};

// Gate: hold the frame until the font and every texture exist.
const useSceneAssets = (row: AcronymRow) => {
  const [handle] = useState(() =>
    delayRender(`Building textures for ${row.id}`, { timeoutInMilliseconds: 180000 }),
  );
  const [assets, setAssets] = useState<SceneAssets | null>(null);
  useEffect(() => {
    loadSceneAssets(row).then(setAssets).catch((e) => cancelRender(e));
  }, [row]);
  useEffect(() => {
    // Released only after the <ThreeCanvas> has mounted (it holds its own
    // delayRender until R3F has drawn the frame).
    if (assets) continueRender(handle);
  }, [assets, handle]);
  return assets;
};

export const AcronymCubes: React.FC<{ id: string }> = ({ id }) => {
  const row = useMemo(() => {
    const r = ACRONYMS.find((a) => a.id === id);
    if (!r) throw new Error(`Unknown acronym ${id}`);
    return r;
  }, [id]);
  const { width, height } = useVideoConfig();
  const assets = useSceneAssets(row);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return (
    <AbsoluteFill style={{ backgroundColor: `rgb(${PAPER_RGB.join(",")})` }}>
      {assets ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          linear={false}
          flat
          shadows={{ type: PCSS_SHADOW_TYPE, enabled: true }}
          gl={{
            antialias: false,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
            stencil: false,
          }}
          camera={{ fov: 30, near: 2, far: 60, position: [0, 16, 3] }}
        >
          <Scene row={row} assets={assets} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
