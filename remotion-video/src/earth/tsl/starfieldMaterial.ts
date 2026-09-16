import {
  dot,
  float,
  floor,
  Fn,
  length,
  mix,
  mx_fractal_noise_float,
  normalize,
  oneMinus,
  positionLocal,
  pow,
  saturate,
  smoothstep,
  step,
  vec3,
  vec4,
} from "three/tsl";
import { BackSide, MeshBasicNodeMaterial, type Node } from "three/webgpu";
import { hash31 } from "./common";

/**
 * One octave of stars.
 *
 * The sky is diced into a lattice in direction space and each cell either
 * holds a star or does not. Doing it analytically rather than with geometry
 * keeps the stars the same angular size at 1080p and at 4K, and keeps them
 * perfectly stable from frame to frame — a point cloud of this density
 * scintillates under any kind of resampling.
 */
const starLayer = (dir: Node, cells: number, sparsity: number, gain: number): Node => {
  const p = dir.mul(cells);
  const cell = floor(p);
  const offset = p.sub(cell);

  const exists = step(float(sparsity), hash31(cell.add(vec3(3.3, 11.7, 5.1))));
  const centre = vec3(
    hash31(cell),
    hash31(cell.add(vec3(13.1, 7.3, 91.7))),
    hash31(cell.add(vec3(57.7, 31.3, 5.9))),
  );
  const magnitude = hash31(cell.add(vec3(71.3, 2.1, 43.7)));

  const radius = magnitude.mul(0.14).add(0.09);
  const falloff = saturate(oneMinus(length(offset.sub(centre)).div(radius)));
  const intensity = pow(falloff, 2.6).mul(magnitude.mul(magnitude)).mul(gain).mul(exists);

  // Slight spread of colour temperature so the field is not a grey dust.
  const tint = mix(vec3(1.0, 0.86, 0.72), vec3(0.78, 0.88, 1.0), hash31(cell.add(vec3(8.8))));
  return tint.mul(intensity);
};

export const createStarfieldMaterial = () => {
  const material = new MeshBasicNodeMaterial();
  material.side = BackSide;
  material.depthWrite = false;
  material.depthTest = false;

  material.colorNode = Fn(() => {
    const dir = normalize(positionLocal);

    const stars = starLayer(dir, 240, 0.9, 1.0)
      .add(starLayer(dir, 520, 0.955, 0.5))
      .add(starLayer(dir, 1050, 0.978, 0.26));

    // A barely-there galactic band, enough to stop the void reading as flat
    // black without ever becoming a feature.
    const band = smoothstep(0.34, 0.0, dot(dir, vec3(0.35, 0.86, 0.37)).abs());
    const clouds = saturate(mx_fractal_noise_float(dir.mul(2.6), 4, 2, 0.55).mul(0.5).add(0.5));
    const haze = vec3(0.009, 0.011, 0.018).mul(band).mul(clouds);

    return vec4(stars.add(haze), 1);
  })() as unknown as Node;

  return material;
};
