import * as THREE from "three";
import { DEG, geoToVec3, headingVector, surfaceFrame } from "./sphere";
import { ASPECT, GLOBE_RADIUS } from "./constants";

// The camera rig for both versions.
//
// Neither reference is a chase cam locked behind the aircraft: the grid
// slides *and* rotates under a jet that stays near frame centre while its
// own heading drifts across the frame. That is a camera orbiting the
// aircraft at a slowly changing azimuth while the pair travels over the
// globe together — so the rig is parameterised as (ground track) +
// (orbit offset), and the camera always aims at the aircraft.
//
// Every value is a pure function of the normalised time t, because
// Remotion renders frames out of order across worker processes.

/** Keyframes as [t (0..1), value], interpolated with smoothstep. */
export type Keyframes = [number, number][];

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const sampleKeyframes = (keys: Keyframes, t: number): number => {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (t <= t1) return v0 + (v1 - v0) * smoothstep(t0, t1, t);
  }
  return last[1];
};

export type GroundTrack = {
  lat0Deg: number;
  lon0Deg: number;
  /** Eastward ground speed, world units per second. */
  speed: number;
  latAmpDeg: number;
  latPeriodSec: number;
  latPhase: number;
  lonAmpDeg: number;
  lonPeriodSec: number;
  lonPhase: number;
};

export type RigConfig = {
  fovDeg: number;
  near: number;
  far: number;
  durationSec: number;
  planeAltitude: number;
  track: GroundTrack;
  /** Camera distance from the aircraft, world units. */
  camDistance: Keyframes;
  /** Camera elevation above the aircraft's local horizontal, degrees. */
  camElevationDeg: Keyframes;
  /** Camera bearing relative to directly astern, degrees. 0 is a pure
   *  chase cam; drifting it is what rotates the grid on screen. */
  camAzimuthDeg: Keyframes;
  /** Dutch roll of the horizon, degrees. */
  camRollDeg: Keyframes;
  /** Aircraft placement in frame: fractions of the half-width and
   *  half-height, so +1 is the right/top edge. */
  aimOffsetX: Keyframes;
  aimOffsetY: Keyframes;
  /** Shifts the focal plane off the aircraft, world units. */
  focusBias: number;
  /** Bank angle scaling applied to the aircraft's turn rate. */
  bankGain: number;
};

const trackPosition = (track: GroundTrack, timeSec: number) => {
  const lonPerUnit = 1 / (GLOBE_RADIUS * DEG);
  const latDeg =
    track.lat0Deg +
    track.latAmpDeg *
      Math.sin((timeSec / track.latPeriodSec) * Math.PI * 2 + track.latPhase);
  const lonDeg =
    track.lon0Deg +
    track.speed * timeSec * lonPerUnit +
    track.lonAmpDeg *
      Math.sin((timeSec / track.lonPeriodSec) * Math.PI * 2 + track.lonPhase);
  return { latDeg, lonDeg };
};

export type RigState = {
  camPosition: THREE.Vector3;
  camQuaternion: THREE.Quaternion;
  /** World transform for the hero aircraft. */
  planeMatrix: THREE.Matrix4;
  planePosition: THREE.Vector3;
  /** Local frame at the aircraft, for placing companion traffic. */
  planeRight: THREE.Vector3;
  planeUp: THREE.Vector3;
  planeForward: THREE.Vector3;
  /** Distance the depth-of-field is focused at. */
  focusDistance: number;
};

const orientation = (
  right: THREE.Vector3,
  up: THREE.Vector3,
  forward: THREE.Vector3,
) => new THREE.Matrix4().makeBasis(right, up, forward);

