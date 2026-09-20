import * as THREE from 'three/webgpu';
import { attribute, color as tslColor } from 'three/tsl';
import { Rng } from '../engine/rng';
import type { Theme } from '../themes';
import type { FrameState } from '../timeline';
import { createDotTexture, createHalftoneTexture, createRingTexture, createStreakTexture } from './textures';

export interface EnergyResult {
  group: THREE.Group;
  update: (s: FrameState, camera: THREE.Camera) => void;
  dispose: () => void;
}

interface Streak {
  angle: number;
  /** Radius the streak is born at. */
  r0: number;
  /** Radius it dies at. */
  r1: number;
  length: number;
  width: number;
  /** Height above the board. */
  y: number;
  /** Seconds for one birth-to-death trip. */
  cycle: number;
  /** Offset into the cycle, so the field does not pulse in lockstep. */
  phase: number;
  brightness: number;
  /** Upward tilt, in radians — used by the airborne rays. */
  rise: number;
}

/**
 * Builds a field of additive streaks racing outward from the socket.
 *
 * Each streak walks its own cycle from `r0` to `r1`, fading in and out
 * across the trip, so after the initial synchronised burst the field
 * settles into a continuous flow — which is what the references do once
 * the chip is live.
 */
const buildStreakField = (
  rng: Rng,
  count: number,
  opts: {
    rMin: number;
    rMax: number;
    lenMin: number;
    lenMax: number;
    widthMin: number;
    widthMax: number;
    yMin: number;
    yMax: number;
    cycleMin: number;
    cycleMax: number;
    riseMax: number;
    /** Spread of the initial synchronised burst, in seconds. */
    burst: number;
  },
): Streak[] => {
  const out: Streak[] = [];
  for (let i = 0; i < count; i++) {
    // Golden-angle stepping gives an even angular spread without clumping.
    const angle = (i * 2.399963229728653) % (Math.PI * 2) + rng.range(-0.05, 0.05);
    const cycle = rng.range(opts.cycleMin, opts.cycleMax);
    out.push({
      angle,
      r0: rng.range(opts.rMin, opts.rMin + 3),
      r1: rng.range(opts.rMax * 0.55, opts.rMax),
      length: rng.range(opts.lenMin, opts.lenMax),
      width: rng.range(opts.widthMin, opts.widthMax),
      y: rng.range(opts.yMin, opts.yMax),
      cycle,
      phase: (rng.float() * opts.burst) / cycle,
      brightness: rng.range(0.04, 0.17),
      rise: rng.range(0, opts.riseMax),
    });
  }
  return out;
};

const streakGeometry = () => {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2); // lie flat: length on X, width on Z
  geo.translate(0.5, 0, 0); // origin at the tail
  return geo;
};

/**
 * Per-instance brightness, fed in as an instanced attribute.
 *
 * `InstancedMesh.setColorAt()` is a no-op on the WebGPU backend here, which
 * would leave every streak burning at full material colour with no fade in
 * or out. An explicit attribute multiplied into `colorNode` works on both
 * backends, and one float per instance is cheaper to re-upload each frame
 * than a full RGB triple.
 */
