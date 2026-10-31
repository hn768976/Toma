import { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { ShaderCanvas } from "../gl/ShaderCanvas";
import { lampState } from "./lampState";
import { LED_WALL_FRAG } from "./ledWallShader";
import { LedPalette } from "./palettes";

export type LedLightWallProps = {
  palette: LedPalette;
};

export const LedLightWall: React.FC<LedLightWallProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const uniforms = useMemo(
    () => ({ ...palette, uLamp: { vec4Array: lampState(palette, frame) } }),
    [palette, frame],
  );
  return <ShaderCanvas fragmentShader={LED_WALL_FRAG} uniforms={uniforms} />;
};
