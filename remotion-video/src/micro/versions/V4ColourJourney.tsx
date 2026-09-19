// Version 4 -- the colour journey.
//
// Reference: the shot travels through four moods in ten seconds. It opens in
// amber on near-black, warms to gold, cools through olive, turns teal, and
// finally clears into plain blue water with nothing left but a few bubbles.
//
// Both the CSS backdrop and the cell materials read from the same keyframe
// table, so the fluid and the bodies in it always change colour together.

import React from "react";
import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  type BufferGeometry,
} from "three";
import { Backdrop } from "../components/Backdrop";
import { ThreeStage, type StageWorld } from "../gpu/ThreeStage";
import { makeCellGeometry, makeCellMaterial, makeRimGlow } from "../lib/cells";
import { createNoise3D } from "../lib/noise";
import { applyLightRig } from "../lib/rig";
import { mulberry32, range } from "../lib/rng";
import { createBumpTexture } from "../lib/textures";
import { FPS, VERSION_DURATIONS } from "../constants";

/** Keyframes, in frames at 30fps, across the 300-frame shot. */
const STOPS = [0, 96, 150, 198, 260, VERSION_DURATIONS.v4];

const BACKDROP_GLOW = ["#7a4a0d", "#9c6614", "#6e7a42", "#2f7d92", "#2f8ed0", "#3596d8"];
const BACKDROP_SURROUND = ["#0a0703", "#140c04", "#232a1c", "#12333f", "#0f4e80", "#125a92"];
const CELL_COLOR = ["#6f6636", "#8d7b3c", "#93a06d", "#a9cfd0", "#b7dcea", "#c3e4ef"];
const CELL_EMISSIVE = ["#2a1d05", "#3a2708", "#2f3a1c", "#16414c", "#1d5d86", "#1d5d86"];

const LAYERS = [{ blur: 32 }, { blur: 0 }, { blur: 66 }];

interface Body {
  group: Group;
  mesh: Mesh;
  rim: Mesh;
  base: [number, number, number];
  drift: [number, number, number];
  spin: [number, number, number];
  phase: number;
  /** Bodies clear the frame in a stagger so the water empties unevenly. */
  exitStart: number;
}