const attachBrightness = (
  mesh: THREE.InstancedMesh,
  material: THREE.NodeMaterial,
  base: string,
  count: number,
) => {
  const data = new Float32Array(count);
  const attr = new THREE.InstancedBufferAttribute(data, 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  mesh.geometry.setAttribute('aBright', attr);
  material.colorNode = tslColor(base).mul(attribute('aBright', 'float'));
  return { data, attr };
};

export const createEnergy = (theme: Theme): EnergyResult => {
  const group = new THREE.Group();
  const rng = new Rng(theme.seed ^ 0x77aa);
  const streakTex = createStreakTexture(256);
  const dotTex = createDotTexture(128, 0.0);
  const ringTex = createRingTexture(512, 0.62, 0.99);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const axisY = new THREE.Vector3(0, 1, 0);

  // --- ground-hugging data streams --------------------------------------
  const streams = buildStreakField(rng, theme.energy.streamCount, {
    rMin: 6.5,
    rMax: 74,
    lenMin: 5,
    lenMax: 26,
    widthMin: 0.09,
    widthMax: 0.5,
    yMin: 0.07,
    yMax: 0.3,
    cycleMin: 1.5,
    cycleMax: 3.4,
    riseMax: 0,
    burst: 0.5,
  });
  const streamMat = new THREE.MeshBasicNodeMaterial({
    map: streakTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
  const streamGeo = streakGeometry();
  const streamMesh = new THREE.InstancedMesh(streamGeo, streamMat, streams.length);
  streamMesh.frustumCulled = false;
  streamMesh.renderOrder = 8;
  group.add(streamMesh);
  const streamBright = attachBrightness(
    streamMesh,
    streamMat,
    theme.energy.streamColor,
    streams.length,
  );

  // --- airborne rays ----------------------------------------------------
  const rays = buildStreakField(rng, theme.energy.rayCount, {
    rMin: 5,
    rMax: 60,
    lenMin: 7,
    lenMax: 30,
    widthMin: 0.12,
    widthMax: 0.7,
    yMin: 0.6,
    yMax: 7.5,
    cycleMin: 1.2,
    cycleMax: 2.8,
    riseMax: 0.5,
    burst: 0.35,
  });
  const rayMat = new THREE.MeshBasicNodeMaterial({
    map: streakTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const rayGeo = streakGeometry();
  const rayMesh = new THREE.InstancedMesh(rayGeo, rayMat, rays.length);
  rayMesh.frustumCulled = false;
  rayMesh.renderOrder = 9;
  group.add(rayMesh);
  const rayBright = attachBrightness(rayMesh, rayMat, theme.energy.rayColor, rays.length);

  const updateField = (
    mesh: THREE.InstancedMesh,
    defs: Streak[],
    bright: { data: Float32Array; attr: THREE.InstancedBufferAttribute },
    s: FrameState,
    gain: number,
  ) => {
    const live = s.streamEnergy;
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const local = Math.max(0, s.seconds - theme.beats.seat) / d.cycle - d.phase;
      if (live <= 0.001 || local <= 0) {
        scl.set(0, 0, 0);
        m.compose(pos.set(0, -50, 0), q.identity(), scl);
        mesh.setMatrixAt(i, m);
        bright.data[i] = 0;
        continue;
      }
      const u = local % 1;
      // Ease the travel so streaks decelerate as they reach the far field.
      const travel = 1 - Math.pow(1 - u, 2.2);
      const r = d.r0 + (d.r1 - d.r0) * travel;
      // Fade in fast, out slow.
      const alpha = Math.sin(Math.pow(u, 0.7) * Math.PI) * d.brightness * live * gain;

      q.setFromAxisAngle(axisY, -d.angle);
      if (d.rise > 0) {
        const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -d.rise * travel);
        q.multiply(tilt);
      }
      pos.set(Math.cos(d.angle) * r, d.y + d.rise * travel * 6, Math.sin(d.angle) * r);
      scl.set(d.length * (0.5 + travel), 1, d.width);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
      bright.data[i] = Math.max(0, alpha);
    }
    mesh.instanceMatrix.needsUpdate = true;
    bright.attr.needsUpdate = true;
  };

  // --- shockwave rings --------------------------------------------------
  const makeRing = (size: number, blending: THREE.Blending, c: string) => {
    const mat = new THREE.MeshBasicNodeMaterial({
      map: ringTex,
      color: new THREE.Color(c),
      transparent: true,
      blending,
      depthWrite: false,
      opacity: 0,
    });
    const geo = new THREE.PlaneGeometry(size, size);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.22;
    mesh.renderOrder = 10;
    group.add(mesh);
    return { mesh, mat, geo };
  };

  const ringBlend = theme.energy.halftone ? THREE.NormalBlending : THREE.AdditiveBlending;
  const ringA = makeRing(11, ringBlend, theme.energy.ringColor);
  const ringB = makeRing(11, ringBlend, theme.energy.ringColor);

  // --- halftone pulse (V2) ---------------------------------------------
  let halftone: { mesh: THREE.Mesh; mat: THREE.MeshBasicNodeMaterial; geo: THREE.PlaneGeometry; tex: THREE.Texture } | null = null;
  if (theme.energy.halftone) {
    const tex = createHalftoneTexture(1024, 58);
    const mat = new THREE.MeshBasicNodeMaterial({
      map: tex,
      color: new THREE.Color(theme.energy.ringColor),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const geo = new THREE.PlaneGeometry(26, 26);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.18;
    mesh.renderOrder = 3;
    group.add(mesh);
    halftone = { mesh, mat, geo, tex };
  }

  // --- floating motes ---------------------------------------------------
  interface Mote {
    x: number;
    y: number;
    z: number;
    size: number;
    speed: number;
    swing: number;
    seed: number;
    brightness: number;
  }
  const motes: Mote[] = [];
  for (let i = 0; i < theme.energy.dustCount; i++) {
    const a = rng.float() * Math.PI * 2;
    const r = Math.sqrt(rng.float()) * 62 + 5;
    motes.push({
      x: Math.cos(a) * r,
      y: rng.range(0.6, 20),
      z: Math.sin(a) * r,
      size: rng.range(0.07, 0.34),
      speed: rng.range(0.12, 0.7),
      swing: rng.range(0.4, 2.2),
      seed: rng.float() * 100,
      brightness: rng.range(0.2, 1),
    });
  }
  const moteMat = new THREE.MeshBasicNodeMaterial({
    map: dotTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const moteGeo = new THREE.PlaneGeometry(1, 1);
  const moteMesh = new THREE.InstancedMesh(moteGeo, moteMat, motes.length);
  moteMesh.frustumCulled = false;
  moteMesh.renderOrder = 11;
  group.add(moteMesh);
  const moteBright = attachBrightness(moteMesh, moteMat, theme.energy.dustColor, motes.length);

  return {
    group,

    update: (s, camera) => {
      updateField(streamMesh, streams, streamBright, s, 1);
      updateField(rayMesh, rays, rayBright, s, 0.65);

      ringA.mat.opacity = s.ringAlpha * (theme.energy.halftone ? 0.45 : 0.4);
      ringA.mesh.scale.setScalar(s.ringScale);
      ringB.mat.opacity = s.ring2Alpha * (theme.energy.halftone ? 0.3 : 0.28);
      ringB.mesh.scale.setScalar(s.ring2Scale);

      if (halftone) {
        halftone.mat.opacity = s.ringAlpha * 0.5;
        halftone.mesh.scale.setScalar(1 + (s.ringScale - 1) * 0.42);
      }

      // Motes drift upward and billboard toward the camera.
      camera.updateMatrixWorld();
      const camQ = camera.quaternion;
      const glow = (0.25 + s.energy * 0.75) * 0.45;
      for (let i = 0; i < motes.length; i++) {
        const d = motes[i];
        const y = ((d.y + s.seconds * d.speed) % 22) + 0.4;
        const sway = Math.sin(s.seconds * d.swing * 0.5 + d.seed) * 0.8;
        pos.set(d.x + sway, y, d.z + Math.cos(s.seconds * d.swing * 0.4 + d.seed) * 0.8);
        const twinkle = 0.55 + 0.45 * Math.sin(s.seconds * 2.2 + d.seed * 3.1);
        scl.setScalar(d.size * (1 + s.flash * 0.6));
        m.compose(pos, camQ, scl);
        moteMesh.setMatrixAt(i, m);
        moteBright.data[i] = d.brightness * twinkle * glow;
      }
      moteMesh.instanceMatrix.needsUpdate = true;
      moteBright.attr.needsUpdate = true;
    },

    dispose: () => {
      streakTex.dispose();
      dotTex.dispose();
      ringTex.dispose();
      streamGeo.dispose();
      rayGeo.dispose();
      moteGeo.dispose();
      streamMat.dispose();
      rayMat.dispose();
      moteMat.dispose();
      streamMesh.dispose();
      rayMesh.dispose();
      moteMesh.dispose();
      [ringA, ringB].forEach((r) => {
        r.geo.dispose();
        r.mat.dispose();
      });
      if (halftone) {
        halftone.geo.dispose();
        halftone.mat.dispose();
        halftone.tex.dispose();
      }
    },
  };
};
