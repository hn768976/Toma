/**
 * Sparse ceiling elements: a light strip above each aisle. Deliberately thin
 * so nothing obscures the racks below.
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import { easeOutCubic, progress } from "./anim";
import { CEILING_Y, T } from "./constants";
import type { Layout } from "./layout";
import type { Theme } from "./theme";

export const Ceiling: React.FC<{ layout: Layout; theme: Theme }> = ({
  layout,
  theme,
}) => {
  const frame = useCurrentFrame();

  return (
    <group>
      {layout.ceilingStrips.map((strip, i) => {
        const p = easeOutCubic(progress(frame, strip.delay, T.ceilingFade));
        if (p <= 0) return null;
        const length = strip.x1 - strip.x0;
        return (
          <group key={i}>
            {/* Housing sits just below the light panel so that, seen from
                above, the strip itself is what reads. */}
            <mesh
              position={[strip.x0 + length / 2, CEILING_Y - 0.03, strip.z]}
              scale={[length + 0.1, 1, 1]}
            >
              <boxGeometry args={[1, 0.032, 0.15]} />
              <meshStandardMaterial
                color={theme.tray}
                roughness={0.8}
                metalness={0.1}
                transparent
                opacity={p}
              />
            </mesh>
            <mesh
              position={[strip.x0 + length / 2, CEILING_Y, strip.z]}
              scale={[length, 1, 1]}
            >
              <boxGeometry args={[1, 0.02, 0.085]} />
              <meshBasicMaterial
                color={theme.ceiling}
                transparent
                opacity={theme.ceilingOpacity * p}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
