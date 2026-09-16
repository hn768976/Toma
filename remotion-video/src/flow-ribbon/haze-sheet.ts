// The soft additive wash that fills the band.
//
// In the reference this is what makes the piece read as an aurora rather than
// a bundle of tubes: a wide, unfocused sheet of colour hugging the same wave,
// brightest where it meets the strands and fading out toward the top of the
// cloud. It renders behind the strands and under the particles, so it lifts
// the whole band off the black without softening the crisp strand highlights.

import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
} from "three/webgpu";
import {
  float,
  mix,
  positionGeometry,
  smoothstep,
  uniform,
  varying,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import {
  BAND_HALF_LENGTH,
  HAZE_RISE,
  HAZE_SEGMENTS_U,
  HAZE_SEGMENTS_V,
  STRAND_COUNT,
  STRAND_PITCH,
} from "./constants";
import { applyAdditiveBlending } from "./blending";
import type { Palette } from "./palettes";
import { TAU, sampleWave } from "./wave";

export type HazeLayer = {
  mesh: Mesh;
  dispose: () => void;
};

/** How far below the surface the sheet starts, so it backs the strand stack. */
const HAZE_DROP = STRAND_PITCH * (STRAND_COUNT - 1) * 0.85;

/**
 * Builds the sheet grid. As with the strands, the `position` attribute
 * carries shader parameters - along-band x and the vertical parameter v -
 * rather than coordinates.
 */
const buildGeometry = (): BufferGeometry => {
  const uSteps = HAZE_SEGMENTS_U + 1;
  const vSteps = HAZE_SEGMENTS_V + 1;
  const params: number[] = [];

  for (let i = 0; i < uSteps; i++) {
    const x = -BAND_HALF_LENGTH + (i / HAZE_SEGMENTS_U) * BAND_HALF_LENGTH * 2;
    for (let j = 0; j < vSteps; j++) {
      params.push(x, j / HAZE_SEGMENTS_V, 0);
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < HAZE_SEGMENTS_U; i++) {
    for (let j = 0; j < HAZE_SEGMENTS_V; j++) {
      const a = i * vSteps + j;
      const b = a + vSteps;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(params, 3));
  geometry.setIndex(indices);
  return geometry;
};

export const createHazeSheet = (
  palette: Palette,
  loopT: Node<"float">,
  mirror: Node<"float">,
): HazeLayer => {
  const geometry = buildGeometry();
  const material = new MeshBasicNodeMaterial({
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    // Depth-tested, because three draws transparent objects after opaque ones
    // whatever their renderOrder: without this the haze would paint its
    // streaks straight over the strands instead of glowing around them.
    depthTest: true,
  });
  applyAdditiveBlending(material);

  const low = uniform(new Color(palette.haze[0]).convertSRGBToLinear());
  const mid = uniform(new Color(palette.haze[1]).convertSRGBToLinear());
  const high = uniform(new Color(palette.haze[2]).convertSRGBToLinear());

  const x = positionGeometry.x;
  const v = positionGeometry.y;

  const wave = sampleWave(x, 0, loopT);

  // v = 0 sits below the strand stack, v = 1 at the top of the cloud. The
  // sheet leans slightly back in depth as it rises, so it sits behind the
  // particles rather than slicing through them.
  const y = wave.y.sub(HAZE_DROP).add(v.mul(HAZE_RISE + HAZE_DROP));
  // Sat well behind the whole strand bundle. Any closer and the sheet
  // intersects the deeper strands, printing its streaks across them as bands.
  const z = wave.z.sub(v.mul(0.9)).sub(2.4);

  material.positionNode = vec3(x.mul(mirror), y, z);

  const vV = varying(v, "vHazeV");
  const vX = varying(x.div(BAND_HALF_LENGTH).mul(mirror), "vHazeX");

  // Streaks running along the band. Two incommensurate spatial frequencies,
  // both integer multiples of the band period so they wrap with everything
  // else, give the reference's ribboned light without a texture lookup.
  const streakPhase = vX.mul(TAU * 1.5).add(loopT.mul(TAU).negate());
  const streak = streakPhase.sin().mul(0.5).add(0.5).pow(3.4);
  const streak2 = streakPhase.mul(2.0).add(2.1).sin().mul(0.5).add(0.5).pow(5);

  const ramp = mix(
    mix(low, mid, smoothstep(0, 0.55, vV)),
    high,
    smoothstep(0.45, 1, vV),
  );

  // Brightest just above the strands and gone well before the sheet's own
  // top edge - if any brightness survived to the boundary the mesh would
  // show its silhouette instead of reading as haze.
  // A power falloff rather than a smoothstep: it reaches zero exactly at the
  // sheet's top edge with no inflection, so the mesh never shows its own
  // silhouette the way a band-limited falloff does.
  const body = smoothstep(0, 0.06, vV).mul(float(1).sub(vV).pow(2.3));
  const edgeFade = smoothstep(1, 0.45, vX.abs());

  const intensity = body
    .mul(edgeFade)
    .mul(palette.hazeIntensity * 0.42)
    .mul(streak.mul(0.45).add(0.7));

  material.colorNode = ramp
    .mul(intensity)
    .add(high.mul(streak2).mul(body).mul(edgeFade).mul(0.06));

  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;

  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
