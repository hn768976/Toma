// Version 1 -- blue blastocysts, backlit.
//
// Reference: cool blue fluid with a bright hotspot sitting just behind the
// subject, one hero morula in the middle, a scatter of smaller bodies, and
// very large out-of-focus cells drifting through the near and far planes.
// Faint concentric ripples spread from the light.

import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  type BufferGeometry,
  type Texture,
} from "three";
import { Backdrop } from "../components/Backdrop";
import { ThreeStage, type StageWorld } from "../gpu/ThreeStage";
import { makeCellGeometry, makeCellMaterial, makeRimGlow } from "../lib/cells";
import { createNoise3D } from "../lib/noise";
import { applyLightRig } from "../lib/rig";
import { mulberry32, range } from "../lib/rng";
import { createBumpTexture } from "../lib/textures";
import { FPS } from "../constants";

const PALETTE = {
  cell: "#b7d9f0",
  cellDeep: "#7aa8d2",
  rim: "#dbeeff",
  glow: "#e8f4fd",
  surround: "#37699c",
  key: "#eaf5ff",
};

interface Body {
  group: Group;
  basePosition: [number, number, number];
  drift: [number, number, number];
  spin: [number, number, number];
  phase: number;
  bob: number;
}

const LAYERS = [
  { blur: 30 }, // far
  { blur: 5 }, // focus -- the reference is soft even where it is sharp
  { blur: 64 }, // near
];

