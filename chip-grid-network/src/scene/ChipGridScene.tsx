import { MeshReflectorMaterial } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import {
  DIM,
  GRID_N,
  INSET_Y,
  LINKS,
  NODES,
  NODE_COUNT,
  SPACING,
  TOP_Y,
  TUBE_LENGTH,
} from "../lib/grid";
import { computeSpread, MIN_GAP, SpreadTiming } from "../lib/spread";
import type { CompDef } from "../lib/types";
import { getQuality } from "../lib/quality";
import { buildNodeGeometries, buildShieldGeometry, buildSocketGeometry, buildTubeGeometry } from "./geometry";
import {
  COMPROMISED,
  createCoreMaterial,
  createDieMaterial,
  createFrostMaterial,
  createGlassMaterial,
  createGlowLineMaterial,
  createInnerLinesMaterial,
  createPcbMaterial,
  createPlinthMaterial,
  createPostMaterial,
  createSharedUniforms,
  createShieldMaterial,
  createSocketMaterial,
  createSpillMaterial,
  createTopFrameMaterial,
  SAFE,
  SharedUniforms,
} from "./materials";
import { PostFXRenderer, usePostFX } from "./PostFX";
import { FLOOR_TEXTURE_UNITS, getFloorTextures } from "./textures";

// Spread timing is a pure function of the composition definition; cache it.
const timingCache = new Map<string, SpreadTiming>();
export const getTiming = (def: CompDef) => {
  let t = timingCache.get(def.id);
  if (!t) {
    t = computeSpread(def.spread);
    timingCache.set(def.id, t);
  }
  return t;
};

const FLOOR_SIZE = 192;

const makeInstanced = (
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  matrices: THREE.Matrix4[],
  attrs: Record<string, { data: Float32Array; size: number }> = {},
  opts: { castShadow?: boolean; receiveShadow?: boolean; renderOrder?: number } = {},
) => {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((m, k) => mesh.setMatrixAt(k, m));
  mesh.instanceMatrix.needsUpdate = true;
  for (const [name, a] of Object.entries(attrs)) {
    geometry.setAttribute(name, new THREE.InstancedBufferAttribute(a.data, a.size));
  }
  mesh.frustumCulled = false;
  mesh.castShadow = !!opts.castShadow;
  mesh.receiveShadow = !!opts.receiveShadow;
  if (opts.renderOrder !== undefined) mesh.renderOrder = opts.renderOrder;
  return mesh;
};

