// Lighting rigs and drift helpers.
//
// Each depth layer is its own Scene, so lights cannot be shared between them
// (an Object3D has exactly one parent). `applyLightRig` builds a fresh set of
// light instances from a plain description, which keeps the layers lit
// identically without any cross-scene bookkeeping.

import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PointLight,
  type Scene,
} from "three";
import type { Noise3D } from "./noise";

export interface LightRig {
  ambient?: { color: string | number; intensity: number };
  hemisphere?: { sky: string | number; ground: string | number; intensity: number };
  points?: Array<{
    color: string | number;
    intensity: number;
    position: [number, number, number];
    distance?: number;
    decay?: number;
  }>;
  directionals?: Array<{
    color: string | number;
    intensity: number;
    position: [number, number, number];
  }>;
  fog?: { color: string | number; density: number };
}

export const applyLightRig = (scene: Scene, rig: LightRig) => {
  if (rig.ambient) {
    scene.add(new AmbientLight(new Color(rig.ambient.color), rig.ambient.intensity));
  }
  if (rig.hemisphere) {
    scene.add(
      new HemisphereLight(
        new Color(rig.hemisphere.sky),
        new Color(rig.hemisphere.ground),
        rig.hemisphere.intensity,
      ),
    );
  }
  for (const p of rig.points ?? []) {
    const light = new PointLight(
      new Color(p.color),
      p.intensity,
      p.distance ?? 0,
      p.decay ?? 2,
    );
    light.position.set(...p.position);
    scene.add(light);
  }
  for (const d of rig.directionals ?? []) {
    const light = new DirectionalLight(new Color(d.color), d.intensity);
    light.position.set(...d.position);
    scene.add(light);
  }
  if (rig.fog) {
    scene.fog = new FogExp2(new Color(rig.fog.color), rig.fog.density);
  }
};

/**
 * Slow organic wander. Sampling a noise field at an offset per axis keeps the
 * three components independent, so bodies meander instead of sliding along a
 * diagonal.
 */
export const wander = (
  noise: Noise3D,
  seedOffset: number,
  t: number,
  amplitude: number,
): [number, number, number] => [
  noise(seedOffset, t, 0) * amplitude,
  noise(0, seedOffset + 41.7, t) * amplitude,
  noise(t, 0, seedOffset + 93.1) * amplitude,
];

/** Wraps a coordinate into [min, max) so fields can scroll forever. */
export const wrapRange = (value: number, min: number, max: number) => {
  const span = max - min;
  return min + (((value - min) % span) + span) % span;
};
