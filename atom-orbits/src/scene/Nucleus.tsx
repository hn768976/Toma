import { useMemo } from "react";
import { Color, MeshPhysicalMaterial, ShaderMaterial, SphereGeometry } from "three";
import type { AtomModel } from "./model";
import { Glow } from "./Sprites";

let sphere: SphereGeometry | null = null;
const unitSphere = () => (sphere ??= new SphereGeometry(1, 48, 32));

/** Look 1: lumpy cluster of glossy orange-red spheres + soft red glow. */
const Cluster: React.FC<{ model: AtomModel; color: Color; glow: Color }> = ({ model, color, glow }) => {
  const mat = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color,
        roughness: 0.32,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        emissive: color.clone().multiplyScalar(0.55),
      }),
    [color],
  );
  return (
    <>
      {model.nucleusSpheres.map(([x, y, z, r], i) => (
        <mesh key={i} geometry={unitSphere()} material={mat} position={[x, y, z]} scale={r} renderOrder={0} />
      ))}
      <Glow size={1.5} color={glow} intensity={0.55} sigma={0.32} />
    </>
  );
};

const CORE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const CORE_FRAG = /* glsl */ `
uniform vec3 uRim;
uniform vec3 uDark;
varying vec3 vN;
varying vec3 vV;
void main(){
  float f = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0);
  float rim = pow(f, 1.6);
  gl_FragColor = vec4(mix(uDark, uRim * 6.0, rim), 1.0);
}
`;

/** Look 2: bright white-cyan core with a small dark centre. */
const EnergyCore: React.FC<{ color: Color; glow: Color }> = ({ color, glow }) => {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: CORE_VERT,
        fragmentShader: CORE_FRAG,
        uniforms: { uRim: { value: color.clone() }, uDark: { value: new Color(0.004, 0.02, 0.018) } },
      }),
    [color],
  );
  return (
    <>
      <mesh geometry={unitSphere()} material={mat} scale={0.085} renderOrder={0} />
      {/* bright ring hugging the core; centre left dark */}
      <Glow size={0.75} color={glow} intensity={0.25} sigma={0.5} ring={[0.27, 0.09, 1.6]} />
    </>
  );
};

/** Look 3: small, understated teal sphere with a soft glow. */
const TealSphere: React.FC<{ color: Color; glow: Color }> = ({ color, glow }) => {
  const mat = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color,
        roughness: 0.45,
        clearcoat: 0.6,
        emissive: color.clone().multiplyScalar(0.35),
      }),
    [color],
  );
  return (
    <>
      <mesh geometry={unitSphere()} material={mat} scale={0.075} renderOrder={0} />
      <Glow size={0.9} color={glow} intensity={0.3} sigma={0.35} />
    </>
  );
};

export const Nucleus: React.FC<{ model: AtomModel; color: Color; glow: Color }> = ({ model, color, glow }) => {
  switch (model.look.nucleus) {
    case "cluster":
      return <Cluster model={model} color={color} glow={glow} />;
    case "energy-core":
      return <EnergyCore color={color} glow={glow} />;
    case "teal-sphere":
      return <TealSphere color={color} glow={glow} />;
  }
};
