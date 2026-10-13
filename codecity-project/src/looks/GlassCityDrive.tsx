import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { buildingGeometry, buildingMaterial } from "../kit/buildings";
import { generateStreet } from "../kit/city";
import { GLSL_LINES, SkyParams } from "../lib/glsl";
import { loopSin, TAU } from "../lib/math";
import { mulberry32 } from "../lib/random";
import { SkyDome } from "../lib/Sky";
import { Driver, Stage } from "../lib/Stage";

export type GlassCityDriveProps = {
  citySeed: number;
  glass: string;
  edge: string;
  window: string;
  road: string;
  skyHorizon: string;
};

const PERIOD = 600;
const L = 216; // layout period (m): 10.8 m/s, a slow city drive
const COPIES = 4;
const lin = (hex: string) => new THREE.Color(hex);

const Scene: React.FC<GlassCityDriveProps> = (p) => {
  const world = useRef<THREE.Group>(null);
  const sky = useRef<THREE.Mesh>(null);

  const skyParams = useMemo<SkyParams>(() => {
    const h = lin(p.skyHorizon);
    return {
      top: [0.0, 0.0, 0.004],
      horizon: [h.r * 0.06, h.g * 0.06, h.b * 0.06],
      glow: [h.r * 2.6, h.g * 2.6, h.b * 2.6],
      glowDir: [0, 0.0, -1],
      glowW: [0.9, 0.05],
    };
  }, [p.skyHorizon]);

  const m = useMemo(() => {
    const boxes = generateStreet({
      seed: p.citySeed,
      period: L,
      roadHalf: 26,
      floorH: 3.0,
      minFloors: 3,
      maxFloors: 34,
      rows: 1,
      lotMin: 12,
      lotMax: 26,
    });
    const geo = buildingGeometry(boxes, L, COPIES, -1);
    const style = {
      mode: "glass" as const,
      body: lin(p.glass),
      bodyAlpha: 0.3,
      line: lin(p.edge),
      lineAlpha: 1.0,
      edgeW: 0.1,
      floorW: 0.035,
      floorH: 3.0,
      mullion: 1.7,
      windowLit: 0.1,
      window: lin(p.window).multiplyScalar(2.2),
      fogColor: new THREE.Color(0, 0, 0),
      fogNear: 40,
      fogFar: 330,
      hazeHeight: 100,
      mirror: 1,
      brightness: 0.3,
    };
    const mat = buildingMaterial(style);
    const mirrorMat = buildingMaterial({ ...style, mirror: -1, brightness: 0.4 });

    // Road: dark, partly transparent over the mirrored city (wet reflection),
    // with lane lines and a bright edge strip on both sides.
    const roadMat = new THREE.ShaderMaterial({
      uniforms: { uLine: { value: lin(p.edge) }, uRoad: { value: lin(p.road) }, uOff: { value: 0 }, uHaze: { value: lin(p.skyHorizon) } },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        ${GLSL_LINES}
        uniform vec3 uLine;
        uniform vec3 uRoad;
        uniform vec3 uHaze;
        uniform float uOff;
        varying vec3 vWorld;
        void main() {
          float x = vWorld.x;
          float z = vWorld.z - uOff;
          float px = max(fwidth(x), 1e-5);
          // Solid outer lane lines and dashed inner ones.
          float l = 0.0;
          l = max(l, lineAt(abs(abs(x) - 12.0), 0.16, px) * 3.2);
          l = max(l, lineAt(abs(abs(x) - 4.0), 0.08, px) * 1.2);

          float curb = lineAt(abs(abs(x) - 22.0), 0.3, px) * 0.35;
          float dist = length(vWorld - cameraPosition);
          vec3 c = uRoad * 0.6 + uLine * (l + curb) * 2.2;
          // Light pooling on the road from the buildings either side.
          c += uLine * 0.1 * smoothstep(8.0, 24.0, abs(x));
          // Ground glow toward the horizon.
          c += uHaze * 0.5 * smoothstep(30.0, 250.0, dist);
          // Haze toward the horizon.
          float hz = smoothstep(80.0, 450.0, dist);
          c = mix(c, uHaze * 0.5, hz * 0.8);
          gl_FragColor = vec4(c, 0.62 - 0.2 * hz);
        }`,
      transparent: true,
      depthWrite: true,
    });

    // Light streaks: thin emissive ribbons that run along the road faster
    // than the camera (an integer number of extra periods per loop).
    const r = mulberry32(p.citySeed ^ 0x7a11);
    const N = 70;
    const base = new THREE.PlaneGeometry(1, 1);
    base.rotateX(-Math.PI / 2);
    base.translate(0, 0, -0.5);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.getAttribute("position"));
    g.setAttribute("uv", base.getAttribute("uv"));
    const a = new Float32Array(N * 4);
    const b = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const side = r() < 0.5 ? -1 : 1;
      const lane = r();
      const x = lane < 0.35 ? side * (12 + (r() - 0.5) * 0.8) : lane < 0.7 ? side * (13 + r() * 8) : side * (1 + r() * 10);
      const y = lane < 0.7 ? 0.05 + r() * 0.5 : 0.04 + r() * 0.15;
      a.set([x, y, r() * L, 8 + r() * 36], i * 4);
      // speed in whole periods per loop (1..3 extra), width, brightness, hue mix
      b.set([1 + Math.floor(r() * 3), 0.05 + r() * 0.12, 0.5 + r() * 1.2, r()], i * 4);
    }
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 4));
    g.setAttribute("aB", new THREE.InstancedBufferAttribute(b, 4));
    g.instanceCount = N;
    const streakMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uL: { value: L }, uC1: { value: lin(p.edge) }, uC2: { value: lin(p.window) } },
      vertexShader: /* glsl */ `
        attribute vec4 aA;
        attribute vec4 aB;
        uniform float uT;
        uniform float uL;
        varying vec2 vUv;
        varying float vB;
        varying float vHue;
        void main() {
          vUv = uv;
          vB = aB.z;
          vHue = aB.w;
          float z = -mod(aA.z + aB.x * uL * uT, uL * 3.0) + uL * 0.6;
          vec3 p = vec3(aA.x + position.x * aB.y, aA.y, z + position.z * aA.w);
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
          vec4 w = modelMatrix * vec4(p, 1.0);
          vB *= smoothstep(520.0, 150.0, length(w.xyz - cameraPosition));
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uC1;
        uniform vec3 uC2;
        varying vec2 vUv;
        varying float vB;
        varying float vHue;
        void main() {
          float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
          float along = smoothstep(0.0, 0.6, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
          vec3 c = mix(uC1, uC2, vHue) * 3.0;
          gl_FragColor = vec4(c * across * across * along * vB, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    return { geo, mat, mirrorMat, roadMat, streakGeo: g, streakMat };
  }, [p.citySeed, p.glass, p.edge, p.window, p.road, p.skyHorizon]);

  return (
    <>
      <SkyDome ref={sky} sky={skyParams} radius={900} />
      <group ref={world}>
        <mesh geometry={m.geo} material={m.mirrorMat} frustumCulled={false} renderOrder={0} />
        <mesh geometry={m.geo} material={m.mat} frustumCulled={false} renderOrder={2} />
      </group>
      <mesh material={m.roadMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -400]} renderOrder={1}>
        <planeGeometry args={[400, 1000]} />
      </mesh>
      <mesh geometry={m.streakGeo} material={m.streakMat} frustumCulled={false} renderOrder={3} />
      <Driver
        post={{
          period: PERIOD,
          background: "#000",
          exposure: 1,
          bloom: { intensity: 1.6, threshold: 0.3, smoothing: 0.4, radius: 0.75, levels: 6 },
          dof: { focus: 55, range: 50, bokeh: 3.0 },
          grain: 0.015,
        }}
        update={(frame, cam) => {
          const f = frame % PERIOD;
          const t = f / PERIOD;
          const zOff = t * L;
          world.current!.position.z = zOff;
          m.roadMat.uniforms.uOff.value = zOff;
          m.streakMat.uniforms.uT.value = t;
          cam.fov = 72;
          cam.position.set(1.2 * loopSin(f, PERIOD, 1, 0.4), 2.0 + 0.1 * loopSin(f, PERIOD, 3), 0);
          const yaw = 4 * loopSin(f, PERIOD, 1) * (TAU / 360);
          const roll = 2 * loopSin(f, PERIOD, 1, 0.3) * (TAU / 360);
          cam.rotation.set((21 + 1 * loopSin(f, PERIOD, 2, 1.1)) * (TAU / 360), yaw, roll, "YXZ");
          sky.current!.position.copy(cam.position);
        }}
      />
    </>
  );
};

export const GlassCityDrive: React.FC<GlassCityDriveProps> = (p) => (
  <Stage fov={72} near={0.3} far={1400}>
    <Scene {...p} />
  </Stage>
);
