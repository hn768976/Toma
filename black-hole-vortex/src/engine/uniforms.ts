import * as THREE from "three";
import { BlackHoleRow, LOOP_FRAMES, ShotRow, VortexRow } from "../shots";

const TAU = Math.PI * 2;
const rad = (d: number) => (d * Math.PI) / 180;
// sRGB hex -> linear working space (three's ColorManagement does the decode;
// do not call convertSRGBToLinear on top or colours get decoded twice).
THREE.ColorManagement.enabled = true;
export const col = (hex: string) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

/** Loop phase from the frame number only. frame 600 -> 0. */
export const phaseOf = (frame: number) => (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;

const lookBasis = (pos: THREE.Vector3, target: THREE.Vector3, rollDeg: number) => {
  const fwd = target.clone().sub(pos).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  // negative roll = image rotates clockwise (right side of frame drops)
  const c = Math.cos(rad(-rollDeg));
  const s = Math.sin(rad(-rollDeg));
  const r2 = right.clone().multiplyScalar(c).addScaledVector(up, s);
  const u2 = up.clone().multiplyScalar(c).addScaledVector(right, -s);
  return { fwd, right: r2, up: u2 };
};

const orbitPos = (target: THREE.Vector3, dist: number, elevDeg: number, azDeg: number) =>
  new THREE.Vector3(
    Math.cos(rad(elevDeg)) * Math.sin(rad(azDeg)),
    Math.sin(rad(elevDeg)),
    Math.cos(rad(elevDeg)) * Math.cos(rad(azDeg)),
  )
    .multiplyScalar(dist)
    .add(target);

export const blackHoleUniforms = (row: BlackHoleRow, frame: number, w: number, h: number) => {
  const t = phaseOf(frame);
  const c = row.camera;
  const sn = Math.sin(TAU * t);
  const cs = Math.cos(TAU * t);
  const dist = c.dist - c.drift.dist * (0.5 - 0.5 * cs); // push in, back out
  const elev = c.elevDeg + c.drift.elevDeg * sn;
  const az = c.azDeg + c.drift.azDeg * Math.sin(TAU * t + 1.1);
  const target = new THREE.Vector3(...c.target);
  const pos = orbitPos(target, dist, elev, az);
  const b = lookBasis(pos, target, c.rollDeg);
  const tanHalf = Math.tan(rad(c.fovDeg) / 2);
  const d = row.disc;
  return {
    uRes: new THREE.Vector2(w, h),
    uPhase: t,
    uCamPos: pos,
    uCamRight: b.right,
    uCamUp: b.up,
    uCamFwd: b.fwd,
    uTanHalf: tanHalf,
    uShift: new THREE.Vector2(c.shift[0] + c.drift.shift[0] * sn, c.shift[1] + c.drift.shift[1] * cs),
    uPixAngle: (2 * tanHalf) / h,
    uRin: d.rin,
    uRout: d.rout,
    uThick: d.thick,
    uThickFlat: d.thickFlat,
    uThickR: d.thickR,
    uDiscBright: d.bright,
    uAbsorb: d.absorb,
    uFallPow: d.fallPow,
    uStreakFreq: new THREE.Vector2(...d.streakFreq),
    uStreakSharp: d.streakSharp,
    uStreakMix: d.streakMix,
    uCloudFreq: d.cloudFreq,
    uInnerTurns: d.innerTurns,
    uDoppler: d.doppler,
    uColHot: col(d.colHot),
    uColMid: col(d.colMid),
    uColOuter: col(d.colOuter),
    uDeckSide: new THREE.Vector3(pos.x, 0, pos.z).normalize(),
    uDeckTop: row.deck.top,
    uDeckAmp: row.deck.amp,
    uDeckR0: row.deck.r0,
    uDeckFreq: row.deck.freq,
    uDeckFog: row.deck.fog,
    uDeckGlow: row.deck.glow,
    uDeckCol: col(row.deck.color),
    uDeckColHi: col(row.deck.colorHi),
    uDeckFogCol: col(row.deck.fogColor),
    uDofDist: row.deck.dofDist,
    uDofAmt: row.deck.dofAmt,
    uDust: row.dust.amount,
    uDustAz: rad(row.dust.azDeg),
    uDustWidth: row.dust.width,
    uDustThick: row.dust.thick,
    uDustCol: col(row.dust.color),
    uRing: row.ring,
    uHazeCol: col(row.haze.color),
    uHazeGlow: row.haze.glow,
    uHazeRadius: row.haze.radius,
    uBgCol: col(row.haze.bg),
    uBgTop: col(row.haze.bgTop),
    uBandStr: row.haze.band,
    uBandNormal: new THREE.Vector3(...row.haze.bandNormal).normalize(),
    uBandCol: col(row.haze.bandColor),
    uRingTop: row.ringTop,
    uStarDensity: row.stars.density,
    uStarBright: row.stars.bright,
    uSeed: row.stars.seed,
    uSkyLens: row.stars.lens,
  };
};

export const vortexUniforms = (row: VortexRow, frame: number, w: number, h: number) => {
  const t = phaseOf(frame);
  const sn = Math.sin(TAU * t);
  const cs = Math.cos(TAU * t);
  const f = row.funnel;
  const target = new THREE.Vector3(...f.target);
  // funnel (mode 1): drift = [azimuth deg, elevation deg] amplitudes
  const az = f.azDeg + row.drift[0] * sn;
  const pos = orbitPos(target, f.camDist || 1, (f.elevDeg || 45) + row.drift[1] * cs, az);
  const b = lookBasis(pos, target, 0);
  return {
    uRes: new THREE.Vector2(w, h),
    uPhase: t,
    uCenter:
      row.mode === 1
        ? new THREE.Vector2(0, 0)
        : new THREE.Vector2(row.center[0] + row.drift[0] * sn, row.center[1] + row.drift[1] * cs),
    uZoom: row.zoom.base * (1 + row.zoom.amp * (0.5 - 0.5 * cs)),
    uTwist: row.twist,
    uTurns: new THREE.Vector3(...row.turns),
    uFreq: new THREE.Vector2(...row.freq),
    uStreak: row.streak,
    uStreakMix: row.streakMix,
    uContrast: new THREE.Vector2(...row.contrast),
    uTilt: new THREE.Vector2(rad(row.tilt[0]), row.tilt[1]),
    uArms: new THREE.Vector2(...row.arms),
    uGlow: new THREE.Vector2(...row.glow),
    uColGlow: col(row.colGlow),
    uRim: new THREE.Vector2(row.rim[0], rad(row.rim[1])),
    uSide: new THREE.Vector2(row.side[0], rad(row.side[1])),
    uNearFade: row.nearFade ?? 0,
    uWarp: row.warp,
    uEvolve: row.evolve,
    uCoreR: row.coreR,
    uOuterR: row.outerR,
    uGain: row.gain,
    uColBg: col(row.colBg),
    uColGas: col(row.colGas),
    uColHi: col(row.colHi),
    uColAccent: col(row.colAccent),
    uEyeR: row.eyeR,
    uRingBright: row.ringBright,
    uDarkR: row.darkR,
    uStarDensity: row.stars.density,
    uStarBright: row.stars.bright,
    uSeed: row.stars.seed,
    uCamPos: pos,
    uCamRight: b.right,
    uCamUp: b.up,
    uCamFwd: b.fwd,
    uTanHalf: Math.tan(rad(f.fovDeg) / 2),
    uDepth: f.depth,
    uThroat: f.throat,
    uLayerSep: f.layerSep,
    uHoleR: f.holeR,
  };
};

export const sceneUniforms = (row: ShotRow, frame: number, w: number, h: number): Record<string, unknown> =>
  row.look === "blackhole" ? blackHoleUniforms(row, frame, w, h) : vortexUniforms(row, frame, w, h);
