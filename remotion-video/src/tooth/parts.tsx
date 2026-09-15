import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import {
  useBackdropMaterial,
  useGlowShellMaterial,
  useMirrorMaterial,
  usePointsMaterial,
  useRadialMaterial,
} from "./shaders/materials";
import type { PointCloud } from "./loaders";
import { usePxScale } from "./stage";

/** Deterministic RNG - the scatter must be identical on every render tab. */
export const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const useRandom = (seed: number) => useMemo(() => mulberry32(seed), [seed]);

/** Full-frame CSS layer - the backdrop for every version lives in the DOM. */
export const Backdrop: React.FC<{
  readonly background: string;
  readonly blend?: React.CSSProperties["mixBlendMode"];
  readonly opacity?: number;
}> = ({ background, blend, opacity }) => (
  <AbsoluteFill style={{ background, mixBlendMode: blend, opacity }} />
);

/**
 * The scene's background, drawn as a full-screen quad before anything else.
 *
 * Every version uses this rather than a CSS layer behind the canvas - see
 * `useBackdropMaterial` for why the background has to be inside WebGL.
 */
export const SceneBackdrop: React.FC<{
  readonly colors: [string, string, string, string];
  readonly stops?: [number, number, number, number];
  readonly center?: [number, number];
  readonly radius?: [number, number];
  /** 0 = radial, 1 = linear along `angle`. */
  readonly linear?: number;
  /** Radians; 0 points right, PI/2 points up. */
  readonly angle?: number;
  /** Vignette strength, 0 = none. Eased, and dithered with the rest of the ramp. */
  readonly vignette?: number;
  readonly vignetteColor?: string;
  readonly vignetteCenter?: [number, number];
  readonly vignetteRadius?: [number, number];
  readonly vignetteRange?: [number, number];
  readonly vignettePower?: number;
}> = ({
  colors,
  stops = [0, 0.34, 0.68, 1],
  center = [0.5, 0.5],
  radius = [0.8, 0.8],
  linear = 0,
  angle = Math.PI / 2,
  vignette = 0,
  vignetteColor = "#000000",
  vignetteCenter,
  vignetteRadius = [0.75, 0.65],
  vignetteRange = [0.45, 1.25],
  vignettePower = 2.2,
}) => {
  const material = useBackdropMaterial({
    uC0: colors[0],
    uC1: colors[1],
    uC2: colors[2],
    uC3: colors[3],
    uStops: stops,
    uCenter: center,
    uRadius: radius,
    uLinear: linear,
    uAngle: angle,
    uVig: vignette,
    uVigColor: vignetteColor,
    uVigCenter: vignetteCenter ?? center,
    uVigRadius: vignetteRadius,
    uVigRange: vignetteRange,
    uVigPower: vignettePower,
  });
  return (
    <mesh material={material} renderOrder={-1000} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};

/* -------------------------------------------------------------------------- */
/* Particles                                                                    */
/* -------------------------------------------------------------------------- */

const useScatter = (
  count: number,
  seed: number,
  place: (random: () => number, index: number) => [number, number, number],
) =>
  useMemo(() => {
    const random = mulberry32(seed);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const [x, y, z] = place(random, i);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seed]);

/** Dust in a slab behind and around the subject. */
export const Starfield: React.FC<{
  readonly count?: number;
  readonly seed?: number;
  readonly spread?: [number, number, number];
  readonly color?: string;
  readonly size?: number;
  readonly opacity?: number;
  readonly rotation?: number;
}> = ({
  count = 320,
  seed = 7,
  spread = [16, 9, 10],
  color = "#8fd0ff",
  size = 14,
  opacity = 0.9,
  rotation = 0,
}) => {
  const px = usePxScale();
  const geometry = useScatter(count, seed, (random) => [
    (random() - 0.5) * spread[0],
    (random() - 0.5) * spread[1],
    -random() * spread[2] - 1,
  ]);
  const material = usePointsMaterial({
    uColor: color,
    uSize: size,
    uOpacity: opacity,
    uPx: px,
    uFade: 0,
  });
  return (
    <points geometry={geometry} material={material} rotation-y={rotation} />
  );
};

/** The tooth's own surface samples, drawn as glowing dots. */
export const SurfacePoints: React.FC<{
  readonly cloud: PointCloud;
  readonly count?: number;
  readonly color?: string;
  readonly size?: number;
  readonly opacity?: number;
  readonly inflate?: number;
}> = ({ cloud, count, color = "#b6ecff", size = 9, opacity = 1, inflate = 0 }) => {
  const px = usePxScale();
  const used = Math.min(count ?? cloud.count, cloud.count);
  const geometry = useMemo(() => {
    const positions = new Float32Array(used * 3);
    for (let i = 0; i < used * 3; i++) {
      positions[i] = cloud.positions[i] + cloud.normals[i] * inflate;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [cloud, used, inflate]);
  const material = usePointsMaterial({
    uColor: color,
    uSize: size,
    uOpacity: opacity,
    uPx: px,
    uFade: 0,
  });
  return <points geometry={geometry} material={material} />;
};

/* -------------------------------------------------------------------------- */
/* Flat helpers                                                                 */
/* -------------------------------------------------------------------------- */

/** Soft elliptical contact shadow on the ground plane. */
export const ContactShadow: React.FC<{
  readonly y: number;
  readonly radius?: number;
  readonly squash?: number;
  readonly opacity?: number;
  readonly color?: string;
  readonly power?: number;
}> = ({ y, radius = 1.6, squash = 1, opacity = 0.35, color = "#000000", power = 2.4 }) => {
  const material = useRadialMaterial({
    uColor: color,
    uOpacity: opacity,
    uPower: power,
    uAspect: 1 / squash,
  });
  return (
    <mesh
      material={material}
      position={[0, y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={-1}
    >
      <planeGeometry args={[radius * 2, radius * 2 * squash]} />
    </mesh>
  );
};

/** Additive halo billboard, sat behind the subject to fake a bloom. */
export const Halo: React.FC<{
  readonly color: string;
  readonly size: number;
  readonly opacity: number;
  readonly power?: number;
  readonly position?: [number, number, number];
  readonly squash?: number;
}> = ({ color, size, opacity, power = 2.6, position = [0, 0, -1.2], squash = 1 }) => {
  const material = useRadialMaterial(
    { uColor: color, uOpacity: opacity, uPower: power, uAspect: 1 / squash },
    true,
  );
  return (
    <mesh material={material} position={position} renderOrder={-2}>
      <planeGeometry args={[size, size * squash]} />
    </mesh>
  );
};

/** Inflated back-faced copy of the subject that lights up at the rim. */
export const GlowShell: React.FC<{
  readonly geometry: THREE.BufferGeometry;
  readonly color: string;
  readonly strength: number;
  readonly power?: number;
  readonly scale?: number;
}> = ({ geometry, color, strength, power = 3, scale = 1.05 }) => {
  const material = useGlowShellMaterial({
    uColor: color,
    uStrength: strength,
    uPower: power,
  });
  return (
    <mesh geometry={geometry} material={material} scale={scale} renderOrder={-1} />
  );
};

/**
 * A vertically-mirrored copy of the subject, sitting under a floor line.
 * `floorY` is where the real object meets the floor; the reflection fades out
 * over `depth` world units below it.
 */
export const FloorReflection: React.FC<{
  readonly geometry: THREE.BufferGeometry;
  readonly floorY: number;
  readonly depth?: number;
  readonly color?: string;
  readonly shade?: string;
  readonly opacity?: number;
  readonly rotationY?: number;
  readonly scale?: number;
  /** Vertical offset of the real subject, so the mirror tracks it. */
  readonly offsetY?: number;
}> = ({
  geometry,
  floorY,
  depth = 1.9,
  color = "#ffffff",
  shade = "#4d7ba8",
  opacity = 0.3,
  rotationY = 0,
  scale = 1,
  offsetY = 0,
}) => {
  const material = useMirrorMaterial({
    uColor: color,
    uShade: shade,
    uFadeLow: floorY - depth,
    uFadeHigh: floorY - depth * 0.12,
    uOpacity: opacity,
  });
  return (
    <group position-y={floorY * 2 - offsetY} scale={[scale, -scale, scale]} rotation-y={rotationY}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
};

/**
 * A radial CSS gradient whose alpha follows a smoothstep instead of a straight
 * line between two stops.
 *
 * CSS interpolates linearly between colour stops, so a two-stop fade has a hard
 * slope change at each end. Over a smooth background the eye reads those as
 * rings. Sampling the curve into several stops removes both, at the cost of a
 * longer gradient string.
 *
 * Used for overlays that genuinely have to sit above the WebGL canvas; anything
 * that only treats the background belongs in <SceneBackdrop> instead, where it
 * is also covered by the backdrop's dither.
 */
export const easedRadialGradient = ({
  rgb,
  alpha,
  radius,
  center,
  from = 0,
  to = 1,
  steps = 12,
  invert = false,
}: {
  /** "255,255,255" */
  readonly rgb: string;
  readonly alpha: number;
  readonly radius: [number, number];
  readonly center: [number, number];
  readonly from?: number;
  readonly to?: number;
  readonly steps?: number;
  /** false: opaque at the centre fading out. true: clear at the centre. */
  readonly invert?: boolean;
}) => {
  const stops: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const eased = p * p * (3 - 2 * p);
    const a = alpha * (invert ? eased : 1 - eased);
    const pos = (from + (to - from) * p) * 100;
    stops.push(`rgba(${rgb},${a.toFixed(4)}) ${pos.toFixed(2)}%`);
  }
  return `radial-gradient(${(radius[0] * 100).toFixed(1)}% ${(radius[1] * 100).toFixed(1)}% at ${(center[0] * 100).toFixed(1)}% ${(center[1] * 100).toFixed(1)}%, ${stops.join(", ")})`;
};
