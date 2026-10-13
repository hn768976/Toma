import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { buildingGeometry, buildingMaterial, skyUniforms } from "../kit/buildings";
import { generateStreet } from "../kit/city";
import { GLSL_LINES, GLSL_SKY, SkyParams } from "../lib/glsl";
import { loopSin, TAU } from "../lib/math";
import { mulberry32 } from "../lib/random";
import { SkyDome } from "../lib/Sky";
import { Driver, Stage } from "../lib/Stage";

export type WireframeStreetProps = {
  citySeed: number;
  body: string; // building face colour
  line: string; // edge / floor lines
  glow: string; // horizon glow
  glowWarm?: string; // optional second glow colour, low at the horizon
  skyTop: string;
};

const PERIOD = 600;
const L = 132; // street layout period in metres (camera walks this in 600 frames)
const COPIES = 5;
const lin = (hex: string) => new THREE.Color(hex); // three converts sRGB hex to linear

const Scene: React.FC<WireframeStreetProps> = (p) => {
  const world = useRef<THREE.Group>(null);
  const sky = useRef<THREE.Mesh>(null);
  const parts = useRef<THREE.Points>(null);

  const skyParams = useMemo<SkyParams>(() => {
    const g = lin(p.glow);
    const t = lin(p.skyTop);
    const h = lin(p.glow).multiplyScalar(0.3).lerp(t, 0.6);
    const w = p.glowWarm ? lin(p.glowWarm) : null;
    return {
      glow2: w ? [w.r * 1.4, w.g * 1.4, w.b * 1.4] : [0, 0, 0],
      top: [t.r, t.g, t.b],
      horizon: [h.r, h.g, h.b],
      glow: [g.r * 1.8, g.g * 1.8, g.b * 1.8],
      glowDir: [0, -0.01, -1],
      glowW: [0.65, 0.14],
    };
  }, [p.glow, p.glowWarm, p.skyTop]);

  const { geo, mat, mirrorMat, floorMat, pointsGeo, pointsMat } = useMemo(() => {
    const boxes = generateStreet({
      seed: p.citySeed,
      period: L,
      roadHalf: 27,
      floorH: 1.3,
      minFloors: 3,
      maxFloors: 40,
      rows: 2,
      lotMin: 9,
      lotMax: 22,
    });
    const geo = buildingGeometry(boxes, L, COPIES, -1);
    const style = {
      mode: "solid" as const,
      body: lin(p.body),
      bodyAlpha: 1,
      line: lin(p.line).multiplyScalar(1.8),
      lineAlpha: 0.7,
      edgeW: 0.05,
      floorW: 0.018,
      floorH: 2.6,
      mullion: 3.0,
      windowLit: 0,
      window: new THREE.Color(0, 0, 0),
      fogColor: lin(p.glow),
      fogNear: 120,
      fogFar: 480,
      hazeHeight: 50,
      mirror: 1,
      brightness: 1,
      sky: skyParams,
    };
    const mat = buildingMaterial(style);
    const mirrorMat = buildingMaterial({ ...style, mirror: -1 });

    const floorMat = new THREE.ShaderMaterial({
      uniforms: { ...skyUniforms(skyParams), uLine: { value: lin(p.line) }, uOff: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        ${GLSL_LINES}
        ${GLSL_SKY}
        uniform vec3 uLine;
        uniform float uOff;
        varying vec3 vWorld;
        void main() {
          vec2 g = vec2(vWorld.x, vWorld.z - uOff);
          float l = max(gridLines(g.x + 1.5, 3.0, 0.035), gridLines(g.y, 3.0, 0.035));
          vec3 dir = normalize(vWorld - cameraPosition);
          float dist = length(vWorld - cameraPosition);
          vec3 sky = skyCol(dir);
          vec3 base = uLine * 0.03;
          float nearB = mix(1.0, 0.4, smoothstep(10.0, 160.0, dist));
          vec3 c = base + uLine * l * nearB;
          // Wet street: the horizon glow reflected as a streak down the middle.
          vec3 hz = skyCol(normalize(vec3(dir.x, -dir.y, dir.z)));
          c += hz * 1.1 * exp(-abs(vWorld.x) / 8.0);
          float fog = smoothstep(15.0, 380.0, dist);
          c = mix(c, sky, fog);
          // Partly transparent: the mirrored city shows through as a reflection.
          gl_FragColor = vec4(c, mix(0.8, 1.0, fog));
        }`,
      transparent: true,
      depthWrite: true,
    });

    // About 60 floating light particles, periodic with the street.
    const r = mulberry32(p.citySeed ^ 0x5eed);
    const n = 60;
    const pos = new Float32Array(n * COPIES * 3);
    const ph = new Float32Array(n * COPIES);
    for (let c = 0; c < COPIES; c++) {
      for (let i = 0; i < n / 2; i++) {
        // n/2 per period, twice: 60 visible over two periods of view.
        const x = (r() < 0.5 ? -1 : 1) * (6 + r() * 14);
        const y = 0.2 + r() * 4;
        const z = -(r() * L + (c - 1) * L);
        pos.set([x, y, z], (c * n + i) * 3);
        ph[c * n + i] = r();
      }
    }
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pointsGeo.setAttribute("aPhase", new THREE.BufferAttribute(ph, 1));
    const pointsMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uColor: { value: lin(p.glow).multiplyScalar(3) }, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        uniform float uT;
        uniform float uScale;
        varying float vA;
        void main() {
          vec3 p = position;
          float a = 6.2831853 * (uT + aPhase);
          p.y += 0.25 * sin(a * 2.0);
          p.x += 0.3 * sin(a + aPhase * 10.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uScale * 0.7 / -mv.z;
          vA = (0.5 + 0.5 * sin(a * 3.0 + aPhase * 6.28)) * smoothstep(250.0, 60.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vA;
        void main() {
          vec2 q = gl_PointCoord * 2.0 - 1.0;
          float d = dot(q, q);
          float a = exp(-d * 5.0);
          gl_FragColor = vec4(uColor * a * (0.4 + vA), 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat, mirrorMat, floorMat, pointsGeo, pointsMat };
  }, [p.citySeed, p.body, p.line, p.glow, skyParams]);

  return (
    <>
      <SkyDome ref={sky} sky={skyParams} radius={800} />
      <group ref={world}>
        <mesh geometry={geo} material={mirrorMat} frustumCulled={false} renderOrder={0} />
        <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={2} />
        <points ref={parts} geometry={pointsGeo} material={pointsMat} frustumCulled={false} renderOrder={3} />
      </group>
      <mesh material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -300]} renderOrder={1}>
        <planeGeometry args={[1200, 1400]} />
      </mesh>
      <Driver
        post={{
          period: PERIOD,
          background: "#000",
          exposure: 1,
          bloom: { intensity: 1.0, threshold: 0.45, smoothing: 0.3, radius: 0.55, levels: 6 },
          grain: 0.015,
        }}
        update={(frame, cam, { buffer }) => {
          const f = frame % PERIOD;
          const t = f / PERIOD;
          const zOff = t * L;
          world.current!.position.z = zOff;
          floorMat.uniforms.uOff.value = zOff;
          pointsMat.uniforms.uT.value = t;
          cam.fov = 46;
          cam.updateProjectionMatrix();
          const bufH = buffer.y;
          pointsMat.uniforms.uScale.value = bufH / (2 * Math.tan((cam.fov * Math.PI) / 360));
          cam.position.set(0.6 * loopSin(f, PERIOD, 1), 16 + 0.3 * loopSin(f, PERIOD, 2, 1), 0);
          cam.rotation.set(
            (1.5 + 0.4 * loopSin(f, PERIOD, 1, 2)) * (TAU / 360),
            1.5 * loopSin(f, PERIOD, 1, 0.5) * (TAU / 360),
            0.5 * loopSin(f, PERIOD, 1, 1.3) * (TAU / 360),
            "YXZ",
          );
          sky.current!.position.copy(cam.position);
        }}
      />
    </>
  );
};

export const WireframeStreet: React.FC<WireframeStreetProps> = (p) => (
  <Stage fov={42} near={0.5} far={1200}>
    <Scene {...p} />
  </Stage>
);