const buildNetwork = (def: CompDef, u: SharedUniforms, timing: SpreadTiming) => {
  const group = new THREE.Group();
  const geo = buildNodeGeometries();

  const translate = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
  const nodeMats = NODES.map((n) => translate(n.x, 0, n.z));
  const nodeAttr = (subset: typeof NODES) => {
    const data = new Float32Array(subset.length * 4);
    subset.forEach((n, k) => {
      data[k * 4] = timing.tNode[n.index];
      data[k * 4 + 1] = n.seed;
      data[k * 4 + 2] = n.whiteTop ? 1 : 0;
      data[k * 4 + 3] = 0;
    });
    return { aNode: { data, size: 4 } };
  };

  const glass = createGlassMaterial(0.07, 0.55);
  const tubeGlass = createGlassMaterial(0.1, 0.8);

  group.add(makeInstanced(geo.plinth, createPlinthMaterial(), nodeMats, {}, { castShadow: true, receiveShadow: true }));
  group.add(makeInstanced(geo.glowLine, createGlowLineMaterial(u), nodeMats, nodeAttr(NODES)));
  group.add(makeInstanced(geo.cornerPosts, createPostMaterial(), nodeMats, {}, { castShadow: true }));
  group.add(makeInstanced(geo.innerLines, createInnerLinesMaterial(u), nodeMats, nodeAttr(NODES), { renderOrder: 2 }));
  group.add(makeInstanced(geo.walls, glass, nodeMats, {}, { renderOrder: 3 }));
  group.add(makeInstanced(geo.top, createTopFrameMaterial(), nodeMats, {}, { castShadow: true, receiveShadow: true }));

  const pcbNodes = NODES.filter((n) => !n.whiteTop);
  const frostNodes = NODES.filter((n) => n.whiteTop);
  const pcbMats = pcbNodes.map((n) => translate(n.x, 0, n.z));
  const frostMats = frostNodes.map((n) => translate(n.x, 0, n.z));
  group.add(makeInstanced(geo.inset, createPcbMaterial(u), pcbMats, nodeAttr(pcbNodes), { receiveShadow: true }));
  group.add(makeInstanced(geo.die, createDieMaterial(), pcbMats, {}, {}));
  group.add(makeInstanced(geo.inset.clone(), createFrostMaterial(u), frostMats, nodeAttr(frostNodes)));

  // Sockets on all four sides of every node.
  const socketMats: THREE.Matrix4[] = [];
  const sides: [number, number, number][] = [
    [1, 0, Math.PI / 2],
    [-1, 0, -Math.PI / 2],
    [0, 1, 0],
    [0, -1, Math.PI],
  ];
  for (const n of NODES) {
    for (const [dx, dz, rot] of sides) {
      const m = new THREE.Matrix4().makeRotationY(rot);
      m.setPosition(n.x + dx * DIM.wallHalf, DIM.cableY, n.z + dz * DIM.wallHalf);
      socketMats.push(m);
    }
  }
  group.add(makeInstanced(buildSocketGeometry(), createSocketMaterial(), socketMats, {}, { castShadow: true }));

  // Cable bundles: three tubes per link.
  const tubeMats: THREE.Matrix4[] = [];
  const linkData = new Float32Array(LINKS.length * 3 * 4);
  const rotX = new THREE.Matrix4().makeRotationZ(-Math.PI / 2); // +y -> +x
  const rotZ = new THREE.Matrix4().makeRotationX(Math.PI / 2); // +y -> +z
  const scale = new THREE.Matrix4().makeScale(1, TUBE_LENGTH, 1);
  let k = 0;
  LINKS.forEach((l, idx) => {
    const a = NODES[l.a];
    const b = NODES[l.b];
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    for (let t = -1; t <= 1; t++) {
      const off = t * DIM.tubeSpacing;
      const m = new THREE.Matrix4();
      if (l.axis === 0) {
        m.multiplyMatrices(rotX, scale);
        m.setPosition(mx, DIM.cableY, mz + off);
      } else {
        m.multiplyMatrices(rotZ, scale);
        m.setPosition(mx + off, DIM.cableY, mz);
      }
      tubeMats.push(m);
      linkData[k * 4] = timing.linkStart[idx];
      linkData[k * 4 + 1] = timing.linkEnd[idx];
      linkData[k * 4 + 2] = timing.linkReverse[idx];
      linkData[k * 4 + 3] = (l.seed * 3.7 + (t + 1) * 0.311) % 1;
      k++;
    }
  });
  group.add(makeInstanced(buildTubeGeometry(DIM.coreRadius, 8), createCoreMaterial(u), tubeMats, { aLink: { data: linkData, size: 4 } }));
  group.add(makeInstanced(buildTubeGeometry(DIM.tubeRadius, 18), tubeGlass, tubeMats, {}, { renderOrder: 4 }));

  // Shield marks.
  let shieldMaterial: THREE.ShaderMaterial | null = null;
  if (def.shield !== "none") {
    const mode = def.shield === "top" ? 0 : 1;
    shieldMaterial = createShieldMaterial(u, mode);
    if (def.shieldUpXZ) {
      (shieldMaterial.uniforms.uUpXZ.value as THREE.Vector2).set(def.shieldUpXZ[0], def.shieldUpXZ[1]);
    }
    const y = mode === 0 ? INSET_Y + DIM.dieThickness + 0.012 : TOP_Y + 1.3;
    const shieldMats = NODES.map((n) => translate(n.x, y, n.z));
    group.add(makeInstanced(buildShieldGeometry(), shieldMaterial, shieldMats, nodeAttr(NODES), { renderOrder: 6 }));
  }
  return group;
};

