// Version 3 -- flight through a virion swarm.
//
// Reference: dense green spiked virions in heavy teal fog, camera pushing
// continuously forward, bodies swelling and sliding past the lens.
//
// The camera actually stays put and the field streams towards it, which makes
// the swarm endlessly recyclable: a virion that passes the lens wraps back to
// the far end of the corridor. Because depth changes constantly here, bodies
// are re-parented between the depth layers every frame rather than being
// assigned to one at build time.

import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Group, PerspectiveCamera, Scene, type Texture } from "three";
import { Backdrop } from "../components/Backdrop";
import { ThreeStage, type StageWorld } from "../gpu/ThreeStage";
import { makeVirion } from "../lib/cells";
import { createNoise3D } from "../lib/noise";
import { applyLightRig } from "../lib/rig";
import { mulberry32, range } from "../lib/rng";
import { createBumpTexture } from "../lib/textures";
import { FPS } from "../constants";

const PALETTE = {
  core: "#5f8f2c",
  spike: "#b7d14a",
  glow: "#1f6b68",
  surround: "#07201f",
  // Fog has to sit at the backdrop's own mid-tone. Any darker and distant
  // virions read as black holes punched in a bright teal background.
  fog: "#175450",
};

const CORRIDOR = 78; // depth of the loop, in world units
const SPEED = 4.1; // world units per second
const VIRION_COUNT = 58;

const LAYERS = [{ blur: 30 }, { blur: 0 }, { blur: 72 }];

// Depth boundaries used to sort bodies into the blur layers each frame.
const FAR_UNTIL = -36;
const NEAR_FROM = -10;

interface Bug {
  group: Group;
  x: number;
  y: number;
  zOffset: number;
  scale: number;
  spin: [number, number, number];
  wobble: number;
  layer: number;
}

export const buildV3World = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): StageWorld => {
  const camera = new PerspectiveCamera(46, width / height, 0.1, 200);
  camera.position.set(0, 0, 2);
  camera.lookAt(0, 0, -10);

  const scenes = LAYERS.map(() => new Scene());
  for (const scene of scenes) {
    applyLightRig(scene, {
      ambient: { color: "#2e6f5e", intensity: 0.5 },
      hemisphere: { sky: "#bfe6a8", ground: "#05201f", intensity: 0.9 },
      points: [
        // Lamp riding just behind the lens, so bodies flare as they pass.
        { color: "#d8f3a8", intensity: 110, position: [0, 1.5, 7], decay: 2 },
        { color: "#5fd0b0", intensity: 520, position: [-9, 7, -8], decay: 2 },
        { color: "#89c24a", intensity: 380, position: [10, -6, -18], decay: 2 },
      ],
      fog: { color: PALETTE.fog, density: 0.029 },
    });
  }

  const rng = mulberry32(0x33c007);
  const noise = createNoise3D(3303);
  const bump: Texture = createBumpTexture("pebbled", 6601, 6.0);

  const bugs: Bug[] = [];
  for (let i = 0; i < VIRION_COUNT; i++) {
    const scale = range(rng, 0.55, 1.75);
    const group = makeVirion({
      radius: 1,
      seed: 700 + i,
      spikeCount: 74,
      spikeLength: 0.2,
      spikeRadius: 0.085,
      coreColor: PALETTE.core,
      spikeColor: PALETTE.spike,
      emissive: "#1d3a0d",
      emissiveIntensity: 0.32,
      bumpMap: bump,
      coreSegments: 56,
      glow: { color: "#a8e05a", opacity: 0.16 },
    });
    group.scale.setScalar(scale);
    scenes[0].add(group);

    bugs.push({
      group,
      x: range(rng, -17, 17),
      y: range(rng, -11, 11),
      zOffset: rng() * CORRIDOR,
      scale,
      spin: [range(rng, -0.4, 0.4), range(rng, -0.5, 0.5), range(rng, -0.3, 0.3)],
      wobble: rng() * 60,
      layer: 0,
    });
  }

  const update = (frame: number) => {
    const t = frame / FPS;

    for (const bug of bugs) {
      // Wrap through the corridor: far end to just past the lens, forever.
      const z = -CORRIDOR + ((bug.zOffset + t * SPEED) % CORRIDOR);
      const sway = noise(bug.wobble, t * 0.12, 0) * 0.8;
      const rise = noise(0, bug.wobble, t * 0.1) * 0.8;

      bug.group.position.set(bug.x + sway, bug.y + rise, z);
      bug.group.rotation.set(
        bug.spin[0] * t,
        bug.spin[1] * t,
        bug.spin[2] * t,
      );

      const layer = z < FAR_UNTIL ? 0 : z > NEAR_FROM ? 2 : 1;
      if (layer !== bug.layer) {
        scenes[layer].add(bug.group);
        bug.layer = layer;
      }
    }

    // Gentle handheld drift so the flight does not feel rail-mounted.
    camera.position.set(
      noise(500, t * 0.09, 0) * 0.55,
      noise(0, 500, t * 0.08) * 0.45,
      2,
    );
    camera.lookAt(camera.position.x * 0.4, camera.position.y * 0.4, -12);
  };

  return {
    camera,
    layers: scenes.map((scene, i) => ({ scene, blur: LAYERS[i].blur })),
    update,
    dispose: () => bump.dispose(),
  };
};

export const V3CoronaFlythrough: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Backdrop
        glow={PALETTE.glow}
        surround={PALETTE.surround}
        center={[50, 48]}
        radius={72}
        vignette={0.45}
      />
      <ThreeStage width={width} height={height} build={buildV3World} />
    </AbsoluteFill>
  );
};
