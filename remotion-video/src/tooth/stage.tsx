import React, { useLayoutEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./config";

/**
 * How many real pixels one "design pixel" is worth. 1 at 1080p, 2 at 4K.
 * Anything authored in pixels - shader line widths, point sizes, CSS blur radii
 * - has to go through this or the 4K render will not match the 1080p one.
 */
export const usePxScale = () => useVideoConfig().width / DESIGN_WIDTH;

/**
 * Normalised loop position. Everything in these scenes is driven from `t` with
 * whole-cycle periodic functions, which is what makes the clips seamless: at
 * t = 1 every value is back where it was at t = 0.
 */
export const useLoop = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return { frame, durationInFrames, t: frame / durationInFrames };
};

/** sin() over the loop, completing `cycles` whole periods. */
export const wave = (t: number, cycles = 1, phase = 0) =>
  Math.sin((t * cycles + phase) * Math.PI * 2);

/** cos() over the loop, completing `cycles` whole periods. */
export const cwave = (t: number, cycles = 1, phase = 0) =>
  Math.cos((t * cycles + phase) * Math.PI * 2);

/** A 0..1 sawtooth repeating `cycles` times across the loop. */
export const saw = (t: number, cycles = 1, phase = 0) => {
  const v = (t * cycles + phase) % 1;
  return v < 0 ? v + 1 : v;
};

/** A 0..1..0 triangle repeating `cycles` times across the loop. */
export const ping = (t: number, cycles = 1, phase = 0) =>
  1 - Math.abs(saw(t, cycles, phase) * 2 - 1);

/** Smooth 0..1..0 bell, peaking at `centre`, over the loop's [0,1). */
export const bell = (t: number, centre: number, halfWidth: number) => {
  let d = Math.abs(t - centre);
  d = Math.min(d, 1 - d); // wrap around the loop
  return THREE.MathUtils.smoothstep(1 - d / halfWidth, 0, 1);
};

const Renderer: React.FC<{
  readonly toneMapping: THREE.ToneMapping;
  readonly exposure: number;
}> = ({ toneMapping, exposure }) => {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => {
    gl.toneMapping = toneMapping;
    gl.toneMappingExposure = exposure;
  }, [gl, toneMapping, exposure]);
  return null;
};

export type StageProps = {
  readonly children: React.ReactNode;
  readonly fov?: number;
  readonly position?: [number, number, number];
  readonly near?: number;
  readonly far?: number;
  readonly toneMapping?: THREE.ToneMapping;
  readonly exposure?: number;
  readonly antialias?: boolean;
};

/**
 * The WebGL layer every version sits on: a canvas at the composition's exact
 * pixel size, frame-locked to Remotion, with a transparent clear so the DOM
 * backdrop behind it shows through.
 */
export const Stage: React.FC<StageProps> = ({
  children,
  fov = 32,
  position = [0, 0, 6],
  near = 0.1,
  far = 100,
  toneMapping = THREE.ACESFilmicToneMapping,
  exposure = 1,
  antialias = true,
}) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={1}
      flat={toneMapping === THREE.NoToneMapping}
      gl={{ antialias, alpha: false }}
      camera={{ fov, position, near, far }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Renderer toneMapping={toneMapping} exposure={exposure} />
      {children}
    </ThreeCanvas>
  );
};

/**
 * Lays its children out in a fixed 1920x1080 box and scales the whole thing to
 * the composition, so DOM overlays (gradients, vignettes, HUD panels) can be
 * authored once in design pixels and stay pixel-proportional at 4K.
 */
export const ScaledDom: React.FC<{
  readonly children: React.ReactNode;
  readonly style?: React.CSSProperties;
}> = ({ children, style }) => {
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill style={{ ...style, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transformOrigin: "top left",
          transform: `scale(${width / DESIGN_WIDTH})`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
