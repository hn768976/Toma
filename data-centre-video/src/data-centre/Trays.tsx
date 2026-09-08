/**
 * Overhead cable trays running along the tops of the rows, plus the thin
 * hangers that carry them up to the ceiling. Each tray draws in from one
 * end of its row.
 */

import React, { useCallback, useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { Instanced, hide } from "./Instanced";
import { easeOutCubic, progress } from "./anim";
import { RACK_D, RACK_H, T, TRAY_Y } from "./constants";
import type { Layout } from "./layout";
import type { Theme } from "./theme";

type TrayPart = {
  x0: number;
  length: number;
  z: number;
  y: number;
  h: number;
  d: number;
  delay: number;
  rail: boolean;
};

export const Trays: React.FC<{ layout: Layout; theme: Theme }> = ({
  layout,
  theme,
}) => {
  const frame = useCurrentFrame();

  const parts = useMemo<TrayPart[]>(() => {
    const list: TrayPart[] = [];
    for (const row of layout.rows) {
      const x0 = row.x0 - 0.12;
      const length = row.x1 - row.x0 + 0.24;
      const z = row.z + RACK_D / 2 - 0.18;
      const delay = T.trayStart + row.order * T.trayRowStagger;
      list.push({ x0, length, z, y: TRAY_Y, h: 0.022, d: 0.36, delay, rail: false });
      for (const side of [-1, 1]) {
        list.push({
          x0,
          length,
          z: z + side * 0.175,
          y: TRAY_Y + 0.025,
          h: 0.055,
          d: 0.022,
          delay: delay + 2,
          rail: true,
        });
      }
    }
    return list;
  }, [layout]);

  const colors = useMemo(
    () => ({
      tray: new THREE.Color(theme.tray),
      rail: new THREE.Color(theme.trayRail),
      hanger: new THREE.Color(theme.hanger),
    }),
    [theme],
  );

  const writeTray = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const part = parts[i];
      const p = easeOutCubic(progress(frame, part.delay, T.trayDraw));
      if (p <= 0) return hide(object);
      const length = part.length * p;
      object.position.set(part.x0 + length / 2, part.y, part.z);
      object.scale.set(length, part.h, part.d);
      color.copy(part.rail ? colors.rail : colors.tray);
    },
    [parts, frame, colors],
  );

  // Short posts standing on the rack tops that carry the tray. Reads far
  // better in isometric than hangers dropping from an unseen ceiling.
  const postHeight = TRAY_Y - RACK_H + 0.02;

  const writePost = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const post = layout.hangers[i];
      const p = easeOutCubic(progress(frame, post.delay, T.trayDraw * 0.6));
      if (p <= 0) return hide(object);
      object.position.set(post.x, RACK_H + (postHeight * p) / 2, post.z);
      object.scale.set(1, postHeight * p, 1);
      color.copy(colors.hanger);
    },
    [layout, frame, colors, postHeight],
  );

  return (
    <group>
      <Instanced count={parts.length} write={writeTray} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.72} metalness={0.18} />
      </Instanced>
      <Instanced count={layout.hangers.length} write={writePost} castShadow>
        <boxGeometry args={[0.03, 1, 0.03]} />
        <meshStandardMaterial roughness={0.8} metalness={0.15} />
      </Instanced>
    </group>
  );
};
