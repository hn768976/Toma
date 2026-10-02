import { useMemo } from 'react';
import {
  AdditiveBlending, Color, CylinderGeometry, DoubleSide, PlaneGeometry, ShaderMaterial, Vector3,
} from 'three';
import { NOISE4D_GLSL } from './glsl';
import { cameraAt } from './camera';

// Soft vertical beam of blue light falling behind the icon: additive
// billboard planes + open cones + a bright floor spot. Noise is sampled
// around a circle in time so it loops: noise(x, y, cos 2πt·r, sin 2πt·r).

export const BEAM_POS = new Vector3(0, 0, -1.3);
export const BEAM_COLOR = new Color('#3F5BFF');
const H = 7;

const columnMaterial = (width: number, strength: number, seed: number, sharp: number) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: {
      uT: { value: 0 },
      uColor: { value: BEAM_COLOR },
      uStrength: { value: strength },
      uSeed: { value: seed },
      uSharp: { value: sharp },
      uWidth: { value: width },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uT;
      uniform vec3 uColor;
      uniform float uStrength;
      uniform float uSeed;
      uniform float uSharp;
      uniform float uWidth;
      varying vec2 vUv;
      ${NOISE4D_GLSL}
      void main() {
        float x = (vUv.x - 0.5) * 2.0;
        float Y = vUv.y * ${H.toFixed(1)};
        float a = 6.283185307 * uT;
        vec4 lp = vec4(cos(a), sin(a), cos(a * 2.0), sin(a * 2.0));
        float n1 = snoise(vec4(x * uWidth * 0.9 + uSeed, Y * 0.35, lp.x * 0.9, lp.y * 0.9));
        float n2 = snoise(vec4(x * uWidth * 2.2 - uSeed, Y * 0.9 + 3.1, lp.z * 0.6, lp.w * 0.6));
        float xs = x + n1 * 0.14 + n2 * 0.05;
        float prof = exp(-xs * xs * uSharp);
        float vert = smoothstep(0.0, 0.25, Y) * (0.55 + 0.45 * smoothstep(0.3, 2.6, Y)) * (1.0 - smoothstep(4.5, ${H.toFixed(1)}, Y));
        float base = 1.0 + 0.9 * exp(-Y * 2.2); // brighter where it meets the board
        float k = prof * vert * base * (0.78 + 0.22 * n1 + 0.12 * n2);
        gl_FragColor = vec4(uColor * k * uStrength, 1.0);
      }`,
  });

const coneMaterial = (strength: number, power: number) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uColor: { value: BEAM_COLOR }, uStrength: { value: strength }, uPow: { value: power } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      varying float vY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vY = uv.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      uniform float uPow;
      varying vec3 vN;
      varying vec3 vW;
      varying float vY;
      void main() {
        vec3 v = normalize(cameraPosition - vW);
        float f = pow(abs(dot(normalize(vN), v)), uPow);
        float vert = smoothstep(0.0, 0.05, vY) * (1.0 - smoothstep(0.55, 1.0, vY));
        gl_FragColor = vec4(uColor * f * vert * uStrength, 1.0);
      }`,
  });

const spotMaterial = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uT: { value: 0 }, uColor: { value: BEAM_COLOR } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uT;
      uniform vec3 uColor;
      varying vec2 vP;
      ${NOISE4D_GLSL}
      void main() {
        float a = 6.283185307 * uT;
        float n = snoise(vec4(vP * 1.3, cos(a) * 0.7, sin(a) * 0.7));
        float r2 = dot(vP, vP);
        float k = exp(-r2 * 9.0) * 0.9 + exp(-r2 * 1.4) * 0.16 + exp(-r2 * 0.25) * 0.025;
        gl_FragColor = vec4(uColor * k * (0.85 + 0.15 * n), 1.0);
      }`,
  });

export const Beam = ({ t }: { t: number }) => {
  const plane = useMemo(() => new PlaneGeometry(1, 1).translate(0, 0.5, 0), []);
  const spotGeo = useMemo(() => new PlaneGeometry(5, 5), []);
  const coneWide = useMemo(() => new CylinderGeometry(0.25, 1.1, H, 64, 1, true).translate(0, H / 2, 0), []);
  const coneTight = useMemo(() => new CylinderGeometry(0.1, 0.45, H, 64, 1, true).translate(0, H / 2, 0), []);
  const mats = useMemo(
    () => ({
      wide: columnMaterial(1.0, 0.15, 0.0, 2.2),
      core: columnMaterial(2.6, 0.26, 7.3, 4.5),
      coneWide: coneMaterial(0.035, 3.0),
      coneTight: coneMaterial(0.06, 4.0),
      spot: spotMaterial(),
    }),
    [],
  );
  mats.wide.uniforms.uT.value = t;
  mats.core.uniforms.uT.value = t;
  mats.spot.uniforms.uT.value = t;
  // cylindrical billboard: face the (deterministic) camera position
  const cam = cameraAt(t);
  const rotY = Math.atan2(cam.x - BEAM_POS.x, cam.z - BEAM_POS.z);
  return (
    <group position={BEAM_POS}>
      <mesh geometry={plane} material={mats.wide} rotation={[0, rotY, 0]} scale={[2.6, H, 1]} renderOrder={5} />
      <mesh geometry={plane} material={mats.core} rotation={[0, rotY, 0]} scale={[1.0, H, 1]} renderOrder={5} />
      <mesh geometry={coneWide} material={mats.coneWide} renderOrder={5} />
      <mesh geometry={coneTight} material={mats.coneTight} renderOrder={5} />
      <mesh geometry={spotGeo} material={mats.spot} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]} renderOrder={1} />
    </group>
  );
};
