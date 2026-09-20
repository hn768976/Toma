import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';
import { Rng } from '../engine/rng';
import type { Theme } from '../themes';
import type { FrameState } from '../timeline';

const FIELD = 150;

export interface PartsResult {
  group: THREE.Group;
  update: (s: FrameState) => void;
  dispose: () => void;
}

interface Placement {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rotY: number;
  colorIndex: number;
  /** Distance from the socket, used to stagger the energy sweep. */
  radius: number;
}

/**
 * Attaches a per-instance linear-RGB attribute and returns the buffer.
 *
 * `InstancedMesh.setColorAt()` is not usable here: on the WebGPU backend the
 * `instanceColor` buffer is silently ignored (and, worse, its presence also
 * suppresses `material.color`, so every part renders white). Feeding an
 * explicit instanced attribute into `colorNode` works on both backends.
 */
const attachInstanceColors = (
  mesh: THREE.InstancedMesh,
  material: THREE.NodeMaterial,
  count: number,
) => {
  const data = new Float32Array(count * 3);
  mesh.geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(data, 3));
  material.colorNode = attribute('aColor', 'vec3');
  return data;
};

/**
 * Surface-mount population: chips, capacitors, connector headers and pads,
 * scattered on a jittered grid so the board reads as a designed layout
 * rather than random noise. Everything is instanced — three draw calls for
 * ~600 parts.
 */
export const createParts = (theme: Theme): PartsResult => {
  const group = new THREE.Group();
  const rng = new Rng(theme.seed ^ 0x2b1c);
  // Nothing is placed closer to the origin than this — the socket lives there.
  const keepOut = theme.components.keepOut;
  const palette = theme.components.palette.map((c) => new THREE.Color(c));

  // --- placement --------------------------------------------------------
  const placements: Placement[] = [];
  const cell = 7.5;
  const half = Math.floor(FIELD / 2 / cell);
  for (let ix = -half; ix <= half; ix++) {
    for (let iz = -half; iz <= half; iz++) {
      if (placements.length >= theme.components.count) break;
      const jx = rng.range(-0.42, 0.42) * cell;
      const jz = rng.range(-0.42, 0.42) * cell;
      const x = ix * cell + jx;
      const z = iz * cell + jz;
      const radius = Math.hypot(x, z);
      if (radius < keepOut) continue;
      // Thin out the far field — it is fogged and defocused anyway.
      if (radius > 55 && rng.chance(0.55)) continue;
      if (rng.chance(0.18)) continue;

      const big = rng.chance(0.16);
      const w = big ? rng.range(3.2, 6.4) : rng.range(0.8, 2.6);
      const d = big ? rng.range(3.2, 6.0) : rng.range(0.5, 2.0);
      const h = big ? rng.range(0.5, 1.5) : rng.range(0.18, 0.72);
      placements.push({
        x,
        z,
        w,
        d,
        h,
        rotY: (rng.int(0, 3) * Math.PI) / 2,
        colorIndex: rng.int(0, palette.length - 1),
        radius,
      });
    }
  }

  // --- instanced bodies -------------------------------------------------
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const bodyMat = new THREE.MeshPhysicalNodeMaterial({
    color: new THREE.Color(0xff0000),
    roughness: theme.components.roughness,
    metalness: theme.components.metalness,
    clearcoat: theme.components.clearcoat,
    clearcoatRoughness: 0.12,
  });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, placements.length);
  bodies.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const bodyColors = attachInstanceColors(bodies, bodyMat, placements.length);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  placements.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotY);
    pos.set(p.x, p.h / 2, p.z);
    scl.set(p.w, p.h, p.d);
    m.compose(pos, q, scl);
    bodies.setMatrixAt(i, m);
    const c = palette[p.colorIndex];
    bodyColors.set([c.r, c.g, c.b], i * 3);
  });
  bodies.instanceMatrix.needsUpdate = true;
  group.add(bodies);

  // --- capacitors -------------------------------------------------------
  const capCount = Math.round(theme.components.count * 0.12);
  const capGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1);
  const capMat = new THREE.MeshPhysicalNodeMaterial({
    roughness: Math.max(0.08, theme.components.roughness - 0.15),
    metalness: Math.min(1, theme.components.metalness + 0.35),
    clearcoat: theme.components.clearcoat,
  });
  const caps = new THREE.InstancedMesh(capGeo, capMat, capCount);
  const capColors = attachInstanceColors(caps, capMat, capCount);
  for (let i = 0; i < capCount; i++) {
    const src = placements[rng.int(0, placements.length - 1)];
    const r = rng.range(0.45, 1.25);
    const h = rng.range(1.1, 3.0);
    q.identity();
    // Jittering off a body placement can nudge a capacitor back inside the
    // keep-out, so the radius is re-checked below.
    pos.set(src.x + rng.range(-2.5, 2.5), h / 2, src.z + rng.range(-2.5, 2.5));
    if (Math.hypot(pos.x, pos.z) < keepOut) pos.x += keepOut;
    scl.set(r, h, r);
    m.compose(pos, q, scl);
    caps.setMatrixAt(i, m);
    const c = palette[rng.int(0, palette.length - 1)];
    capColors.set([c.r, c.g, c.b], i * 3);
  }
  caps.instanceMatrix.needsUpdate = true;
  group.add(caps);

  // --- connector pin headers -------------------------------------------
  const pinRows = 22;
  const pinsPerRow = 16;
  const pinGeo = new THREE.BoxGeometry(1, 1, 1);
  // Mirror-finish pins read as black spikes on the bright board, so the
  // light theme gets a softer, less specular header.
  const pinMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(theme.socket.padColor),
    roughness: theme.components.clearcoat > 0.5 ? 0.5 : 0.26,
    metalness: theme.components.clearcoat > 0.5 ? 0.35 : 0.5,
  });
  const pins = new THREE.InstancedMesh(pinGeo, pinMat, pinRows * pinsPerRow);
  let pi = 0;
  for (let row = 0; row < pinRows; row++) {
    const ang = rng.float() * Math.PI * 2;
    const rad = rng.range(keepOut + 6, 62);
    const bx = Math.cos(ang) * rad;
    const bz = Math.sin(ang) * rad;
    const along = rng.chance(0.5);
    const pitch = 0.55;
    for (let k = 0; k < pinsPerRow; k++) {
      const off = (k - pinsPerRow / 2) * pitch;
      q.identity();
      pos.set(bx + (along ? off : 0), 0.4, bz + (along ? 0 : off));
      scl.set(0.2, 0.8, 0.2);
      m.compose(pos, q, scl);
      pins.setMatrixAt(pi++, m);
    }
  }
  pins.instanceMatrix.needsUpdate = true;
  group.add(pins);

  // Components pick up a little of the board's energy as the wave passes.
  const baseEmissive = theme.components.emissive;
  const glowColor = new THREE.Color(theme.board.traceGlowColor);
  bodyMat.emissive = glowColor.clone();
  capMat.emissive = glowColor.clone();

  return {
    group,
    update: (s) => {
      const lift = baseEmissive + s.energy * 0.02 + s.flash * 0.05;
      bodyMat.emissiveIntensity = lift;
      capMat.emissiveIntensity = lift * 1.3;
    },
    dispose: () => {
      bodyGeo.dispose();
      capGeo.dispose();
      pinGeo.dispose();
      bodyMat.dispose();
      capMat.dispose();
      pinMat.dispose();
      bodies.dispose();
      caps.dispose();
      pins.dispose();
    },
  };
};
