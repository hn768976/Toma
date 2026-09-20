/**
 * Look 2 — Neon Double Ring.
 *
 * Pure black field, a thin dark obsidian slab, and a neon ring at its rim
 * that is by a wide margin the brightest thing in frame — with its
 * reflection below it in a polished floor.
 *
 * On what "two rings" means here. Read literally the brief asks for a ring
 * at the disc's top edge and a second just below it; read against the
 * reference, which is the same sentence's "reading as a reflection", there
 * is one neon line around the slab's rim and a mirrored arc underneath it.
 * The second is what the reference actually shows, it is what makes the
 * slab sit on something rather than float in a void, and it still gives two
 * separately distinguishable rings with dark between them. So that is what
 * this builds. The reflection is real mirrored geometry rather than a
 * planar-reflection pass: dimmer, wider and softer, as a reflection in a
 * slightly rough floor is.
 *
 * The glow is a volume, not a bloom pass. Nested shells around the tube are
 * drawn additively, each carrying the value of the glow field at its own
 * radius, so a view ray accumulates the shells it crosses. A screen-space
 * bloom would have been easier and would have ruined the second use case:
 * this composition has to encode true 0,0,0 outside the glow so a buyer can
 * screen-blend it over their own background, and bloom bleeds a few levels
 * into every pixel of frame. Additive geometry leaves black alone — as does
 * the localised haze around the podium, which is falloff geometry that
 * reaches zero well inside the frame edge rather than an ambient term.
 */
import { useCurrentFrame } from "remotion";
import { useMemo } from "react";
import * as THREE from "three";
import { discGeometry } from "../plinths/geometry";
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

/** Where the travelling segment is, and how much it brightens a point. */
const segmentGlsl = /* glsl */ `
uniform float uSegment;
uniform float uSegWidth;
uniform float uBoost;

float segmentAt( float turns ) {
  float d = abs( fract( turns - uSegment + 0.5 ) - 0.5 );
  return exp( - pow( d / uSegWidth, 2.0 ) );
}

/*
 * A real neon tube looks brighter where you are looking along it. At the
 * left and right extremes of the ellipse the ring's tangent points almost
 * straight at the camera, so a view ray travels much further through the
 * tube than it does across the front. This is that, bounded: the reference
 * shows it clearly and without it the ring reads as uniformly bright all
 * the way round, which no real ring does.
 */
float grazing( vec3 world, float amount ) {
  vec3 v = normalize( cameraPosition - world );
  vec2 p = world.xz;
  float r = max( length( p ), 1e-4 );
  vec3 tangent = normalize( vec3( -p.y * 0.0 - world.z, 0.0, world.x ) / r );
  float a = abs( dot( tangent, v ) );
  return 1.0 + amount * a * a;
}
`;

/** The tube itself: thin, hot, opaque. */
const coreFragment = /* glsl */ `
uniform vec3 uGlow;
uniform vec3 uCore;
uniform float uIntensity;
uniform float uGrazing;
varying vec2 vUv;
varying vec3 vWorld;
${segmentGlsl}

void main() {
  float v = uIntensity * ( 1.0 + uBoost * segmentAt( vUv.x ) ) * grazing( vWorld, uGrazing );
  // Hold the hue until the tube is genuinely hot: mixing to white too early
  // is what turns a saturated neon line into a white cord with a blue edge.
  vec3 col = mix( uGlow, uCore, clamp( ( v - 0.85 ) * 1.1, 0.0, 1.0 ) );
  gl_FragColor = vec4( col * v, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** One shell of the glow volume. */
const shellFragment = /* glsl */ `
uniform vec3 uGlow;
uniform vec3 uCore;
uniform float uField;
uniform float uIntensity;
uniform float uGrazing;
varying vec3 vWorld;
varying vec2 vUv;
${segmentGlsl}

