import React, { useCallback } from "react";
import * as THREE from "three";
import type { CloudRow } from "../data";
import { hexToLinear } from "../lib/color";
import { ShaderPipeline, useStableUniforms } from "../lib/ShaderPipeline";
import { CLOUD_FRAG } from "./cloudShader";
import { getCloudNoise } from "./noise";
import { FLIGHT_MAP, getFlightWeather, getSeaWeather, SEA_FAR, SEA_NEAR } from "./weather";

const FPS = 30;
const DEG = Math.PI / 180;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Sea loop: forward travel per loop equals the 2400 m noise tile period. */
export const SEA_PERIOD_M = 2400;

/**
 * Cumulus masses placed along the flight path (metres). The camera starts
 * between banks, pushes into the wall at ~5.5 s and climbs out of its top
 * at ~7.5 s. d = density scale (wisps < 1), base = flat-base ramp (m).
 */
const FLIGHT_MASSES: { c: [number, number, number]; r: [number, number, number]; d: number; base: number }[] = [
  { c: [-25, 1680, -84], r: [190, 160, 44], d: 1, base: 40 }, // the wall: a dome the camera skims through
  { c: [150, 1900, -70], r: [80, 140, 90], d: 1, base: 30 }, // right bank
  { c: [-230, 1960, -150], r: [130, 190, 120], d: 1, base: 40 }, // left tower
  { c: [260, 1930, -120], r: [120, 160, 120], d: 1, base: 40 }, // right tower
  { c: [520, 2000, -620], r: [210, 260, 200], d: 1, base: 60 }, // tower ahead-right
  { c: [-215, 1905, -250], r: [115, 150, 110], d: 1, base: 40 }, // cumulus ahead-left
  { c: [250, 1880, -290], r: [125, 150, 120], d: 1, base: 40 }, // cumulus ahead-right
  { c: [14, 1843, -26], r: [14, 7, 12], d: 0.35, base: 0 }, // wisp
  { c: [11, 1866, -93], r: [13, 6, 9], d: 0.32, base: 0 }, // exit wisp, passes ~10 m right at 7.5 s
  { c: [-10, 1886, -103], r: [15, 6, 10], d: 0.28, base: 0 }, // exit wisp, passes left at 8.5 s
];

const massBounds = () => {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const m of FLIGHT_MASSES) {
    for (let k = 0; k < 3; k++) {
      min.setComponent(k, Math.min(min.getComponent(k), m.c[k] - m.r[k] * 1.2));
      max.setComponent(k, Math.max(max.getComponent(k), m.c[k] + m.r[k] * 1.2));
    }
  }
  return { min, max };
};

/**
 * Bakes the masses' ellipsoid field into a 3D texture once (R = strongest
 * "inside-ness" m, G = that mass's density), so the shader pays one fetch
 * instead of evaluating every ellipsoid per sample.
 */
let massTex: THREE.Data3DTexture | null = null;
const MASS_VOXEL = 5; // metres
const getMassField = () => {
  if (massTex) return massTex;
  const { min, max } = massBounds();
  const nx = Math.ceil((max.x - min.x) / MASS_VOXEL);
  const ny = Math.ceil((max.y - min.y) / MASS_VOXEL);
  const nz = Math.ceil((max.z - min.z) / MASS_VOXEL);
  const data = new Uint16Array(nx * ny * nz * 4);
  const h = THREE.DataUtils.toHalfFloat;
  let o = 0;
  for (let k = 0; k < nz; k++) {
    const z = min.z + ((k + 0.5) / nz) * (max.z - min.z);
    for (let j = 0; j < ny; j++) {
      const y = min.y + ((j + 0.5) / ny) * (max.y - min.y);
      for (let i = 0; i < nx; i++) {
        const x = min.x + ((i + 0.5) / nx) * (max.x - min.x);
        let bestM = -0.3;
        let bestD = 0;
        for (const m of FLIGHT_MASSES) {
          const ex = (x - m.c[0]) / m.r[0];
          const ey = (y - m.c[1]) / m.r[1];
          const ez = (z - m.c[2]) / m.r[2];
          // Solid core out to ~0.9 of the radius, noise-eroded shell beyond.
          let v = 1.15 - Math.sqrt(ex * ex + ey * ey + ez * ez);
          if (m.base > 0) v = Math.min(v, (y - (m.c[1] - m.r[1] * 0.6)) / m.base);
          if (v > bestM) {
            bestM = v;
            bestD = m.d;
          }
        }
        data[o++] = h(Math.max(-0.3, Math.min(1.2, bestM)));
        data[o++] = h(bestD);
        data[o++] = 0;
        data[o++] = h(1);
      }
    }
  }
  const t = new THREE.Data3DTexture(data, nx, ny, nz);
  t.format = THREE.RGBAFormat;
  t.type = THREE.HalfFloatType;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  massTex = t;
  return t;
};

