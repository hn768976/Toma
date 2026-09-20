import * as THREE from "three";
import type { VariantConfig, VariantId } from "../config";
import { FPS } from "../config";
import {
  clamp01,
  easeInOutCubic,
  easeOutCubic,
  easeOutQuint,
  mix,
  smoothstep,
  springImpulse,
} from "../gfx/easing";
import { CHIP_H, WAVE_NORM, type SceneParts } from "./build";

/** Height the package starts at before it descends. */
const START_HEIGHT = 6.2;
// Seated so the package lid clears the socket wall while its body sits inside.
const SEATED_Y = 0.30 + CHIP_H / 2;

type CamKey = {
  /** Normalised time 0..1 across the whole clip. */
  t: number;
  /** Spherical-ish framing: distance, height, yaw in radians. */
  dist: number;
  height: number;
  yaw: number;
  /** Point the camera aims at, as a height above the board. */
  targetY: number;
  fov: number;
};

/**
 * Camera paths, one per variant, keyed off the reference clips:
 *   v1 — high three-quarter angle, slow push-in with a gentle orbital drift.
 *   v2 — low macro angle, lateral drift, like a product shot on a slider.
 *   v3 — low angle push-in that settles and holds on the finished chip.
 */
const PATHS: Record<VariantId, CamKey[]> = {
  v1: [
    { t: 0.0, dist: 13.0, height: 9.6, yaw: -0.52, targetY: 1.0, fov: 36 },
    { t: 0.22, dist: 11.4, height: 8.4, yaw: -0.3, targetY: 0.8, fov: 35 },
    { t: 0.55, dist: 10.0, height: 7.3, yaw: 0.0, targetY: 0.6, fov: 34 },
    { t: 1.0, dist: 8.8, height: 6.4, yaw: 0.36, targetY: 0.5, fov: 33 },
  ],
  v2: [
    { t: 0.0, dist: 10.6, height: 4.6, yaw: 0.6, targetY: 0.5, fov: 30 },
    { t: 0.3, dist: 9.4, height: 4.1, yaw: 0.34, targetY: 0.45, fov: 29 },
    { t: 0.65, dist: 8.5, height: 3.8, yaw: 0.02, targetY: 0.42, fov: 28 },
    { t: 1.0, dist: 8.0, height: 3.65, yaw: -0.26, targetY: 0.4, fov: 28 },
  ],
  v3: [
    { t: 0.0, dist: 12.2, height: 5.2, yaw: -0.22, targetY: 0.7, fov: 33 },
    { t: 0.35, dist: 10.2, height: 4.6, yaw: -0.1, targetY: 0.6, fov: 32 },
    { t: 0.72, dist: 8.6, height: 4.15, yaw: 0.02, targetY: 0.52, fov: 31 },
    { t: 1.0, dist: 8.2, height: 4.0, yaw: 0.07, targetY: 0.5, fov: 31 },
  ],
};

const sampleCam = (keys: CamKey[], t: number): CamKey => {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1];
      const b = keys[i];
      const k = easeInOutCubic((t - a.t) / (b.t - a.t || 1));
      return {
        t,
        dist: mix(a.dist, b.dist, k),
        height: mix(a.height, b.height, k),
        yaw: mix(a.yaw, b.yaw, k),
        targetY: mix(a.targetY, b.targetY, k),
        fov: mix(a.fov, b.fov, k),
      };
    }
  }
  return keys[keys.length - 1];
};

export type FrameState = {
  /** Screen-space Y of the chip, for the post pass's focus band. */
  focusY: number;
  energy: number;
  flash: number;
};

// Allocated once: updateScene runs per frame and these would otherwise churn.
const AMBER = new THREE.Color(0xffb04a);
const WHITE = new THREE.Color(0xffffff);
const COOL_WHITE = new THREE.Color(0xeaf6ff);
const GLOSS_BLACK = new THREE.Color(0x07090c);

const tmpTarget = new THREE.Vector3();
const tmpProj = new THREE.Vector3();
const ringMat4 = new THREE.Matrix4();
const ringQuat = new THREE.Quaternion();
const ringPos = new THREE.Vector3();
const ringScale = new THREE.Vector3();

