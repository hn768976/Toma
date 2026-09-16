// The bundle of glossy strands that forms the lower half of the band.
//
// Each strand is the camera-facing half of a tube swept along the wave. Only
// the visible half is built: the cross-section sweeps a little past +/-90
// degrees from the view axis, so the silhouette closes over cleanly against
// the strand behind it without paying for geometry that always faces away.
//
// Shading is emissive rather than physically lit - the reference reads as
// self-illuminated neon, not as a lit object - so a key-light term, a tight
// specular streak and a fresnel rim are composited directly in the fragment
// program.

import {
  Color,
  DoubleSide,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
} from "three/webgpu";
import {
  cameraPosition,
  clamp,
  dot,
  float,
  max,
  mix,
  normalize,
  positionGeometry,
  positionWorld,
  pow,
  reflect,
  smoothstep,
  uniform,
  vec3,
  varying,
} from "three/tsl";
import type { Node } from "three/webgpu";
import {
  BAND_HALF_LENGTH,
  STRAND_COUNT,
  STRAND_DEPTH_PITCH,
  STRAND_PHASE_LAG,
  STRAND_PITCH,
  STRAND_RADIUS,
  STRAND_SEGMENTS_C,
  STRAND_SEGMENTS_U,
} from "./constants";
import { KEY_LIGHT } from "./lighting";
import { surfaceSpecks } from "./specks";
import type { Palette } from "./palettes";
import { sampleWave } from "./wave";

/** How far past the silhouette the cross-section sweeps, as a multiple of 90 degrees. */
const CROSS_SECTION_ARC = 1.08;


/**
 * Builds the strand grid.
 *
 * The `position` attribute does not hold positions: it carries the three
 * parameters each vertex needs - along-band x, normalised strand index, and
 * the cross-section parameter - which the vertex program turns into a real
 * position. The mesh therefore has no meaningful bounding volume and opts out
 * of frustum culling.
 */