const DriveFrame: React.FC<{ def: CompDef; u: SharedUniforms; fx: ReturnType<typeof usePostFX> }> = ({ def, u, fx }) => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const target = useMemo(() => new THREE.Vector3(), []);
  // Layout effect: runs before <ThreeCanvas>'s advance() for this frame.
  useLayoutEffect(() => {
    u.uFrame.value = frame;
    u.uPulse.value = 1 + 0.04 * Math.sin((frame / 90) * Math.PI * 2);
    const shot = def.camera(frame);
    camera.position.set(...shot.position);
    camera.up.set(...shot.up);
    target.set(...shot.target);
    camera.lookAt(target);
    camera.fov = shot.fov;
    camera.near = 0.5;
    camera.far = 400;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const focus = camera.position.distanceTo(target);
    fx.dof.cocMaterial.focusDistance = focus;
    fx.dof.cocMaterial.focusRange = def.dof.rangeFactor * focus;
    fx.finish.uniforms.get("uFrameF")!.value = frame;
  }, [frame, def, u, camera, target, fx]);
  return null;
};

export const ChipGridScene: React.FC<{ def: CompDef; hdri: THREE.DataTexture }> = ({ def, hdri }) => {
  const { gl, scene } = useThree();
  const timing = getTiming(def);
  const u = useMemo(() => {
    const s = createSharedUniforms();
    s.uColOld.value.copy(def.from === "safe" ? SAFE : COMPROMISED);
    s.uColNew.value.copy(def.to === "safe" ? SAFE : COMPROMISED);
    s.uShieldTop.value = def.shield === "top" ? 1 : 0;
    s.uMinFill.value = MIN_GAP * def.spread.stepFrames;
    return s;
  }, [def]);

  // Environment (PMREM of the studio HDRI) + background + haze.
  useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromEquirectangular(hdri).texture;
    pmrem.dispose();
    scene.environment = env;
    scene.environmentIntensity = 1.0;
    scene.environmentRotation.set(0, 0.6, 0);
    scene.background = new THREE.Color("#121821");
    scene.fog = new THREE.FogExp2("#141b25", 0.0065);
  }, [gl, scene, hdri]);

  const network = useMemo(() => buildNetwork(def, u, timing), [def, u, timing]);

  // Switch times as a data texture for the floor spill shader.
  const timesTex = useMemo(() => {
    const data = new Float32Array(NODE_COUNT * 4);
    for (let n = 0; n < NODE_COUNT; n++) data[n * 4] = timing.tNode[n];
    const t = new THREE.DataTexture(data, GRID_N, GRID_N, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = THREE.NearestFilter;
    t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  }, [timing]);
  const spillMat = useMemo(() => createSpillMaterial(u, timesTex), [u, timesTex]);

  const floor = useMemo(() => {
    const { map, rough, normal } = getFloorTextures();
    const reps = FLOOR_SIZE / FLOOR_TEXTURE_UNITS;
    for (const t of [map, rough, normal]) {
      t.repeat.set(reps, reps);
      // put tile seams half a cell away from node centres
      t.offset.set(2 / FLOOR_TEXTURE_UNITS, 2 / FLOOR_TEXTURE_UNITS);
    }
    return { map, rough, normal };
  }, []);

  const fx = usePostFX(def.dof);

  return (
    <>
      <DriveFrame def={def} u={u} fx={fx} />
      <PostFXRenderer fx={fx} baseBokeh={def.dof.bokehScale} />
      <hemisphereLight args={["#a9bedf", "#151a22", 0.35]} />
      <directionalLight
        position={[-18, 42, 14]}
        intensity={1.3}
        color="#e3ecff"
        castShadow={getQuality().shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={5}
        shadow-camera-left={-46}
        shadow-camera-right={46}
        shadow-camera-top={46}
        shadow-camera-bottom={-46}
        shadow-camera-near={1}
        shadow-camera-far={120}
      />
      <primitive object={network} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <MeshReflectorMaterial
          resolution={getQuality().reflectRes}
          blur={[320, 90]}
          mixBlur={1.1}
          mixStrength={1.4}
          mixContrast={1.05}
          depthScale={1.0}
          minDepthThreshold={0.35}
          maxDepthThreshold={1.3}
          mirror={0}
          color="#ffffff"
          map={floor.map}
          roughnessMap={floor.rough}
          normalMap={floor.normal}
          normalScale={new THREE.Vector2(1, 1)}
          roughness={1}
          metalness={0.2}
          envMapIntensity={0.6}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} material={spillMat} renderOrder={1}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
      </mesh>
    </>
  );
};

export { SPACING };
