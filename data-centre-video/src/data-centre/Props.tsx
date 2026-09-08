/**
 * A handful of detail props so the facility does not read as a pure grid: a
 * floor-standing unit at the end of a couple of rows, a wall panel behind
 * the back row, and a cable spool parked in an aisle.
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import { easeOutBack, progress } from "./anim";
import { T } from "./constants";
import type { Layout, Prop } from "./layout";
import type { Theme } from "./theme";

const riseOf = (prop: Prop, frame: number) => {
  const p = progress(frame, prop.delay, T.propRise);
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return Math.max(easeOutBack(p), 0.0001);
};

const FloorUnit: React.FC<{ prop: Prop; theme: Theme; s: number }> = ({
  prop,
  theme,
  s,
}) => (
  <group position={[prop.x, 0, prop.z]}>
    <mesh position={[0, (prop.h * s) / 2, 0]} scale={[1, prop.h * s, 1]} castShadow receiveShadow>
      <boxGeometry args={[prop.w, 1, prop.d]} />
      <meshStandardMaterial color={theme.propBody} roughness={0.8} metalness={0.08} />
    </mesh>
    <mesh
      position={[0, (prop.h * s) / 2, prop.d / 2 + 0.012]}
      scale={[1, (prop.h - 0.12) * s, 1]}
    >
      <boxGeometry args={[prop.w - 0.08, 1, 0.024]} />
      <meshStandardMaterial color={theme.propPanel} roughness={0.75} metalness={0.1} />
    </mesh>
    <mesh position={[0, prop.h * s * 0.78, prop.d / 2 + 0.03]}>
      <boxGeometry args={[prop.w - 0.24, 0.02, 0.014]} />
      <meshBasicMaterial color={theme.propAccent} toneMapped={false} />
    </mesh>
    <mesh position={[0, prop.h * s + 0.016, 0]} castShadow>
      <boxGeometry args={[prop.w - 0.03, 0.03, prop.d - 0.03]} />
      <meshStandardMaterial color={theme.chassisTop} roughness={0.7} metalness={0.12} />
    </mesh>
  </group>
);

const WallPanel: React.FC<{ prop: Prop; theme: Theme; s: number }> = ({
  prop,
  theme,
  s,
}) => (
  <group position={[prop.x, 0, prop.z]}>
    <mesh position={[0, (prop.h * s) / 2, 0]} scale={[1, prop.h * s, 1]} castShadow receiveShadow>
      <boxGeometry args={[prop.w, 1, prop.d]} />
      <meshStandardMaterial color={theme.wall} roughness={0.9} metalness={0.03} />
    </mesh>
    {[-1, 1].map((side) => (
      <mesh
        key={side}
        position={[side * prop.w * 0.23, prop.h * s * 0.58, prop.d / 2 + 0.01]}
        scale={[1, s, 1]}
      >
        <boxGeometry args={[prop.w * 0.34, prop.h * 0.5, 0.02]} />
        <meshStandardMaterial color={theme.propPanel} roughness={0.8} metalness={0.06} />
      </mesh>
    ))}
  </group>
);

const Spool: React.FC<{ prop: Prop; theme: Theme; s: number }> = ({
  prop,
  theme,
  s,
}) => (
  <group position={[prop.x, prop.w / 2, prop.z]} rotation={[0, prop.rotY, Math.PI / 2]} scale={s}>
    <mesh castShadow receiveShadow>
      <cylinderGeometry args={[prop.w / 2, prop.w / 2, 0.045, 20]} />
      <meshStandardMaterial color={theme.spool} roughness={0.85} metalness={0.05} />
    </mesh>
    <mesh position={[0, prop.d, 0]} castShadow>
      <cylinderGeometry args={[prop.w / 2, prop.w / 2, 0.045, 20]} />
      <meshStandardMaterial color={theme.spool} roughness={0.85} metalness={0.05} />
    </mesh>
    <mesh position={[0, prop.d / 2, 0]} castShadow>
      <cylinderGeometry args={[prop.w * 0.36, prop.w * 0.36, prop.d, 20]} />
      <meshStandardMaterial color={theme.propBody} roughness={0.9} metalness={0.03} />
    </mesh>
  </group>
);

export const Props: React.FC<{ layout: Layout; theme: Theme }> = ({
  layout,
  theme,
}) => {
  const frame = useCurrentFrame();

  return (
    <group>
      {layout.props.map((prop, i) => {
        const s = riseOf(prop, frame);
        if (s <= 0) return null;
        if (prop.kind === "unit")
          return <FloorUnit key={i} prop={prop} theme={theme} s={s} />;
        if (prop.kind === "wall")
          return <WallPanel key={i} prop={prop} theme={theme} s={s} />;
        return <Spool key={i} prop={prop} theme={theme} s={s} />;
      })}
    </group>
  );
};
