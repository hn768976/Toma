import { Bloom, DepthOfField, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import { ToneMappingMode } from "postprocessing";
import React, { useEffect, useMemo } from "react";
import {
  Color,
  HalfFloatType,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Texture,
  Vector3,
} from "three";
import { useCurrentFrame, useDelayRender } from "remotion";
import { CAM_OVERRIDE, POST_MODE } from "./env";
import { Post } from "./Post";
import { DURATION, LookConfig, wrap01 } from "./looks";
import { makeBokehMaterial, makeEmissiveMaterial } from "./materials";
import {
  buildCollarPlacements,
  buildRig,
  collarRadius,
  collarRingOffsets,
  makeCollarGeometry,
  makeCollarRingGeometry,
} from "./rig";
import { mulberry32 } from "./random";

/* ------------------------------------------------------------------ *
 * Texture filtering
 * ------------------------------------------------------------------ */

/**
 * Anisotropic filtering, set to whatever the renderer actually supports.
 *
 * These surfaces are seen at extreme glancing angles, which is exactly where
 * trilinear filtering gives up. Without this the digits on the receding end of
 * every cable smear to grey however large the texture is.
 */
const AnisotropySetup: React.FC<{ digits: Texture }> = ({ digits }) => {
  const gl = useThree((s) => s.gl);
  useMemo(() => {
    const max = gl.capabilities.getMaxAnisotropy();
    digits.anisotropy = max;
    digits.needsUpdate = true;
    (globalThis as Record<string, unknown>).__MAX_ANISOTROPY__ = max;
  }, [gl, digits]);
  return null;
};

/* ------------------------------------------------------------------ *
 * Camera -- fixed. All the motion is in the data flow.
 * ------------------------------------------------------------------ */

const CameraRig: React.FC<{ config: LookConfig }> = ({ config }) => {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useMemo(() => {
    const { position, lookAt, fov } = CAM_OVERRIDE ?? config.camera;
    camera.position.set(position[0], position[1], position[2]);
    camera.fov = fov;
    camera.aspect = size.width / size.height;
    camera.near = 0.1;
    camera.far = 260;
    camera.lookAt(new Vector3(lookAt[0], lookAt[1], lookAt[2]));
    camera.updateProjectionMatrix();
  }, [camera, config, size]);
  return null;
};

/* ------------------------------------------------------------------ *
 * Strands
 * ------------------------------------------------------------------ */

const Strands: React.FC<{
  config: LookConfig;
  digits: Texture;
  frame: number;
  mirrored?: boolean;
}> = ({ config, digits, frame, mirrored = false }) => {
  const rig = useMemo(
    () => buildRig(config, digits, { mirrored }),
    [config, digits, mirrored],
  );

  // Every animated value is a pure function of the frame. No clock, no delta.
  const progress = frame / DURATION;
  for (const { def, material } of rig) {
    material.uniforms.uScroll.value = wrap01(def.scrollRepeats * progress);
    material.uniforms.uMaskScroll.value = wrap01(def.maskRepeats * progress);
  }

  return (
    <>
      {rig.map((entry, i) => (
        <mesh key={i} geometry={entry.geometry} material={entry.material} />
      ))}
    </>
  );
};

/* ------------------------------------------------------------------ *
 * Connector collars
 * ------------------------------------------------------------------ */

const Collars: React.FC<{ config: LookConfig }> = ({ config }) => {
  const meshes = useMemo(() => {
    const placements = buildCollarPlacements(config);
    if (placements.length === 0) return null;

    const radius = collarRadius(config);
    const body = new InstancedMesh(
      makeCollarGeometry(radius),
      // Matte black hardware with a low-roughness sheen, so it catches a
      // highlight and reads as a fitting rather than as a shadow.
      new MeshStandardMaterial({
        color: new Color("#141a26").convertSRGBToLinear(),
        metalness: 0.3,
        roughness: 0.55,
      }),
      placements.length,
    );

    const offsets = collarRingOffsets(radius);
    const rings = new InstancedMesh(
      makeCollarRingGeometry(radius),
      makeEmissiveMaterial(config.palette.rim, 1.25),
      placements.length * offsets.length,
    );

    const m = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const one = new Vector3(1, 1, 1);
    const localY = new Vector3();

    placements.forEach((p, i) => {
      pos.set(p.position[0], p.position[1], p.position[2]);
      quat.set(p.quaternion[0], p.quaternion[1], p.quaternion[2], p.quaternion[3]);
      m.compose(pos, quat, one);
      body.setMatrixAt(i, m);

      offsets.forEach((off, k) => {
        localY.set(0, 1, 0).applyQuaternion(quat).multiplyScalar(off);
        m.compose(pos.clone().add(localY), quat, one);
        rings.setMatrixAt(i * offsets.length + k, m);
      });
    });

    body.instanceMatrix.needsUpdate = true;
    rings.instanceMatrix.needsUpdate = true;
    body.frustumCulled = false;
    rings.frustumCulled = false;
    return { body, rings };
  }, [config]);

  if (!meshes) return null;
  return (
    <>
      <primitive object={meshes.body} />
      <primitive object={meshes.rings} />
    </>
  );
};

/* ------------------------------------------------------------------ *
 * Bokeh field (1A only)
 * ------------------------------------------------------------------ */

const BOKEH_BLUE = ["#2f8fff", "#1f6fe0", "#4fb0ff", "#1550b8"];
const BOKEH_ACCENT = ["#4fd699", "#ff8fb8", "#67e0a8", "#ff9ec4"];

const BokehField: React.FC<{ config: LookConfig; frame: number }> = ({
  config,
  frame,
}) => {
  const mesh = useMemo(() => {
    const cfg = config.bokeh;
    if (!cfg) return null;

    // Drawn once at module scope semantics: a fresh seeded PRNG per config,
    // consumed in a fixed order, so every thread gets the same field.
    const rng = mulberry32(0xb0cef17d);
    const n = cfg.count;
    const geometry = new PlaneGeometry(1, 1);
    const offsets = new Float32Array(n * 3);
    const radii = new Float32Array(n);
    const colors = new Float32Array(n * 3);
    const lissa = new Float32Array(n * 4);
    const phase = new Float32Array(n);
    const col = new Color();

    for (let i = 0; i < n; i++) {
      offsets[i * 3] = (rng() - 0.5) * cfg.spread[0];
      offsets[i * 3 + 1] = (rng() - 0.5) * cfg.spread[1];
      offsets[i * 3 + 2] = cfg.z[0] + rng() * (cfg.z[1] - cfg.z[0]);
      radii[i] = cfg.radius[0] + rng() * (cfg.radius[1] - cfg.radius[0]);

      // Mostly blue, with the occasional green or pink one breaking it up.
      const r = rng();
      const hex =
        r < 0.91
          ? BOKEH_BLUE[Math.floor(rng() * BOKEH_BLUE.length) % BOKEH_BLUE.length]
          : BOKEH_ACCENT[Math.floor(rng() * BOKEH_ACCENT.length) % BOKEH_ACCENT.length];
      col.set(hex).convertSRGBToLinear();
      const scale = 0.5 + rng() * 0.72;
      colors[i * 3] = col.r * scale;
      colors[i * 3 + 1] = col.g * scale;
      colors[i * 3 + 2] = col.b * scale;

      // Integer frequencies -> the path closes exactly over the loop.
      lissa[i * 4] = 0.12 + rng() * 0.35;
      lissa[i * 4 + 1] = 0.1 + rng() * 0.3;
      lissa[i * 4 + 2] = 1 + Math.floor(rng() * 3);
      lissa[i * 4 + 3] = 1 + Math.floor(rng() * 3);
      phase[i] = rng() * Math.PI * 2;
    }

    geometry.setAttribute("iOffset", new InstancedBufferAttribute(offsets, 3));
    geometry.setAttribute("iRadius", new InstancedBufferAttribute(radii, 1));
    geometry.setAttribute("iColor", new InstancedBufferAttribute(colors, 3));
    geometry.setAttribute("iLissa", new InstancedBufferAttribute(lissa, 4));
    geometry.setAttribute("iPhase", new InstancedBufferAttribute(phase, 1));

    const instanced = new InstancedMesh(geometry, makeBokehMaterial(), n);
    instanced.frustumCulled = false;
    const m = new Matrix4();
    for (let i = 0; i < n; i++) instanced.setMatrixAt(i, m);
    instanced.instanceMatrix.needsUpdate = true;
    return instanced;
  }, [config]);

  if (!mesh) return null;
  (mesh.material as ShaderMaterial).uniforms.uProgress.value = wrap01(frame / DURATION);
  return <primitive object={mesh} />;
};

/* ------------------------------------------------------------------ *
 * Post chain
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Compositing
 * ------------------------------------------------------------------ */

/**
 * Drives one more render pass after the effect chain exists.
 *
 * <ThreeCanvas> mounts its own frame renderer *before* its children and
 * advances exactly once, with frameloop="never". At that moment
 * <EffectComposer> has not finished assembling its passes from its children,
 * so that first advance composites an empty chain and the canvas stays black.
 * Advancing again from here -- an effect that runs after the whole subtree has
 * committed -- renders the real chain, and the delayRender keeps Remotion from
 * screenshotting in between.
 *
 * Nothing in the scene reads a clock, so the timestamp passed to advance()
 * has no bearing on the output.
 */
const ComposerAdvance: React.FC = () => {
  const advance = useThree((s) => s.advance);
  const frame = useCurrentFrame();
  const { delayRender, continueRender } = useDelayRender();

  useEffect(() => {
    const handle = delayRender(`Compositing frame ${frame}`);
    advance(performance.now());
    continueRender(handle);
  }, [frame, advance, delayRender, continueRender]);

  return null;
};

/* ------------------------------------------------------------------ *
 * Scene
 * ------------------------------------------------------------------ */

export const Scene: React.FC<{
  config: LookConfig;
  digits: Texture;
  frame: number;
}> = ({ config, digits, frame }) => {
  return (
  <>
    <AnisotropySetup digits={digits} />
    <CameraRig config={config} />

    {/* Lights exist only for the collars and nothing else: the cables are
        emitters and light themselves. */}
    <ambientLight intensity={0.45} />
    <directionalLight position={[-6, 9, 8]} intensity={0.85} />
    <directionalLight position={[7, 3, -6]} intensity={0.45} />

    <Strands config={config} digits={digits} frame={frame} />
    <Collars config={config} />
    <BokehField config={config} frame={frame} />

    {config.ground ? (
      <group scale={[1, -1, 1]} position={[0, 2 * config.ground.y, 0]}>
        <Strands config={config} digits={digits} frame={frame} mirrored />
      </group>
    ) : null}

    {POST_MODE === "off" ? null : <Post config={config} frame={frame} />}
    <ComposerAdvance />
  </>
  );
};
