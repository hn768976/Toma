import { AbsoluteFill, useVideoConfig, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { HeroPill } from "../scene/Pill";
import { Cyclorama } from "../scene/Backdrop";
import { LightRig } from "../scene/Rig";
import { SINGLE_ROWS } from "../data/looks";
import { PillMaterial } from "../lib/pill-material";
import { GEOM } from "../lib/pill-geometry";

const row = SINGLE_ROWS[0];

const unpatched = () => {
  const m = new PillMaterial({ color: "#e05030" });
  (m as unknown as { onBeforeCompile: undefined }).onBeforeCompile = undefined;
  return m;
};

export const Smoke: React.FC<{ variant: number }> = ({ variant }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const canvasProps =
    variant >= 1
      ? ({ flat: true, shadows: true, gl: { antialias: true, alpha: false } } as const)
      : ({} as const);
  return (
    <AbsoluteFill style={{ backgroundColor: "#203040" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={1}
        {...canvasProps}
        camera={{ fov: 22, position: [0, 0, 20], near: 0.5, far: 200 }}
      >
        {variant >= 3 ? (
          <LightRig rig={row.rig} />
        ) : (
          <>
            <ambientLight intensity={2} />
            <directionalLight position={[3, 5, 4]} intensity={3} />
          </>
        )}
        {variant >= 4 ? <Cyclorama {...row.backdrop!} /> : null}
        {variant === 8 ? (
          <mesh position={[-2.6, 0.2, 0]}>
            <boxGeometry args={[2, 2, 2]} />
            <meshPhysicalMaterial color="#e05030" roughness={0.3} metalness={0} clearcoat={0.6} />
          </mesh>
        ) : variant === 9 ? (
          <mesh position={[-2.6, 0.2, 0]}>
            <boxGeometry args={[2, 2, 2]} />
            <primitive object={unpatched()} attach="material" />
          </mesh>
        ) : variant === 5 ? (
          <mesh position={[-2.6, 0.2, 0]}>
            <boxGeometry args={[2, 2, 2]} />
            <primitive object={new PillMaterial({ color: "#e05030" })} attach="material" />
          </mesh>
        ) : variant === 6 ? (
          <mesh position={[-2.6, 0.2, 0]} geometry={GEOM.capsuleBody} scale={0.9}>
            <meshStandardMaterial color="#e05030" />
          </mesh>
        ) : variant === 7 ? (
          <mesh position={[-2.6, 0.2, 0]} geometry={GEOM.tabletPlain} scale={2}>
            <meshStandardMaterial color="#e05030" />
          </mesh>
        ) : variant >= 2 ? (
          <group position={[-2.6, 0.2, 0]} rotation={[0.2, frame * 0.02, 0.5]} scale={0.644}>
            <HeroPill shape="capsule" colourway={row.colourway} matte={false} />
          </group>
        ) : (
          <mesh position={[-2.6, 0.2, 0]}>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="#e05030" />
          </mesh>
        )}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
