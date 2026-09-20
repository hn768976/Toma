import {
  AdditiveBlending,
  BufferGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicNodeMaterial,
  LineSegments,
  Mesh,
  PlaneGeometry,
  SpriteNodeMaterial,
  Texture,
  WireframeGeometry,
} from "three/webgpu";
import {
  float,
  instancedBufferAttribute,
  length,
  positionLocal,
  sin,
  smoothstep,
  texture,
  uv,
} from "three/tsl";
import { colorVec3, floatUniform, type FloatUniform } from "./tsl-helpers";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Palette } from "../palettes";
import { mulberry32 } from "../random";
import { BROW_CULL_Y } from "../constants";

export type EyeParticleOptions = {
  /** Total particle budget (mesh vertices + surface samples). */
  particleCount: number;
  /** Draw the triangle wireframe faintly underneath the dots. */
  wireframe: boolean;
  /** World-space diameter of one dot. */
  dotSize: number;
  seed: number;
};

export type EyeParticles = {
  group: Group;
  setTime: (t: number) => void;
};

/** Loads the cleaned eye model and returns its single geometry. */
export const loadEyeGeometry = async (url: string): Promise<BufferGeometry> => {
  const gltf = await new GLTFLoader().loadAsync(url);
  let geometry: BufferGeometry | null = null;
  gltf.scene.traverse((obj) => {
    const mesh = obj as Mesh;
    if (mesh.isMesh && geometry === null) {
      geometry = mesh.geometry;
    }
  });
  if (geometry === null) {
    throw new Error(`No mesh found in ${url}`);
  }
  return geometry;
};

// Vertices alone leave the smooth eyelid surfaces sparse, so we top the cloud
// up with area-weighted random samples on the triangles. Deterministic.
const samplePositions = (
  geometry: BufferGeometry,
  total: number,
  seed: number,
) => {
  const pos = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const vertexCount = pos.count;
  const out: number[] = [];
  for (let i = 0; i < vertexCount; i++) {
    out.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  }
  const extra = Math.max(0, total - vertexCount);
  if (extra > 0 && index) {
    const triCount = index.count / 3;
    const areas = new Float32Array(triCount);
    let totalArea = 0;
    for (let t = 0; t < triCount; t++) {
      const a = index.getX(t * 3);
      const b = index.getX(t * 3 + 1);
      const c = index.getX(t * 3 + 2);
      const abx = pos.getX(b) - pos.getX(a);
      const aby = pos.getY(b) - pos.getY(a);
      const abz = pos.getZ(b) - pos.getZ(a);
      const acx = pos.getX(c) - pos.getX(a);
      const acy = pos.getY(c) - pos.getY(a);
      const acz = pos.getZ(c) - pos.getZ(a);
      const cx = aby * acz - abz * acy;
      const cy = abz * acx - abx * acz;
      const cz = abx * acy - aby * acx;
      const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
      areas[t] = area;
      totalArea += area;
    }
    const rand = mulberry32(seed);
    let carry = 0;
    for (let t = 0; t < triCount; t++) {
      const expected = (areas[t] / totalArea) * extra + carry;
      const n = Math.floor(expected);
      carry = expected - n;
      if (n === 0) {
        continue;
      }
      const a = index.getX(t * 3);
      const b = index.getX(t * 3 + 1);
      const c = index.getX(t * 3 + 2);
      for (let k = 0; k < n; k++) {
        let u = rand();
        let v = rand();
        if (u + v > 1) {
          u = 1 - u;
          v = 1 - v;
        }
        const w = 1 - u - v;
        out.push(
          pos.getX(a) * w + pos.getX(b) * u + pos.getX(c) * v,
          pos.getY(a) * w + pos.getY(b) * u + pos.getY(c) * v,
          pos.getZ(a) * w + pos.getZ(b) * u + pos.getZ(c) * v,
        );
      }
    }
  }
  // Drop the brow ridge: only the lids, lashes and the ball should remain.
  const kept: number[] = [];
  for (let i = 0; i < out.length; i += 3) {
    if (out[i + 1] <= BROW_CULL_Y) {
      kept.push(out[i], out[i + 1], out[i + 2]);
    }
  }
  return new Float32Array(kept);
};

