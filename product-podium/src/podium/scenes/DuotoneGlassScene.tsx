/**
 * Look 1 — Duotone Glass.
 *
 * A thick frosted glass disc between a magenta key on the left and a cyan
 * key on the right, on a dark field over a glossy floor.
 *
 * The two things that make it read: the keys are broad and overlap across
 * the front of the disc, so the colours blend through the middle instead of
 * splitting it into two halves; and light that passes through the glass
 * pools on the floor beneath it in both colours. The pools are additive
 * geometry rather than caustics — a real caustic solve is out of reach in a
 * rasteriser, but the brief is right that the scatter matters more than the
 * refraction accuracy, and this is where the scatter goes.
 */
import { useCurrentFrame } from "remotion";
import { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { discGeometry } from "../plinths/geometry";
import { ContactAO } from "../ContactAO";
import { studioEnvironment } from "../environment";
import { radialFalloff, verticalGradient } from "../textures";
import { loopNoiseRange } from "../loop";
import { LOOP_FRAMES, type DuotoneGlassParams } from "../types";

/** Frosted glass scatters, so what pools on the floor is never the pure
 *  key colour — it always carries white with it. */
const scatter = (hex: string, towardsWhite: number) =>
  "#" +
  new THREE.Color(hex)
    .lerp(new THREE.Color("#ffffff"), towardsWhite)
    .getHexString();

/**
 * The frosted glass is the expensive material in the set: transmission
 * costs a second full render of the scene every frame. Halving the
 * resolution of that pass is invisible here — the frost blurs what comes
 * through it far past half a pixel — and it is the right thing to cut
 * first, well before the frost quality itself, because the scatter is what
 * the look is made of and the refraction accuracy is not.
 */
const TransmissionBudget: React.FC<{ scale: number }> = ({ scale }) => {
  const gl = useThree((s) => s.gl);
  useLayoutEffect(() => {
    gl.transmissionResolutionScale = scale;
  }, [gl, scale]);
  return null;
};

const Pool: React.FC<{
  color: string;
  position: [number, number, number];
  size: number;
  strength: number;
}> = ({ color, position, size, strength }) => {
  const map = radialFalloff(2.4);
  if (strength <= 0) return null;
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={map}
        color={color}
        transparent
        opacity={strength}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped
      />
    </mesh>
  );
};

export const DuotoneGlassScene: React.FC<{ params: DuotoneGlassParams }> = ({
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

  const env = useMemo(
    () =>
      studioEnvironment({
        intensity: 0.35,
        top: [0.5, 0.52, 0.62],
        horizon: [0.1, 0.1, 0.14],
        bottom: [0.03, 0.03, 0.04],
      }),
    [],
  );

  const backdropMap = useMemo(
    () => verticalGradient(p.backdropTop, p.backdropBase),
    [p.backdropTop, p.backdropBase],
  );

  // The two keys breathe out of phase with each other, so the colour balance
  // across the disc shifts over the clip without either key ever pumping.
  // Both are noise sampled on a circle in time, so both are exactly periodic.
  const left = loopNoiseRange(frame, LOOP_FRAMES, 0.0, 0.8, 1.2, 1, 17);
  const right = loopNoiseRange(frame, LOOP_FRAMES, 31.7, 0.8, 1.2, 1, 53);

  const topY = p.disc.height;

  return (
    <>
      <primitive object={env} attach="environment" />
      <TransmissionBudget scale={0.5} />

      {/* Enough ambient to keep the backdrop off zero and to stop the
          glass going black on its shaded side. The reference field is a
          dark blue-grey, not a void. */}
      <ambientLight intensity={0.17} color="#8a90b8" />

      {/* Magenta key, left. Broad and slightly in front, so its falloff
          reaches past the centre of the disc and overlaps the cyan. */}
      <spotLight
        position={[-4.6, 2.2, 3.4]}
        angle={1.25}
        penumbra={1}
        decay={2}
        intensity={230 * left}
        color={p.keyLeft}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-intensity={0.55}
      />
      {/* Cyan key, right. */}
      <spotLight
        position={[4.6, 2.2, 3.4]}
        angle={1.25}
        penumbra={1}
        decay={2}
        intensity={230 * right}
        color={p.keyRight}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-intensity={0.55}
      />
      {/* A soft top light so the glass reads as a lit surface from above,
          not only from the two side keys. */}
      <spotLight
        position={[0, 6.5, 1.2]}
        angle={0.5}
        penumbra={1}
        decay={2}
        intensity={38 * (left + right) * 0.5}
        color="#cfd6ff"
      />
      {/* Rim from behind, low, to separate the disc from the backdrop. */}
      <pointLight position={[-2.2, 2.4, -3.4]} intensity={14 * left} color={p.keyLeft} decay={2} />
      <pointLight position={[2.2, 2.4, -3.4]} intensity={14 * right} color={p.keyRight} decay={2} />

      {/* Backdrop: a dark field that climbs continuously from the top of
          frame down. It is hung close enough that the gradient covers the
          whole frame — pushed back, the top of frame falls off the
          gradient entirely and a horizon appears where the reference has
          none. The coloured spill across it at plinth height is real
          light, not painted into the gradient. */}
      <mesh position={[0, 4.6, -6.2]} receiveShadow>
        <planeGeometry args={[60, 24]} />
        <meshStandardMaterial map={backdropMap} roughness={1} metalness={0} />
      </mesh>

      {/* Glossy floor carrying the coloured reflections. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          color={p.floorColor}
          roughness={p.floorRoughness}
          metalness={0}
          envMapIntensity={0.9}
        />
      </mesh>

      {/* Light pooling on the floor beneath the glass: a blend of both keys
          directly under the disc, and each key's own colour spreading out
          to its own side. */}
      <Pool color={scatter(p.keyLeft, 0.34)} position={[-0.95, 0.012, 0.55]} size={3.8} strength={0.4 * p.pool * left} />
      <Pool color={scatter(p.keyRight, 0.34)} position={[0.95, 0.012, 0.55]} size={3.8} strength={0.4 * p.pool * right} />
      <Pool color={scatter(p.keyLeft, 0.45)} position={[-0.35, 0.014, 0.1]} size={2.6} strength={0.22 * p.pool * left} />
      <Pool color={scatter(p.keyRight, 0.45)} position={[0.35, 0.014, 0.1]} size={2.6} strength={0.22 * p.pool * right} />

      {/* Occlusion crease. Two opposing keys leave the floor right at the
          disc lit from both sides; without this the disc hovers. */}
      <ContactAO radius={p.disc.radius} spread={1.7} strength={0.5} />

      {/* The plinth. Nothing stands on it, and nothing ever will. */}
      <mesh geometry={geo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={p.glass.transmission}
          roughness={p.glass.roughness}
          thickness={p.glass.thickness}
          ior={p.glass.ior}
          attenuationColor={new THREE.Color(p.glass.attenuationColor)}
          attenuationDistance={p.glass.attenuationDistance}
          metalness={0}
          clearcoat={0.35}
          clearcoatRoughness={0.28}
          envMapIntensity={1.1}
          specularIntensity={1}
        />
      </mesh>

      {/* A whisper of scatter sitting just above the top face, so the glass
          reads as lit from within rather than as a polished lid. */}
      <mesh position={[0, topY + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <circleGeometry args={[p.disc.radius * 0.98, 96]} />
        <meshBasicMaterial
          map={radialFalloff(1.6)}
          color="#ffffff"
          transparent
          opacity={0.05 * (left + right) * 0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
};