// Position + heading of an aircraft flying `track`, sampled at `timeSec`.
// The heading comes from a finite difference of the ground track rather
// than an analytic derivative — it stays a pure function of time and
// tracks any wander added to the path.
export const sampleAircraft = (
  track: GroundTrack,
  altitude: number,
  timeSec: number,
) => {
  const dt = 0.05;
  const here = trackPosition(track, timeSec);
  const ahead = trackPosition(track, timeSec + dt);
  const behind = trackPosition(track, timeSec - dt);

  const frame = surfaceFrame(here.latDeg * DEG, here.lonDeg * DEG);
  const position = geoToVec3(
    here.latDeg * DEG,
    here.lonDeg * DEG,
    GLOBE_RADIUS + altitude,
  );

  // Heading as a compass bearing, from the along-track displacement
  // resolved onto the local north/east axes.
  const bearingAt = (a: typeof here, b: typeof here) => {
    const dLat = b.latDeg - a.latDeg;
    const dLon = (b.lonDeg - a.lonDeg) * Math.cos(a.latDeg * DEG);
    return Math.atan2(dLon, dLat);
  };
  const heading = bearingAt(here, ahead);
  const turnRate = (bearingAt(here, ahead) - bearingAt(behind, here)) / dt;

  const forward = headingVector(frame, heading);
  const up = frame.up.clone();
  const right = new THREE.Vector3().crossVectors(up, forward).normalize();

  return { position, forward, up, right, heading, turnRate, frame };
};

export const computeRig = (cfg: RigConfig, timeSec: number): RigState => {
  const t = THREE.MathUtils.clamp(timeSec / cfg.durationSec, 0, 1);
  const plane = sampleAircraft(cfg.track, cfg.planeAltitude, timeSec);

  // Bank into the turn, so the silhouette is not a rigid cut-out.
  const bank = THREE.MathUtils.clamp(
    plane.turnRate * cfg.bankGain,
    -0.35,
    0.35,
  );
  const bankQuat = new THREE.Quaternion().setFromAxisAngle(
    plane.forward,
    -bank,
  );
  const planeRight = plane.right.clone().applyQuaternion(bankQuat);
  const planeUp = plane.up.clone().applyQuaternion(bankQuat);
  const planeMatrix = orientation(
    planeRight,
    planeUp,
    plane.forward,
  ).setPosition(plane.position);

  // Orbit offset: swing the "astern" direction around the aircraft's local
  // vertical by the azimuth keyframes, then lift it by the elevation.
  const azimuth = sampleKeyframes(cfg.camAzimuthDeg, t) * DEG;
  const elevation = sampleKeyframes(cfg.camElevationDeg, t) * DEG;
  const distance = sampleKeyframes(cfg.camDistance, t);

  const astern = plane.forward.clone().negate();
  astern.applyAxisAngle(plane.up, azimuth);

  const camPosition = plane.position
    .clone()
    .addScaledVector(astern, distance * Math.cos(elevation))
    .addScaledVector(plane.up, distance * Math.sin(elevation));

  // Aim: the aircraft sits off-centre by a fraction of the half-frame,
  // which is a shift of the look-at target across the view plane.
  const viewDir = plane.position.clone().sub(camPosition).normalize();
  const worldUp = plane.up.clone();
  const screenRight = new THREE.Vector3()
    .crossVectors(viewDir, worldUp)
    .normalize();
  const screenUp = new THREE.Vector3()
    .crossVectors(screenRight, viewDir)
    .normalize();

  const halfHeight = Math.tan((cfg.fovDeg * DEG) / 2) * distance;
  const halfWidth = halfHeight * ASPECT;
  const target = plane.position
    .clone()
    .addScaledVector(
      screenRight,
      -sampleKeyframes(cfg.aimOffsetX, t) * halfWidth,
    )
    .addScaledVector(
      screenUp,
      -sampleKeyframes(cfg.aimOffsetY, t) * halfHeight,
    );

  // Build the camera basis directly: three's camera looks down its own -Z.
  const roll = sampleKeyframes(cfg.camRollDeg, t) * DEG;
  const zAxis = camPosition.clone().sub(target).normalize();
  const rolledUp = worldUp.clone().applyAxisAngle(zAxis, roll);
  const xAxis = new THREE.Vector3().crossVectors(rolledUp, zAxis).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  const camQuaternion = new THREE.Quaternion().setFromRotationMatrix(
    orientation(xAxis, yAxis, zAxis),
  );

  return {
    camPosition,
    camQuaternion,
    planeMatrix,
    planePosition: plane.position,
    planeRight,
    planeUp,
    planeForward: plane.forward,
    focusDistance: distance + cfg.focusBias,
  };
};
