// The chain itself: a conveyor of binary-skinned cubes joined by
// glowing link strips.
//
// Cubes are recycled rather than created per frame -- a cube that
// passes behind the camera is re-inserted at the far end of the run --
// so the chain can stream forever at a fixed object count.

import * as THREE from "three/webgpu";
import { texture, uv, vec2, uniform, float, color } from "three/tsl";
import {
  CHAIN_LENGTH,
  CUBE_EDGE_COLOR,
  CUBE_FACE_COLOR,
  CUBE_SIZE,
  CUBE_SPACING,
} from "../constants";
import { makeBinaryFaceTexture, makeLinkTexture } from "../textures";
import type { LayoutConfig } from "../layouts";
import { makeRandom } from "../rng";

// Distinct skins so neighbouring cubes don't read as clones.
const FACE_VARIANTS = 6;

const EDGE_THICKNESS = 0.0125;
// Edges are additive, so anything near 1 blows straight to white once
// bloom lands on top.
const EDGE_INTENSITY = 0.5;
const LINK_INTENSITY = 1.0;

// The binary skin is a mostly-transparent canvas texture, so the faces
// need lifting to sit at the reference's brightness once additive
// blending has knocked them back.
const FACE_INTENSITY = 1.95;

// Atmospheric falloff. Without it the whole 22-cube run stays equally
// crisp to the horizon; the reference dissolves into haze after about
// a dozen, which is what sells the depth.
const HAZE_NEAR = 11;
const HAZE_FAR = 31;
const HAZE_FLOOR = 0.13;

// The 12 edges of a unit cube, as [axis, signA, signB] where axis is
// the direction the edge runs and the signs place it on the other two.
const EDGES: [0 | 1 | 2, number, number][] = [];
for (const axis of [0, 1, 2] as const) {
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      EDGES.push([axis, a, b]);
    }
  }
}

export type CubeChain = {
  group: THREE.Group;
  update: (flow: number, cameraPosition: THREE.Vector3) => void;
  dispose: () => void;
};

type CubeEntry = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicNodeMaterial;
  scrollUniform: ReturnType<typeof uniform>;
  brightUniform: ReturnType<typeof uniform>;
  spin: number;
  scrollRate: number;
};