void main() {
  float v = uField * uIntensity * ( 1.0 + uBoost * segmentAt( vUv.x ) )
          * grazing( vWorld, uGrazing );
  vec3 col = mix( uGlow, uCore, clamp( ( uField - 0.55 ) * 1.6, 0.0, 1.0 ) );
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
  grazing: number;
  order: number;
}> = (o) => {
  const uniforms = useMemo(
    () => ({
      uGlow: { value: new THREE.Color() },
      uCore: { value: new THREE.Color() },
      uField: { value: 1 },
      uIntensity: { value: 1 },
      uGrazing: { value: 0.8 },
      uSegment: { value: 0 },
      uSegWidth: { value: 0.075 },
      uBoost: { value: 1.35 },
    }),
    [],
  );
  uniforms.uGlow.value.copy(o.glow);
  uniforms.uCore.value.copy(o.core);
  uniforms.uField.value = o.field;
  uniforms.uIntensity.value = o.intensity;
  uniforms.uGrazing.value = o.grazing;
  uniforms.uSegment.value = o.segment;

  return (
    <mesh position={[0, o.y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={o.order}>
      <torusGeometry args={[o.radius, o.tube, 16, 288]} />
      {/*
        Drawn before the slab and without a depth test, so the slab paints
        over the glow inside its own silhouette. Otherwise every shell
        leaves a bright ring where it cuts the slab's rim and the plinth
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

/** Shells are packed close enough that the stack reads as a smooth falloff. */
const SHELL_COUNT = 16;

const NeonRing: React.FC<{
  radius: number;
  tube: number;
  y: number;
  glow: THREE.Color;
  core: THREE.Color;
  segment: number;
  brightness: number;
  /** e-folding distance of the glow field, in world units. */
  spread: number;
  intensity: number;
  coreIntensity: number;
  /** A reflection is a smear of light, not a second filament. */
  showCore: boolean;
  grazing: number;
  /** Glow shells draw here — must be BEFORE the slab, so it occludes them. */
  shellOrder: number;
  /** The tube itself draws here — after the slab, so the slab cannot hide it. */
  coreOrder: number;
}> = ({
  radius, tube, y, glow, core, segment, brightness,
  spread, intensity, coreIntensity, showCore, grazing, shellOrder, coreOrder,
}) => {
  const coreUniforms = useMemo(
    () => ({
      uGlow: { value: new THREE.Color() },
      uCore: { value: new THREE.Color() },
      uIntensity: { value: 1 },
      uGrazing: { value: 0.8 },
      uSegment: { value: 0 },
      uSegWidth: { value: 0.075 },
      uBoost: { value: 1.35 },
    }),
    [],
  );
  coreUniforms.uGlow.value.copy(glow);
  coreUniforms.uCore.value.copy(core);
  coreUniforms.uIntensity.value = coreIntensity * brightness;
  coreUniforms.uGrazing.value = grazing;
  coreUniforms.uSegment.value = segment;

  const shells = useMemo(() => {
    const out: { t: number; field: number }[] = [];
    for (let i = 1; i <= SHELL_COUNT; i++) {
      const t = (i / SHELL_COUNT) * spread * 3.2;
      out.push({ t, field: Math.exp(-Math.pow(t / spread, 1.7)) });
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
            grazing={grazing}
            order={shellOrder + i}
          />
        ))}

      {showCore ? (
      <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={coreOrder}>
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
      ) : null}
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

  const pulse = loopRange(frame, LOOP_FRAMES, p.pulseCycles, 0.88, 1.0);
  const segMain = loopPhase(frame, LOOP_FRAMES, p.travelCyclesTop, 0.0);
  const segRefl = loopPhase(frame, LOOP_FRAMES, -p.travelCyclesBottom, 0.37);

  // The slab floats clear of the floor, which is what separates the ring
  // from its reflection instead of fusing the two into one band.
  const lift = p.float;
  // Just below the slab, with unlit gap above it: in the reference the
  // neon sits behind and under the base rather than fused to it.
  const ringY = lift - 0.022;
  const ringTube = 0.0062;

  return (
    <>
      {/* No environment map, no fill, no floor geometry: anything that
          reaches past the podium would lift the field off true black. */}
      <ambientLight intensity={0.03} color={p.ring} />
      {/* A dim key from above and in front, so the slab's top face carries a
          front-to-back gradient and reads as a solid plate. */}
      <directionalLight position={[0.9, 5, -2.2]} intensity={2.9} color="#d6d2c9" />
      {/* Bounce from the ring onto the slab's underside and rim. */}
      <pointLight position={[0, ringY + 0.02, p.disc.radius * 0.8]} intensity={0.1 * pulse} color={p.ring} decay={2} distance={1.6} />
      

      {/* The reflection, below: dimmer, wider, softer. */}
      <NeonRing
        radius={p.disc.radius * 0.96}
        tube={ringTube * 1.6}
        y={-ringY * 1.15}
        glow={glow}
        core={core}
        segment={segRefl}
        brightness={pulse}
        spread={0.075}
        intensity={0.003}
        coreIntensity={0}
        showCore={false}
        grazing={0.6}
        shellOrder={2}
        coreOrder={30}
      />

      {/* The slab. renderOrder puts it after the glow shells and before the
          neon tubes, so it occludes the glow but not the ring itself. */}
      <mesh geometry={geo} position={[0, lift, 0]} renderOrder={100}>
        <meshPhysicalMaterial
          transparent
          depthWrite
          color="#34322f"
          roughness={0.52}
          metalness={0.02}
          clearcoat={0.25}
          clearcoatRoughness={0.45}
          envMapIntensity={0}
        />
      </mesh>

      {/* The neon itself, at the slab's rim. */}
      <NeonRing
        radius={p.disc.radius + ringTube * 0.5}
        tube={ringTube}
        y={ringY}
        glow={glow}
        core={core}
        segment={segMain}
        brightness={pulse}
        spread={0.021}
        intensity={0.017}
        coreIntensity={0.6}
        showCore
        grazing={1.1}
        shellOrder={40}
        coreOrder={150}
      />
    </>
  );
};
