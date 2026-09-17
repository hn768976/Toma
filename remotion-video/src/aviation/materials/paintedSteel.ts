import { FrontSide, MeshStandardNodeMaterial, Texture, Vector3 } from "three/webgpu";
import {
  attribute,
  clamp,
  float,
  mix,
  mod,
  normalLocal,
  positionLocal,
  smoothstep,
  step,
  texture,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import { CONTAINER_ATLAS_COLUMNS, CONTAINER_ATLAS_ROWS } from "../three/canvas-textures";
import { falloff, fbm3, ridged3, runoff } from "../three/tsl-noise";
import type { TSL } from "../three/tsl";

/**
 * Painted corrugated steel, as found on a shipping container that has crossed
 * an ocean a few dozen times.
 *
 * The corrugation is real geometry in the supplied model, so this material's
 * whole job is what sits *on* the steel: factory paint, the stencilled codes,
 * chalky UV bleaching on the sun side, grime pulled up from the yard, and oxide
 * running down from the top rail. All of it is driven from local position, so
 * the wear stays welded to the box no matter how the box is placed.
 *
 * Every box in a stack shares one material; variation comes from two instanced
 * attributes, which is what keeps a whole yard down to a handful of draw calls.
 */

/** Per-instance attributes the geometry must carry. */
export const CONTAINER_INSTANCE_ATTRIBUTES = {
  /** Linear-space paint colour. */
  paint: "aPaint",
  /** x: marking atlas index, y: wear seed, z: rust amount, w: sun bleaching. */
  variation: "aVariation",
} as const;

export type PaintedSteelOptions = {
  readonly markings: Texture;
  /** Container length along local Z, in metres. */
  readonly length: number;
  /** Container height along local Y, in metres. */
  readonly height: number;
  /** Global dirt multiplier. A working port runs dirtier than a depot. */
  readonly grime?: number;
};

export const createPaintedSteelMaterial = ({
  markings,
  length,
  height,
  grime = 1,
}: PaintedSteelOptions): MeshStandardNodeMaterial => {
  const material = new MeshStandardNodeMaterial();
  // Single-sided on purpose. The model is a closed box apart from its floor,
  // and rendering back faces lets the inside of the far wall show through that
  // opening — complete with its stencils, mirrored.
  material.side = FrontSide;

  const grimeAmount = uniform(grime);

  const paint = attribute(CONTAINER_INSTANCE_ATTRIBUTES.paint, "vec3") as unknown as TSL;
  const variation = attribute(CONTAINER_INSTANCE_ATTRIBUTES.variation, "vec4") as unknown as TSL;

  const local = positionLocal as unknown as TSL;
  const normal = normalLocal as unknown as TSL;
  const seed = variation.y.mul(37.4);

  // Noise is sampled in a seeded copy of local space so two neighbouring boxes
  // of the same colour never share a wear pattern.
  const wearSpace = local.add(vec3(seed, seed.mul(0.37), seed.mul(0.71)));

  // ---- Paint ---------------------------------------------------------------
  // Chalking: UV breaks down the binder and the pigment goes pale and flat,
  // strongest high on the box where nothing shades it.
  const chalk = smoothstep(0.1, 0.95, local.y.div(height)).mul(variation.w);
  const mottle = fbm3(wearSpace.mul(0.8));
  const bleached = mix(paint, paint.add(vec3(0.16, 0.16, 0.17)).mul(0.92), chalk.mul(0.75));
  const shaded = bleached.mul(mottle.mul(0.18).add(0.9));

  // ---- Grime ---------------------------------------------------------------
  // Splash off the yard surface climbs about a third of the way up. The broader
  // dust film reuses the mottle field at a different weight rather than paying
  // for a third fBm of its own.
  const splash = falloff(0, height * 0.38, local.y as TSL).mul(fbm3(wearSpace.mul(2.4)).add(0.35));
  // Note the weights: `mottle` spans 0..1 where the dedicated dust fBm it
  // replaced was already halved, so matching the old look means halving here.
  const dirtMask = clamp(
    splash.mul(0.62).add(mottle.mul(0.16)).mul(grimeAmount),
    0,
    0.8,
  );
  const dirty = mix(shaded, vec3(0.135, 0.12, 0.103), dirtMask);

  // ---- Oxide ---------------------------------------------------------------
  // Rain lifts oxide from the top rail and draws it down the wall in fingers.
  const streaks = runoff(wearSpace, float(3.1));
  const fromTop = falloff(height * 0.18, height * 0.98, local.y as TSL);
  const rustMask = clamp(streaks.mul(fromTop).mul(variation.z), 0, 1);
  const rustPatch = ridged3(wearSpace.mul(7.4)).mul(rustMask);
  const oxide = mix(vec3(0.21, 0.082, 0.033), vec3(0.42, 0.18, 0.07), rustPatch);
  const weathered = mix(dirty, oxide, rustMask.mul(0.94));

  // ---- Stencilled markings -------------------------------------------------
  // Flat-projected onto the two long walls from local space. The reference
  // clips only ever show the sides, and projecting there avoids the seam a
  // triplanar blend would leave along the corner castings.
  const sideMask = smoothstep(0.55, 0.82, normal.x.abs());
  const along = local.z.div(length).add(0.5);
  // Seen from +X the length axis runs the other way, so the cell is mirrored
  // there to keep the codes reading left to right from both sides of the box.
  //
  // Which wall a fragment is on is decided by its position, not its normal:
  // the corrugation ridges swing the interpolated normal far enough to flip the
  // sign of its X component on the steeper flanks, which mirrors the stencil in
  // bands across the wall.
  const facing = step(0, local.x);
  const u = mix(along, float(1).sub(along), facing);
  const v = float(1).sub(local.y.div(height));

  const index = variation.x;
  const column = mod(index, float(CONTAINER_ATLAS_COLUMNS));
  const row = index.div(CONTAINER_ATLAS_COLUMNS).floor();
  // Inset a little from the cell edge so mip filtering cannot pull a
  // neighbouring cell's ink across the boundary.
  const cellU = column.add(clamp(u, 0.004, 0.996)).div(CONTAINER_ATLAS_COLUMNS);
  const cellV = row.add(clamp(v, 0.008, 0.992)).div(CONTAINER_ATLAS_ROWS);
  const decal = texture(markings, vec2(cellU, cellV));

  // Paint over stencil, then weather over both — the codes wear too.
  const inkMask = decal.a.mul(sideMask).mul(float(1).sub(rustMask.mul(0.7))).mul(0.94);
  const color = mix(weathered, decal.rgb.mul(0.94), inkMask);

  // ---- Response ------------------------------------------------------------
  // Aged alkyd enamel is matte and nearly dielectric; oxide is rougher still
  // but picks up a little specular from the mineral crust.
  const roughness = clamp(
    float(0.62)
      .add(chalk.mul(0.16))
      .add(dirtMask.mul(0.14))
      .add(rustMask.mul(0.12))
      .sub(mottle.mul(0.08)),
    0.3,
    0.97,
  );
  const metalness = clamp(float(0.04).add(rustMask.mul(0.14)), 0, 1);

  material.colorNode = color;
  material.roughnessNode = roughness;
  material.metalnessNode = metalness;
  return material;
};

/**
 * Container paints, sampled from what actually stacks up in a yard.
 *
 * Values are linear, not sRGB — these feed the shader directly.
 */
export const CONTAINER_PALETTE: readonly Vector3[] = [
  new Vector3(0.215, 0.031, 0.024), // oxide red
  new Vector3(0.019, 0.055, 0.148), // deep marine blue
  new Vector3(0.012, 0.106, 0.212), // lighter line blue
  new Vector3(0.262, 0.128, 0.013), // ochre
  new Vector3(0.352, 0.216, 0.02), // yellow
  new Vector3(0.168, 0.052, 0.038), // maroon
  new Vector3(0.018, 0.09, 0.062), // hunter green
  new Vector3(0.235, 0.238, 0.232), // weathered grey
  new Vector3(0.46, 0.458, 0.442), // off white
  new Vector3(0.33, 0.096, 0.026), // orange
];