export const buildV4World = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): StageWorld => {
  const camera = new PerspectiveCamera(36, width / height, 0.1, 400);
  camera.position.set(0, 0, 19);
  camera.lookAt(0, 0, 0);

  const scenes = LAYERS.map(() => new Scene());
  for (const scene of scenes) {
    applyLightRig(scene, {
      ambient: { color: "#8a7a5a", intensity: 0.55 },
      hemisphere: { sky: "#f0e0bc", ground: "#0a0803", intensity: 0.9 },
      points: [
        { color: "#ffd089", intensity: 700, position: [0, 0.5, -10], decay: 2 },
        { color: "#ffe8c0", intensity: 260, position: [-8, 6, 8], decay: 2 },
      ],
      fog: { color: "#1a1206", density: 0.022 },
    });
  }

  const rng = mulberry32(0x44d00b);
  const noise = createNoise3D(4404);

  const bump = createBumpTexture("fibrous", 7701, 4.6);
  const shells: BufferGeometry[] = [
    makeCellGeometry({ radius: 1, segments: 110, seed: 811, lumpiness: 0.14, frequency: 2.7 }),
    makeCellGeometry({ radius: 1, segments: 110, seed: 812, lumpiness: 0.11, frequency: 3.3 }),
    makeCellGeometry({ radius: 1, segments: 88, seed: 813, lumpiness: 0.16, frequency: 2.2 }),
  ];

  const bodies: Body[] = [];
  const addCell = (
    layer: number,
    base: [number, number, number],
    radius: number,
    variant: number,
    exitStart: number,
  ) => {
    const geometry = shells[variant % shells.length];
    const mesh = new Mesh(
      geometry,
      makeCellMaterial({
        color: CELL_COLOR[0],
        emissive: CELL_EMISSIVE[0],
        emissiveIntensity: 0.5,
        roughness: 0.7,
        bumpMap: bump,
        bumpScale: 0.34,
        opacity: 1,
      }),
    );
    const rim = makeRimGlow(geometry, "#e8c070", 0.2, 1.06);
    const group = new Group();
    group.add(mesh);
    group.add(rim);
    group.scale.setScalar(radius);
    group.position.set(...base);
    scenes[layer].add(group);

    bodies.push({
      group,
      mesh,
      rim,
      base,
      drift: [range(rng, -0.12, 0.12), range(rng, 0.02, 0.16), range(rng, -0.05, 0.05)],
      spin: [range(rng, -0.1, 0.1), range(rng, -0.12, 0.12), range(rng, -0.08, 0.08)],
      phase: rng() * 90,
      exitStart,
    });
  };

  // Mid field: the cells the eye tracks through the colour changes.
  const midSpecs: Array<[number, number, number, number]> = [
    [-4.6, 2.4, 0, 1.15],
    [1.2, 3.1, -1.2, 0.8],
    [4.9, 1.0, -0.6, 1.35],
    [-2.0, -2.2, 0.4, 1.0],
    [3.0, -3.2, -1.8, 0.72],
    [-6.2, -1.4, -2.4, 0.9],
    [6.6, -1.9, -2.9, 0.6],
    [0.2, -0.6, -3.6, 0.55],
  ];
  midSpecs.forEach((s, i) =>
    addCell(1, [s[0], s[1], s[2]], s[3], i, 192 + i * 4),
  );

  const farSpecs: Array<[number, number, number, number]> = [
    [-8.4, 5.2, -9, 2.4],
    [8.0, 4.4, -10, 2.0],
    [-7.0, -5.6, -8.5, 2.6],
    [7.4, -5.0, -11, 2.2],
    [0.0, 7.0, -12, 1.8],
  ];
  farSpecs.forEach((s, i) => addCell(0, [s[0], s[1], s[2]], s[3], i + 1, 188 + i * 4));

  const nearSpecs: Array<[number, number, number, number]> = [
    [-8.8, -4.0, 7.0, 3.0],
    [8.4, 4.8, 6.2, 2.6],
  ];
  nearSpecs.forEach((s, i) => addCell(2, [s[0], s[1], s[2]], s[3], i, 184 + i * 5));

  // Bubbles for the clean-water tail: smooth, near-transparent, rising.
  const bubbleGeometry = makeCellGeometry({
    radius: 1,
    segments: 56,
    seed: 820,
    lumpiness: 0.03,
    frequency: 2,
  });
  const bubbles: { group: Group; mesh: Mesh; base: [number, number, number]; rise: number; phase: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const mesh = new Mesh(
      bubbleGeometry,
      makeCellMaterial({
        color: "#d8f0ff",
        emissive: "#3f8fd0",
        emissiveIntensity: 0.4,
        roughness: 0.15,
        opacity: 0,
      }),
    );
    const group = new Group();
    group.add(mesh);
    group.add(makeRimGlow(bubbleGeometry, "#eaf8ff", 0.25, 1.1));
    const base: [number, number, number] = [
      range(rng, -9, 9),
      range(rng, -7, 4),
      range(rng, -6, 3),
    ];
    group.position.set(...base);
    group.scale.setScalar(range(rng, 0.22, 0.8));
    scenes[i % 2 === 0 ? 1 : 0].add(group);
    bubbles.push({ group, mesh, base, rise: range(rng, 0.25, 0.75), phase: rng() * 70 });
  }

  const tmpColor = new Color();
  const colorAt = (frame: number, table: string[]) => {
    const hex = interpolateColors(frame, STOPS, table);
    tmpColor.set(hex);
    return tmpColor;
  };

  const update = (frame: number) => {
    const t = frame / FPS;

    const cellColor = colorAt(frame, CELL_COLOR).clone();
    const emissiveColor = colorAt(frame, CELL_EMISSIVE).clone();

    for (const body of bodies) {
      const [bx, by, bz] = body.base;
      body.group.position.set(
        bx + body.drift[0] * t + noise(body.phase, t * 0.15, 0) * 0.3,
        by + body.drift[1] * t + noise(0, body.phase, t * 0.13) * 0.3,
        bz + body.drift[2] * t,
      );
      body.group.rotation.set(body.spin[0] * t, body.spin[1] * t, body.spin[2] * t);

      const material = body.mesh.material as MeshStandardMaterial;
      material.color.copy(cellColor);
      material.emissive.copy(emissiveColor);

      // Cells dissolve away so the last seconds are clean water.
      const fade = interpolate(
        frame,
        [body.exitStart, body.exitStart + 45],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      material.transparent = true;
      material.opacity = fade;
      const rimMaterial = body.rim.material as MeshStandardMaterial;
      rimMaterial.opacity = 0.2 * fade;
      body.group.visible = fade > 0.004;
    }

    for (const bubble of bubbles) {
      const appear = interpolate(frame, [176, 236], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const material = bubble.mesh.material as MeshStandardMaterial;
      material.transparent = true;
      material.opacity = 0.32 * appear;
      bubble.group.visible = appear > 0.004;
      bubble.group.position.set(
        bubble.base[0] + noise(bubble.phase, t * 0.1, 0) * 0.6,
        bubble.base[1] + bubble.rise * t,
        bubble.base[2],
      );
    }

    camera.position.set(0, 0, 19 - t * 0.2);
    camera.lookAt(0, 0, 0);
  };

  return {
    camera,
    layers: scenes.map((scene, i) => ({ scene, blur: LAYERS[i].blur })),
    update,
    dispose: () => {
      shells.forEach((g) => g.dispose());
      bubbleGeometry.dispose();
      bump.dispose();
    },
  };
};

export const V4ColourJourney: React.FC = () => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop
        glow={interpolateColors(frame, STOPS, BACKDROP_GLOW)}
        surround={interpolateColors(frame, STOPS, BACKDROP_SURROUND)}
        center={[50, 50]}
        radius={interpolate(frame, [0, 260], [58, 82], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
        vignette={interpolate(frame, [0, 200, 290], [0.6, 0.4, 0.12], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
      />
      <ThreeStage width={width} height={height} build={buildV4World} />
    </AbsoluteFill>
  );
};
