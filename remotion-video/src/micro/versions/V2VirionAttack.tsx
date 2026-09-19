// Version 2 -- infection.
//
// Reference: a pale host cell alone in dark slate-teal fluid with a red haze
// low in the frame. Around two seconds in, red virions stream in from the
// left, curve onto the host and stick, until the cell is crusted with them.
//
// The virions are children of the host group, so once attached they ride its
// rotation for free. While still inbound their world-space position is pulled
// back into host space each frame, which keeps the hand-off seamless.

import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import {
  Group,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
  type BufferGeometry,
} from "three";
import { Backdrop } from "../components/Backdrop";
import { ThreeStage, type StageWorld } from "../gpu/ThreeStage";
import {
  fibonacciSphere,
  makeCellGeometry,
  makeCellMaterial,
  makeRimGlow,
} from "../lib/cells";
import { createNoise3D } from "../lib/noise";
import { applyLightRig } from "../lib/rig";
import { mulberry32, range } from "../lib/rng";
import { createBumpTexture } from "../lib/textures";
import { FPS } from "../constants";

const PALETTE = {
  host: "#a9c5c3",
  hostRim: "#d6efee",
  bystander: "#2f4a52",
  virion: "#b8322a",
  virionEmissive: "#5e130e",
  glow: "#63767f",
  surround: "#1a232a",
  haze: "#9c3430",
};

const HOST_RADIUS = 2.25;
const VIRION_COUNT = 72;

const LAYERS = [{ blur: 34 }, { blur: 0 }, { blur: 70 }];

interface Virion {
  mesh: Group;
  attachLocal: Vector3;
  approachStart: Vector3;
  control: Vector3;
  startFrame: number;
  travelFrames: number;
  spin: number;
  /** Per-virion size, so the crust does not read as regular polka dots. */
  size: number;
}

