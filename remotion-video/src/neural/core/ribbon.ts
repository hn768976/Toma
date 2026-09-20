/**
 * Camera-facing ribbon strips, one per fibre strand.
 *
 * GL line primitives are locked to one pixel wide, which makes them scale
 * wrongly between the 1080p and 4K outputs, so each strand is built as a
 * triangle strip with a real world-space width instead. Width is therefore
 * subject to perspective, which is what gives depth its natural falloff.
 *
 * Colour is carried as RGBA per vertex and drawn with additive blending, so
 * the alpha channel doubles as the strand's emission strength.
 *
 * Each strand is several vertices wide, following a `CrossSection` profile
 * that fades alpha towards the edges. That bakes a bright core with a soft
 * skirt straight into the geometry, which reads as bloom without any
 * post-processing pass -- so the result is identical on every backend and
 * costs one draw call.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
} from "three";

/** Scratch record filled in by the caller for one sample of one strand. */
export type Sample = {
  x: number;
  y: number;
  z: number;
  /** World-space ribbon width at this sample. */
  width: number;
  r: number;
  g: number;
  b: number;
  /** Emission strength; additive blending turns this into brightness. */
  a: number;
};

export type SampleWriter = (
  strandIndex: number,
  sampleIndex: number,
  /** Normalised position along the strand, 0..1. */
  t: number,
  out: Sample,
) => void;

/**
 * Lateral profile of a strand, from one edge to the other. `offset` is in
 * units of half-width (-1..1) and `alpha` scales the sample's emission, so a
 * profile that ends in zeroes gives the strand soft, antialiased edges.
 */
export type CrossSection = readonly { offset: number; alpha: number }[];

/** Thin bright core with a soft falloff either side. */
export const GLOW_PROFILE: CrossSection = [
  { offset: -1, alpha: 0 },
  { offset: -0.3, alpha: 1 },
  { offset: 0.3, alpha: 1 },
  { offset: 1, alpha: 0 },
];

const FLOATS_PER_SAMPLE = 8;

export class RibbonMesh {
  readonly mesh: Mesh;

  private readonly strandCount: number;
  private readonly samples: number;
  private readonly profile: CrossSection;
  private readonly across: number;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  /** Per-strand scratch buffer, reused every frame to avoid allocation. */
  private readonly scratch: Float32Array;
  private readonly sample: Sample = {
    x: 0,
    y: 0,
    z: 0,
    width: 1,
    r: 1,
    g: 1,
    b: 1,
    a: 1,
  };

  private readonly geometry: BufferGeometry;
  private readonly material: MeshBasicMaterial;

  constructor(
    strandCount: number,
    samples: number,
    profile: CrossSection = GLOW_PROFILE,
  ) {
    this.strandCount = strandCount;
    this.samples = samples;
    this.profile = profile;
    this.across = profile.length;

    const across = this.across;
    const vertexCount = strandCount * samples * across;
    this.positions = new Float32Array(vertexCount * 3);
    this.colors = new Float32Array(vertexCount * 4);
    this.scratch = new Float32Array(samples * FLOATS_PER_SAMPLE);

    const segments = samples - 1;
    const quadsPerSegment = across - 1;
    const index = new Uint32Array(strandCount * segments * quadsPerSegment * 6);
    let o = 0;
    for (let s = 0; s < strandCount; s++) {
      const base = s * samples * across;
      for (let i = 0; i < segments; i++) {
        const rowA = base + i * across;
        const rowB = base + (i + 1) * across;
        for (let k = 0; k < quadsPerSegment; k++) {
          index[o] = rowA + k;
          index[o + 1] = rowB + k;
          index[o + 2] = rowA + k + 1;
          index[o + 3] = rowA + k + 1;
          index[o + 4] = rowB + k;
          index[o + 5] = rowB + k + 1;
          o += 6;
        }
      }
    }

    const positionAttr = new BufferAttribute(this.positions, 3);
    positionAttr.setUsage(DynamicDrawUsage);
    const colorAttr = new BufferAttribute(this.colors, 4);
    colorAttr.setUsage(DynamicDrawUsage);

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", positionAttr);
    this.geometry.setAttribute("color", colorAttr);
    this.geometry.setIndex(new BufferAttribute(index, 1));

    this.material = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      side: DoubleSide,
      toneMapped: false,
    });

    this.mesh = new Mesh(this.geometry, this.material);
    // The strands are additive and unsorted, so a bounding volume would only
    // ever cause incorrect culling as the field scrolls past the camera.
    this.mesh.frustumCulled = false;
  }

  /** Rebuilds every vertex for the current frame. */
  update(write: SampleWriter): void {
    const { samples, scratch, positions, colors, sample } = this;
    const lastSample = samples - 1;

    for (let s = 0; s < this.strandCount; s++) {
      for (let i = 0; i < samples; i++) {
        sample.width = 1;
        sample.a = 1;
        write(s, i, i / lastSample, sample);

        const o = i * FLOATS_PER_SAMPLE;
        scratch[o] = sample.x;
        scratch[o + 1] = sample.y;
        scratch[o + 2] = sample.z;
        scratch[o + 3] = sample.width;
        scratch[o + 4] = sample.r;
        scratch[o + 5] = sample.g;
        scratch[o + 6] = sample.b;
        scratch[o + 7] = sample.a;
      }

      const vertexBase = s * samples * this.across;

      for (let i = 0; i < samples; i++) {
        const o = i * FLOATS_PER_SAMPLE;
        const x = scratch[o];
        const y = scratch[o + 1];
        const z = scratch[o + 2];

        // Central difference for the tangent; one-sided at the ends.
        const prev = (i === 0 ? 0 : i - 1) * FLOATS_PER_SAMPLE;
        const next = (i === lastSample ? lastSample : i + 1) * FLOATS_PER_SAMPLE;
        const tx = scratch[next] - scratch[prev];
        const ty = scratch[next + 1] - scratch[prev + 1];

        // Widen along the screen-space perpendicular of the tangent, i.e.
        // the cross product with the world Z axis. That is exactly
        // camera-facing in V1, where the camera looks down -Z; in V2 the
        // camera is pitched down onto the layer planes, so ribbons stand
        // roughly upright and are foreshortened by a constant factor. Since
        // every strand there is foreshortened equally it reads as a slightly
        // finer line weight, not as distortion -- and keeping the normal
        // independent of the camera means width never swims as it moves.
        let nx = ty;
        let ny = -tx;
        const len = Math.hypot(nx, ny);
        if (len > 1e-6) {
          nx /= len;
          ny /= len;
        } else {
          nx = 0;
          ny = 1;
        }

        const half = scratch[o + 3] * 0.5;
        const r = scratch[o + 4];
        const g = scratch[o + 5];
        const b = scratch[o + 6];
        const a = scratch[o + 7];
        const rowBase = vertexBase + i * this.across;

        for (let k = 0; k < this.across; k++) {
          const lane = this.profile[k];
          const d = lane.offset * half;

          const p = (rowBase + k) * 3;
          positions[p] = x + nx * d;
          positions[p + 1] = y + ny * d;
          positions[p + 2] = z;

          const c = (rowBase + k) * 4;
          colors[c] = r;
          colors[c + 1] = g;
          colors[c + 2] = b;
          colors[c + 3] = a * lane.alpha;
        }
      }
    }

    this.geometry.getAttribute("position").needsUpdate = true;
    this.geometry.getAttribute("color").needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