export const updateScene = (
  parts: SceneParts,
  cfg: VariantConfig,
  frame: number,
): FrameState => {
  const dur = cfg.durationInFrames;
  const time = frame / FPS;
  const t01 = clamp01(frame / (dur - 1));
  const { beats } = cfg;

  // ------------------------------------------------------------- camera
  const key = sampleCam(PATHS[cfg.id], t01);
  // Slow breathing drift keeps handheld life in an otherwise rigid move.
  const drift = Math.sin(time * 0.42) * 0.035 + Math.sin(time * 0.17 + 1.3) * 0.02;
  const yaw = key.yaw + drift * 0.5;
  const cam = parts.camera;
  cam.position.set(
    Math.sin(yaw) * key.dist,
    key.height + Math.sin(time * 0.31) * 0.06,
    Math.cos(yaw) * key.dist,
  );
  tmpTarget.set(0, key.targetY, 0);
  cam.lookAt(tmpTarget);
  if (cam.fov !== key.fov) {
    cam.fov = key.fov;
    cam.updateProjectionMatrix();
  }

  // Shake the frame briefly on impact.
  const sinceSeat = (frame - beats.seat) / FPS;
  const impact = springImpulse(Math.max(0, sinceSeat), 7, 9);
  if (frame >= beats.seat && sinceSeat < 0.8) {
    cam.position.y += impact * 0.055;
    cam.rotateZ(impact * 0.0045);
  }

  // --------------------------------------------------------------- chip
  const descend = clamp01(
    (frame - beats.descendStart) / (beats.seat - beats.descendStart),
  );
  const drop = easeOutQuint(descend);
  const chipY = mix(START_HEIGHT, SEATED_Y, drop);
  // A small settle bounce reads as the package clicking into the socket.
  const settle = frame >= beats.seat ? impact * 0.05 : 0;
  parts.chip.position.y = chipY + settle;
  parts.chip.rotation.y = mix(0.26, 0, easeOutCubic(descend)) * (cfg.id === "v2" ? 1 : 0.6);

  // ------------------------------------------------------------ energy
  // The wavefront travels outward at constant world speed from the moment of
  // contact; uWave is expressed in the same normalised units as the baked
  // "distance along run" channel.
  const waveT = clamp01((frame - beats.seat) / (beats.waveEnd - beats.seat));
  // Nearly linear: an ease-out here makes the front cross the visible board in
  // the first few frames and the reveal is lost.
  const waveRadius = Math.pow(waveT, 0.88) * 74;
  const energy = smoothstep(0, 0.1, waveT) * (0.55 + 0.45 * smoothstep(0, 0.45, waveT));
  const flash = frame >= beats.seat ? Math.exp(-Math.max(0, sinceSeat) * 5.2) : 0;

  // V3 cools from blue to white as the chip hands over to steady-state.
  const transform =
    beats.transformStart !== undefined && beats.transformEnd !== undefined
      ? smoothstep(beats.transformStart, beats.transformEnd, frame)
      : 0;

  for (const mat of [parts.boardMat, parts.fieldMat]) {
    const u = mat.userData.uniforms;
    u.uTime.value = time;
    u.uWave.value = waveRadius / WAVE_NORM;
    u.uWaveWidth.value = mix(0.09, 0.3, waveT);
    u.uEnergy.value = energy;
    u.uPacketAmount.value = mix(1, 0.55, transform);
    u.uGlowGain.value = 1 + flash * 2.2;
  }

  if (cfg.id === "v3") {
    // Traces shift from vivid blue to cool white over the transform.
    parts.boardMat.userData.uniforms.uTraceHot.value
      .set(0x2fb8ff)
      .lerp(WHITE, transform);
    parts.fieldMat.userData.uniforms.uTraceHot.value
      .set(0x2fb8ff)
      .lerp(COOL_WHITE, transform);
    parts.boardMat.userData.uniforms.uTraceEdge.value
      .set(0x8fe0ff)
      .lerp(WHITE, transform);
  }

  // V2's halftone ripple: a dot-matrix wave instead of a hot trace front.
  if (cfg.id === "v2") {
    const rip = Math.exp(-Math.max(0, sinceSeat) * 0.5) * smoothstep(0, 0.05, waveT);
    for (const mat of [parts.boardMat, parts.fieldMat]) {
      const u = mat.userData.uniforms;
      u.uRipple.value = rip * 1.6;
      u.uRippleRadius.value = waveRadius / WAVE_NORM;
      u.uRippleWidth.value = 0.26;
      // Coarse enough that individual dots survive at 1080p; the earlier
      // scale put them below a pixel and the ripple vanished.
      u.uDotScale.value = mat === parts.boardMat ? 34 : 130;
    }
  }

  // ----------------------------------------------------- chip materials
  const bodyU = parts.chipBody.userData.uniforms;
  const lidU = parts.chipLid.userData.uniforms;
  bodyU.uTime.value = time;
  lidU.uTime.value = time;

  const inFlight = 1 - drop;
  if (cfg.chipStyle === "hologram") {
    // Descends as a projection, resolves into a solid package, then the
    // surface goes glossy black with a bright white lip.
    const solidify = easeOutCubic(clamp01((frame - beats.seat) / 30));
    const holo = Math.max(mix(1, 0, solidify), inFlight * 0.95) * (1 - transform);
    bodyU.uHolo.value = holo;
    lidU.uHolo.value = holo;
    bodyU.uHoloScale.value = 34;
    lidU.uHoloScale.value = 34;

    // A tight, bright Fresnel lip rather than a broad wash: a wide rim on a
    // smooth lid reflects the whole studio and turns the chip white.
    bodyU.uRimPower.value = mix(2.8, 5.2, transform);
    lidU.uRimPower.value = 6.5;
    bodyU.uRim.value = mix(0.45, 1.5, transform) + flash * 1.2;
    lidU.uRim.value = 0.12 + flash * 0.4;
    lidU.uEdge.value = mix(0.55, 1.2, transform) + flash * 0.8;
    lidU.uEdgeWidth.value = 0.05;
    bodyU.uRimColor.value.set(0x35c0ff).lerp(WHITE, transform);
    lidU.uRimColor.value.set(0x35c0ff).lerp(WHITE, transform);

    parts.chipBody.color.setHex(0x0b0e12);
    parts.chipBody.transmission = mix(0.62, 0.0, solidify) * (1 - transform);
    parts.chipBody.opacity = mix(0.45, 1, solidify);
    parts.chipBody.transparent = true;
    parts.chipBody.metalness = mix(0.3, 0.72, transform);
    parts.chipBody.roughness = mix(0.12, 0.09, transform);

    parts.chipLid.transparent = true;
    parts.chipLid.opacity = mix(0.55, 1, solidify);
    parts.chipLid.color.set(0x11557f).lerp(GLOSS_BLACK, transform);
    parts.chipLid.metalness = mix(0.35, 0.62, transform);
    // Kept off mirror-smooth so the lid stays black instead of mirroring the
    // bright ceiling panel of the studio environment.
    parts.chipLid.roughness = mix(0.22, 0.34, transform);
    parts.chipLid.clearcoat = mix(1, 0.35, transform);
    parts.chipLid.clearcoatRoughness = mix(0.06, 0.4, transform);
    parts.chipBody.clearcoatRoughness = mix(0.06, 0.3, transform);

    lidU.uDie.value = mix(0.34, 0.05, transform) * (0.35 + holo * 0.9);
    lidU.uCircuit.value = mix(0.5, 0.1, transform);
    lidU.uLabelColor.value.set(0xd6f0ff).lerp(WHITE, transform);
    lidU.uLabel.value =
      smoothstep(beats.descendStart, beats.seat, frame) * mix(1.35, 1.2, transform) +
      flash * 0.7;
  } else if (cfg.chipStyle === "iridescent") {
    lidU.uSheen.value = 1;
    // The marking has to stay legible against a bright iridescent lid, so it
    // is driven harder here than on the dark variants.
    lidU.uLabel.value = smoothstep(beats.descendStart, beats.seat - 8, frame) * 0.95;
    lidU.uLabelColor.value.set(0xffffff);
    bodyU.uRim.value = 0.55;
    lidU.uRim.value = 0.12;
    lidU.uEdge.value = 0.5;
    lidU.uDie.value = 0.12;
    lidU.uCircuit.value = 0.16;
  } else {
    // V1: the marking is already lit on the way down, as in the reference,
    // then spikes amber at the instant of contact and cools to the board's
    // electric white-blue. Holds at 1 until contact, decays after it.
    const hot = Math.exp(-Math.max(0, sinceSeat) * 2.1);
    lidU.uLabelColor.value
      .set(0xdcf2ff)
      .lerp(AMBER, frame >= beats.seat ? hot : 0);
    lidU.uLabel.value =
      smoothstep(beats.descendStart, beats.seat, frame) * 1.0 + flash * 1.6 + hot * 1.0;
    lidU.uDie.value = 0.2 + energy * 0.35;
    lidU.uCircuit.value = 0.25 + energy * 0.5;
    bodyU.uRim.value = 0.7 + flash * 2;
    lidU.uRim.value = 0.15 + flash * 0.5;
    lidU.uEdge.value = 0.5 + energy * 0.35 + flash * 1.4;
  }

  // -------------------------------------------------------------- lights
  parts.chipLight.intensity = (0.45 + energy * 1.3 + flash * 20) * (cfg.id === "v2" ? 0.45 : 1);
  // Kept just above the board rather than above the package. Sitting over the
  // chip, this light throws a specular highlight onto the lid which the
  // grazing camera stretches into a vertical beam straight through the
  // marking; from below the lid it lights the socket and board instead.
  parts.chipLight.position.y = 0.22;
  parts.waveLight.intensity = flash * 40 + energy * 3;

  // ----------------------------------------------------------- particles
  const sparkMat = parts.sparks.material as THREE.PointsMaterial;
  if (frame >= beats.seat && sinceSeat < 2.2) {
    const life = clamp01(sinceSeat / 2.2);
    const pos = parts.sparkGeo.getAttribute("position") as THREE.BufferAttribute;
    const dir = parts.sparkGeo.getAttribute("aDir") as THREE.BufferAttribute;
    const seed = parts.sparkGeo.getAttribute("aSeed") as THREE.BufferAttribute;
    const spread = easeOutCubic(life);
    for (let i = 0; i < pos.count; i++) {
      const s = seed.getX(i);
      const d = 1 + s * 1.6;
      pos.setXYZ(
        i,
        dir.getX(i) * spread * 9 * d,
        SEATED_Y + dir.getY(i) * spread * 5 * d - spread * spread * 3.2 * d,
        dir.getZ(i) * spread * 9 * d,
      );
    }
    pos.needsUpdate = true;
    sparkMat.opacity = (1 - life) * 0.9;
    sparkMat.size = mix(0.07, 0.02, life);
  } else {
    sparkMat.opacity = 0;
  }

  // Square-particle energy ring across the board.
  const ringMat = parts.ring.material as THREE.MeshBasicMaterial;
  const ringLife = clamp01((frame - beats.seat) / (beats.waveEnd - beats.seat));
  if (frame >= beats.seat && ringLife < 1) {
    const seeds = parts.ring.userData.seeds as {
      a: number;
      jitter: number;
      size: number;
      lag: number;
    }[];
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      const local = clamp01((ringLife - s.lag) / (1 - s.lag));
      const r = easeOutCubic(local) * 46 * (0.75 + s.jitter * 0.5);
      ringPos.set(
        Math.cos(s.a) * r,
        0.08 + Math.sin(local * Math.PI) * 1.5 * s.jitter,
        Math.sin(s.a) * r,
      );
      const sc = s.size * (1 - local * 0.55) * (1 + s.jitter);
      ringScale.set(sc, sc, sc);
      ringQuat.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, s.a + local * 2));
      ringMat4.compose(ringPos, ringQuat, ringScale);
      parts.ring.setMatrixAt(i, ringMat4);
    }
    parts.ring.instanceMatrix.needsUpdate = true;
    ringMat.opacity = Math.sin(clamp01(ringLife) * Math.PI) * (cfg.id === "v2" ? 0.5 : 1);
  } else {
    ringMat.opacity = 0;
  }

  // Digital rain shed by the descending package.
  const streamMat = parts.streams.material as THREE.PointsMaterial;
  if (frame >= beats.descendStart && frame < beats.seat + 14) {
    const seed = parts.streams.geometry.getAttribute("aSeed") as THREE.BufferAttribute;
    const pos = parts.streams.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const s = seed.getX(i);
      const fall = (time * (0.9 + s * 1.4) + s * 5) % 1;
      pos.setY(i, mix(parts.chip.position.y, SEATED_Y, fall));
    }
    pos.needsUpdate = true;
    streamMat.opacity =
      (cfg.chipStyle === "hologram" ? 0.85 : 0.4) *
      smoothstep(beats.descendStart, beats.descendStart + 8, frame) *
      (1 - smoothstep(beats.seat, beats.seat + 14, frame));
    streamMat.size = 0.035;
  } else {
    streamMat.opacity = 0;
  }

  // Where the chip lands on screen, so the post pass can hold focus on it.
  tmpProj.set(0, parts.chip.position.y, 0).project(cam);
  const focusY = clamp01((1 - tmpProj.y) * 0.5);

  return { focusY, energy, flash };
};
