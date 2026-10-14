import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import {
  type CameraRow,
  type GravityWellRow,
  MOON_RADIUS_RATIO,
  type MoonOrbitRow,
  type SceneRow,
} from "./config";
import { useTextures, type TextureSet } from "./lib/textures";
import { phase, turnAngle } from "./lib/time";
import { type Dip, wellHeight } from "./lib/well";
import { type BodyLight, Earth, Moon, Sun } from "./three/Bodies";
import { Grid } from "./three/Grid";
import { Nebula, OrbitDots, Stars } from "./three/Points";
import { PostFX } from "./three/PostFX";
import { createShared, type SharedUniforms } from "./three/shared";

const DEG = Math.PI / 180;

/* ---------------- Closed-form state: pure functions of frame -------- */

type CameraPose = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  forward: THREE.Vector3;
};

export const cameraPose = (cam: CameraRow, frame: number): CameraPose => {
  const az = (cam.azimuth + cam.swing * Math.sin(turnAngle(frame, 1))) * DEG;
  const el = cam.elevation * DEG;
  const target = new THREE.Vector3(...cam.target);
  const position = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  )
    .multiplyScalar(cam.distance)
    .add(target);
  // A camera helper, so lookAt points -z (the view direction) at the target.
  const helper = new THREE.PerspectiveCamera();
  helper.position.copy(position);
  helper.up.set(0, 1, 0);
  helper.lookAt(target);
  const forward = target.clone().sub(position).normalize();
  return { position, quaternion: helper.quaternion.clone(), forward };
};

/** Position on a circle, counter-clockwise seen from above (+y). */
const ccw = (r: number, angle: number) =>
  new THREE.Vector3(r * Math.cos(angle), 0, -r * Math.sin(angle));

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const yawQuat = (yaw: number) => new THREE.Quaternion().setFromAxisAngle(Y, yaw);

const earthLook = (row: SceneRow) => ({
  rim: row.earth.rim,
  clouds: row.earth.clouds,
  saturation: row.earth.saturation,
  haze: row.earth.haze,
});

const keyLight = (row: SceneRow): BodyLight => ({
  light: new THREE.Vector4(...row.keyDir, 0),
  intensity: row.keyIntensity,
  fill: row.fill,
});

/* ------------------------------ Camera ------------------------------ */

const CameraRig: React.FC<{ cam: CameraRow; pose: CameraPose }> = ({ cam, pose }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    camera.position.copy(pose.position);
    camera.quaternion.copy(pose.quaternion);
    camera.fov = cam.fov;
    camera.near = 0.1;
    camera.far = 3000;
    // Lens shift (keeps verticals straight); also sets the aspect ratio.
    const W = size.width;
    const H = size.height;
    camera.setViewOffset(W, H, cam.shiftX * W, cam.shiftY * H, W, H);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }, [camera, pose, cam, size]);
  return null;
};

/* ------------------------------ Scenes ------------------------------ */

const WellScene: React.FC<{
  row: GravityWellRow;
  frame: number;
  textures: TextureSet;
  shared: SharedUniforms;
  pose: CameraPose;
  starAxis: THREE.Vector3;
}> = ({ row, frame, textures, shared, pose, starAxis }) => {
  const t = phase(frame);
  const w = row.well;
  const R = row.earth.radius;

  let earthPos: THREE.Vector3;
  let dip: Dip = { x: 0, z: 0, depth: 0, width: 1 };
  let earthLight = keyLight(row);
  let moon: null | { pos: THREE.Vector3; yaw: number } = null;

  if (row.sun) {
    // Earth orbits the Sun once per loop, CCW from above, on the funnel slope.
    const a = turnAngle(frame, 1) + Math.PI * 0.25;
    const p = ccw(row.sun.orbitRadius, a);
    dip = { x: p.x, z: p.z, depth: row.sun.earthDipDepth, width: row.sun.earthDipWidth };
    p.y = wellHeight(p.x, p.z, w.depth, w.width, dip) + R * 1.0;
    earthPos = p;
  } else {
    const bob =
      row.bob.amount * 2 * R * Math.sin(turnAngle(frame, row.bob.cycles));
    earthPos = new THREE.Vector3(0, -w.depth / w.width + row.earthLift * R + bob, 0);
    if (row.moon) {
      // Moon: one orbit per loop, CCW from above, riding the funnel slope.
      const a = turnAngle(frame, 1) + Math.PI * 0.3;
      const p = ccw(row.moon.orbitRadius, a);
      dip = { x: p.x, z: p.z, depth: row.moon.dipDepth, width: row.moon.dipWidth };
      p.y =
        wellHeight(p.x, p.z, w.depth, w.width, dip) +
        MOON_RADIUS_RATIO * R +
        row.moon.lift;
      // Tidal locking: the near side (texture longitude 0, object +x)
      // always points back at Earth -> one turn per orbit.
      moon = { pos: p, yaw: a + Math.PI };
    }
  }

  let sunPos: THREE.Vector3 | null = null;
  if (row.sun) {
    sunPos = new THREE.Vector3(0, -w.depth / w.width + row.sun.radius * 0.9, 0);
    earthLight = {
      light: new THREE.Vector4(sunPos.x, sunPos.y, sunPos.z, 1),
      intensity: row.keyIntensity,
      fill: row.fill,
    };
  }

  const earthPose = {
    position: earthPos,
    spin: turnAngle(frame, row.earth.spinTurns) + row.earth.spinOffset,
    tiltRad: row.earth.tiltDeg * DEG,
    leanRad: row.earth.lean * DEG,
    radius: R,
  };

  return (
    <>
      <Stars
        count={row.stars.count}
        brightness={row.stars.brightness}
        axis={starAxis}
        spreadDeg={row.stars.spreadDeg}
        phase={t}
        shared={shared}
      />
      <Grid well={w} dip={dip} shared={shared} />
      <Earth
        textures={textures}
        pose={earthPose}
        light={earthLight}
        {...earthLook(row)}
        cameraQuat={pose.quaternion}
      />
      {moon ? (
        <Moon
          textures={textures}
          position={moon.pos}
          quaternion={yawQuat(moon.yaw)}
          radius={MOON_RADIUS_RATIO * R}
          light={keyLight(row)}
          albedo={row.moonLook.albedo}
          glow={row.moonLook.glow}
          cameraQuat={pose.quaternion}
        />
      ) : null}
      {row.sun && sunPos ? (
        <Sun
          position={sunPos}
          radius={row.sun.radius}
          phase={t}
          glow={row.sun.glow}
          cameraQuat={pose.quaternion}
        />
      ) : null}
    </>
  );
};

