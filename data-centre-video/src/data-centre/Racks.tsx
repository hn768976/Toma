/**
 * The racks themselves: chassis, top plates, front panels, unit divisions,
 * status LEDs, open-front interiors and contact shadows.
 *
 * Each of those is a single instanced mesh, so the whole facility — several
 * thousand cuboids — stays at roughly a dozen draw calls.
 */

import React, { useCallback, useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { Instanced, hide } from "./Instanced";
import { easeOutBack, easeOutCubic, lerp, progress } from "./anim";
import { CAMERA_DIRECTION, RACK_D, RACK_W, T } from "./constants";
import type { Layout, Led, Rack } from "./layout";
import { radialTexture } from "./textures";
import type { Theme } from "./theme";

const FRONT_Z = RACK_D / 2;

/** Vertical scale of a rack at this frame: grows from zero with a slight snap. */
const riseOf = (rack: Rack, frame: number) => {
  const p = progress(frame, rack.delay, T.rackRise);
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return Math.max(easeOutBack(p), 0.0001);
};

/** Brightness of a status LED, 0..1, as a pure function of the frame. */
const ledLevel = (led: Led, frame: number, offLevel: number) => {
  const on = progress(frame, led.delay, T.ledOn);
  if (on <= 0) return 0;
  const t = frame - led.delay;
  let level = 1;
  if (led.mode === 1 || led.mode === 2) {
    const phase = (t / led.period + led.phase) % 1;
    level = phase < led.duty ? 1 : offLevel;
  } else if (led.mode === 3) {
    const phase = (t / led.period + led.phase) % 1;
    level = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2));
  }
  return level * easeOutCubic(on);
};

type InteriorPart = {
  rack: number;
  ox: number;
  /** Fraction of rack height, measured from the floor. */
  fy: number;
  oz: number;
  w: number;
  h: number;
  d: number;
  color: "interior" | "rail";
};

