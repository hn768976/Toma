// Version 5 -- amber field.
//
// Reference: a crowded drift of fibrous olive microbes lit from behind by a
// warm amber pool, everything falling away into a near-black vignette at the
// corners. No event, no camera move to speak of: the shot is pure texture and
// slow parallax, so the surface detail carries it.

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
  cell: "#6d7248",
  cellDeep: "#4a4a2c",
  rim: "#d9b568",
  glow: "#8a5410",
  surround: "#090601",
};

const LAYERS = [{ blur: 30 }, { blur: 0 }, { blur: 62 }];

interface Body {
  group: Group;
  x: number;
  y: number;
  z: number;
  driftX: number;
  driftY: number;
  spin: [number, number, number];
  phase: number;
  spanX: number;
  spanY: number;
}

export const buildV5World = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): StageWorld => {
  const camera = new PerspectiveCamera(38, width / height, 0.1, 400);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);

  const scenes = LAYERS.map(() => new Scene());
  for (const scene of scenes) {
    applyLightRig(scene, {
      ambient: { color: "#5a3f18", intensity: 0.55 },
      hemisphere: { sky: "#ffd58a", ground: "#050300", intensity: 0.75 },
      points: [
        // The amber pool sits behind the field and rims every body.
        { color: "#ffb347", intensity: 1100, position: [0.5, -0.5, -13], decay: 2 },
        { color: "#ffe3ab", intensity: 240, position: [-9, 7, 9], decay: 2 },
        { color: "#8a6a30", intensity: 180, position: [10, -7, 6], decay: 2 },
      ],
      fog: { color: "#140c02", density: 0.026 },
    });
  }

  const rng = mulberry32(0x55e013);
  const noise = createNoise3D(5505);

  const bumps = [
    createBumpTexture("fibrous", 8801, 5.2),
    createBumpTexture("fibrous", 8802, 7.0),
    createBumpTexture("fibrous", 8803, 3.9),
  ];
  const shells: BufferGeometry[] = [
    makeCellGeometry({ radius: 1, segments: 96, seed: 901, lumpiness: 0.1, frequency: 3.2, ridged: true }),
    makeCellGeometry({ radius: 1, segments: 96, seed: 902, lumpiness: 0.12, frequency: 2.6 }),
    makeCellGeometry({ radius: 1, segments: 72, seed: 903, lumpiness: 0.09, frequency: 4.1, ridged: true }),
    makeCellGeometry({ radius: 1, segments: 72, seed: 904, lumpiness: 0.13, frequency: 3.0 }),
  ];

  const bodies: Body[] = [];
  const spawn = (layer: number, count: number, zRange: [number, number], scaleRange: [number, number], spanX: number, spanY: number) => {
    for (let i = 0; i < count; i++) {
      const variant = Math.floor(rng() * shells.length);
      const geometry = shells[variant];
      const group = new Group();
      group.add(
        new Mesh(
          geometry,
          makeCellMaterial({
            color: layer === 0 ? PALETTE.cellDeep : PALETTE.cell,
            emissive: "#2a1d05",
            emissiveIntensity: 0.55,
            roughness: 0.78,
            bumpMap: bumps[variant % bumps.length],
            bumpScale: 0.42,
          }),
        ),
      );
      group.add(makeRimGlow(geometry, PALETTE.rim, layer === 0 ? 0.12 : 0.2, 1.05));
      group.scale.setScalar(range(rng, scaleRange[0], scaleRange[1]));
      scenes[layer].add(group);

      bodies.push({
        group,
        x: range(rng, -spanX, spanX),
        y: range(rng, -spanY, spanY),
        z: range(rng, zRange[0], zRange[1]),
        driftX: range(rng, 0.05, 0.28),
        driftY: range(rng, -0.26, -0.06),
        spin: [range(rng, -0.09, 0.09), range(rng, -0.12, 0.12), range(rng, -0.07, 0.07)],
        phase: rng() * 120,
        spanX,
        spanY,
      });
    }
  };

  // Deep, mid and foreground populations. The near plane is sparse on purpose:
  // a couple of huge soft shapes are enough to sell the depth.
  spawn(0, 22, [-16, -9], [0.9, 2.4], 20, 13);
  spawn(1, 26, [-5, 1], [0.35, 1.3], 13, 8.5);
  spawn(2, 5, [6, 9], [1.8, 3.2], 12, 8);

  const update = (frame: number) => {
    const t = frame / FPS;

    for (const body of bodies) {
      // Bodies scroll out of frame and reappear on the opposite edge, which
      // keeps the field looking equally dense from first frame to last.
      const x = wrapRange(
        body.x + body.driftX * t + noise(body.phase, t * 0.11, 0) * 0.55,
        -body.spanX - 3,
        body.spanX + 3,
      );
      const y = wrapRange(
        body.y + body.driftY * t + noise(0, body.phase, t * 0.1) * 0.55,
        -body.spanY - 3,
        body.spanY + 3,
      );
      body.group.position.set(x, y, body.z);
      body.group.rotation.set(body.spin[0] * t, body.spin[1] * t, body.spin[2] * t);
    }

    camera.position.set(
      noise(900, t * 0.07, 0) * 0.3,
      noise(0, 900, t * 0.06) * 0.25,
      20 - t * 0.1,
    );
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

export const V5AmberField: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Backdrop
        glow={PALETTE.glow}
        surround={PALETTE.surround}
        center={[50, 50]}
        radius={64}
        vignette={0.55}
      />
      <ThreeStage width={width} height={height} build={buildV5World} />
    </AbsoluteFill>
  );
};
