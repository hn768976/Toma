import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

/**
 * A look is a plain imperative three.js program: built once, then asked to draw
 * frame N into the canvas. It must not keep any state that depends on which
 * frames it drew before (Remotion renders frames out of order across tabs).
 */
export interface Look {
  render(frame: number): void;
  dispose(): void;
}

export type LookFactory<P> = (gl: THREE.WebGLRenderer, params: P) => Look;

const Driver = <P,>({ factory, params }: { factory: LookFactory<P>; params: P }) => {
  const frame = useCurrentFrame();
  // The frame number is the only input. It is copied into a ref during render
  // so the render hook below draws exactly this frame.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);

  const look = useMemo(() => {
    gl.outputColorSpace = THREE.LinearSRGBColorSpace; // the final pass does its own sRGB encode
    gl.toneMapping = THREE.NoToneMapping;
    gl.autoClear = false;
    gl.debug.checkShaderErrors = true;
    // Fail the render loudly on a shader error instead of drawing black.
    gl.debug.onShaderError = (c, prog, vs, fs) => {
      throw new Error(
        `Shader error: ${c.getProgramInfoLog(prog)} VS: ${c.getShaderInfoLog(vs)} FS: ${c.getShaderInfoLog(fs)}`.replace(/\n/g, " / "),
      );
    };
    return factory(gl, params);
    // Built exactly once per mounted composition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useEffect(() => () => look.dispose(), [look]);

  // Priority 1 takes rendering over from R3F. This is only the "draw now" hook
  // that @remotion/three's advance() triggers after each frame change; the R3F
  // clock and delta are ignored. Everything comes from frameRef (useCurrentFrame).
  useFrame(() => {
    look.render(frameRef.current);
  }, 1);

  return null;
};

export const LoopCanvas = <P,>({ factory, params }: { factory: LookFactory<P>; params: P }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        // Render at the output resolution: --scale sets devicePixelRatio, so a
        // 1/3 scale render draws 1280x720 rather than drawing 4K and shrinking.
        dpr={[0.1, 4]}
        flat
        linear
        gl={{
          antialias: false,
          alpha: false,
          depth: false,
          stencil: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
      >
        <Driver factory={factory} params={params} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