const buildGeometry = (): BufferGeometry => {
  const uSteps = STRAND_SEGMENTS_U + 1;
  const cSteps = STRAND_SEGMENTS_C + 1;
  const params: number[] = [];

  for (let s = 0; s < STRAND_COUNT; s++) {
    const strandNorm = s / (STRAND_COUNT - 1);
    for (let i = 0; i < uSteps; i++) {
      const x = -BAND_HALF_LENGTH + (i / STRAND_SEGMENTS_U) * BAND_HALF_LENGTH * 2;
      for (let j = 0; j < cSteps; j++) {
        // c runs -1 (underside) .. 0 (facing camera) .. +1 (crest)
        const c = (j / STRAND_SEGMENTS_C) * 2 - 1;
        params.push(x, strandNorm, c);
      }
    }
  }

  const indices: number[] = [];
  const perStrand = uSteps * cSteps;
  for (let s = 0; s < STRAND_COUNT; s++) {
    const base = s * perStrand;
    for (let i = 0; i < STRAND_SEGMENTS_U; i++) {
      for (let j = 0; j < STRAND_SEGMENTS_C; j++) {
        const a = base + i * cSteps + j;
        const b = a + cSteps;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(params, 3));
  geometry.setIndex(indices);
  return geometry;
};

export type StrandLayer = {
  mesh: Mesh;
  dispose: () => void;
};

export const createRibbonStrands = (
  palette: Palette,
  loopT: Node<"float">,
  mirror: Node<"float">,
): StrandLayer => {
  const geometry = buildGeometry();
  const material = new MeshBasicNodeMaterial({ side: DoubleSide });

  const rampA = uniform(new Color(palette.strandRamp[0]).convertSRGBToLinear());
  const rampB = uniform(new Color(palette.strandRamp[1]).convertSRGBToLinear());
  const rampC = uniform(new Color(palette.strandRamp[2]).convertSRGBToLinear());
  const rampD = uniform(new Color(palette.strandRamp[3]).convertSRGBToLinear());
  const highlight = uniform(
    new Color(palette.strandHighlight).convertSRGBToLinear(),
  );
  const rim = uniform(new Color(palette.strandRim).convertSRGBToLinear());

  const x = positionGeometry.x;
  const strandNorm = positionGeometry.y;
  const c = positionGeometry.z;

  const lag = strandNorm.mul(STRAND_PHASE_LAG * (STRAND_COUNT - 1));
  const wave = sampleWave(x, lag, loopT);

  // Tube frame. The axis follows the surface tangent in XY; the cross-section
  // spans the view axis (+Z) and the in-plane normal, so c = +1 lands on the
  // crest facing the key light and c = -1 on the shadowed underside.
  const tangent = normalize(vec3(1, wave.dydx, 0));
  const inPlane = vec3(tangent.y.negate(), tangent.x, 0);
  const angle = c.mul((Math.PI / 2) * CROSS_SECTION_ARC);
  const crossNormal = normalize(
    vec3(0, 0, 1).mul(angle.cos()).add(inPlane.mul(angle.sin())),
  );

  const centre = vec3(
    x,
    wave.y.sub(strandNorm.mul(STRAND_PITCH * (STRAND_COUNT - 1))),
    wave.z.sub(strandNorm.mul(STRAND_DEPTH_PITCH * (STRAND_COUNT - 1))),
  );
  const local = centre.add(crossNormal.mul(STRAND_RADIUS));

  // Mirroring is a world-space x flip. Because the strands are shaded
  // emissively and drawn DoubleSide, flipping the winding costs nothing.
  const worldPos = vec3(local.x.mul(mirror), local.y, local.z);
  const worldNormal = vec3(crossNormal.x.mul(mirror), crossNormal.y, crossNormal.z);

  material.positionNode = worldPos;

  const vNormal = varying(worldNormal, "vStrandNormal");
  const vRampT = varying(
    clamp(
      x.div(BAND_HALF_LENGTH).mul(mirror).mul(0.5).add(0.5).mul(0.78).add(strandNorm.mul(0.22)),
      0,
      1,
    ),
    "vStrandRampT",
  );
  const vC = varying(c, "vStrandC");
  const vStrand = varying(strandNorm, "vStrandIndex");
  const vEdgeFade = varying(
    smoothstep(1, 0.62, x.div(BAND_HALF_LENGTH).abs()),
    "vStrandEdgeFade",
  );

  const n = normalize(vNormal);
  const view = normalize(positionWorld.sub(cameraPosition).negate());
  const light = vec3(KEY_LIGHT[0], KEY_LIGHT[1], KEY_LIGHT[2]);

  // Four-stop ramp along the band, nudged by strand index so the deeper
  // strands sit a shade cooler than the ones on top.
  const t = vRampT;
  const base = mix(
    mix(rampA, rampB, smoothstep(0, 0.4, t)),
    mix(rampC, rampD, smoothstep(0.6, 1, t)),
    smoothstep(0.32, 0.7, t),
  );

  const ndl = max(dot(n, light), 0);
  const diffuse = base.mul(ndl.mul(1.05).add(0.15));

  // Tight specular streak along each crest - the glossy read of the reference.
  const specular = pow(max(dot(reflect(light.negate(), n), view), 0), 70)
    .mul(1.6)
    .mul(highlight);

  // Fresnel at the grazing edges, which also softens the seam between strands.
  const fresnel = pow(float(1).sub(max(dot(n, view), 0)), 2.9)
    .mul(0.3)
    .mul(rim);

  // Ambient occlusion between neighbours: the underside of each tube sits in
  // the shadow of the one below it.
  const occlusion = smoothstep(-1.05, 0.15, vC).mul(0.72).add(0.28);

  // The bundle falls into darkness toward the bottom of the stack.
  const stackFade = smoothstep(1.06, 0.12, vStrand).mul(0.78).add(0.22);

  // Sparse specks riding on the strand surfaces, as in the reference. The
  // cross-section parameter is folded into the second axis so specks land
  // around each tube rather than running in lines along it.
  const speck = surfaceSpecks(vRampT, vStrand.add(vC.mul(0.05)), {
    cells: [700, 150],
    density: 0.42,
    size: 0.3,
  })
    .mul(smoothstep(-0.1, 0.8, vC))
    .mul(2.1);

  material.colorNode = diffuse
    .add(specular)
    .add(fresnel)
    .mul(occlusion)
    .mul(stackFade)
    .mul(vEdgeFade)
    .add(highlight.mul(speck).mul(vEdgeFade));

  const mesh = new Mesh(geometry, material);
  // `position` carries shader parameters, not coordinates, so the derived
  // bounding volume would be meaningless.
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
