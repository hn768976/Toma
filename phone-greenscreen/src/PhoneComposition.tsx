import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { VersionRow } from "./data";
import { buildWorld } from "./scene/world";

/**
 * Draws one frame of the world. R3F's own render is replaced (useFrame with
 * priority 1); the callback ignores R3F's clock entirely and renders the frame
 * number Remotion asked for, so frames can be rendered in any order.
 */
const Stage: React.FC<{ row: VersionRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const { delayRender, continueRender } = useDelayRender();
  // geometry + PMREM environment are built synchronously here; hold the
  // render until the first frame has actually been drawn with them.
  const [handle] = useState(() => delayRender(`Building phone world for ${row.id}`));
  const firstDrawn = useRef(false);
  const world = useMemo(() => buildWorld(gl, row), [gl, row]);
  useEffect(() => () => world.dispose(), [world]);

  useFrame(() => {
    world.render(frameRef.current);
    if (!firstDrawn.current) {
      firstDrawn.current = true;
      continueRender(handle);
    }
  }, 1);
  return null;
};

export const PhoneComposition: React.FC<{ row: VersionRow }> = ({ row }) => {
  const { width, height } = useVideoConfig();
  // Render the canvas at the output resolution (composition size x --scale);
  // window.devicePixelRatio equals the --scale factor while rendering.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        gl={{
          antialias: false,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
      >
        <Stage row={row} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