export type CameraPose = {
  pos: [number, number, number];
  yaw: number; // radians, 0 = looking toward -z, + = turn right
  pitch: number; // + = up
  roll: number; // + = bank right
};

/** Cloud Flight: ~12 m/s through the layer, out above it at ~7.5 s. */
export const flightPose = (t: number): CameraPose => {
  const z = -12 * t;
  const x = 6 * Math.sin(t * 0.4);
  // Dip into the wall (whiteout ~5.2-6.8 s), then climb out above the layer.
  const dip = Math.sin(Math.PI * clamp01((t - 4.6) / 3.0)) ** 2;
  const y =
    1846 -
    32 * dip * (1 - smooth(6.0, 7.6, t)) +
    74 * smooth(6.3, 9.8, t) + // climb out through the top of the wall
    22 * smooth(9.8, 15, t); // gentle rise in the glide
  const pitch =
    (2.0 - 7.0 * smooth(4.0, 5.4, t) + 13.0 * smooth(5.8, 7.0, t) - 12.0 * smooth(7.4, 10.2, t)) *
    DEG;
  const roll = 3 * Math.sin(t * 0.95) * (1 - smooth(4.0, 6.0, t)) * DEG;
  const yaw = -0.04 * Math.cos(t * 0.4) * 0.5;
  return { pos: [x, y, z], yaw, pitch, roll };
};

/** Cloud Sea: one tile period in exactly one loop. */
export const seaPose = (frame: number, loop: number): CameraPose => {
  const u = (frame % loop) / loop;
  const a = u * Math.PI * 2;
  return {
    pos: [18 * Math.sin(a), 2380 + 6 * Math.sin(a * 2), -SEA_PERIOD_M * u],
    yaw: 0.02 * Math.sin(a),
    pitch: -9 * DEG,
    roll: 0.6 * Math.sin(a) * DEG,
  };
};

const rotation = (p: CameraPose) => {
  const m = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(p.pitch, -p.yaw, -p.roll, "YXZ"),
  );
  return new THREE.Matrix3().setFromMatrix4(m);
};

const sunDir = (row: CloudRow) => {
  const el = row.sunElevationDeg * DEG;
  const az = row.sunAzimuthDeg * DEG;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
};

const v3 = (hex: string, k = 1) => {
  const c = hexToLinear(hex);
  return new THREE.Vector3(c[0] * k, c[1] * k, c[2] * k);
};

const GRADE = /* glsl */ `
vec3 grade(vec3 c, vec2 uv) {
  // ACES filmic fit (Narkowicz): sunlit tops keep their shape.
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  return c;
}`;

