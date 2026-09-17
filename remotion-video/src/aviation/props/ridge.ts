import { Mesh, MeshStandardNodeMaterial, PlaneGeometry, Vector3 } from "three/webgpu";
import { mix, positionWorld, smoothstep, vec3 } from "three/tsl";
import { createRng } from "../three/rng";
import type { TSL } from "../three/tsl";

/**
 * A distant mountain ridge, for the end of the cruise shot.
 *
 * Reference 4 reveals peaks through the cloud deck in its last second. They are
 * tens of kilometres away and read almost entirely as a hazed silhouette, so
 * the mesh is a displaced plane rather than terrain: at that distance the only
 * things that survive are the skyline and the snow line.
 */

export type Ridge = {
  readonly object: Mesh;
  dispose(): void;
};

export type RidgeOptions = {
  readonly seed: number;
  /** Extent across the view, in metres. */
  readonly width: number;
  readonly depth: number;
  /** Peak height above the base plane, in metres. */
  readonly relief: number;
  readonly baseHeight: number;
  readonly rockColor?: Vector3;
  readonly snowColor?: Vector3;
  /** Altitude at which snow starts, in metres. */
  readonly snowLine?: number;
};

export const createRidge = (options: RidgeOptions): Ridge => {
  const {
    seed,
    width,
    depth,
    relief,
    baseHeight,
    rockColor = new Vector3(0.055, 0.06, 0.075),
    snowColor = new Vector3(0.78, 0.8, 0.86),
    snowLine = baseHeight + relief * 0.45,
  } = options;

  const segmentsX = 160;
  const segmentsY = 48;
  const geometry = new PlaneGeometry(width, depth, segmentsX, segmentsY);
  geometry.rotateX(-Math.PI / 2);

  const rng = createRng(seed);
  // A handful of octaves with independent phases; enough for a believable
  // skyline without the cost of a real noise field this far from the camera.
  const octaves = Array.from({ length: 6 }, (_, i) => ({
    frequency: (1.7 + i * 2.3) / width,
    amplitude: 1 / (i + 1) ** 1.35,
    phaseX: rng.float(0, Math.PI * 2),
    phaseZ: rng.float(0, Math.PI * 2),
    skew: rng.float(0.4, 1.6),
  }));

  const position = geometry.getAttribute("position");
  let maxima = 0;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    let h = 0;
    for (const o of octaves) {
      h +=
        o.amplitude *
        Math.sin(x * o.frequency * Math.PI * 2 + o.phaseX) *
        Math.cos(z * o.frequency * o.skew * Math.PI * 2 + o.phaseZ);
    }
    // Ridged transform: sharp crests, broad valleys, the way real rock erodes.
    // The sum of octaves can exceed 1, which would make this negative — and a
    // negative base raised to a fractional power is NaN, which propagates
    // straight into the vertex buffer.
    const ridged = Math.max(0, 1 - Math.abs(h));
    const shaped = ridged ** 2.4;
    maxima = Math.max(maxima, shaped);
    position.setY(i, shaped);
  }
  for (let i = 0; i < position.count; i++) {
    position.setY(i, (position.getY(i) / (maxima || 1)) * relief);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  const material = new MeshStandardNodeMaterial();
  material.roughness = 0.92;
  material.metalness = 0;
  const altitude = (positionWorld.y as unknown as TSL).add(baseHeight);
  const snow = smoothstep(snowLine, snowLine + relief * 0.3, altitude);
  material.colorNode = mix(
    vec3(rockColor.x, rockColor.y, rockColor.z),
    vec3(snowColor.x, snowColor.y, snowColor.z),
    snow,
  ) as TSL;

  const mesh = new Mesh(geometry, material);
  mesh.position.y = baseHeight;
  mesh.frustumCulled = false;

  return {
    object: mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
};