type LayerOptions = {
  positions: Float32Array;
  seeds: Float32Array;
  color: string;
  size: number;
  intensity: number;
  dotTexture: Texture;
  time: FloatUniform;
};

const makeSpriteLayer = ({
  positions,
  seeds,
  color: hex,
  size,
  intensity,
  dotTexture,
  time,
}: LayerOptions) => {
  const count = positions.length / 3;
  const posAttr = new InstancedBufferAttribute(positions, 3);
  const seedAttr = new InstancedBufferAttribute(seeds, 1);

  const material = new SpriteNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = true;
  material.blending = AdditiveBlending;

  const pos = instancedBufferAttribute<"vec3">(posAttr, "vec3");
  const seed = instancedBufferAttribute<"float">(seedAttr, "float");

  material.positionNode = pos;
  material.scaleNode = float(size).mul(seed.mul(0.9).add(0.55));

  // Per-dot twinkle plus a slow brightness wave that travels across the lids,
  // which gives the "living mesh" feel of the references.
  const flicker = sin(time.mul(seed.mul(2.5).add(1.5)).add(seed.mul(80)))
    .mul(0.5)
    .add(0.5);
  const wave = sin(pos.x.mul(6).add(pos.y.mul(4)).sub(time.mul(0.7)))
    .mul(0.5)
    .add(0.5);
  // Fade the cloud out where the HUD disc sits so the rings stay clean.
  const centreFade = smoothstep(float(0.26), float(0.42), length(pos.xy));
  const soft = texture(dotTexture, uv()).r;
  const brightness = float(0.25)
    .add(flicker.mul(0.45))
    .add(wave.mul(0.3))
    .mul(centreFade)
    .mul(intensity);
  material.colorNode = colorVec3(hex).mul(brightness).mul(soft);
  material.opacityNode = float(1);

  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, count);
  mesh.frustumCulled = false;
  return mesh;
};

export const buildEyeParticles = (
  geometry: BufferGeometry,
  palette: Palette,
  options: EyeParticleOptions,
  dotTexture: Texture,
): EyeParticles => {
  const group = new Group();
  const time = floatUniform(0);

  const positions = samplePositions(
    geometry,
    options.particleCount,
    options.seed,
  );
  const count = positions.length / 3;
  const rand = mulberry32(options.seed + 1);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    seeds[i] = rand();
  }

  // Layer 1: crisp dots.
  group.add(
    makeSpriteLayer({
      positions,
      seeds,
      color: palette.particle,
      size: options.dotSize,
      intensity: palette.particleIntensity,
      dotTexture,
      time,
    }),
  );

  // Layer 2: every 7th dot again, much larger and dimmer, as a cheap
  // depth-of-field haze around the lids.
  const hazeCount = Math.floor(count / 4);
  const hazePos = new Float32Array(hazeCount * 3);
  const hazeSeeds = new Float32Array(hazeCount);
  for (let i = 0; i < hazeCount; i++) {
    hazePos[i * 3] = positions[i * 12];
    hazePos[i * 3 + 1] = positions[i * 12 + 1];
    hazePos[i * 3 + 2] = positions[i * 12 + 2];
    hazeSeeds[i] = seeds[i * 4];
  }
  group.add(
    makeSpriteLayer({
      positions: hazePos,
      seeds: hazeSeeds,
      color: palette.particle,
      size: options.dotSize * 10,
      intensity: palette.particleIntensity * 0.16,
      dotTexture,
      time,
    }),
  );

  if (options.wireframe) {
    const wireMaterial = new LineBasicNodeMaterial();
    wireMaterial.transparent = true;
    wireMaterial.depthWrite = false;
    wireMaterial.blending = AdditiveBlending;
    wireMaterial.colorNode = colorVec3(palette.particle);
    wireMaterial.opacityNode = smoothstep(
      float(0.27),
      float(0.42),
      length(positionLocal.xy),
    )
      .mul(smoothstep(float(BROW_CULL_Y + 0.02), float(BROW_CULL_Y - 0.03), positionLocal.y))
      .mul(0.1 * palette.particleIntensity);
    const wire = new LineSegments(new WireframeGeometry(geometry), wireMaterial);
    wire.frustumCulled = false;
    group.add(wire);
  }

  return {
    group,
    setTime: (t) => {
      time.value = t;
    },
  };
};
