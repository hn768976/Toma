import * as THREE from 'three/webgpu';
import { Rng } from '../engine/rng';
import { color, float, mix, smoothstep, texture, uniform, uv } from 'three/tsl';
import type { Theme } from '../themes';
import type { FrameState } from '../timeline';
import { SEAT_Y } from '../timeline';
import { createDieTextures, createDotTexture, createPadGridTexture, createShadowTexture, createStreakTexture } from './textures';

export const CHIP_SIZE = 8.4;
const SUBSTRATE_H = 0.44;
const SPREADER = 7.0;
const SPREADER_H = 0.3;

export interface ChipResult {
  group: THREE.Group;
  /** Follows the package so the depth of field can track it. */
  focusTarget: THREE.Object3D;
  update: (s: FrameState) => void;
  dispose: () => void;
}

/**
 * The processor package.
 *
 * Substrate + integrated heat spreader + die face. The die texture carries
 * the "AI" label in its emissive channel, so the lettering ignites with the
 * rest of the silicon rather than being a separate overlay. V2's package is
 * glass, so its face mixes an iridescent gradient over the die art.
 */
export const createChip = (theme: Theme, textureSize: number): ChipResult => {
  const group = new THREE.Group();
  const dieSize = Math.min(2048, textureSize / 2);
  const die = createDieTextures(theme, dieSize);
  const padTex = createPadGridTexture(theme, 512, 52);
  const glowTex = createDotTexture(256, 0.05);
  const streakTex = createStreakTexture(256);

  const uIgnite = uniform(0);

  // --- substrate --------------------------------------------------------
  // The dark packages want a visibly darker substrate under the spreader;
  // the glass one would read as a black frame if knocked down that far.
  const substrateShade = theme.chip.iridescent ? 0.94 : 0.7;
  const substrateMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(theme.chip.bodyColor).multiplyScalar(substrateShade),
    metalness: 0.35,
    roughness: 0.6,
  });
  const substrateGeo = new THREE.BoxGeometry(CHIP_SIZE, SUBSTRATE_H, CHIP_SIZE);
  const substrate = new THREE.Mesh(substrateGeo, substrateMat);
  group.add(substrate);

  // --- underside contact pads ------------------------------------------
  const padMat = new THREE.MeshStandardNodeMaterial({
    map: padTex,
    metalness: 0.9,
    roughness: 0.32,
  });
  const padGeo = new THREE.PlaneGeometry(CHIP_SIZE * 0.94, CHIP_SIZE * 0.94);
  const pads = new THREE.Mesh(padGeo, padMat);
  pads.rotation.x = Math.PI / 2;
  pads.position.y = -SUBSTRATE_H / 2 - 0.002;
  group.add(pads);

  // --- integrated heat spreader ----------------------------------------
  const spreaderMat = new THREE.MeshPhysicalNodeMaterial({
    color: new THREE.Color(theme.chip.bodyColor),
    metalness: theme.chip.bodyMetalness,
    roughness: theme.chip.bodyRoughness,
    clearcoat: theme.chip.iridescent ? 1 : 0.2,
    clearcoatRoughness: 0.06,
  });

  // --- die face ---------------------------------------------------------
  const dieMat = new THREE.MeshPhysicalNodeMaterial({
    metalness: theme.chip.iridescent ? 0.25 : 0.55,
    roughness: theme.chip.iridescent ? 0.08 : 0.32,
    clearcoat: theme.chip.iridescent ? 1 : 0.35,
    clearcoatRoughness: 0.04,
  });

  const vUv = uv();
  const albedoNode = texture(die.albedo);
  if (theme.chip.iridescent) {
    // Diagonal hue sweep across the glass, as in the V2 reference.
    const g = smoothstep(float(0), float(1), vUv.x.mul(0.65).add(vUv.y.mul(0.35)));
    const irid = mix(color(theme.chip.dieColorA), color(theme.chip.dieColorB), g);
    dieMat.colorNode = mix(albedoNode.rgb, irid, float(0.68));
  } else {
    dieMat.colorNode = albedoNode;
  }
  dieMat.emissiveNode = texture(die.emissive).rgb
    .mul(color(theme.chip.dieColorA))
    .mul(uIgnite.mul(theme.chip.dieGlow));

  // Box with the die art only on the top face.
  const spreaderGeo = new THREE.BoxGeometry(SPREADER, SPREADER_H, SPREADER);
  const spreader = new THREE.Mesh(spreaderGeo, [
    spreaderMat, spreaderMat, dieMat, spreaderMat, spreaderMat, spreaderMat,
  ]);
  spreader.position.y = SUBSTRATE_H / 2 + SPREADER_H / 2;
  group.add(spreader);

  // --- substrate detail -------------------------------------------------
  // Real packages carry a ring of tiny decoupling capacitors on the exposed
  // substrate around the lid, plus a chamfer where the lid meets it. Both
  // are small, but they are what stops the package reading as a plain box
  // once the camera is close.
  const chipRng = new Rng(theme.seed ^ 0xc41d);
  const ringInner = SPREADER / 2 + 0.28;
  const ringOuter = CHIP_SIZE / 2 - 0.18;

  const capGeo = new THREE.BoxGeometry(1, 1, 1);
  const capMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(theme.chip.bodyColor).multiplyScalar(substrateShade * 1.5),
    metalness: 0.5,
    roughness: 0.42,
  });
  const CAP_COUNT = 56;
  const caps = new THREE.InstancedMesh(capGeo, capMat, CAP_COUNT);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < CAP_COUNT; i++) {
      // Walk the ring, alternating sides, with a little jitter.
      const side = i % 4;
      const t = chipRng.range(-1, 1) * (ringOuter - 0.3);
      const r = chipRng.range(ringInner, ringOuter);
      const along = side < 2 ? t : r * (side === 2 ? 1 : -1);
      const across = side < 2 ? r * (side === 0 ? 1 : -1) : t;
      pos.set(side < 2 ? along : across, SUBSTRATE_H / 2 + 0.05, side < 2 ? across : along);
      q.setFromAxisAngle(up, side < 2 ? 0 : Math.PI / 2);
      scl.set(chipRng.range(0.18, 0.32), 0.1, chipRng.range(0.32, 0.55));
      m.compose(pos, q, scl);
      caps.setMatrixAt(i, m);
    }
    caps.instanceMatrix.needsUpdate = true;
  }
  group.add(caps);

  // Chamfer: a slightly wider, very thin plate just under the lid.
  const chamferMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(theme.chip.bodyColor).multiplyScalar(1.3),
    metalness: theme.chip.bodyMetalness,
    roughness: Math.max(0.05, theme.chip.bodyRoughness - 0.12),
  });
  const chamferGeo = new THREE.BoxGeometry(SPREADER + 0.34, 0.07, SPREADER + 0.34);
  const chamfer = new THREE.Mesh(chamferGeo, chamferMat);
  chamfer.position.y = SUBSTRATE_H / 2 + 0.035;
  group.add(chamfer);

  // --- rim light --------------------------------------------------------
  const rimMat = new THREE.MeshBasicNodeMaterial({
    color: new THREE.Color(theme.chip.dieColorA),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  });
  const rimGeo = new THREE.BoxGeometry(CHIP_SIZE * 1.02, SUBSTRATE_H * 1.1, CHIP_SIZE * 1.02);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.renderOrder = 5;
  group.add(rim);

  // --- glow sprite around the package -----------------------------------
  const haloMat = new THREE.MeshBasicNodeMaterial({
    map: glowTex,
    color: new THREE.Color(theme.chip.dieColorA),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  });
  const haloGeo = new THREE.PlaneGeometry(CHIP_SIZE * 3.6, CHIP_SIZE * 3.6);
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = SUBSTRATE_H;
  halo.renderOrder = 7;
  group.add(halo);

  // --- light shafts under a descending package (V3's signature) ---------
  const beamMat = new THREE.MeshBasicNodeMaterial({
    map: streakTex,
    color: new THREE.Color(theme.chip.beamColor),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const beams = new THREE.Group();
  const beamGeo = new THREE.PlaneGeometry(1, 1);
  const BEAM_COUNT = 14;
  for (let i = 0; i < BEAM_COUNT; i++) {
    const mesh = new THREE.Mesh(beamGeo, beamMat);
    const a = (i / BEAM_COUNT) * Math.PI * 2;
    const r = CHIP_SIZE * 0.36;
    mesh.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    mesh.rotation.y = -a;
    beams.add(mesh);
  }
  beams.renderOrder = 4;
  group.add(beams);

  const focusTarget = new THREE.Object3D();

  // The package light sells the die's output on the surrounding board.
  const chipLight = new THREE.PointLight(new THREE.Color(theme.chip.dieColorA), 0, 46, 1.7);
  chipLight.position.y = 1.2;
  group.add(chipLight);

  return {
    group,
    focusTarget,
    update: (s) => {
      group.position.y = s.chipY;
      group.rotation.set(s.chipTiltX, s.chipSpin, s.chipTiltZ);

      uIgnite.value = s.ignite;
      focusTarget.position.set(0, s.chipY, 0);

      rimMat.opacity = s.ignite * 0.07 + s.flash * 0.18;
      haloMat.opacity = s.ignite * 0.05 + s.flash * 0.22;
      halo.scale.setScalar(1 + s.flash * 1.6 + s.energy * 0.15);

      chipLight.intensity = s.ignite * 22 + s.flash * 130;
      chipLight.distance = 46 + s.flash * 40;

      // Shafts stretch from the package down to the board.
      const height = Math.max(0.001, s.chipY - SEAT_Y * 0.4);
      beamMat.opacity = s.beam * 0.5;
      beams.visible = s.beam > 0.004;
      if (beams.visible) {
        beams.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const wobble = 0.75 + 0.25 * Math.sin(i * 2.3 + s.seconds * 1.7);
          mesh.scale.set(1.5 * wobble, height, 1);
          mesh.position.y = -height / 2 - 0.2;
        });
      }
    },
    dispose: () => {
      die.dispose();
      padTex.dispose();
      glowTex.dispose();
      streakTex.dispose();
      [substrateGeo, padGeo, spreaderGeo, rimGeo, haloGeo, beamGeo, capGeo, chamferGeo].forEach((g) =>
        g.dispose(),
      );
      [substrateMat, padMat, spreaderMat, dieMat, rimMat, haloMat, beamMat, capMat, chamferMat].forEach(
        (mt) => mt.dispose(),
      );
      caps.dispose();
    },
  };
};

/** The contact shadow is parented to the world, so it is exported separately. */
export const createChipShadow = (theme: Theme) => {
  const tex = createShadowTexture(256);
  const mat = new THREE.MeshBasicNodeMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    color: new THREE.Color(0x000000),
    opacity: 0,
  });
  const geo = new THREE.PlaneGeometry(CHIP_SIZE * 2.8, CHIP_SIZE * 2.8);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  mesh.renderOrder = 2;
  return {
    mesh,
    update: (s: FrameState) => {
      const h = Math.max(0, s.chipY - SEAT_Y);
      mat.opacity = Math.max(0, 0.6 - h * 0.016) * (1 - Math.min(1, s.flash));
      mesh.scale.setScalar(1 + h * 0.03);
    },
    dispose: () => {
      tex.dispose();
      mat.dispose();
      geo.dispose();
    },
  };
};
