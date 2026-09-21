/**
 * The fixed rig.
 *
 * Camera, lighting, motion and post chain are the same for every composition;
 * a LookRow selects geometry mode, materials, palette, background and blur.
 *
 * Why three's own transmission, not drei's MeshTransmissionMaterial
 * --------------------------------------------------------------------------
 * drei's material renders the scene into its OWN framebuffer inside useFrame
 * and keeps that buffer between frames. Rendering frame 150 from a cold start
 * then produced a different image from frame 150 of a sequential render -- it
 * failed the determinism check outright, which matters because Remotion
 * renders frames out of order across threads.
 *
 * three's built-in transmission rebuilds its backdrop from the opaque objects
 * every frame and keeps no state, so it passes. It is also cheaper: one shared
 * pass for every transmissive material rather than one per instance, with the
 * buffer size under our control via `transmissionResolutionScale`.
 *
 * The trade is that transmissive objects are excluded from each other's
 * backdrop, so the hero spheres refract the approximated layers rather than
 * one another. Those layers are stateless and deliberately carry the depth
 * cues -- look 6's packed back mass is what its foreground spheres bend into
 * the dark lens shapes.
 */
import { useThree } from '@react-three/fiber';
import { DepthOfField, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildBlobGeometry } from './blob';
import { buildScene, type Cluster, type Layer } from './build';
import { Background } from './Background';
import { BubbleMaterial } from './BubbleMaterial';
import { getStudioEnvironment } from './env';
import { smoothIcosphere } from './geometry';
import { Grain } from './Grain';
import { buildIridescenceThicknessMap } from './iridescence';
import { clusterPosition, clusterQuaternion } from './motion';
import type { LookRow } from './types';

/**
 * Backdrop buffer size as a fraction of the viewport. 0.3 of 4K is still over
 * 1000px wide, far more than these blurred scenes resolve.
 */
const TRANSMISSION_RESOLUTION_SCALE = 0.3;

const FRAME_BUFFER_TYPE = THREE.HalfFloatType;

const StudioEnvironment: React.FC<{ intensity: number; transmissionScale: number }> = ({
  intensity,
  transmissionScale,
}) => {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  useLayoutEffect(() => {
    scene.environment = getStudioEnvironment();
    scene.environmentIntensity = intensity;
    // Transmission is the most expensive material in three: the scene behind
    // every transmissive surface is re-rendered into a backdrop buffer each
    // frame. That buffer does not need to match output resolution -- these
    // scenes are heavily blurred -- and dropping it is the single biggest
    // saving available. This is the knob for it.
    gl.transmissionResolutionScale = transmissionScale;
    return () => {
      scene.environment = null;
    };
  }, [scene, gl, intensity, transmissionScale]);
  return null;
};

type Instance = { cluster: Cluster; offset: [number, number, number]; radius: number };

const tintColor = new THREE.Color();

/** Shared scratch objects -- written fresh every frame, never read across frames. */
const scratch = {
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  axis: new THREE.Vector3(),
  offset: new THREE.Vector3(),
  scale: new THREE.Vector3(),
  matrix: new THREE.Matrix4(),
};