export const buildV1World = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): StageWorld => {
  const camera = new PerspectiveCamera(34, width / height, 0.1, 400);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);

  const scenes = LAYERS.map(() => new Scene());
  for (const scene of scenes) {
    applyLightRig(scene, {
      ambient: { color: "#7fb2dd", intensity: 0.85 },
      hemisphere: { sky: "#e8f5ff", ground: "#1d456e", intensity: 1.1 },
      points: [
        // The hotspot behind the subject that gives every cell its bright rim.
        { color: PALETTE.key, intensity: 900, position: [2.5, 1.2, -14], decay: 2 },
        { color: "#9fd0f5", intensity: 260, position: [-9, 5, 9], decay: 2 },
      ],
      fog: { color: "#3a6d9f", density: 0.016 },
    });
  }

  const rng = mulberry32(0x51fe01);
  const noise = createNoise3D(1201);

  // A few shared shells, re-used at different scales across the field.
  const bumpMaps: Texture[] = [
    createBumpTexture("pebbled", 4401, 3.1),
    createBumpTexture("pebbled", 4402, 4.0),
    createBumpTexture("membrane", 4403, 2.4),
  ];
  const shells: BufferGeometry[] = [
    makeCellGeometry({ radius: 1, segments: 120, seed: 91, lumpiness: 0.1, frequency: 3.1 }),
    makeCellGeometry({ radius: 1, segments: 120, seed: 92, lumpiness: 0.13, frequency: 2.6 }),
    makeCellGeometry({ radius: 1, segments: 96, seed: 93, lumpiness: 0.09, frequency: 3.6 }),
  ];

  const bodies: Body[] = [];

  const addCell = (
    layer: number,
    position: [number, number, number],
    radius: number,
    variant: number,
    tint: string,
    rimOpacity: number,
  ) => {
    const geometry = shells[variant % shells.length];
    const mesh = new Mesh(
      geometry,
      makeCellMaterial({
        color: tint,
        emissive: "#2b6396",
        emissiveIntensity: 0.22,
        roughness: 0.52,
        bumpMap: bumpMaps[variant % bumpMaps.length],
        bumpScale: 0.3,
      }),
    );
    const group = new Group();
    group.add(mesh);
    group.add(makeRimGlow(geometry, PALETTE.rim, rimOpacity, 1.16));
    group.scale.setScalar(radius);
    group.position.set(...position);
    scenes[layer].add(group);

    bodies.push({
      group,
      basePosition: position,
      drift: [range(rng, -0.05, 0.12), range(rng, 0.03, 0.14), range(rng, -0.04, 0.04)],
      spin: [range(rng, -0.06, 0.06), range(rng, -0.09, 0.09), range(rng, -0.05, 0.05)],
      phase: rng() * 100,
      bob: range(rng, 0.1, 0.32),
    });
  };

  // Hero cell, slightly off-centre and right in the light.
  addCell(1, [-0.4, -0.2, 0], 2.05, 0, PALETTE.cell, 0.15);
  // Mid-field companions.
  addCell(1, [4.1, 1.6, -2.2], 1.05, 1, PALETTE.cell, 0.14);
  addCell(1, [-5.2, 1.9, -1.4], 1.25, 2, PALETTE.cell, 0.13);
  addCell(1, [2.6, -2.9, -1.0], 0.62, 1, PALETTE.cell, 0.12);
  addCell(1, [-3.4, -3.2, -2.6], 0.5, 0, PALETTE.cell, 0.12);
  addCell(1, [6.0, -1.1, -3.4], 0.42, 2, PALETTE.cell, 0.11);

  // Far plane: bigger, dimmer, heavily blurred.
  addCell(0, [-7.4, 4.6, -9], 2.6, 1, PALETTE.cellDeep, 0.06);
  addCell(0, [7.8, -4.2, -8], 3.1, 0, PALETTE.cellDeep, 0.06);
  addCell(0, [0.5, 6.2, -12], 2.0, 2, PALETTE.cellDeep, 0.05);

  // Near plane: huge cells clipping the frame edges.
  addCell(2, [7.2, -6.4, 7.5], 3.4, 0, PALETTE.cell, 0.12);
  addCell(2, [-8.6, 5.4, 6.0], 2.8, 2, PALETTE.cell, 0.1);

  // Ripples spreading from the hotspot, kept faint and in the far layer.
  const rings: { mesh: Mesh; phase: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const geometry = new RingGeometry(1, 1.012, 160);
    const mesh = new Mesh(
      geometry,
      new MeshBasicMaterial({
        color: new Color("#cfe7fa"),
        transparent: true,
        opacity: 0.07,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    mesh.position.set(1.4, 0.5, -6);
    scenes[0].add(mesh);
    rings.push({ mesh, phase: i / 4 });
  }

  const update = (frame: number) => {
    const t = frame / FPS;

    for (const body of bodies) {
      const [bx, by, bz] = body.basePosition;
      const n = noise(body.phase, t * 0.16, 0);
      body.group.position.set(
        bx + body.drift[0] * t + n * body.bob,
        by + body.drift[1] * t + noise(0, body.phase, t * 0.14) * body.bob,
        bz + body.drift[2] * t,
      );
      body.group.rotation.set(
        body.spin[0] * t,
        body.spin[1] * t,
        body.spin[2] * t,
      );
    }

    for (const ring of rings) {
      // Each ring expands and fades on its own offset cycle.
      const cycle = (t * 0.1 + ring.phase) % 1;
      const scale = 2 + cycle * 16;
      ring.mesh.scale.setScalar(scale);
      (ring.mesh.material as MeshBasicMaterial).opacity =
        0.075 * Math.sin(cycle * Math.PI);
    }

    // Very slow push towards the subject.
    camera.position.set(0, 0, 20 - t * 0.16);
    camera.lookAt(0, 0, 0);
  };

  return {
    camera,
    layers: scenes.map((scene, i) => ({ scene, blur: LAYERS[i].blur })),
    update,
    dispose: () => {
      shells.forEach((g) => g.dispose());
      bumpMaps.forEach((m) => m.dispose());
    },
  };
};

export const V1BlueCells: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Backdrop
        glow={PALETTE.glow}
        surround={PALETTE.surround}
        center={[54, 46]}
        radius={58}
        vignette={0.3}
      />
      <ThreeStage width={width} height={height} build={buildV1World} />
    </AbsoluteFill>
  );
};
