// Realism gate: the robot hand alone on a dark blue background, three views
// (frame 0 = front, 1 = three-quarter, 2 = from slightly below).
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { buildBackground } from "./scene/background";
import { buildEnvironment } from "./scene/environment";
import { buildHand } from "./scene/hand";
import { buildLights } from "./scene/lights";
import { buildHandMaterials } from "./scene/materials";
import { RenderRefs, Stage } from "./scene/Stage";
import { VERSIONS } from "./versions";

const palette = VERSIONS[0].palette;
const DEG = Math.PI / 180;

const VIEWS = [
  { yaw: -24, elev: 40, dist: 4.6 },
  { yaw: -58, elev: 28, dist: 4.6 },
  { yaw: -25, elev: -12, dist: 4.6 },
];

const StudyScene: React.FC<{ refs: RenderRefs }> = ({ refs }) => {
  const gl = useThree((s) => s.gl);
  const frame = useCurrentFrame();
  const objs = useMemo(() => {
    const env = buildEnvironment(gl, palette);
    const hand = buildHand(buildHandMaterials(palette, env));
    const bg = buildBackground();
    bg.material.uniforms.uBase.value.set("#04122c");
    bg.material.uniforms.uGlow.value.set(palette.glow);
    bg.material.uniforms.uGlowStrength.value = 0.6;
    const lights = buildLights(palette);
    lights.cube.intensity = 1.2;
    lights.cube.position.set(0, 0.9, 0.1);
    const group = new THREE.Group();
    group.add(bg.mesh, hand.root, lights.group);
    return { group, hand };
  }, [gl]);

  useLayoutEffect(() => {
    const v = VIEWS[Math.min(frame, VIEWS.length - 1)];
    const cam = refs.camera;
    const target = new THREE.Vector3(0, 0.15, 0.35);
    cam.position.set(
      target.x + v.dist * Math.cos(v.elev * DEG) * Math.sin(v.yaw * DEG),
      target.y + v.dist * Math.sin(v.elev * DEG),
      target.z + v.dist * Math.cos(v.elev * DEG) * Math.cos(v.yaw * DEG),
    );
    cam.lookAt(target);
    cam.updateMatrixWorld();
    objs.hand.setPose([0, 0, 0, 0, 0]);
  }, [frame, objs, refs]);

  return <primitive object={objs.group} />;
};

export const HandStudy: React.FC = () => {
  const refs = useMemo<RenderRefs>(() => {
    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
    return {
      camera,
      hudScene: null,
      params: {
        frameMod: 0,
        focus: 6,
        focusBand: 0,
        nearK: 0,
        farK: 0,
        maxCoc: 0,
        dof: false,
        bloomStrength: 0.25,
        bloomThreshold: 1.2,
        exposure: 1,
        grain: 0.015,
        vignette: 0.25,
      },
    };
  }, []);
  return (
    <AbsoluteFill>
      <Stage refs={refs}>
        <StudyScene refs={refs} />
      </Stage>
    </AbsoluteFill>
  );
};
