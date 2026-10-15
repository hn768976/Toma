import { BufferImageSource, Geometry, Mesh, RenderTexture, Shader, Texture, TextureSource } from "pixi.js";

/**
 * Build a texture from a pure function of (u, v) -> [r, g, b, a] (0..1, straight alpha).
 * Stored premultiplied. Deterministic: no canvas 2D rasteriser involved.
 */
export const makeTexture = (
  w: number,
  h: number,
  fn: (u: number, v: number) => [number, number, number, number],
) => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fn((x + 0.5) / w, (y + 0.5) / h);
      const i = (y * w + x) * 4;
      data[i] = Math.round(Math.min(1, r * a) * 255);
      data[i + 1] = Math.round(Math.min(1, g * a) * 255);
      data[i + 2] = Math.round(Math.min(1, b * a) * 255);
      data[i + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  const source = new BufferImageSource({
    resource: data,
    width: w,
    height: h,
    format: "rgba8unorm",
    alphaMode: "premultiplied-alpha",
    scaleMode: "linear",
    autoGenerateMipmaps: true,
  });
  return new Texture({ source });
};

/**
 * Half-float render target (keeps gradients free of 8-bit steps until the final dithered pass).
 * Note: a bare TextureSource is allocated as RGBA8 by Pixi's GL backend regardless of `format`,
 * so the target is backed by a BufferImageSource, whose uploader honours rgba16float.
 */
export const makeHdrTarget = (w: number, h: number) => {
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));
  const source = new BufferImageSource({
    resource: new Uint16Array(width * height * 4),
    width,
    height,
    format: "rgba16float",
    scaleMode: "linear",
    resolution: 1,
    alphaMode: "premultiplied-alpha",
  });
  return new RenderTexture({ source });
};

export const FS_VERT = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}
`;

/** A w x h quad with a custom fragment shader. */
export const makeQuad = (
  w: number,
  h: number,
  fragment: string,
  resources: Record<string, unknown>,
) => {
  const geometry = new Geometry({
    attributes: {
      aPosition: [0, 0, w, 0, w, h, 0, h],
      aUV: [0, 0, 1, 0, 1, 1, 0, 1],
    },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });
  const shader = Shader.from({ gl: { vertex: FS_VERT, fragment }, resources });
  return new Mesh({ geometry, shader });
};

export type { TextureSource };
