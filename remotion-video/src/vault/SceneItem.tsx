// A prop in the scene. Owns the three things every element shares: its
// absolute position in the 3840x2160 scene, its enter/exit reveal, and its
// idle float. Children draw in their own local coordinates, centred on 0,0.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { floatY, type Reveal } from "./anim";

export const SceneItem: React.FC<{
  x: number;
  y: number;
  reveal: Reveal;
  /** Desynchronises this element's idle float from every other element. */
  seed: number;
  floatAmplitude?: number;
  /** Extra scale on top of the reveal, for elements that grow on cue. */
  scale?: number;
  zIndex?: number;
  children: React.ReactNode;
}> = ({
  x,
  y,
  reveal,
  seed,
  floatAmplitude = 6,
  scale = 1,
  zIndex,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!reveal.rendered) return null;

  const bob = floatY(frame, fps, seed, floatAmplitude);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + bob,
        width: 0,
        height: 0,
        opacity: reveal.opacity,
        transform: `scale(${reveal.scale * scale})`,
        zIndex,
      }}
    >
      {children}
    </div>
  );
};
