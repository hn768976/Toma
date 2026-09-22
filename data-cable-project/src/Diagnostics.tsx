import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useState } from "react";
import { AbsoluteFill } from "remotion";
import { useDigitTexture } from "./useDigitTexture";
import { COLS, ROWS, TEX_H, TEX_W } from "./digitField";

/**
 * Reports what the renderer actually supports. If max anisotropy comes back as
 * 1, anisotropic filtering is unavailable and the digits will smear on every
 * receding surface -- which is worth knowing before shipping anything.
 */
const Probe: React.FC<{ onReport: (lines: string[]) => void }> = ({ onReport }) => {
  const gl = useThree((s) => s.gl);
  React.useEffect(() => {
    const ctx = gl.getContext();
    onReport([
      `MAX_ANISOTROPY: ${gl.capabilities.getMaxAnisotropy()}`,
      `WEBGL2: ${gl.capabilities.isWebGL2}`,
      `MAX_TEXTURE_SIZE: ${gl.capabilities.maxTextureSize}`,
      `RENDERER: ${ctx.getParameter(ctx.RENDERER)}`,
      `VERSION: ${ctx.getParameter(ctx.VERSION)}`,
      `DIGIT_TEX: ${TEX_W}x${TEX_H} grid ${COLS}x${ROWS}`,
    ]);
  }, [gl, onReport]);
  return null;
};

export const Diagnostics: React.FC = () => {
  const [lines, setLines] = useState<string[]>([]);
  const digits = useDigitTexture();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", color: "#0f0", padding: 40 }}>
      <div style={{ position: "absolute", opacity: 0.001 }}>
        {digits ? (
          <ThreeCanvas width={64} height={64}>
            <Probe onReport={setLines} />
          </ThreeCanvas>
        ) : null}
      </div>
      <pre style={{ fontSize: 34, fontFamily: "monospace", lineHeight: 1.5 }}>
        {lines.join("\n")}
      </pre>
    </AbsoluteFill>
  );
};