export const Racks: React.FC<{ layout: Layout; theme: Theme }> = ({
  layout,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { racks, unitLines, leds } = layout;

  const colors = useMemo(
    () => ({
      chassis: new THREE.Color(theme.chassis),
      top: new THREE.Color(theme.chassisTop),
      front: new THREE.Color(theme.front),
      division: new THREE.Color(theme.division),
      interior: new THREE.Color(theme.interior),
      rail: new THREE.Color(theme.rail),
      led: theme.ledColors.map((c) => new THREE.Color(c)),
    }),
    [theme],
  );

  const openRacks = useMemo(() => racks.filter((r) => r.open), [racks]);

  /** Empty interior frame shown on the racks left open. */
  const interior = useMemo<InteriorPart[]>(() => {
    const parts: InteriorPart[] = [];
    for (const rack of openRacks) {
      parts.push({
        rack: rack.index,
        ox: 0,
        fy: 0.5,
        oz: FRONT_Z - 0.28,
        w: RACK_W - 0.07,
        h: 0.92,
        d: 0.52,
        color: "interior",
      });
      for (const side of [-1, 1]) {
        parts.push({
          rack: rack.index,
          ox: side * (RACK_W / 2 - 0.05),
          fy: 0.5,
          oz: FRONT_Z - 0.09,
          w: 0.035,
          h: 0.9,
          d: 0.05,
          color: "rail",
        });
      }
      for (const fy of [0.24, 0.46, 0.68, 0.88]) {
        parts.push({
          rack: rack.index,
          ox: 0,
          fy,
          oz: FRONT_Z - 0.2,
          w: RACK_W - 0.1,
          h: 0.018,
          d: 0.36,
          color: "rail",
        });
      }
    }
    return parts;
  }, [openRacks]);

  // Additive haloes are drawn as camera-aligned quads. The camera never
  // rotates (the drift is a pure orthographic pan), so one quaternion,
  // computed once, is correct for every frame.
  const billboard = useMemo(() => {
    const helper = new THREE.Object3D();
    helper.position.set(...CAMERA_DIRECTION);
    helper.lookAt(0, 0, 0);
    helper.updateMatrixWorld();
    return helper.quaternion.clone();
  }, []);
  const towardCamera = useMemo(
    () => new THREE.Vector3(...CAMERA_DIRECTION).normalize().multiplyScalar(0.03),
    [],
  );

  const glowMap = useMemo(() => radialTexture(2.6), []);
  const shadowMap = useMemo(() => radialTexture(1.7), []);

  const writeChassis = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const rack = racks[i];
      const s = riseOf(rack, frame);
      if (s <= 0) return hide(object);
      object.position.set(rack.x, (rack.h * s) / 2, rack.z);
      object.scale.set(1, rack.h * s, 1);
      color.copy(colors.chassis);
    },
    [racks, frame, colors],
  );

  const writeTop = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const rack = racks[i];
      const s = riseOf(rack, frame);
      if (s <= 0) return hide(object);
      object.position.set(rack.x, rack.h * s - 0.014, rack.z);
      color.copy(colors.top);
    },
    [racks, frame, colors],
  );

  const writeFront = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const rack = racks[i];
      const s = riseOf(rack, frame);
      if (s <= 0 || rack.open) return hide(object);
      object.position.set(rack.x, (rack.h * s) / 2, rack.z + FRONT_Z + 0.011);
      object.scale.set(1, (rack.h - 0.08) * s, 1);
      color.copy(colors.front);
    },
    [racks, frame, colors],
  );

  const writeUnitLine = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const line = unitLines[i];
      const rack = racks[line.rack];
      const s = riseOf(rack, frame);
      const draw = easeOutCubic(progress(frame, line.delay, T.unitDraw));
      if (s <= 0 || draw <= 0) return hide(object);
      object.position.set(
        rack.x,
        (rack.h * s) / 2 + line.oy * s,
        rack.z + FRONT_Z + 0.023,
      );
      object.scale.set(draw, 1, 1);
      color.copy(colors.division);
    },
    [unitLines, racks, frame, colors],
  );

  const writeLed = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const led = leds[i];
      const rack = racks[led.rack];
      const s = riseOf(rack, frame);
      const level = ledLevel(led, frame, theme.ledOffLevel);
      if (s <= 0 || level <= 0) return hide(object);
      const pop = easeOutCubic(progress(frame, led.delay, T.ledOn));
      object.position.set(
        rack.x + led.ox,
        (rack.h * s) / 2 + led.oy * s,
        rack.z + FRONT_Z + 0.026,
      );
      object.scale.set(pop * theme.ledScale, pop * theme.ledScale, 1);
      color.copy(colors.led[led.color]).multiplyScalar(level);
    },
    [leds, racks, frame, colors, theme],
  );

  const writeGlow = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const led = leds[i];
      const rack = racks[led.rack];
      const s = riseOf(rack, frame);
      const level = ledLevel(led, frame, theme.ledOffLevel * 0.4);
      if (s <= 0 || level <= 0.08) return hide(object);
      object.position.set(
        rack.x + led.ox + towardCamera.x,
        (rack.h * s) / 2 + led.oy * s + towardCamera.y,
        rack.z + FRONT_Z + 0.026 + towardCamera.z,
      );
      object.quaternion.copy(billboard);
      const size = theme.glowSize * (0.65 + 0.35 * level);
      object.scale.set(size, size, 1);
      color.copy(colors.led[led.color]).multiplyScalar(level * theme.glowOpacity);
    },
    [leds, racks, frame, colors, theme, billboard, towardCamera],
  );

  const writeInterior = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const part = interior[i];
      const rack = racks[part.rack];
      const s = riseOf(rack, frame);
      if (s <= 0) return hide(object);
      object.position.set(
        rack.x + part.ox,
        rack.h * s * part.fy,
        rack.z + part.oz,
      );
      object.scale.set(part.w, part.h * s, part.d);
      color.copy(part.color === "interior" ? colors.interior : colors.rail);
    },
    [interior, racks, frame, colors],
  );

  const writeAisleAo = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const row = layout.rows[i];
      const p = easeOutCubic(
        progress(frame, T.rackStart + row.order * T.rackRowStagger, 46),
      );
      if (p <= 0) return hide(object);
      object.position.set((row.x0 + row.x1) / 2, 0.002, row.z + 0.1);
      object.rotation.set(-Math.PI / 2, 0, 0);
      object.scale.set((row.x1 - row.x0 + 1.5) * p, RACK_D + 1.7, 1);
      color.setRGB(0, 0, 0);
    },
    [layout, frame],
  );

  const writeContact = useCallback(
    (i: number, object: THREE.Object3D, color: THREE.Color) => {
      const rack = racks[i];
      const s = riseOf(rack, frame);
      if (s <= 0) return hide(object);
      const grow = lerp(0.55, 1, easeOutCubic(Math.min(s, 1)));
      object.position.set(rack.x + 0.06, 0.004, rack.z + 0.08);
      object.rotation.set(-Math.PI / 2, 0, 0);
      object.scale.set(grow, grow, 1);
      color.setRGB(0, 0, 0);
    },
    [racks, frame],
  );

  return (
    <group>
      <Instanced count={layout.rows.length} write={writeAisleAo} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={shadowMap}
          transparent
          opacity={theme.aisleAo}
          depthWrite={false}
          toneMapped={false}
        />
      </Instanced>

      <Instanced count={racks.length} write={writeContact} renderOrder={2}>
        <planeGeometry args={[RACK_W + 0.62, RACK_D + 0.62]} />
        <meshBasicMaterial
          map={shadowMap}
          transparent
          opacity={theme.contactShadow}
          depthWrite={false}
          toneMapped={false}
        />
      </Instanced>

      <Instanced count={racks.length} write={writeChassis} castShadow receiveShadow>
        <boxGeometry args={[RACK_W, 1, RACK_D]} />
        <meshStandardMaterial roughness={0.8} metalness={0.08} />
      </Instanced>

      <Instanced count={racks.length} write={writeTop} castShadow>
        <boxGeometry args={[RACK_W - 0.02, 0.028, RACK_D - 0.02]} />
        <meshStandardMaterial roughness={0.7} metalness={0.12} />
      </Instanced>

      <Instanced count={racks.length} write={writeFront}>
        <boxGeometry args={[RACK_W - 0.045, 1, 0.022]} />
        <meshStandardMaterial roughness={0.74} metalness={0.1} />
      </Instanced>

      <Instanced count={interior.length} write={writeInterior}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} metalness={0.05} />
      </Instanced>

      <Instanced count={unitLines.length} write={writeUnitLine}>
        <boxGeometry args={[RACK_W - 0.1, 0.013, 0.014]} />
        <meshStandardMaterial roughness={0.95} metalness={0} />
      </Instanced>

      <Instanced count={leds.length} write={writeLed} renderOrder={3}>
        <boxGeometry args={[0.019, 0.019, 0.012]} />
        <meshBasicMaterial toneMapped={false} />
      </Instanced>

      {theme.glow ? (
        <Instanced count={leds.length} write={writeGlow} renderOrder={4}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={glowMap}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </Instanced>
      ) : null}
    </group>
  );
};
