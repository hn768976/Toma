// The cloud of glowing specks riding above the strand bundle.
//
// The look the reference is built on is depth of field: particles near the
// focal plane are tiny sharp points, while particles drifting toward camera
// spread into large soft bokeh discs. That is modelled honestly here - the
// sprite is scaled by its circle of confusion and its brightness divided by
// the disc's area, so a particle keeps roughly the same total energy as it
// defocuses and large discs stay faint instead of blowing out.
//
// Seamlessness comes from the drift: over one loop every particle travels
// exactly WAVE_PERIOD along the band, and the wave field repeats over that
// same distance, so a particle wrapping from one end of the band to the other
// lands in an identical piece of the field.

import {
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  SpriteNodeMaterial,
} from "three/webgpu";
import {
  clamp,
  float,
  instancedBufferAttribute,
  length,
  mix,
  smoothstep,
  uv,
  varying,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import {
  BAND_HALF_LENGTH,
  BOKEH_MAX,
  BOKEH_STRENGTH,
  PARTICLE_BASE_SIZE,
  PARTICLE_COUNT,
  PARTICLE_DEPTH_RANGE,
  PARTICLE_SHEET_OVERSHOOT,
  PARTICLE_SURFACE_LIFT,
  WAVE_PERIOD,
} from "./constants";
import { sampleSheet } from "./band-sheet";
import { applyAdditiveBlending } from "./blending";
import type { Palette, ParticleSwatch } from "./palettes";
import { mulberry32 } from "../particle-ring/random";
import { TAU } from "./wave";

export type ParticleLayer = {
  mesh: Mesh;
  dispose: () => void;
};

/** Picks a swatch for `r` in [0,1) from a weighted list. */
const pickSwatch = (
  swatches: readonly ParticleSwatch[],
  r: number,
): ParticleSwatch => {
  const total = swatches.reduce((sum, p) => sum + p.weight, 0);
  const target = r * total;
  let acc = 0;
  for (const swatch of swatches) {
    acc += swatch.weight;
    if (target < acc) {
      return swatch;
    }
  }
  return swatches[swatches.length - 1];
};

export const createParticleCloud = (
  palette: Palette,
  loopT: Node<"float">,
  mirror: Node<"float">,
): ParticleLayer => {
  // Seeded, never Math.random(): Remotion renders frames out of order across
  // workers, so every particle's identity has to be a pure function of its
  // index or the cloud would reshuffle between frames.
  const rand = mulberry32(0x5eed1e);

  // x at loop time 0, sweep position on the sheet, depth jitter, size.
  const seedA = new Float32Array(PARTICLE_COUNT * 4);
  // linear rgb premultiplied by the swatch's intensity, plus a phase seed.
  const seedB = new Float32Array(PARTICLE_COUNT * 4);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Biasing the sweep toward the fold thins the density toward the crest,
    // the way it does in the reference.
    const sweep = Math.pow(rand(), 1.5) * (1 + PARTICLE_SHEET_OVERSHOOT);
    const depthT = rand();

    seedA[i * 4 + 0] = (rand() * 2 - 1) * BAND_HALF_LENGTH;
    seedA[i * 4 + 1] = sweep;
    seedA[i * 4 + 2] =
      PARTICLE_DEPTH_RANGE[0] +
      (PARTICLE_DEPTH_RANGE[1] - PARTICLE_DEPTH_RANGE[0]) * depthT;
    // A long tail on size is what produces the occasional oversized disc
    // among many small ones.
    seedA[i * 4 + 3] = 0.4 + Math.pow(rand(), 3.4) * 2.2;

    // Classify by the particle's own depth offset, which is what dominates
    // the circle of confusion the shader computes (the surface's own depth
    // sway adds under a unit on top of it), so the swatch population lines up
    // with how the particle actually renders.
    const defocus = Math.min(
      Math.abs(seedA[i * 4 + 2]) * BOKEH_STRENGTH * 8,
      BOKEH_MAX - 1,
    );
    const swatch = pickSwatch(
      defocus > 1.35 ? palette.particles.bokeh : palette.particles.spark,
      rand(),
    );
    const colour = new Color(swatch.color).convertSRGBToLinear();
    seedB[i * 4 + 0] = colour.r * swatch.intensity;
    seedB[i * 4 + 1] = colour.g * swatch.intensity;
    seedB[i * 4 + 2] = colour.b * swatch.intensity;
    seedB[i * 4 + 3] = rand();
  }

  const quad = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute("position", quad.getAttribute("position"));
  geometry.setAttribute("uv", quad.getAttribute("uv"));
  geometry.instanceCount = PARTICLE_COUNT;
  quad.dispose();

  const attrA = new InstancedBufferAttribute(seedA, 4);
  const attrB = new InstancedBufferAttribute(seedB, 4);
  geometry.setAttribute("aSeedA", attrA);
  geometry.setAttribute("aSeedB", attrB);

  const a = instancedBufferAttribute<"vec4">(attrA, "vec4");
  const b = instancedBufferAttribute<"vec4">(attrB, "vec4");

  const sweep = a.y;
  const depth = a.z;
  const sizeScale = a.w;

  // Drift exactly one wave period per loop, wrapping inside a cell one wave
  // period wide rather than across the whole band. Wrapping over the band
  // would put a particle a half-band away from where it started at loop end -
  // the wave field there is identical, but the edge fade is not, so the loop
  // would show a faint seam. Confining the wrap to one period returns every
  // particle to its exact starting x.
  const cellBase = a.x
    .add(BAND_HALF_LENGTH)
    .div(WAVE_PERIOD)
    .floor()
    .mul(WAVE_PERIOD)
    .sub(BAND_HALF_LENGTH);
  const offset = a.x.sub(cellBase).add(loopT.mul(WAVE_PERIOD));
  const x = cellBase.add(
    offset.sub(offset.div(WAVE_PERIOD).floor().mul(WAVE_PERIOD)),
  );

  // Riding the band's own upper surface, lifted just clear of it. Sharing the
  // sheet's parameterisation is what keeps the cloud inside the band's
  // silhouette rather than scattered across the background.
  const surface = sampleSheet(x, sweep, loopT);

  // A slow sway, one cycle per loop, so the cloud breathes instead of sitting
  // rigidly on the surface.
  const phase = loopT.mul(TAU).add(b.w.mul(TAU));
  const sway = phase.sin().mul(0.1).mul(sweep.add(0.25));

  const lifted = surface.position.add(
    surface.normal.mul(float(PARTICLE_SURFACE_LIFT).add(sway)),
  );

  const worldZ = lifted.z.add(depth);
  const centre = vec3(lifted.x.mul(mirror), lifted.y, worldZ);

  // Circle of confusion. The lens is focused on the camera's own distance, so
  // the focal plane is world z = 0 and a particle's defocus is simply its
  // distance from it. coc is 1 at focus and grows outward.
  const coc = clamp(
    float(1).add(worldZ.abs().mul(BOKEH_STRENGTH * 8)),
    1,
    BOKEH_MAX,
  );

  // Spreading a fixed amount of light over a disc of radius `coc` divides its
  // brightness by coc^2. Softened so the largest discs stay readable.
  const spreadFalloff = float(1).div(coc.mul(coc).mul(0.82).add(0.18));

  const edgeFade = smoothstep(1, 0.58, x.div(BAND_HALF_LENGTH).abs());
  // Thins out past the sheet's own top edge so the cloud dissolves into the
  // background instead of ending on a line.
  const topFade = smoothstep(1 + PARTICLE_SHEET_OVERSHOOT, 0.25, sweep);
  const twinkle = phase.mul(3).sin().mul(0.22).add(0.88);

  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  applyAdditiveBlending(material);

  material.positionNode = centre;
  material.scaleNode = float(PARTICLE_BASE_SIZE).mul(sizeScale).mul(coc);

  const vColour = varying(vec3(b.x, b.y, b.z), "vParticleColour");
  const vAlpha = varying(
    spreadFalloff.mul(edgeFade).mul(topFade).mul(twinkle),
    "vParticleAlpha",
  );
  const vCoc = varying(coc, "vParticleCoc");

  // Bokeh profile: a soft point in focus, becoming a flat disc with a
  // slightly brighter rim as it defocuses, the way a real aperture renders an
  // out-of-focus highlight.
  const d = length(uv().sub(0.5)).mul(2);
  const discness = smoothstep(1.6, 6, vCoc);
  const point = smoothstep(1, 0, d).pow(2.2);
  const disc = smoothstep(1, 0.86, d).mul(
    smoothstep(0.35, 0.95, d).mul(0.35).add(0.65),
  );

  material.colorNode = vColour;
  material.opacityNode = mix(point, disc, discness).mul(vAlpha);

  const mesh = new Mesh(geometry, material);
  // Instance positions are computed in the shader, so the CPU-side bounding
  // volume would be meaningless.
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;

  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
