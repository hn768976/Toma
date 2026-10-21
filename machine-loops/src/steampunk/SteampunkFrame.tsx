import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { ThreeStage } from "../lib/ThreeStage";
import { linearKey } from "../lib/pipeline";
import { buildMachine, setupEnvironment } from "./build";

export type SteampunkFrameProps = { background: "white" | "green" };

const BG = { white: linearKey(1, 1, 1), green: linearKey(0, 1, 0) };

const Lights: React.FC = () => {
  const { gl, scene } = useThree();
  const key = useMemo(() => {
    const l = new THREE.DirectionalLight(0xffffff, 3.2);
    l.position.set(-4.5, 5.5, 7);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -2.4; c.right = 2.4; c.top = 1.8; c.bottom = -1.8; c.near = 1; c.far = 20;
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.01;
    l.shadow.radius = 6;
    return l;
  }, []);
  const rim = useMemo(() => {
    const l = new THREE.DirectionalLight(0xfff1e0, 2.2);
    l.position.set(4, 3, -5);
    return l;
  }, []);
  const fill = useMemo(() => new THREE.HemisphereLight(0xf2f4ff, 0x40362e, 0.22), []);
  useLayoutEffect(() => setupEnvironment(gl, scene), [gl, scene]);
  return (
    <>
      <primitive object={key} />
      <primitive object={rim} />
      <primitive object={fill} />
    </>
  );
};

export const SteampunkFrame: React.FC<SteampunkFrameProps> = ({ background }) => {
  const frame = useCurrentFrame();
  const machine = useMemo(() => buildMachine(), []);
  useLayoutEffect(() => machine.update(frame), [frame, machine]);
  return (
    <AbsoluteFill>
      <ThreeStage background={BG[background]} fov={20} position={[0, 0.04, 12.5]} target={[0, 0.04, 0]}>
        <Lights />
        <primitive object={machine.root} />
      </ThreeStage>
    </AbsoluteFill>
  );
};
