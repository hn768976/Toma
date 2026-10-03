/**
 * <ThreeCanvas> wrapper shared by the three.js looks.
 * - Backing store follows Remotion's --scale (devicePixelRatio), so a
 *   0.3333 render draws 1280x720 pixels instead of drawing 4K and
 *   downsampling. In the Studio a low fixed ratio keeps preview fast.
 * - No tone mapping on the renderer: the post chain does it.
 * - The studio HDRI is turned into a PMREM env map synchronously.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, getRemotionEnvironment, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useHdri } from "../assets";

const EnvContext = createContext<THREE.Texture | null>(null);
/**
 * The studio HDRI as a PMREM texture, for materials that want real
 * reflections: pass it as `envMap` with their own `envMapIntensity`.
 * (scene.environment uses one global intensity for every material.)
 */
export const useEnvTexture = () => useContext(EnvContext);

const EnvMap: React.FC<{
  hdri: THREE.DataTexture;
  intensity: number;
  rotationY?: number;
  children: React.ReactNode;
}> = ({ hdri, intensity, rotationY = 0, children }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const envTex = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromEquirectangular(hdri);
    pmrem.dispose();
    return rt.texture;
  }, [gl, hdri]);
  useLayoutEffect(() => {
    scene.environment = intensity > 0 ? envTex : null;
    scene.environmentIntensity = intensity;
    scene.environmentRotation.set(0, rotationY, 0);
  }, [scene, envTex, intensity, rotationY]);
  return <EnvContext.Provider value={envTex}>{children}</EnvContext.Provider>;
};

/**
 * Bring every world matrix up to date before any pass of this frame runs.
 * Off-screen passes (the floor reflector) render before the main
 * gl.render() that would otherwise do it, and would see last frame's
 * matrices: that made a frame depend on the frame rendered before it.
 */
const UpdateWorldFirst: React.FC = () => {
  useFrame(({ scene, camera }) => {
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
  }, -1);
  return null;
};

/**
 * @remotion/three renders the frame in the first passive effect of the
 * canvas. Re-render once at mount, after every child has set itself up, so a
 * cold-started tab produces exactly the same pixels as a warm one.
 */
const RenderOnMount: React.FC = () => {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    if (getRemotionEnvironment().isRendering) advance(performance.now());
  }, [advance]);
  return null;
};

export const Scene3D: React.FC<{
  children: React.ReactNode;
  background: string;
  fov?: number;
  near?: number;
  far?: number;
  envIntensity?: number;
  envRotation?: number;
}> = ({ children, background, fov = 40, near = 0.1, far = 400, envIntensity = 0, envRotation = 0 }) => {
  const { width, height } = useVideoConfig();
  const hdri = useHdri();
  const dpr = getRemotionEnvironment().isRendering
    ? window.devicePixelRatio
    : Math.min(0.5, 1920 / width);
  if (!hdri) return <AbsoluteFill style={{ background }} />;
  return (
    <AbsoluteFill style={{ background }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        gl={{
          antialias: false,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          stencil: false,
        }}
        camera={{ fov, near, far, position: [0, 0, 10] }}
      >
        <color attach="background" args={[background]} />
        <UpdateWorldFirst />
        <EnvMap hdri={hdri} intensity={envIntensity} rotationY={envRotation}>
          {children}
        </EnvMap>
        <RenderOnMount />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
