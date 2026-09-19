import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  abs,
  attribute,
  clamp,
  float,
  floor,
  mix,
  mod,
  normalize,
  positionGeometry,
  normalGeometry,
  pow,
  sign,
  smoothstep,
  texture,
  vec2,
  vec3,
} from "three/tsl";
import { BOX_HEIGHT } from "./constants";
import {
  getCorrugationNormal,
  getStencilAtlas,
  getWeatherTexture,
  STENCIL_COLS,
} from "./textures";

/**
 * The container surface, built as a TSL node graph so one definition compiles
 * to WGSL on the WebGPU backend and GLSL on the WebGL2 backend.
 *
 * Surface detail is projected triplanar from object space rather than read
 * from the mesh UVs. The supplied mesh carries an atlas-style unwrap from its
 * generator, which is fine for a single baked texture but useless for placing
 * rust along the bottom rail or a carrier mark at door height. Object-space
 * projection also means the procedural LOD boxes and the decimated source mesh
 * share one material and weather identically.
 *
 * Per-instance variation rides on instanced attributes: aSeed offsets the
 * noise lookup so no two containers wear the same way, aWeather scales how
 * hard they have been used, aColor is the livery, aStencil picks a carrier.
 */

export type ContainerMaterialOptions = {
  /**
   * Fakes corrugation on the procedural LOD boxes, whose geometry is flat.
   * At the distances those LODs are used the ridges are a couple of pixels
   * across, so banded shading reads the same as modelled corrugation and
   * costs nothing. The near LODs have the real thing and must not get this.
   */
  corrugationBands?: boolean;
  /** Carrier marks. Off for the most distant LOD, where they are sub-pixel. */
  stencils?: boolean;
  /** Global multiplier for how beaten-up the fleet looks (0 = fresh paint). */
  weathering?: number;
};

