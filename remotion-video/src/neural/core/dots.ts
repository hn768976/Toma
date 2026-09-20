/**
 * Point sprites: the data packets travelling along the strands, and the soft
 * flares sitting on each convergence node.
 *
 * `PointsMaterial` carries a single size for the whole draw call, so varying
 * dot sizes are handled by splitting the field into a few size buckets rather
 * than by a custom shader. Keeping to stock materials is what lets the same
 * scene graph run on the WebGPU node pipeline and on classic WebGL alike.
 *
 * Per-dot brightness is premultiplied into the vertex colour: under additive
 * blending the source is scaled by its own alpha, which here comes from the
 * sprite texture, so RGB is the only free channel left.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DynamicDrawUsage,
  LinearFilter,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  type Texture,
} from "three";

/**
 * Radial sprite with a controllable falloff. Low exponents give a wide soft
 * halo (bokeh, node flares); high exponents give a tight dot with just enough
 * edge softness to stay antialiased.
 */
export const makeDotTexture = (
  resolution: number,
  falloff: number,
): Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D context unavailable for sprite generation");
  }

  const image = ctx.createImageData(resolution, resolution);
  const half = resolution / 2;

  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const dx = (x + 0.5 - half) / half;
      const dy = (y + 0.5 - half) / half;
      const d = Math.hypot(dx, dy);
      const v = d >= 1 ? 0 : Math.pow(1 - d, falloff);

      const o = (y * resolution + x) * 4;
      image.data[o] = 255;
      image.data[o + 1] = 255;
      image.data[o + 2] = 255;
      image.data[o + 3] = Math.round(v * 255);
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

export type Dot = {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  /** Multiplies the colour; additive blending turns it into brightness. */
  brightness: number;
};

export type DotWriter = (index: number, out: Dot) => void;

export class DotField {
  readonly points: Points;

  private readonly count: number;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly geometry: BufferGeometry;
  private readonly material: PointsMaterial;
  private readonly dot: Dot = {
    x: 0,
    y: 0,
    z: 0,
    r: 1,
    g: 1,
    b: 1,
    brightness: 1,
  };

  constructor(count: number, worldSize: number, texture: Texture) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);

    const positionAttr = new BufferAttribute(this.positions, 3);
    positionAttr.setUsage(DynamicDrawUsage);
    const colorAttr = new BufferAttribute(this.colors, 3);
    colorAttr.setUsage(DynamicDrawUsage);

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", positionAttr);
    this.geometry.setAttribute("color", colorAttr);

    this.material = new PointsMaterial({
      size: worldSize,
      sizeAttenuation: true,
      map: texture,
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });

    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  update(write: DotWriter): void {
    const { dot, positions, colors } = this;

    for (let i = 0; i < this.count; i++) {
      dot.brightness = 1;
      write(i, dot);

      const p = i * 3;
      positions[p] = dot.x;
      positions[p + 1] = dot.y;
      positions[p + 2] = dot.z;
      colors[p] = dot.r * dot.brightness;
      colors[p + 1] = dot.g * dot.brightness;
      colors[p + 2] = dot.b * dot.brightness;
    }

    this.geometry.getAttribute("position").needsUpdate = true;
    this.geometry.getAttribute("color").needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