export const buildV2World = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): StageWorld => {
  const camera = new PerspectiveCamera(32, width / height, 0.1, 400);
  camera.position.set(0, 0, 19);
  camera.lookAt(0, 0, 0);

  const scenes = LAYERS.map(() => new Scene());
  for (const scene of scenes) {
    applyLightRig(scene, {
      ambient: { color: "#3f5a63", intensity: 0.5 },
      hemisphere: { sky: "#b9d6dc", ground: "#10181d", intensity: 0.8 },
      points: [
        { color: "#dff0f3", intensity: 640, position: [-6, 6, 10], decay: 2 },
        { color: "#8fb6c0", intensity: 300, position: [8, -2, -6], decay: 2 },
        // Warm bounce from the red haze sitting under the subject.
        { color: "#b8564a", intensity: 420, position: [-4, -7, 4], decay: 2 },
      ],
      fog: { color: "#1c262c", density: 0.02 },
    });
  }

  const rng = mulberry32(0x22b105);
  const noise = createNoise3D(2202);

  const hostBump = createBumpTexture("membrane", 5501, 3.4);
  const virionBump = createBumpTexture("pebbled", 5502, 5.5);

  // Host cell, the subject of the shot.
  const hostGeometry = makeCellGeometry({
    radius: HOST_RADIUS,
    segments: 144,
    seed: 401,
    lumpiness: 0.1,
    frequency: 3.0,
  });
  const hostGroup = new Group();
  hostGroup.add(
    new Mesh(
      hostGeometry,
      makeCellMaterial({
        color: PALETTE.host,
        emissive: "#22383c",
        emissiveIntensity: 0.3,
        roughness: 0.6,
        bumpMap: hostBump,
        bumpScale: 0.3,
      }),
    ),
  );
  hostGroup.add(makeRimGlow(hostGeometry, PALETTE.hostRim, 0.22, 1.05));
  scenes[1].add(hostGroup);

  // Bystander cells, nearly silhouettes against the background.
  const bystanderGeometry: BufferGeometry = makeCellGeometry({
    radius: 1,
    segments: 72,
    seed: 402,
    lumpiness: 0.11,
    frequency: 3.2,
  });
  const bystanders: { group: Group; base: Vector3; phase: number }[] = [];
  const bystanderSpecs: Array<[number, number, number, number, number]> = [
    [-7.2, 3.9, -4, 0.62, 1],
    [6.8, 3.4, -5, 0.5, 1],
    [7.6, -2.6, -3.5, 0.72, 1],
    [-6.4, -3.8, -6, 0.55, 1],
    [-9.5, 6.2, -10, 1.5, 0],
    [9.8, -6.0, -11, 1.7, 0],
  ];
  for (const [x, y, z, r, layer] of bystanderSpecs) {
    const group = new Group();
    group.add(
      new Mesh(
        bystanderGeometry,
        makeCellMaterial({
          color: PALETTE.bystander,
          emissive: "#0f181c",
          emissiveIntensity: 0.4,
          roughness: 0.7,
          bumpMap: hostBump,
          bumpScale: 0.22,
        }),
      ),
    );
    group.add(makeRimGlow(bystanderGeometry, "#7fa8b0", 0.14, 1.06));
    group.scale.setScalar(r);
    group.position.set(x, y, z);
    scenes[layer].add(group);
    bystanders.push({ group, base: new Vector3(x, y, z), phase: rng() * 80 });
  }

  // Virions. One shared shell, instanced by hand so each can be moved alone.
  const virionGeometry = makeCellGeometry({
    radius: 0.165,
    segments: 40,
    seed: 403,
    lumpiness: 0.16,
    frequency: 5.0,
  });
  const attachDirections = fibonacciSphere(VIRION_COUNT);
  const virions: Virion[] = [];

  for (let i = 0; i < VIRION_COUNT; i++) {
    const group = new Group();
    group.add(
      new Mesh(
        virionGeometry,
        makeCellMaterial({
          color: PALETTE.virion,
          emissive: PALETTE.virionEmissive,
          emissiveIntensity: 0.9,
          roughness: 0.45,
          bumpMap: virionBump,
          bumpScale: 0.12,
        }),
      ),
    );
    group.add(makeRimGlow(virionGeometry, "#ff8a72", 0.3, 1.16));
    hostGroup.add(group);

    const dir = attachDirections[i];
    // Bias attachment towards the camera-facing left hemisphere, where the
    // swarm arrives, so the crust builds up visibly rather than behind.
    const attachLocal = dir
      .clone()
      .add(new Vector3(-0.35, 0, 0.25))
      .normalize()
      .multiplyScalar(HOST_RADIUS * 1.02);

    virions.push({
      mesh: group,
      attachLocal,
      approachStart: new Vector3(
        range(rng, -22, -15),
        range(rng, -5, 6),
        range(rng, -4, 5),
      ),
      control: new Vector3(
        range(rng, -11, -5),
        range(rng, -4, 7),
        range(rng, 2, 8),
      ),
      startFrame: 54 + i * 3.1 + range(rng, -6, 6),
      travelFrames: range(rng, 62, 88),
      spin: range(rng, -2.4, 2.4),
      size: range(rng, 0.72, 1.34),
    });
  }

  const worldPoint = new Vector3();
  const a = new Vector3();
  const b = new Vector3();

  const update = (frame: number) => {
    const t = frame / FPS;

    hostGroup.position.set(
      noise(10, t * 0.13, 0) * 0.35,
      -0.1 + noise(0, 20, t * 0.12) * 0.3,
      0,
    );
    hostGroup.rotation.set(t * 0.035, t * 0.075, t * 0.02);
    hostGroup.updateMatrixWorld(true);

    for (const v of virions) {
      const progress = Math.min(
        1,
        Math.max(0, (frame - v.startFrame) / v.travelFrames),
      );

      if (progress >= 1) {
        // Locked to the membrane, carried by the host's own rotation.
        v.mesh.position.copy(v.attachLocal);
        v.mesh.scale.setScalar(v.size);
      } else if (progress <= 0) {
        v.mesh.scale.setScalar(0);
      } else {
        // Ease-out so the virions decelerate as they make contact.
        const e = 1 - Math.pow(1 - progress, 2.4);
        const attachWorld = v.attachLocal.clone();
        hostGroup.localToWorld(attachWorld);

        // Quadratic bezier: start -> control -> attachment point.
        a.lerpVectors(v.approachStart, v.control, e);
        b.lerpVectors(v.control, attachWorld, e);
        worldPoint.lerpVectors(a, b, e);

        hostGroup.worldToLocal(worldPoint);
        v.mesh.position.copy(worldPoint);
        v.mesh.scale.setScalar(v.size * Math.min(1, e * 3));
      }

      v.mesh.rotation.set(0, v.spin * t, 0);
    }

    for (const by of bystanders) {
      by.group.position.set(
        by.base.x + noise(by.phase, t * 0.1, 0) * 0.5,
        by.base.y + noise(0, by.phase, t * 0.09) * 0.5,
        by.base.z,
      );
      by.group.rotation.y = t * 0.05 + by.phase;
    }

    camera.position.set(0, 0, 19 - t * 0.12);
    camera.lookAt(0, 0, 0);
  };

  return {
    camera,
    layers: scenes.map((scene, i) => ({ scene, blur: LAYERS[i].blur })),
    update,
    dispose: () => {
      hostGeometry.dispose();
      bystanderGeometry.dispose();
      virionGeometry.dispose();
      hostBump.dispose();
      virionBump.dispose();
    },
  };
};

export const V2VirionAttack: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Backdrop
        glow={PALETTE.glow}
        surround={PALETTE.surround}
        center={[48, 46]}
        radius={66}
        wash={{ color: PALETTE.haze, center: [34, 66], radius: 88, opacity: 0.5 }}
        vignette={0.42}
      />
      <ThreeStage width={width} height={height} build={buildV2World} />
    </AbsoluteFill>
  );
};
