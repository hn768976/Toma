import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { createCity } from "./city/scene";
import { createPost } from "./render/post";

export type Variant = "v1" | "v2";

/**
 * Lives inside the canvas. Renders the city for `frame` into off-screen
 * targets in a layout effect (which runs before <ThreeCanvas> asks React
 * Three Fiber to draw), so the only thing R3F itself draws is the final
 * full-screen quad. No useFrame, no clocks: everything derives from `frame`.
 */
const CityPass: React.FC<{ frame: number; variant: Variant }> = ({ frame, variant }) => {
  const gl = useThree((s) => s.gl);
  const { fps, width, height } = useVideoConfig();
  const city = useMemo(() => createCity(), []);
  const post = useMemo(() => createPost(), []);

  useLayoutEffect(() => {
    const dpr = gl.getPixelRatio();
    post.setSize(Math.round(width * dpr), Math.round(height * dpr));
    city.prepare(gl);
    city.update(frame / fps, variant, width / height);
    post.render(gl, city.scene, city.camera, frame);
  }, [gl, city, post, frame, fps, variant, width, height]);

  return <mesh geometry={post.quad} material={post.finalMaterial} frustumCulled={false} />;
};

/** The scene at an explicit frame (used by the compositions and by LookDev). */
export const CityFrame: React.FC<{ frame: number; variant: Variant }> = ({ frame, variant }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#c4e6ef" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio}
        flat
        shadows="percentage"
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      >
        <CityPass frame={frame} variant={variant} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const CityGrowth: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  return <CityFrame frame={frame} variant={variant} />;
};