export const createContainerMaterial = ({
  corrugationBands = false,
  stencils = true,
  weathering = 1,
}: ContainerMaterialOptions = {}): MeshStandardNodeMaterial => {
  const weather = getWeatherTexture();
  const corrugation = getCorrugationNormal();
  const stencilAtlas = getStencilAtlas();

  // positionGeometry / normalGeometry, NOT positionLocal / normalLocal: three's
  // InstanceNode overwrites positionLocal with the instance-transformed
  // position, so on an InstancedMesh that is effectively world space. Using it
  // here would stretch one noise field across an entire stack -- which reads as
  // camouflage rather than per-container wear -- and would put the carrier mark
  // band at a fixed height above the ground instead of on every container.
  const p = positionGeometry;
  const n = normalize(normalGeometry);

  // Triplanar weights, sharpened so faces do not smear into each other.
  const an = abs(n);
  const raised = pow(an, float(8));
  const w = raised.div(raised.x.add(raised.y).add(raised.z).max(float(0.0001)));

  const seed = attribute("aSeed", "float");
  const base = attribute("aColor", "vec3");
  const wear = attribute("aWeather", "float").mul(float(weathering));
  const stencilIndex = attribute("aStencil", "float");

  // One noise tile per ~3.3m, offset per instance.
  const s = float(0.52);
  const off = vec2(seed, seed.mul(float(1.61)));
  const sX = texture(weather, vec2(p.z, p.y).mul(s).add(off));
  const sY = texture(weather, vec2(p.x, p.z).mul(s).add(off));
  const sZ = texture(weather, vec2(p.x, p.y).mul(s).add(off));
  const W = sX.mul(w.x).add(sY.mul(w.y)).add(sZ.mul(w.z));

  // Height within the container drives where corrosion starts.
  const h = p.y.div(float(BOX_HEIGHT));
  const lowBias = smoothstep(float(0.0), float(0.17), h).oneMinus();
  const topBias = smoothstep(float(0.88), float(1.0), h);
  const edge = float(1).add(lowBias.mul(float(0.5))).add(topBias.mul(float(0.35)));

  // A high threshold keeps corrosion to isolated patches. Paint covers most of
  // a working container; it is the exceptions that read as age.
  const rust = smoothstep(
    float(0.66),
    float(1.02),
    W.r.mul(edge).mul(float(0.55).add(wear.mul(float(0.85)))),
  );

  // Run-off staining: the noise channel is stretched vertically, so gating it
  // to the walls is enough to read as streaks rather than blotches.
  const sideMask = w.y.oneMinus();
  const streak = smoothstep(float(0.58), float(0.9), W.b)
    .mul(smoothstep(float(0.1), float(0.95), h).oneMinus())
    .mul(wear)
    .mul(sideMask);

  const chalk = smoothstep(float(0.4), float(0.85), W.g).mul(wear).mul(float(0.3));
  const patch = W.a.mul(wear).mul(float(0.22));

  const rustColor = mix(vec3(0.33, 0.14, 0.07), vec3(0.56, 0.31, 0.15), W.g);

  // Each stage is its own binding: the node graph is built once at material
  // creation, so naming the stages costs nothing and keeps the order of
  // weathering passes legible.
  const bleached = mix(base, base.mul(float(1.3)).add(float(0.012)), chalk);
  // Repainted panels sit a shade off the rest of the box.
  const repainted = mix(bleached, base.mul(float(0.86)), patch);
  const corroded = mix(repainted, rustColor, rust.mul(float(0.55)));
  const stained = mix(corroded, rustColor.mul(float(1.25)), streak.mul(float(0.22)));
  // Road grime gathers along the bottom rail.
  const grimed = mix(stained, stained.mul(float(0.72)), lowBias.mul(wear).mul(float(0.22)));

  let banded = grimed;
  if (corrugationBands) {
    // Ridge profile as alternating light and dark bands. Pitch matches the
    // modelled corrugation on the source mesh (0.16m) so LOD swaps do not pop.
    const bandSide = texture(corrugation, vec2(p.z.div(float(0.16)), float(0.5))).r;
    const bandEnd = texture(corrugation, vec2(p.x.div(float(0.16)), float(0.5))).r;
    const bandRoof = texture(corrugation, vec2(p.x.div(float(0.3)), float(0.5))).r;
    const band = bandSide.mul(w.x).add(bandRoof.mul(w.y)).add(bandEnd.mul(w.z));
    banded = grimed.mul(float(1).add(band.sub(float(0.5)).mul(float(0.18))));
  }

  let marked = banded;
  if (stencils) {
    const tile = float(STENCIL_COLS);
    const col = mod(stencilIndex, tile);
    const row = floor(stencilIndex.div(tile));

    // Side walls: mark sits at door height, mirrored per side so it reads the
    // right way round from either flank.
    const sideU = p.z.mul(sign(n.x)).negate().add(float(2.0)).div(float(4.0));
    const sideV = float(1).sub(p.y.sub(float(1.3)).div(float(0.8)));
    /**
     * 1 inside the unit square, 0 outside, with a hair of softness on the
     * edge. Deliberately not built from step(): TSL takes its arguments in the
     * opposite order to GLSL, which makes the obvious pair of bounds checks
     * mutually exclusive and silently gates everything to zero. smoothstep
     * here takes (edge0, edge1, x), same as GLSL.
     */
    const inUnitSquare = (u: typeof sideU, v: typeof sideV) => {
      const du = smoothstep(float(0.48), float(0.5), u.sub(float(0.5)).abs()).oneMinus();
      const dv = smoothstep(float(0.48), float(0.5), v.sub(float(0.5)).abs()).oneMinus();
      return du.mul(dv);
    };

    const sideUv = vec2(col.add(sideU), row.add(sideV)).div(tile);
    const sideMark = texture(stencilAtlas, sideUv).r
      .mul(inUnitSquare(sideU, sideV))
      .mul(w.x);

    // Door end.
    const endU = p.x.mul(sign(n.z)).add(float(1.0)).div(float(2.0));
    const endV = float(1).sub(p.y.sub(float(1.2)).div(float(0.75)));
    const endUv = vec2(col.add(endU), row.add(endV)).div(tile);
    const endMark = texture(stencilAtlas, endUv).r
      .mul(inUnitSquare(endU, endV))
      .mul(w.z);

    // Paint wears off where the box has rusted through.
    const mark = clamp(sideMark.add(endMark), float(0), float(1)).mul(
      rust.mul(float(0.85)).oneMinus(),
    );
    marked = mix(banded, vec3(0.85, 0.84, 0.81), mark.mul(float(0.72)));
  }

  const material = new MeshStandardNodeMaterial();
  material.colorNode = marked;
  material.roughnessNode = clamp(
    mix(float(0.52), float(0.95), rust).add(chalk.mul(float(0.12))),
    float(0.05),
    float(1),
  );
  material.metalnessNode = mix(float(0.28), float(0.03), rust);
  return material;
};

/**
 * Tier-3 fallback for a renderer without node material support. Keeps the
 * livery via InstancedMesh.instanceColor and drops the procedural weathering.
 */
export const createFallbackMaterial = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ roughness: 0.68, metalness: 0.2 });
