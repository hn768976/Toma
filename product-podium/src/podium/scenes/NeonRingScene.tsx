/**
 * Look 2 — Neon Double Ring.
 *
 * Pure black field, a dark obsidian disc, and two neon rings — one hugging
 * the disc's top edge, one at its base — that are by a wide margin the
 * brightest thing in frame.
 *
 * The glow is the whole look, and it is built as a volume rather than as a
 * bloom pass. Nested shells around the tube are drawn additively, each
 * carrying the value of the glow field at its own radius, so a view ray
 * crossing the stack accumulates the shells it passes through and the sum
 * approximates the line integral through the glow. Because each shell's
 * brightness has already fallen to nothing by the time it reaches its own
 * silhouette, no glow geometry ever shows an edge — which a flat card or a
 * single fat torus always does.
 *
 * A screen-space bloom would have been easier and would have ruined the
 * second use case: this composition has to encode true 0,0,0 outside the
 * glow so a buyer can screen-blend it over their own background, and bloom
 * bleeds a few levels into every pixel of the frame. Additive geometry
 * leaves black alone. For the same reason the floor is pure black with no
 * diffuse response at all — it exists to occlude, so the disc has a real
 * contact shadow, but it can never lift the field.
 */
import { useCurrentFrame } from "remotion";
import { useMemo } from "react";
import * as THREE from "three";
import { discGeometry } from "../plinths/geometry";
import { radialRamp } from "../textures";
import { loopPhase, loopRange } from "../loop";
import { LOOP_FRAMES, type NeonRingParams } from "../types";

const vertex = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4( position, 1.0 );
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/** Shared bits: where the travelling segment is, and how bright it makes a point. */
const segmentGlsl = /* glsl */ `
uniform float uSegment;
uniform float uSegWidth;
uniform float uBoost;

float segmentAt( float turns ) {
  float d = abs( fract( turns - uSegment + 0.5 ) - 0.5 );
  return exp( - pow( d / uSegWidth, 2.0 ) );
}
`;

/** The tube itself: thin, hot, opaque. */
const coreFragment = /* glsl */ `
uniform vec3 uGlow;
uniform vec3 uCore;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vWorld;
${segmentGlsl}

void main() {
  float v = uIntensity * ( 1.0 + uBoost * segmentAt( vUv.x ) );
  vec3 col = mix( uGlow, uCore, clamp( v * 0.5, 0.0, 1.0 ) );
  gl_FragColor = vec4( col * v, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * One shell of the glow volume. `uField` is the value of the glow field at
 * this shell's radius; the segment term brightens the part of the ring the
 * travelling highlight is currently passing through.
 */
const shellFragment = /* glsl */ `
uniform vec3 uGlow;
uniform vec3 uCore;
uniform float uField;
uniform float uIntensity;
varying vec3 vWorld;
varying vec2 vUv;
${segmentGlsl}

