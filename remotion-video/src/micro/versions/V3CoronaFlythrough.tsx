// Version 3 -- flight through a virion swarm.
//
// Reference: dense green spiked virions in heavy teal fog, camera pushing
// continuously forward, bodies swelling and sliding past the lens.
//
// The camera actually stays put and the field streams towards it, which makes
// the swarm endlessly recyclable: a virion that reaches the near end of the
// corridor wraps back to the far end.
//
// Everything here is in focus -- no depth-of-field layers. Depth is carried by
// fog and by scale alone. That changes how the recycle has to be handled: with
// a blurred near plane a virion could sweep past the lens and pop out of
// existence unseen, but in focus that pop would be a full-frame flash.
//
// Fading bodies out on approach was the obvious fix and the wrong one: a
// semi-transparent virion writes depth, so its own spikes show through it and
// it reads as a ghost ring rather than something receding.
//
// The fix is geometric instead. Bodies sit anywhere while they are far away,
// including dead on the axis, and are pushed radially outward as they close in,
// so each one has left the frame through the sides by the time it recycles.
// Nothing fades and nothing pops, and it is what a real flythrough looks like
// anyway: near bodies sweep out past the edges while distant ones fill the
// middle. A fixed exclusion tube was the first attempt and read far too sparse,
// because it punched a permanent hole through the middle of the corridor.

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

const CORRIDOR = 46; // depth of the loop, in world units
const SPEED = 4.1; // world units per second
const VIRION_COUNT = 76;

// Nearest a body is allowed to come before it recycles to the far end.
const NEAR_LIMIT = -9;

// Where the outward push begins. Long enough that the slide reads as
// perspective rather than as bodies visibly veering away from the lens.
const SPREAD_FROM = -32;

// Radius every body is pushed to by the time it reaches NEAR_LIMIT. Covers the
// half-width of the frame there, plus the largest body, the per-body sway and
// the camera's own drift.
const EXIT_RADIUS = 13.5;

// Vertical squash of the field, so it fills a 16:9 frame rather than a circle.
const Y_SQUASH = 0.62;

interface Bug {
  group: Group;
  /** Position in the corridor's cross-section, as a polar coordinate. */
  angle: number;
  radius: number;
  zOffset: number;
  spin: [number, number, number];
  wobble: number;
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

  const scene = new Scene();
  applyLightRig(scene, {
    ambient: { color: "#2e6f5e", intensity: 0.5 },
    hemisphere: { sky: "#bfe6a8", ground: "#05201f", intensity: 0.9 },
    // These are directional rather than point lights on purpose. Bodies here
    // travel through the whole volume, so a point light placed inside that
    // volume eventually has a body pass within a unit or two of it, and
    // inverse-square falloff blows it to white. Directional light has no
    // position to collide with.
    directionals: [
      { color: "#5fd0b0", intensity: 1.8, position: [-6, 5, 3] },
      { color: "#89c24a", intensity: 1.25, position: [7, -5, -2] },
    ],
    points: [
      // Lamp behind the lens, past the near limit, so bodies flare as they
      // pass without ever reaching it.
      { color: "#d8f3a8", intensity: 110, position: [0, 1.5, 7], decay: 2 },
    ],
    fog: { color: PALETTE.fog, density: 0.022 },
  });

  const rng = mulberry32(0x33c007);
  const noise = createNoise3D(3303);
  const bump: Texture = createBumpTexture("pebbled", 6601, 6.0);

  const bugs: Bug[] = [];
  for (let i = 0; i < VIRION_COUNT; i++) {
    const scale = range(rng, 0.55, 1.6);
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
    scene.add(group);

    // sqrt keeps the sample uniform by area instead of clumping on the axis.
    bugs.push({
      group,
      angle: rng() * Math.PI * 2,
      radius: Math.sqrt(rng()) * 22,
      zOffset: rng() * CORRIDOR,
      spin: [range(rng, -0.4, 0.4), range(rng, -0.5, 0.5), range(rng, -0.3, 0.3)],
      wobble: rng() * 60,
    });
  }

  const update = (frame: number) => {
    const t = frame / FPS;

    for (const bug of bugs) {
      // Wrap through the corridor, from the far end up to the near limit.
      const z = NEAR_LIMIT - CORRIDOR + ((bug.zOffset + t * SPEED) % CORRIDOR);

      // Push outward on approach, easing in so the slide starts imperceptibly.
      // Bodies already beyond the exit radius are left where they are.
      const approach = Math.min(
        1,
        Math.max(0, (z - SPREAD_FROM) / (NEAR_LIMIT - SPREAD_FROM)),
      );
      const radius =
        bug.radius + approach * approach * Math.max(0, EXIT_RADIUS - bug.radius);

      const sway = noise(bug.wobble, t * 0.12, 0) * 0.8;
      const rise = noise(0, bug.wobble, t * 0.1) * 0.8;

      bug.group.position.set(
        Math.cos(bug.angle) * radius + sway,
        Math.sin(bug.angle) * radius * Y_SQUASH + rise,
        z,
      );
      bug.group.rotation.set(
        bug.spin[0] * t,
        bug.spin[1] * t,
        bug.spin[2] * t,
      );

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
    layers: [{ scene, blur: 0 }],
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