const InstancedRigid: React.FC<{
  instances: Instance[];
  geometry: THREE.BufferGeometry;
  t: number;
  frame: number;
  /** Base colour for per-instance tinting; enables instanceColor when set. */
  tint?: string;
  /**
   * Write the instances back-to-front. three sorts whole objects, never the
   * instances inside one InstancedMesh, so without this an alpha-blended
   * layer composites in arbitrary order and the spheres stop reading as
   * stacked glass. The sort is a pure function of the frame, so it does not
   * threaten determinism.
   */
  sortByDepth?: boolean;
  children: React.ReactNode;
}> = ({ instances, geometry, t, frame, tint, sortByDepth = false, children }) => {
  const ref = useRef<THREE.InstancedMesh>(null);

  // Recomputed in full from `frame` every time -- no accumulation, so the
  // result depends only on the frame index.
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    // Resolve every transform first, so the draw order can be chosen from the
    // resulting depths rather than from array order.
    const resolved = instances.map((instance) => {
      const { cluster } = instance;
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      clusterPosition(cluster, t, frame, position);
      clusterQuaternion(cluster, t, quaternion, scratch.axis);
      const offset = new THREE.Vector3(instance.offset[0], instance.offset[1], instance.offset[2]);
      offset.applyQuaternion(quaternion);
      position.add(offset);
      return { instance, position, quaternion };
    });

    if (sortByDepth) {
      // Camera looks down -z, so the most negative z is furthest away and has
      // to be drawn first.
      resolved.sort((a, b) => a.position.z - b.position.z);
    }

    resolved.forEach((r, i) => {
      scratch.scale.setScalar(r.instance.radius);
      scratch.matrix.compose(r.position, r.quaternion, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;

    if (tint && instances.some((i) => i.cluster.tintScale !== undefined)) {
      resolved.forEach((r, i) => {
        const scale = r.instance.cluster.tintScale ?? 1;
        tintColor.set(tint).multiplyScalar(scale);
        mesh.setColorAt(i, tintColor);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [instances, t, frame, tint, sortByDepth]);

  if (instances.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      // The bounding sphere is derived from instanceMatrix, which three has
      // not seen yet on the first render; without this the whole layer is
      // culled and the frame comes out empty.
      frustumCulled={false}
      args={[geometry, undefined as never, instances.length]}
    >
      {children}
    </instancedMesh>
  );
};

/** Bonds for look 1: thin frosted cylinders seated inside both spheres. */
const Bonds: React.FC<{ clusters: Cluster[]; t: number; frame: number; look: LookRow }> = ({
  clusters,
  t,
  frame,
  look,
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), []);
  const bonds = useMemo(
    () =>
      clusters.flatMap((cluster) =>
        cluster.bonds.map((bond) => ({ cluster, bond })),
      ),
    [clusters],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    bonds.forEach(({ cluster, bond }, i) => {
      clusterPosition(cluster, t, frame, scratch.position);
      clusterQuaternion(cluster, t, scratch.quaternion, scratch.axis);
      const ma = cluster.members[bond.a];
      const mb = cluster.members[bond.b];
      a.set(...ma.offset).applyQuaternion(scratch.quaternion).add(scratch.position);
      b.set(...mb.offset).applyQuaternion(scratch.quaternion).add(scratch.position);
      dir.subVectors(b, a);
      const length = dir.length();
      mid.addVectors(a, b).multiplyScalar(0.5);
      q.setFromUnitVectors(up, dir.clone().normalize());
      // Diameter ~12% of the smaller sphere's radius. The full centre-to-centre
      // length is used so both ends are seated inside the spheres rather than
      // leaving a gap at the join.
      const radius = Math.min(ma.radius, mb.radius) * 0.12;
      scratch.scale.set(radius, length, radius);
      scratch.matrix.compose(mid, q, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [bonds, t, frame]);

  if (bonds.length === 0) return null;
  return (
    <instancedMesh ref={ref} frustumCulled={false} args={[geometry, undefined as never, bonds.length]}>
      <meshPhysicalMaterial
        color={look.material.attenuationColor}
        // Slightly rougher than the spheres so the bonds read as frosted
        // rather than clear.
        roughness={0.35}
        metalness={0}
        transparent
        opacity={0.62}
        clearcoat={0.6}
        envMapIntensity={1.2}
      />
    </instancedMesh>
  );
};

export const SerumScene: React.FC<{
  look: LookRow;
  frame: number;
  width: number;
  height: number;
  /** Look 5's second half: solid black shapes on pure white. */
  matte: boolean;
  /** Frame index driving motion (look 5's matte half re-uses the beauty half). */
  motionFrame: number;
  /**
   * Element groups to omit. Used by the loop-closure bisect: render frames 0
   * and 300 with groups hidden, then add them back one at a time to find the
   * element that is not returning to its start.
   */
  hide?: string[];
}> = ({ look, frame, width, height, matte, motionFrame, hide = [] }) => {
  const shown = (group: string) => !hide.includes(group);
  const scene = useMemo(() => buildScene(look), [look]);
  const t = motionFrame / (look.isLoop ? look.durationInFrames : look.durationInFrames / 2);

  const sphereGeometry = useMemo(() => smoothIcosphere(4), []);
  const bubbleGeometry = useMemo(() => smoothIcosphere(3), []);
  const iridescenceMap = useMemo(
    () => (look.material.iridescence > 0 ? buildIridescenceThicknessMap(look.seed) : null),
    [look.material.iridescence, look.seed],
  );
  const blobGeometry = useMemo(
    () => (scene.blobs.length > 0 ? buildBlobGeometry(scene.blobs[0].members) : null),
    [scene],
  );

  // Hero = the group that carries the one transmission material.
  const heroIsBlob = look.mode === 'blob' && blobGeometry !== null;

  const collect = (layers: Layer[], withBlob: boolean): Instance[] =>
    scene.clusters
      .filter((c) => layers.includes(c.layer) && (c.blobIndex !== undefined) === withBlob)
      .flatMap((cluster) =>
        cluster.blobIndex !== undefined
          ? [{ cluster, offset: [0, 0, 0] as [number, number, number], radius: cluster.scale ?? 1 }]
          : cluster.members.map((m) => ({ cluster, offset: m.offset, radius: m.radius })),
      );

  const heroLayers: Layer[] = look.heroLayers ?? ['front', 'mid'];
  const approxLayers: Layer[] = (['front', 'mid', 'back'] as Layer[]).filter(
    (l) => !heroLayers.includes(l),
  );

  const heroInstances = useMemo(
    () => (heroIsBlob ? collect(heroLayers, true) : collect(heroLayers, false)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, heroIsBlob, look.id],
  );
  const approxInstances = useMemo(
    () => (heroIsBlob ? collect(['front', 'mid', 'back'], false) : collect(approxLayers, false)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, heroIsBlob, look.id],
  );
  const approxBlobInstances = useMemo(
    () => (heroIsBlob ? collect(approxLayers, true) : collect(['front', 'mid', 'back'], true)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, heroIsBlob, look.id],
  );

  // Inner bubbles are real nested spheres, not a texture. They sit inside the
  // parent spheres and are picked up by the transmission backdrop pass, so the
  // parent genuinely refracts them.
  const bubbleInstances = useMemo(
    () =>
      scene.clusters.flatMap((cluster) =>
        cluster.members.flatMap((m) =>
          m.bubbles.map((b) => ({
            cluster,
            offset: [m.offset[0] + b.offset[0], m.offset[1] + b.offset[1], m.offset[2] + b.offset[2]] as [
              number,
              number,
              number,
            ],
            radius: b.radius,
          })),
        ),
      ),
    [scene],
  );

  const mat = look.material;
  const light = look.lighting;

  if (matte) {
    // Same seeded values, same motion -- so the silhouettes land exactly on
    // their bubbles when the two halves are overlaid.
    return (
      <>
        <Background spec={look.background} matte />
        <InstancedRigid instances={heroInstances} geometry={heroIsBlob ? blobGeometry! : sphereGeometry} t={t} frame={motionFrame}>
          <meshBasicMaterial color="#000000" toneMapped={false} />
        </InstancedRigid>
        <InstancedRigid instances={approxInstances} geometry={sphereGeometry} t={t} frame={motionFrame}>
          <meshBasicMaterial color="#000000" toneMapped={false} />
        </InstancedRigid>
      </>
    );
  }

  return (
    <>
      <StudioEnvironment
        intensity={look.envIntensity ?? mat.envMapIntensity}
        transmissionScale={TRANSMISSION_RESOLUTION_SCALE}
      />
      <Background spec={look.background} matte={false} />

      {light.backPanel ? (
        <mesh position={[0, 0, -9]}>
          <planeGeometry args={[46, 28]} />
          <meshBasicMaterial color={light.backPanel.color} toneMapped={false} />
        </mesh>
      ) : null}

      <ambientLight intensity={light.ambientIntensity} color={light.ambientColor} />
      {/* Large soft key, upper-left front. */}
      <directionalLight position={light.keyPosition} intensity={light.keyIntensity} color={light.keyColor} />
      {/* Fill opposite, 30-40% of the key. */}
      <directionalLight
        position={[-light.keyPosition[0], -light.keyPosition[1] * 0.4, light.keyPosition[2]]}
        intensity={light.fillIntensity}
        color={light.fillColor}
      />
      {light.rimIntensity > 0 ? (
        <directionalLight position={[2, -1, -6]} intensity={light.rimIntensity} color={light.rimColor} />
      ) : null}

      {/* The one transmission material. */}
      <InstancedRigid
        instances={shown('hero') ? heroInstances : []}
        geometry={heroIsBlob ? blobGeometry! : sphereGeometry}
        t={t}
        frame={motionFrame}
        sortByDepth={mat.heroOpacity < 1}
      >
        <meshPhysicalMaterial
          // Transmission alone refracts the background, but three excludes
          // transmissive objects from each other's backdrop -- so without a
          // blended pass a sphere in front simply hides the one behind it,
          // and the whole cluster reads as opaque. Blending restores the
          // stacked-glass look the references depend on.
          transparent={mat.heroOpacity < 1}
          opacity={mat.heroOpacity}
          depthWrite={mat.heroOpacity >= 1}
          transmission={mat.transmission}
          thickness={mat.thickness}
          ior={mat.ior}
          roughness={mat.roughness}
          metalness={0}
          color={mat.color as unknown as THREE.Color}
          attenuationColor={mat.attenuationColor as unknown as THREE.Color}
          attenuationDistance={mat.attenuationDistance}
          clearcoat={mat.clearcoat}
          clearcoatRoughness={mat.clearcoatRoughness}
          iridescence={mat.iridescence}
          iridescenceIOR={mat.iridescenceIOR}
          iridescenceThicknessRange={mat.iridescenceThicknessRange}
          iridescenceThicknessMap={iridescenceMap}
          envMapIntensity={mat.envMapIntensity}
        />
      </InstancedRigid>

      {/* Approximated groups. Cheap, stateless, and heavily blurred in every
          look -- but present in the hero's backdrop, so the hero refracts them. */}
      <InstancedRigid
        instances={shown('approx') ? approxInstances : []}
        geometry={sphereGeometry}
        t={t}
        frame={motionFrame}
        tint={look.backTint}
      >
        <meshPhysicalMaterial
          color={look.backTint}
          roughness={Math.min(0.5, mat.roughness + 0.1)}
          metalness={0}
          transparent
          opacity={look.mode === 'oil' || look.mode === 'blob' ? 1 : 0.72}
          clearcoat={0.8}
          clearcoatRoughness={0.1}
          ior={mat.ior}
          emissive={(look.backEmissive ?? '#000000') as unknown as THREE.Color}
          emissiveIntensity={look.backEmissiveIntensity ?? 0}
          envMapIntensity={mat.envMapIntensity}
        />
      </InstancedRigid>

      {approxBlobInstances.length > 0 && blobGeometry && shown('approxBlob') ? (
        <InstancedRigid instances={approxBlobInstances} geometry={blobGeometry} t={t} frame={motionFrame}>
          <meshPhysicalMaterial
            color={look.backTint}
            roughness={Math.min(0.5, mat.roughness + 0.1)}
            metalness={0}
            clearcoat={0.9}
            clearcoatRoughness={0.06}
            ior={mat.ior}
            envMapIntensity={mat.envMapIntensity}
          />
        </InstancedRigid>
      ) : null}

      {bubbleInstances.length > 0 && shown('bubbles') ? (
        <InstancedRigid instances={bubbleInstances} geometry={bubbleGeometry} t={t} frame={motionFrame}>
          <BubbleMaterial
            rim={look.bubble.rim}
            core={look.bubble.core}
            strength={look.bubble.strength}
            opaque={look.bubble.opaque}
          />
        </InstancedRigid>
      ) : null}

      {look.mode === 'molecule' && shown('bonds') ? (
        <Bonds clusters={scene.clusters} t={t} frame={motionFrame} look={look} />
      ) : null}

      <EffectComposer
        multisampling={0}
        enableNormalPass={false}
        frameBufferType={FRAME_BUFFER_TYPE}
      >
        {shown('dof') ? (
          <DepthOfField
            worldFocusDistance={look.dof.worldFocusDistance}
            worldFocusRange={look.dof.worldFocusRange}
            // bokehScale is in pixels, but compositions are authored at 4K and
            // previews render at half scale. Without this the blur is half as
            // wide relative to the frame in the preview as in the master.
            bokehScale={look.dof.bokehScale * (height / 2160)}
          />
        ) : (
          <></>
        )}
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Grain
          // Periodic over the loop, so frame 300 gets frame 0's grain.
          frame={frame % look.durationInFrames}
          amount={look.grain}
          width={width}
          height={height}
        />
      </EffectComposer>
    </>
  );
};
