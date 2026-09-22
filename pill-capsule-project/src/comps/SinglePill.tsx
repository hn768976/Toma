import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { CAPSULE_LENGTH } from "../lib/pill-geometry";
import { HeroPill } from "../scene/Pill";
import { Cyclorama } from "../scene/Backdrop";
import { LightRig } from "../scene/Rig";
import { Post } from "../scene/Post";
import type { SingleRow } from "../data/looks";

/** Tablet geometry is authored with diameter 1; the capsule is 3.03 long. */
const longestAxis = (shape: SingleRow["shape"]) =>
  shape === "capsule" ? CAPSULE_LENGTH : 1;

/**
 * Looks 1 and 2: one pill, fixed camera, rotating by a whole number of turns
 * over the loop.
 *
 * Look 2 runs twice the frames: the beauty pass, then the identical animation
 * again as a solid white silhouette on pure black, so a buyer can key the
 * capsule over their own footage. Both halves are driven by the same values
 * and the same frame-derived motion, so they align frame for frame.
 */
export const SinglePillComp: React.FC<{ row: SingleRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const isMatte = row.hasMattePass && frame >= row.loopFrames;
  const loopFrame = isMatte ? frame - row.loopFrames : frame;
  const t = loopFrame / row.loopFrames;

  // Framing as fractions of the frame, resolved against the camera.
  const visibleHeight = 2 * row.camera.z * Math.tan((row.camera.fovDeg * Math.PI) / 360);
  const visibleWidth = (visibleHeight * width) / height;
  const scale = (row.sizeFraction * visibleHeight) / longestAxis(row.shape);
  const bob = Math.sin(t * Math.PI * 2) * row.bobFraction * longestAxis(row.shape) * scale;

  const position: [number, number, number] = [
    row.positionFraction[0] * visibleWidth,
    row.positionFraction[1] * visibleHeight + bob,
    0,
  ];

  const tilt = useMemo(
    () =>
      row.tiltDeg.map((d) => (d * Math.PI) / 180) as [number, number, number],
    [row.tiltDeg],
  );
  const spin: [number, number, number] = [
    Math.PI * 2 * row.turns[0] * t,
    Math.PI * 2 * row.turns[1] * t,
    Math.PI * 2 * row.turns[2] * t,
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={1}
        flat
        shadows={!isMatte && row.rig.softShadows !== null}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{
          fov: row.camera.fovDeg,
          position: [0, 0, row.camera.z],
          near: row.camera.near,
          far: row.camera.far,
        }}
        style={{ backgroundColor: "#000000" }}
      >
        {/* Pure #000000 everywhere. Look 1's sweep covers the frame; look 2
            needs the black itself, and it has to survive the encode. */}
        <color attach="background" args={["#000000"]} />

        {isMatte ? null : <LightRig rig={row.rig} />}

        {row.backdrop && !isMatte ? <Cyclorama {...row.backdrop} /> : null}

        <group position={position} rotation={tilt}>
          <group rotation={spin} scale={scale}>
            <HeroPill
              shape={row.shape}
              colourway={row.colourway}
              scored={row.scored}
              matte={isMatte}
              roughness={row.material.roughness}
              clearcoat={row.material.clearcoat}
            />
          </group>
        </group>

        {/* The matte is a pure white silhouette on pure black: no shading, no
            highlight, no depth of field, no grain, no tone mapping. Running it
            through the composer would soften the edge and lift the black. */}
        {isMatte ? null : (
          <Post dof={row.dof} grain={row.grain} frameIndex={loopFrame % row.loopFrames} />
        )}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
