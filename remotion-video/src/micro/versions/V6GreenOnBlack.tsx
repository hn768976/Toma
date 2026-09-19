// Version 6 -- green cells on black.
//
// Reference: an isolated element. Pure black, no fluid, no fog -- just bright
// green cells at wildly different sizes sinking through frame, each with a hot
// rim and a visibly textured membrane.
//
// Because there is no background to hide in, this one lives or dies on the
// silhouette and the rim light, so the cells carry more geometric displacement
// than anywhere else in the set and the glow shell is pushed harder.

import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Group, Mesh, PerspectiveCamera, Scene, type BufferGeometry } from "three";
import { Backdrop } from "../components/Backdrop";
import { ThreeStage, type StageWorld } from "../gpu/ThreeStage";
import { makeCellGeometry, makeCellMaterial, makeRimGlow } from "../lib/cells";
import { createNoise3D } from "../lib/noise";
import { applyLightRig, wrapRange } from "../lib/rig";
import { mulberry32, range } from "../lib/rng";
import { createBumpTexture } from "../lib/textures";
import { FPS } from "../constants";

const PALETTE = {
  cell: "#2f9e3f",
  cellBright: "#4dc257",
  rim: "#9bf08a",
};

const LAYERS = [{ blur: 24 }, { blur: 0 }, { blur: 56 }];

interface Body {
  group: Group;
  x: number;
  y: number;
  z: number;
  fall: number;
  driftX: number;
  spin: [number, number, number];
  phase: number;
  spanY: number;
}

export const buildV6World = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): StageWorld => {
  const camera = new PerspectiveCamera(40, width / height, 0.1, 400);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);

  const scenes = LAYERS.map(() => new Scene());
  for (const scene of scenes) {
    applyLightRig(scene, {
      // No fog and almost no fill: everything that is not lit stays pure black,
      // which is what gives the reference its cut-out look.
      ambient: { color: "#0d3a12", intensity: 0.35 },
      points: [
        { color: "#eaffd8", intensity: 700, position: [-7, 7, 9], decay: 2 },
        { color: "#6cff8a", intensity: 420, position: [8, -5, 5], decay: 2 },
        { color: "#2f8f3a", intensity: 520, position: [0, 0, -12], decay: 2 },
      ],
    });
  }

  const rng = mulberry32(0x66f017);
  const noise = createNoise3D(6606);

  const bumps = [
    createBumpTexture("membrane", 9901, 3.6),
    createBumpTexture("pebbled", 9902, 4.8),
  ];
  const shells: BufferGeometry[] = [
    makeCellGeometry({ radius: 1, segments: 112, seed: 1001, lumpiness: 0.09, frequency: 2.9 }),
    makeCellGeometry({ radius: 1, segments: 112, seed: 1002, lumpiness: 0.12, frequency: 2.3 }),
    makeCellGeometry({ radius: 1, segments: 80, seed: 1003, lumpiness: 0.07, frequency: 3.8 }),
  ];

  const bodies: Body[] = [];
  const spawn = (
    layer: number,
    count: number,
    zRange: [number, number],
    scaleRange: [number, number],
    spanX: number,
    spanY: number,
    fallRange: [number, number],
  ) => {
    for (let i = 0; i < count; i++) {
      const variant = Math.floor(rng() * shells.length);
      const geometry = shells[variant];
      const group = new Group();
      group.add(
        new Mesh(
          geometry,
          makeCellMaterial({
            color: rng() > 0.5 ? PALETTE.cell : PALETTE.cellBright,
            emissive: "#10521a",
            emissiveIntensity: 0.75,
            roughness: 0.5,
            bumpMap: bumps[variant % bumps.length],
            bumpScale: 0.3,
          }),
        ),
      );
      group.add(makeRimGlow(geometry, PALETTE.rim, 0.3, 1.07));
      group.scale.setScalar(range(rng, scaleRange[0], scaleRange[1]));
      scenes[layer].add(group);

      bodies.push({
        group,
        x: range(rng, -spanX, spanX),
        y: range(rng, -spanY, spanY),
        z: range(rng, zRange[0], zRange[1]),
        fall: range(rng, fallRange[0], fallRange[1]),
        driftX: range(rng, -0.1, 0.16),
        spin: [range(rng, -0.12, 0.12), range(rng, -0.16, 0.16), range(rng, -0.1, 0.1)],
        phase: rng() * 140,
        spanY,
      });
    }
  };

  // A wide spread of sizes, from specks to cells that fill a third of frame.
  spawn(0, 14, [-12, -6], [0.12, 0.5], 18, 11, [-0.5, -0.2]);
  spawn(1, 16, [-3, 2], [0.18, 1.15], 12, 8, [-0.85, -0.35]);
  spawn(2, 4, [7, 10], [0.9, 1.8], 11, 7.5, [-1.3, -0.7]);

  const update = (frame: number) => {
    const t = frame / FPS;

    for (const body of bodies) {
      const y = wrapRange(
        body.y + body.fall * t + noise(0, body.phase, t * 0.12) * 0.4,
        -body.spanY - 3,
        body.spanY + 3,
      );
      body.group.position.set(
        body.x + body.driftX * t + noise(body.phase, t * 0.13, 0) * 0.45,
        y,
        body.z,
      );
      body.group.rotation.set(body.spin[0] * t, body.spin[1] * t, body.spin[2] * t);
    }

    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);
  };

  return {
    camera,
    layers: scenes.map((scene, i) => ({ scene, blur: LAYERS[i].blur })),
    update,
    dispose: () => {
      shells.forEach((g) => g.dispose());
      bumps.forEach((b) => b.dispose());
    },
  };
};

export const V6GreenOnBlack: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Backdrop glow="#000000" surround="#000000" radius={0} />
      <ThreeStage width={width} height={height} build={buildV6World} />
    </AbsoluteFill>
  );
};