export const CloudScene: React.FC<{
  row: CloudRow;
  debug?: number | boolean;
  debugCam?: [number, number, number, number, number];
}> = ({ row, debug, debugCam }) => {
  const uniforms = useStableUniforms(() => {
    const noise = getCloudNoise();
    return {
      uBase: { value: noise.base },
      uDetail: { value: noise.detail },
      uCurl: { value: noise.curl },
      uCamPos: { value: new THREE.Vector3() },
      uCamRot: { value: new THREE.Matrix3() },
      uTanHalfFovY: { value: Math.tan(21 * DEG) },
      uSteps: { value: row.steps },
      uSunDir: { value: sunDir(row) },
      uSunColor: { value: v3(row.sunColor, row.sunIntensity) },
      uSkyZenith: { value: v3(row.skyZenith) },
      uSkyHorizon: { value: v3(row.skyHorizon) },
      uSkyMid: { value: v3(row.skyMid) },
      uAmbTop: { value: v3(row.ambientTop) },
      uAmbBottom: { value: v3(row.ambientBottom) },
      uShadowTint: { value: v3(row.shadowTint) },
      uHaze: { value: v3(row.groundHaze) },
      uGroundDark: { value: v3(row.groundDark) },
      uGroundLight: { value: v3(row.groundLight) },
      uExposure: { value: row.exposure },
      uStory: { value: row.story === "flight" ? 0 : 1 },
      uWind: { value: new THREE.Vector3() },
      uEvolve: { value: new THREE.Vector3() },
      uLoopZ: { value: 0 },
      uVeil: { value: 0 },
      uLB: { value: row.story === "flight" ? 2400 : SEA_PERIOD_M },
      uMaxTop: { value: 3350 },
      uTerrainScale: {
        value:
          row.story === "flight"
            ? new THREE.Vector4(30000, 30000, 11000, 11000)
            : new THREE.Vector4(12000, SEA_PERIOD_M, 6000, SEA_PERIOD_M / 2),
      },
      uWeatherA: { value: row.story === "flight" ? getFlightWeather() : getSeaWeather().near },
      uWeatherB: { value: row.story === "flight" ? getFlightWeather() : getSeaWeather().far },
      uWeatherXf: {
        value:
          row.story === "flight"
            ? new THREE.Vector4(FLIGHT_MAP.x0, FLIGHT_MAP.z0, FLIGHT_MAP.size, 0)
            : new THREE.Vector4(0, 0, SEA_NEAR.size, 0),
      },
      uSeaFarHalf: { value: SEA_FAR.half },
      uDebug: { value: debug === true ? 1 : typeof debug === "number" ? debug : 0 },
      uMassTex: { value: row.story === "flight" ? getMassField() : getFlightWeather() },
      uMassMin: { value: massBounds().min },
      uMassMax: { value: massBounds().max },
    };
  });

  const update = useCallback(
    (frame: number) => {
      const t = frame / FPS;
      const pose =
        row.story === "flight" ? flightPose(t) : seaPose(frame, row.durationInFrames);
      if (debugCam) {
        pose.pos = [debugCam[0], debugCam[1], debugCam[2]];
        pose.yaw = debugCam[3] * DEG;
        pose.pitch = debugCam[4] * DEG;
        pose.roll = 0;
      }
      uniforms.uCamPos.value.set(...pose.pos);
      uniforms.uCamRot.value.copy(rotation(pose));
      if (row.story === "flight") {
        // Slow drift of the cloud field and a slow boil of the detail.
        uniforms.uWind.value.set(1.6 * t, 0, 0.6 * t);
        uniforms.uEvolve.value.set(0.004 * t, -0.006 * t, 0.002 * t);
        uniforms.uLoopZ.value = 0;
        // Milky veil while among the clouds, gone once above the layer.
        uniforms.uVeil.value = 0.26 * (1 - smooth(6.6, 8.6, t));
      } else {
        // Evolution on a time circle so frame 600 == frame 0.
        const a = ((frame % row.durationInFrames) / row.durationInFrames) * Math.PI * 2;
        uniforms.uWind.value.set(0, 0, 0);
        uniforms.uEvolve.value.set(0.05 * Math.cos(a), 0.05 * Math.sin(a), 0);
        uniforms.uLoopZ.value = pose.pos[2];
      }
    },
    [row, uniforms, debugCam],
  );

  return (
    <ShaderPipeline
      fragment={CLOUD_FRAG}
      uniforms={uniforms}
      update={update}
      loopFrames={row.loop ? row.durationInFrames : null}
      gradeGlsl={GRADE}
      denoise
    />
  );
};