void main() {
  float v = uField * uIntensity * ( 1.0 + uBoost * segmentAt( vUv.x ) );
  vec3 col = mix( uGlow, uCore, clamp( uField * 1.15, 0.0, 1.0 ) );
  gl_FragColor = vec4( col * v, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const Shell: React.FC<{
  radius: number;
  tube: number;
  y: number;
  glow: THREE.Color;
  core: THREE.Color;
  field: number;
  intensity: number;
  segment: number;
  boost: number;
  order: number;
}> = (o) => {
  const uniforms = useMemo(
    () => ({
      uGlow: { value: new THREE.Color() },
      uCore: { value: new THREE.Color() },
      uField: { value: 1 },
      uIntensity: { value: 1 },
      uSegment: { value: 0 },
      uSegWidth: { value: 0.075 },
      uBoost: { value: 1 },
    }),
    [],
  );
  uniforms.uGlow.value.copy(o.glow);
  uniforms.uCore.value.copy(o.core);
  uniforms.uField.value = o.field;
  uniforms.uIntensity.value = o.intensity;
  uniforms.uSegment.value = o.segment;
  uniforms.uBoost.value = o.boost;

  return (
    <mesh position={[0, o.y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={o.order}>
      <torusGeometry args={[o.radius, o.tube, 20, 288]} />
      {/*
        Drawn before the disc and without a depth test, so the disc paints
        over the glow inside its own silhouette. Otherwise every shell
        leaves a bright ring where it cuts the disc's rim, and the plinth
        ends up wearing the glow as a set of concentric bands.
      */}
      <shaderMaterial
        vertexShader={vertex}
        fragmentShader={shellFragment}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
};

const SHELL_COUNT = 11;

const NeonRing: React.FC<{
  radius: number;
  tube: number;
  y: number;
  glow: THREE.Color;
  core: THREE.Color;
  segment: number;
  brightness: number;
  /** Glow width — the e-folding distance of the field, in world units. */
  spread: number;
  intensity: number;
}> = ({ radius, tube, y, glow, core, segment, brightness, spread, intensity }) => {
  const coreUniforms = useMemo(
    () => ({
      uGlow: { value: new THREE.Color() },
      uCore: { value: new THREE.Color() },
      uIntensity: { value: 1 },
      uSegment: { value: 0 },
      uSegWidth: { value: 0.075 },
      uBoost: { value: 1.6 },
    }),
    [],
  );
  coreUniforms.uGlow.value.copy(glow);
  coreUniforms.uCore.value.copy(core);
  coreUniforms.uIntensity.value = 1.08 * brightness;
  coreUniforms.uSegment.value = segment;

  const shells = useMemo(() => {
    const out: { t: number; field: number }[] = [];
    for (let i = 1; i <= SHELL_COUNT; i++) {
      const t = (i / SHELL_COUNT) * spread * 3.0;
      out.push({ t, field: Math.exp(-Math.pow(t / spread, 1.9)) });
    }
    return out;
  }, [spread]);

  return (
    <>
      {shells
        .slice()
        .reverse()
        .map((s, i) => (
          <Shell
            key={i}
            radius={radius}
            tube={tube + s.t}
            y={y}
            glow={glow}
            core={core}
            field={s.field}
            intensity={intensity * brightness}
            segment={segment}
            boost={1.6}
            order={i}
          />
        ))}

      <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={40}>
        <torusGeometry args={[radius, tube, 16, 320]} />
        <shaderMaterial
          vertexShader={vertex}
          fragmentShader={coreFragment}
          uniforms={coreUniforms}
          toneMapped={false}
          transparent
          depthWrite
          depthTest
        />
      </mesh>
    </>
  );
};

export const NeonRingScene: React.FC<{ params: NeonRingParams }> = ({
  params: p,
}) => {
  const frame = useCurrentFrame();

  const geo = useMemo(
    () =>
      discGeometry({
        radius: p.disc.radius,
        height: p.disc.height,
        bevel: p.disc.bevel,
      }),
    [p.disc.radius, p.disc.height, p.disc.bevel],
  );

  const glow = useMemo(() => new THREE.Color(p.ring), [p.ring]);
  const core = useMemo(() => new THREE.Color(p.ringCore), [p.ringCore]);
  // Brighter towards the rim: the top surface is caught by the ring's light
  // rather than lit directly, which is a gradient no point light can give
  // without also putting eight discrete lobes on the face.
  const topRamp = useMemo(() => radialRamp(0.12, 1.0, 2.6), []);

  const pulse = loopRange(frame, LOOP_FRAMES, p.pulseCycles, 0.88, 1.0);
  const segTop = loopPhase(frame, LOOP_FRAMES, p.travelCyclesTop, 0.0);
  const segBottom = loopPhase(frame, LOOP_FRAMES, -p.travelCyclesBottom, 0.37);

  const topY = p.disc.height;
  const ringTube = 0.016;

  return (
    <>
      {/* No environment map, no fill, no floor light: anything ambient that
          reaches beyond the disc would lift the field off true black. */}
      <ambientLight intensity={0.045} color={p.ring} />
      <pointLight position={[0, 2.6, 2.4]} intensity={0.9 * pulse} color={p.ringCore} decay={2} distance={7} />

      {/* Black floor. Diffuse response is zero, so it can only ever return a
          specular sheen — which is exactly the faint arc under the lower
          ring — and the disc occluding that sheen is the contact shadow. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#000000" roughness={0.3} metalness={0} />
      </mesh>

      {/* renderOrder 20 puts the disc after the glow shells and before the
          neon tubes, so it occludes the glow but not the rings. */}
      <mesh geometry={geo} castShadow receiveShadow renderOrder={20}>
        <meshPhysicalMaterial
          transparent
          depthWrite
          color="#04060a"
          roughness={0.24}
          metalness={0.1}
          clearcoat={0.85}
          clearcoatRoughness={0.14}
          envMapIntensity={0}
          emissive={new THREE.Color(p.ring)}
          emissiveMap={topRamp}
          emissiveIntensity={0.055}
        />
      </mesh>

      <NeonRing
        radius={p.disc.radius + ringTube * 0.4}
        tube={ringTube}
        y={topY - ringTube * 0.5}
        glow={glow}
        core={core}
        segment={segTop}
        brightness={pulse}
        spread={0.085}
        intensity={0.062}
      />
      <NeonRing
        radius={p.disc.radius + ringTube * 1.1}
        tube={ringTube * 1.2}
        y={ringTube * 2.2}
        glow={glow}
        core={core}
        segment={segBottom}
        brightness={pulse * 1.06}
        spread={0.1}
        intensity={0.07}
      />
    </>
  );
};
