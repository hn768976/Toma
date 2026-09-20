import * as THREE from 'three/webgpu';
import {
  abs,
  atan,
  color,
  float,
  floor,
  fract,
  mix,
  pow,
  sin,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
} from 'three/tsl';
import type { Theme } from '../themes';
import type { FrameState } from '../timeline';
import { createBoardGrainTexture, createBoardTextures, type BoardTextures } from './textures';

/** Side length of the hero routing plane, in world units. */
export const ROUTING_SIZE = 104;
/** Number of radial buses in the fan-out. Shared with the packet shader. */
export const BUS_COUNT = 108;
/** Side length of the far board. Fog and defocus take care of its edges. */
const FAR_SIZE = 460;

export interface BoardParts {
  group: THREE.Group;
  update: (s: FrameState) => void;
  dispose: () => void;
}

/**
 * The motherboard is two coplanar planes:
 *
 *  - a large, tiled, fogged "far board" that fills frame to the horizon, and
 *  - a smaller high-density routing plane carrying the hero fan-out, drawn
 *    with the copper itself as the alpha channel so it dissolves into the
 *    far board with no visible seam.
 *
 * The energy wave is a TSL expression on the routing plane: a soft disc that
 * grows outward from the socket in UV space, with a bright band at the
 * wavefront and travelling packets behind it. Because the glow is masked by
 * the same texture that drew the copper, the light always lands exactly on
 * the traces.
 */
export const createBoard = (theme: Theme, textureSize: number): BoardParts => {
  const group = new THREE.Group();
  const tex: BoardTextures = createBoardTextures(theme, textureSize);
  const grain = createBoardGrainTexture(theme, 1024);
  grain.repeat.set(14, 14);

  // --- far board --------------------------------------------------------
  const farMat = new THREE.MeshStandardNodeMaterial({
    roughness: theme.board.roughness,
    metalness: theme.board.metalness,
  });
  farMat.colorNode = texture(grain);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(FAR_SIZE, FAR_SIZE, 1, 1), farMat);
  far.rotation.x = -Math.PI / 2;
  far.position.y = -0.015;
  far.renderOrder = 0;
  group.add(far);

  // --- hero routing plane ----------------------------------------------
  const uWaveRadius = uniform(0);
  const uWaveGlow = uniform(0);
  const uEnergy = uniform(0);
  const uSustain = uniform(theme.board.sustainGlow);
  const uTime = uniform(0);
  const uIdle = uniform(theme.board.idleGlow);

  const routingMat = new THREE.MeshStandardNodeMaterial({
    transparent: true,
    depthWrite: false,
    roughness: 0.34,
    metalness: 0.62,
  });

  const vUv = uv();
  const centred = vUv.sub(vec2(0.5, 0.5));
  const radius = centred.length();
  const mask = texture(tex.traceMask).r;

  const band = float(0.055);
  // 1 behind the wavefront, 0 ahead of it.
  const behind = smoothstep(uWaveRadius.sub(band), uWaveRadius.add(band), radius).oneMinus();
  // A bright, narrow band riding the front itself.
  const front = smoothstep(float(0), band, abs(radius.sub(uWaveRadius))).oneMinus();
  // Packets racing outward along the routing once it is live.
  //
  // A packet term that depends only on radius draws concentric rings across
  // the whole board — which is not what data moving along traces looks like.
  // The fan-out is laid down as BUS_COUNT evenly spaced buses, so quantising
  // the polar angle recovers (near enough) which bus a pixel belongs to, and
  // hashing that index gives every bus its own phase. The rings break up into
  // independent runs, one per bus.
  const angle = atan(centred.y, centred.x);
  const busIndex = floor(angle.add(Math.PI).div(Math.PI * 2).mul(BUS_COUNT));
  const busPhase = fract(sin(busIndex.mul(12.9898)).mul(43758.5453));
  const packet = pow(fract(radius.mul(70).sub(uTime.mul(2.2)).add(busPhase)), float(13));
  // Dissolve the plane's own border into the far board.
  const edgeFade = smoothstep(float(0.34), float(0.5), radius).oneMinus();

  // Radial attenuation. Without it the routing sits at full brightness all
  // the way to the frame edge and the shot reads as a flat wall of cyan; the
  // references keep the energy concentrated around the package and let the
  // outer board fall away. Floored rather than taken to zero so the far
  // board still shows live traces.
  const falloff = smoothstep(float(0.07), float(0.46), radius).oneMinus().mul(0.82).add(0.18);

  const glow = behind
    .mul(uEnergy)
    .mul(uSustain)
    .add(front.mul(uWaveGlow))
    .add(packet.mul(behind).mul(uEnergy).mul(0.85))
    .mul(falloff)
    .add(uIdle);

  routingMat.colorNode = color(theme.board.traceColor);
  routingMat.roughnessNode = texture(tex.roughness).r;
  routingMat.emissiveNode = color(theme.board.traceGlowColor).mul(glow).mul(mask);
  // Lit copper also becomes more opaque, so the glow is not eaten by blending.
  routingMat.opacityNode = mask.mul(edgeFade).mul(glow.mul(0.35).add(1).min(2.2));

  const routing = new THREE.Mesh(new THREE.PlaneGeometry(ROUTING_SIZE, ROUTING_SIZE, 1, 1), routingMat);
  routing.rotation.x = -Math.PI / 2;
  routing.position.y = 0.012;
  routing.renderOrder = 1;
  group.add(routing);

  // --- solder-mask sheen on top of the routing --------------------------
  const sheenMat = new THREE.MeshStandardNodeMaterial({
    transparent: true,
    depthWrite: false,
    roughness: theme.board.roughness,
    metalness: theme.board.metalness,
  });
  sheenMat.colorNode = texture(tex.albedo);
  sheenMat.opacityNode = mix(float(0.92), float(0.0), smoothstep(float(0.36), float(0.5), radius));
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(ROUTING_SIZE, ROUTING_SIZE, 1, 1), sheenMat);
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.y = 0.004;
  sheen.renderOrder = 0.5;
  group.add(sheen);

  return {
    group,
    update: (s) => {
      uWaveRadius.value = s.waveRadius;
      uWaveGlow.value = s.waveGlow * s.energy;
      uEnergy.value = s.energy;
      uTime.value = s.seconds;
    },
    dispose: () => {
      tex.dispose();
      grain.dispose();
      far.geometry.dispose();
      routing.geometry.dispose();
      sheen.geometry.dispose();
      farMat.dispose();
      routingMat.dispose();
      sheenMat.dispose();
    },
  };
};