export const createCubeChain = (
  layout: LayoutConfig,
  seed: number,
  resolutionScale: number,
): CubeChain => {
  const random = makeRandom(seed);
  const group = new THREE.Group();

  const faceTextures = Array.from({ length: FACE_VARIANTS }, (_, i) =>
    makeBinaryFaceTexture(seed + i * 977, 768 * (resolutionScale > 1 ? 2 : 1)),
  );
  const linkTexture = makeLinkTexture(seed + 5501, 512, 64);

  const boxGeometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  const faceTint = new THREE.Color(CUBE_FACE_COLOR);

  const cubes: CubeEntry[] = [];
  for (let i = 0; i < CHAIN_LENGTH; i++) {
    const map = faceTextures[i % FACE_VARIANTS];
    const scrollUniform = uniform(0);
    const brightUniform = uniform(1);

    const material = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      // Depth is owned by the invisible proxy pass below, so nothing
      // additive reads or writes it. Additive blending is
      // order-independent anyway, so no sorting is lost.
      depthWrite: false,
      depthTest: false,
      // Front faces only. With DoubleSide the back faces render
      // additively on top of the front ones and the binary digits mush
      // into noise -- the reference reads its front faces cleanly and
      // lets the edge wireframe imply the rest of the volume.
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
    });

    // Scroll the skin vertically so the digits read as streaming data.
    // Doing it in TSL (rather than texture.offset) keeps the offset
    // per-material while the textures themselves stay shared.
    const sampled = texture(map, uv().add(vec2(float(0), scrollUniform)));
    material.colorNode = sampled.rgb
      .mul(color(faceTint))
      .mul(brightUniform)
      .mul(FACE_INTENSITY);
    material.opacityNode = sampled.a.mul(brightUniform);

    const mesh = new THREE.Mesh(boxGeometry, material);
    mesh.frustumCulled = false;
    group.add(mesh);
    cubes.push({
      mesh,
      material,
      scrollUniform,
      brightUniform,
      spin: (random() - 0.5) * 0.0016,
      scrollRate: 0.0012 + random() * 0.0018,
    });
  }

  // --- Edge beams --------------------------------------------------
  // WebGPU clamps line width to 1px, which would render half as thick
  // at 4K as at 1080p. Thin boxes keep the glow identical at any
  // output resolution.
  const beamGeometry = new THREE.BoxGeometry(1, 1, 1);
  const edgeMaterial = new THREE.MeshBasicNodeMaterial({
    color: new THREE.Color(CUBE_EDGE_COLOR),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const edges = new THREE.InstancedMesh(
    beamGeometry,
    edgeMaterial,
    CHAIN_LENGTH * EDGES.length,
  );
  edges.frustumCulled = false;
  edges.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(edges);

  // --- Link strips --------------------------------------------------
  const linkGeometry = new THREE.PlaneGeometry(1, 1);
  const linkMaterial = new THREE.MeshBasicNodeMaterial({
    map: linkTexture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const links = new THREE.InstancedMesh(linkGeometry, linkMaterial, CHAIN_LENGTH);
  links.frustumCulled = false;
  links.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(links);

  // --- Depth proxy ---------------------------------------------------
  // Depth of field needs a populated depth buffer, but every visible
  // material here is additive with depthWrite off, which would leave
  // the buffer empty and defocus the entire frame uniformly. These
  // solid boxes sit at the same transforms and write depth only --
  // colorWrite is off, so they never appear -- giving the DOF pass a
  // real per-pixel distance for the chain.
  const proxyMaterial = new THREE.MeshBasicNodeMaterial({ colorWrite: false });
  const depthProxy = new THREE.InstancedMesh(boxGeometry, proxyMaterial, CHAIN_LENGTH);
  depthProxy.frustumCulled = false;
  depthProxy.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Opaque, so three draws it before any of the additive passes.
  depthProxy.renderOrder = -1;
  group.add(depthProxy);

  const span = CHAIN_LENGTH * CUBE_SPACING;
  // Every scratch value below is hoisted: update() runs 600 times over
  // ~280 instances, and allocating there would churn the GC hard
  // enough to show up in render times.
  const scratch = new THREE.Matrix4();
  const edgeLocal = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const linkCentre = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const linkNormal = new THREE.Vector3();
  const linkUp = new THREE.Vector3();
  const chainAxis = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const identityQuaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const edgeColor = new THREE.Color();
  const linkColor = new THREE.Color();
  const proxyScale = new THREE.Vector3();
  const half = CUBE_SIZE / 2;

  const update = (flow: number, cameraPosition: THREE.Vector3) => {
    let edgeIndex = 0;

    for (let i = 0; i < CHAIN_LENGTH; i++) {
      const entry = cubes[i];

      // Wrap this cube's arc-length into the populated window.
      let s = i * CUBE_SPACING - flow;
      s = ((s - layout.sMin) % span + span) % span + layout.sMin;

      position
        .copy(layout.direction)
        .multiplyScalar(s)
        .add(layout.origin);

      // Fade in at the far end and out as it passes the lens, so
      // recycling never pops.
      const farFade = THREE.MathUtils.smoothstep(
        span + layout.sMin - s,
        0,
        CUBE_SPACING * 3.5,
      );
      const nearFade = THREE.MathUtils.smoothstep(s - layout.sMin, 0, CUBE_SPACING * 2.2);
      const haze = THREE.MathUtils.lerp(
        1,
        HAZE_FLOOR,
        THREE.MathUtils.smoothstep(position.distanceTo(cameraPosition), HAZE_NEAR, HAZE_FAR),
      );
      const bright = farFade * nearFade * haze;

      entry.mesh.position.copy(position);
      entry.mesh.rotation.set(0, layout.cubeYaw + s * entry.spin, 0);
      entry.mesh.updateMatrixWorld(true);
      entry.brightUniform.value = bright;

      // A faded-out cube must not leave depth behind, or the DOF pass
      // would keep a sharp hole where an invisible box sits.
      proxyScale.setScalar(bright > 0.02 ? 1 : 0);
      scratch.compose(position, entry.mesh.quaternion, proxyScale);
      depthProxy.setMatrixAt(i, scratch);
      entry.scrollUniform.value = (flow * entry.scrollRate * 60) % 1;

      // Per-instance colour carries brightness only -- the tint itself
      // lives on the material. Putting CUBE_EDGE_COLOR in both would
      // square it, so changing that constant would move the rendered
      // hue non-linearly.
      const edgeLevel = bright * EDGE_INTENSITY;
      edgeColor.setRGB(edgeLevel, edgeLevel, edgeLevel);

      // Edge beams follow the cube's own transform.
      for (const [axis, a, b] of EDGES) {
        const length = CUBE_SIZE + EDGE_THICKNESS;
        scale.set(EDGE_THICKNESS, EDGE_THICKNESS, EDGE_THICKNESS);
        if (axis === 0) {
          scale.x = length;
          offset.set(0, a * half, b * half);
        } else if (axis === 1) {
          scale.y = length;
          offset.set(a * half, 0, b * half);
        } else {
          scale.z = length;
          offset.set(a * half, b * half, 0);
        }
        edgeLocal.compose(offset, identityQuaternion, scale);
        scratch.multiplyMatrices(entry.mesh.matrixWorld, edgeLocal);
        edges.setMatrixAt(edgeIndex, scratch);
        edges.setColorAt(edgeIndex, edgeColor);
        edgeIndex++;
      }

      // Link strip bridges this cube to the next one up the chain.
      chainAxis.copy(layout.direction);
      linkCentre
        .copy(chainAxis)
        .multiplyScalar(CUBE_SPACING / 2)
        .add(position);
      toCamera.copy(cameraPosition).sub(linkCentre).normalize();
      // Billboard the strip around the chain axis so it always faces
      // the lens without twisting off the chain line.
      linkNormal.copy(toCamera).projectOnPlane(chainAxis).normalize();
      linkUp.crossVectors(linkNormal, chainAxis);
      basis.makeBasis(chainAxis, linkUp, linkNormal);
      quaternion.setFromRotationMatrix(basis);
      scratch.compose(
        linkCentre,
        quaternion,
        scale.set(CUBE_SPACING - CUBE_SIZE * 0.92, 0.17, 1),
      );
      links.setMatrixAt(i, scratch);
      const linkLevel = bright * LINK_INTENSITY;
      links.setColorAt(i, linkColor.setRGB(linkLevel, linkLevel, linkLevel));
    }

    depthProxy.instanceMatrix.needsUpdate = true;
    edges.instanceMatrix.needsUpdate = true;
    if (edges.instanceColor) edges.instanceColor.needsUpdate = true;
    links.instanceMatrix.needsUpdate = true;
    if (links.instanceColor) links.instanceColor.needsUpdate = true;
  };

  const dispose = () => {
    boxGeometry.dispose();
    beamGeometry.dispose();
    linkGeometry.dispose();
    edgeMaterial.dispose();
    proxyMaterial.dispose();
    linkMaterial.dispose();
    linkTexture.dispose();
    for (const t of faceTextures) t.dispose();
    for (const c of cubes) c.material.dispose();
  };

  return { group, update, dispose };
};
