/**
 * The raised floor: a grid of square tiles extending well beyond the frame
 * on all sides, so no edge is ever visible, with a scattering of perforated
 * vent tiles. Tiles fade up in a wave from the front of the frame.
 */

import React, { useCallback } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { Instanced } from "./Instanced";
import { easeOutCubic, lerp, progress } from "./anim";
import { T, TILE } from "./constants";
import type { Layout } from "./layout";
import { ventTexture } from "./textures";
import type { Theme } from "./theme";

const TILE_H = 0.06;

export const Floor: React.FC<{ layout: Layout; theme: Theme }> = ({
  layout,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { tiles } = layout;

  const base = React.useMemo(() => new THREE.Color(theme.floorBase), [theme]);
  const alt = React.useMemo(() => new THREE.Color(theme.floorAlt), [theme]);
  const bg = React.useMemo(() => new THREE.Color(theme.background), [theme]);

  const writeTile = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const tile = tiles[i];
      const p = easeOutCubic(progress(frame, tile.delay, T.floorFade));
      const s = lerp(0.06, 1, p);
      object.position.set(tile.x, -TILE_H / 2, tile.z);
      object.scale.set(s, 1, s);
      color.copy(base).lerp(alt, tile.tone);
      color.lerp(bg, 1 - p);
    },
    [tiles, frame, base, alt, bg],
  );

  const vents = React.useMemo(() => tiles.filter((t) => t.vent), [tiles]);
  const ventMap = React.useMemo(() => ventTexture(), []);

  const writeVent = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const tile = vents[i];
      const p = easeOutCubic(progress(frame, tile.delay + 3, T.floorFade));
      object.position.set(tile.x, 0.003, tile.z);
      object.rotation.set(-Math.PI / 2, 0, 0);
      object.scale.set(p, p, 1);
      color.set(theme.ventDot);
    },
    [vents, frame, theme],
  );

  return (
    <group>
      <Instanced count={tiles.length} write={writeTile} receiveShadow>
        <boxGeometry args={[TILE - 0.02, TILE_H, TILE - 0.02]} />
        <meshStandardMaterial roughness={0.92} metalness={0.02} />
      </Instanced>

      <Instanced count={vents.length} write={writeVent} renderOrder={1}>
        <planeGeometry args={[TILE - 0.06, TILE - 0.06]} />
        <meshBasicMaterial
          map={ventMap}
          transparent
          opacity={theme.ventDotOpacity}
          depthWrite={false}
          toneMapped={false}
        />
      </Instanced>
    </group>
  );
};
