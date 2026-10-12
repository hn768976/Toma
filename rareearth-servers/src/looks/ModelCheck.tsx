import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { studioEnv } from "../engine/env";
import { PostSettings } from "../engine/Post";
import { CameraPose, Stage } from "../engine/Stage";
import { Nugget } from "../kit/ore";
import { Chip } from "./ChipOnOre";
import { BatteryPack, Modules } from "./EVBatteryPack";
import { ServerRack } from "./ServerStreams";

// Neutral grey turntable stills used for the model check (not deliverables).
export type ModelCheckProps = { object: "nugget" | "chip" | "battery" | "rack" };

const POST: PostSettings = {
  focus: 4,
  focusRange: 10,
  nearRamp: 10,
  farRamp: 10,
  maxBlur: 0,
  aoStrength: 0.5,
  aoRadius: 0.15,
  bloomStrength: 0.3,
  bloomThreshold: 1.2,
  bloomRadius: 0.55,
  exposure: 1,
  vignette: 0,
  grain: 0,
  period: 600,
};

const GreyStudio: React.FC = () => {
  const { gl, scene } = useThree();
  const env = useMemo(
    () =>
      studioEnv(gl, "grey", "#808080", 0.35, [
        { position: [0, 9, -4], size: [8, 4], color: "#ffffff", intensity: 4 },
        { position: [-7, 3, 4], size: [3, 5], color: "#ffffff", intensity: 1.5 },
        { position: [7, 4, 3], size: [3, 5], color: "#ffffff", intensity: 1.0 },
        { position: [4, 6, -6], size: [1.5, 1.5], color: "#ffffff", intensity: 8 },
        { position: [-4, 7, -5], size: [1.2, 3], color: "#fff4e6", intensity: 7 },
        { position: [0, 1.5, 8], size: [8, 0.8], color: "#ffffff", intensity: 2 },
      ]),
    [gl],
  );
  useLayoutEffect(() => {
    scene.userData.env = env;
  }, [scene, env]);
  return (
    <>
      <directionalLight position={[2, 5, -2]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#7a7a7a" roughness={0.8} />
      </mesh>
    </>
  );
};

export const ModelCheck: React.FC<ModelCheckProps> = ({ object }) => {
  const cams: Record<ModelCheckProps["object"], CameraPose> = {
    nugget: { position: [0, 1.6, 3.2], target: [0, 0.3, 0], fov: 30 },
    chip: { position: [0.6, 1.6, 2.2], target: [0, 0, 0], fov: 30 },
    battery: { position: [-2.0, 2.6, 3.6], target: [0, 0.1, 0], fov: 32 },
    rack: { position: [-2.4, 2.6, 4.6], target: [0, 0.9, 0], fov: 32 },
  };
  const camera = cams[object];
  return (
    <Stage camera={camera} post={POST} background="#808080">
      <GreyStudio />
      {object === "nugget" && (
        <Nugget
          spec={{ seed: 11, position: [0, 0.36, 0], scale: 0.62, rotY: 0.4, squash: [1.25, 0.7, 1.0] }}
          kind="iridescent"
        />
      )}
      {object === "chip" && <Chip glow="#4AA8FF" emissive={2.6} />}
      {object === "battery" && (
        <>
          <BatteryPack />
          <Modules color="#2A8AFF" frame={299} />
        </>
      )}
      {object === "rack" && <ServerRack frame={0} strip="#8AC8FF" />}
    </Stage>
  );
};
