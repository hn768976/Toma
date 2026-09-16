// The smooth upper body of the band.
//
// Above the strand bundle the reference is not empty space with particles
// floating in it - it is a single broad surface that rolls away from camera as
// it rises, catching the key light along the fold and darkening toward its top
// edge. Modelling it explicitly is what keeps the speck cloud inside the
// band's silhouette instead of scattering it over the background, because the
// particles are placed on this same surface.
//
// The surface is the upper arc of a cylinder swept along the wave. Its
// parameterisation is exported so the particle layer can ride it exactly.

import {
  BufferGeometry,
  Color,
  DoubleSide,
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
  varying,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import {
  BAND_HALF_LENGTH,
  SHEET_ARC,
  SHEET_RADIUS,
  SHEET_SEGMENTS_U,
  SHEET_SEGMENTS_V,
} from "./constants";
import { KEY_LIGHT } from "./lighting";
import { surfaceSpecks } from "./specks";
import type { Palette } from "./palettes";
import { TAU, sampleWave } from "./wave";

export type SheetPoint = {
  /** World-space position, before the mirror flip. */
  position: Node<"vec3">;
  /** World-space surface normal, before the mirror flip. */
  normal: Node<"vec3">;
};

/**
 * Evaluates the sheet at along-band position `x` and sweep parameter
 * `v` in [0, 1]: 0 meets the top strand face-on, 1 is the crest.
 *
 * The offset is written so that v = 0 lands exactly on the wave surface -
 * subtracting the radius along the view axis cancels the arc's own starting
 * offset - which is what makes the sheet and the strand bundle meet without a
 * seam.
 */
export const sampleSheet = (
  x: Node<"float">,
  v: Node<"float">,
  loopT: Node<"float">,
): SheetPoint => {
  const wave = sampleWave(x, 0, loopT);
  const tangent = normalize(vec3(1, wave.dydx, 0));
  const inPlane = vec3(tangent.y.negate(), tangent.x, 0);

  const angle = v.mul(SHEET_ARC);
  const normal = normalize(
    inPlane.mul(angle.sin()).add(vec3(0, 0, 1).mul(angle.cos())),
  );

  const centre = vec3(x, wave.y, wave.z);
  const offset = normal.mul(SHEET_RADIUS).sub(vec3(0, 0, SHEET_RADIUS));

  return { position: centre.add(offset), normal };
};

export type SheetLayer = {
  mesh: Mesh;
  dispose: () => void;
};

/**
 * Builds the sheet grid. As with the other layers, the `position` attribute
 * carries shader parameters - along-band x and the sweep parameter v - rather
 * than coordinates.
 */
const buildGeometry = (): BufferGeometry => {
  const uSteps = SHEET_SEGMENTS_U + 1;
  const vSteps = SHEET_SEGMENTS_V + 1;
  const params: number[] = [];

  for (let i = 0; i < uSteps; i++) {
    const x = -BAND_HALF_LENGTH + (i / SHEET_SEGMENTS_U) * BAND_HALF_LENGTH * 2;
    for (let j = 0; j < vSteps; j++) {
      params.push(x, j / SHEET_SEGMENTS_V, 0);
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < SHEET_SEGMENTS_U; i++) {
    for (let j = 0; j < SHEET_SEGMENTS_V; j++) {
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

export const createBandSheet = (
  palette: Palette,
  loopT: Node<"float">,
  mirror: Node<"float">,
): SheetLayer => {
  const geometry = buildGeometry();
  // Transparent, but still depth-writing. The body of the sheet is fully
  // opaque and occludes normally; only the last sliver at the crest fades,
  // which is what turns a hard cut-out silhouette into the soft, slightly
  // defocused top edge the reference has.
  const material = new MeshBasicNodeMaterial({
    side: DoubleSide,
    transparent: true,
    depthWrite: true,
  });

  const rampA = uniform(new Color(palette.strandRamp[0]).convertSRGBToLinear());
  const rampB = uniform(new Color(palette.strandRamp[1]).convertSRGBToLinear());
  const rampC = uniform(new Color(palette.strandRamp[2]).convertSRGBToLinear());
  const rampD = uniform(new Color(palette.strandRamp[3]).convertSRGBToLinear());
  const highlight = uniform(
    new Color(palette.strandHighlight).convertSRGBToLinear(),
  );
  const rim = uniform(new Color(palette.strandRim).convertSRGBToLinear());

  const x = positionGeometry.x;
  const v = positionGeometry.y;
  const point = sampleSheet(x, v, loopT);

  material.positionNode = vec3(
    point.position.x.mul(mirror),
    point.position.y,
    point.position.z,
  );

  const vNormal = varying(
    vec3(point.normal.x.mul(mirror), point.normal.y, point.normal.z),
    "vSheetNormal",
  );
  const vRampT = varying(
    clamp(x.div(BAND_HALF_LENGTH).mul(mirror).mul(0.5).add(0.5), 0, 1),
    "vSheetRampT",
  );
  const vV = varying(v, "vSheetV");
  const loopTVarying = varying(loopT, "vSheetLoopT");

  const n = normalize(vNormal);
  const view = normalize(positionWorld.sub(cameraPosition).negate());
  const light = vec3(KEY_LIGHT[0], KEY_LIGHT[1], KEY_LIGHT[2]);

  const t = vRampT;
  const base = mix(
    mix(rampA, rampB, smoothstep(0, 0.4, t)),
    mix(rampC, rampD, smoothstep(0.6, 1, t)),
    smoothstep(0.32, 0.7, t),
  );

  // Ribbons of brighter light running along the flow, as in the reference.
  // Two integer spatial frequencies over the band period, travelling one and
  // two cycles per loop, so they wrap with everything else.
  const flow = vRampT.mul(TAU * 2).sub(loopTVarying.mul(TAU));
  const streak = flow.add(vV.mul(1.9)).sin().mul(0.5).add(0.5).pow(3.2);
  const streak2 = flow.mul(2).add(2.4).sin().mul(0.5).add(0.5).pow(6);
  const lit = mix(base, base.mul(1.32).add(rim.mul(0.12)), streak.mul(0.42))
    .add(highlight.mul(streak2).mul(0.06));

  const ndl = max(dot(n, light), 0);
  const diffuse = lit.mul(ndl.mul(0.66).add(0.1));

  // Broad sheen along the fold rather than the tight streak the strands get -
  // the surface is much larger, so the same exponent would read as a hard line.
  const sheen = pow(max(dot(reflect(light.negate(), n), view), 0), 30)
    .mul(0.16)
    .mul(mix(highlight, rim, 0.45));

  const fresnel = pow(float(1).sub(max(dot(n, view), 0)), 2.2)
    .mul(0.22)
    .mul(rim);

  // Darkens toward the crest, where the surface turns away from the key light,
  // and fades at the very edge so the silhouette is soft rather than cut out.
  const crestFade = smoothstep(1.02, 0.46, vV).mul(0.82).add(0.18);
  const edgeFade = varying(
    smoothstep(1, 0.62, x.div(BAND_HALF_LENGTH).abs()),
    "vSheetEdgeFade",
  );

  // Fine specks embedded in the surface itself, distinct from the particle
  // cloud riding above it.
  const speck = surfaceSpecks(vRampT, vV, {
    cells: [520, 44],
    density: 0.5,
    size: 0.2,
  }).mul(1.7);

  material.colorNode = diffuse
    .add(sheen)
    .add(fresnel)
    .mul(crestFade)
    .add(highlight.mul(speck));

  material.opacityNode = smoothstep(1, 0.8, vV).mul(edgeFade);

  const mesh = new Mesh(geometry, material);
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