const OrbitScene: React.FC<{
  row: MoonOrbitRow;
  frame: number;
  textures: TextureSet;
  shared: SharedUniforms;
  pose: CameraPose;
  starAxis: THREE.Vector3;
}> = ({ row, frame, textures, shared, pose, starAxis }) => {
  const t = phase(frame);
  const R = row.earth.radius;
  // Start on the far left of the ellipse, then CCW from above: behind
  // Earth first, round the right, and back in front.
  const a = turnAngle(frame, 1) + Math.PI;
  // The orbit plane is rolled about the view axis (the Moon's real orbit is
  // inclined ~5 deg); "above" still means the orbit plane's own north side.
  const roll = new THREE.Quaternion().setFromAxisAngle(Z, -row.orbit.tiltDeg * DEG);
  const moonPos = ccw(row.orbit.radius, a).applyQuaternion(roll);
  const moonQuat = roll.clone().multiply(yawQuat(a + Math.PI));
  const light = keyLight(row);
  return (
    <>
      <Nebula
        inner={row.nebula.inner}
        outer={row.nebula.outer}
        centre={row.nebula.centre}
        strength={row.nebula.strength}
        dust={row.nebula.dust}
        phase={t}
        shared={shared}
      />
      <Stars
        count={row.stars.count}
        brightness={row.stars.brightness}
        axis={starAxis}
        spreadDeg={row.stars.spreadDeg}
        phase={t}
        shared={shared}
      />
      <group quaternion={roll}>
        <OrbitDots
          radius={row.orbit.radius}
          count={row.orbit.dots}
          size={row.orbit.dotSize}
          opacity={row.orbit.dotOpacity}
          shared={shared}
        />
      </group>
      <Earth
        textures={textures}
        pose={{
          position: new THREE.Vector3(0, 0, 0),
          spin: turnAngle(frame, row.earth.spinTurns) + row.earth.spinOffset,
          tiltRad: row.earth.tiltDeg * DEG,
          leanRad: row.earth.lean * DEG,
          radius: R,
        }}
        light={light}
        {...earthLook(row)}
        cameraQuat={pose.quaternion}
      />
      <Moon
        textures={textures}
        position={moonPos}
        quaternion={moonQuat}
        radius={MOON_RADIUS_RATIO * R}
        light={light}
        albedo={row.moonLook.albedo}
        glow={row.moonLook.glow}
        cameraQuat={pose.quaternion}
      />
    </>
  );
};

/* ---------------------------- Composition --------------------------- */

export const SpaceScene: React.FC<{ row: SceneRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const textures = useTextures();
  const shared = useMemo(() => createShared(), []);
  const pose = useMemo(() => cameraPose(row.camera, frame), [row.camera, frame]);
  // Stars are fixed in the world: centre the field on the camera's rest
  // direction, not the swinging one.
  const starAxis = useMemo(
    () => cameraPose({ ...row.camera, swing: 0 }, 0).forward,
    [row.camera],
  );
  // Render at the real output size: at --scale=1/3 the drawing buffer is
  // 1280x720, at 4K it is 3840x2160.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {textures ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          linear
          flat
          gl={{
            antialias: false,
            alpha: false,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
          }}
          camera={{ fov: row.camera.fov, near: 0.1, far: 3000 }}
        >
          <CameraRig cam={row.camera} pose={pose} />
          {row.kind === "well" ? (
            <WellScene row={row} frame={frame} textures={textures} shared={shared} pose={pose} starAxis={starAxis} />
          ) : (
            <OrbitScene row={row} frame={frame} textures={textures} shared={shared} pose={pose} starAxis={starAxis} />
          )}
          <PostFX
            frame={frame}
            exposure={row.exposure}
            bloom={row.kind === "well" ? row.bloom : null}
            shared={shared}
          />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
