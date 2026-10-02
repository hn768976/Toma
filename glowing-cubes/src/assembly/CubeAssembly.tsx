import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Color } from "three";
import { paletteByName } from "../palettes";
import { baseColorsFor, tintFor } from "../shared/colors";
import { CubeField, type CubeState } from "../shared/CubeField";
import { Backdrop, Floor } from "../shared/Floor";
import { PostFX } from "../shared/PostFX";
import { CameraRig, Stage } from "../shared/Stage";
import { assemblyCamera, assemblyPose, CAM_FOV, CAM_TARGET, CUBES, N, PITCH } from "./layout";

export type CubeAssemblyProps = { palette: string };

export const CubeAssembly: React.FC<CubeAssemblyProps> = ({ palette: paletteName }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const palette = paletteByName(paletteName);

  const baseColors = useMemo(() => baseColorsFor(palette), [palette]);
  const tints = useMemo(() => CUBES.map((c) => tintFor(palette, c.type, c.tone)), [palette]);

  const { cubes, camPos } = useMemo(() => {
    const cubes: CubeState[] = CUBES.map((c, i) => {
      const p = assemblyPose(c, frame);
      return {
        type: c.type,
        pos: p.pos,
        quat: p.quat,
        scale: p.visible ? 1 : 0,
        tint: tints[i],
        glow: p.glow,
      };
    });
    return { cubes, camPos: assemblyCamera(frame) };
  }, [frame, tints]);

  const lightColor = useMemo(() => new Color(palette.glow[1]), [palette]);
  const centerY = 0.5 + (N - 1) * PITCH * 0.5;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.sky }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio}
        gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}
        camera={{ fov: CAM_FOV, near: 0.1, far: 200, position: [0, 10, 20] }}
      >
        <fog attach="fog" args={[palette.haze, 14, 60]} />
        <Stage envIntensity={0.4} envRotationY={2.2}>
          <CameraRig position={camPos} target={CAM_TARGET} fov={CAM_FOV} />
          <Backdrop sky={palette.sky} haze={palette.haze} />
          <spotLight position={[3, 16, -6]} angle={0.5} penumbra={1} intensity={260} decay={2} color={palette.haze} />
          <pointLight position={[0, centerY, 0]} intensity={30} decay={2} color={lightColor} />
          <ambientLight intensity={0.06} color={palette.haze} />
          <Floor color={palette.floor} mixStrength={0.3} roughness={0.7} fade={12} />
          <CubeField cubes={cubes} cameraPos={camPos} baseColors={baseColors} />
          <PostFX
            grainFrame={frame}
            vignette={0.38}
            bloomIntensity={1.3}
            bloomRadius={0.78}
            dof={{ distance: camPos.distanceTo(CAM_TARGET), range: 7, bokeh: 7 }}
          />
        </Stage>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
