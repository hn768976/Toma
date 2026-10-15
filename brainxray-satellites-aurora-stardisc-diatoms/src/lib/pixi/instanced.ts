import { Buffer, BufferUsage, Geometry, GlProgram, Mesh, Shader, TextureSource, UniformGroup } from "pixi.js";
import type { Uniforms } from "./helpers";

/**
 * Instanced quads. Each instance has `floatsPerInstance` floats split into
 * vec4 attributes aI0, aI1, ... (pad to a multiple of 4). The corner of the
 * quad is aPosition in [-1, 1]^2.
 */
export const makeInstanced = (opts: {
  count: number;
  floatsPerInstance: number; // multiple of 4
  vertex: string;
  fragment: string;
  uniforms: Uniforms;
  textures?: Record<string, TextureSource>;
  data?: Float32Array; // static data (otherwise update per frame)
  name?: string;
}) => {
  const fpi = opts.floatsPerInstance;
  const data = opts.data ?? new Float32Array(opts.count * fpi);
  const buffer = new Buffer({ data, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
  const attributes: Record<string, unknown> = {
    aPosition: { buffer: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), format: "float32x2" },
  };
  for (let k = 0; k < fpi / 4; k++) {
    attributes[`aI${k}`] = { buffer, format: "float32x4", instance: true, stride: fpi * 4, offset: k * 16 };
  }
  const geometry = new Geometry({ attributes: attributes as never, indexBuffer: [0, 1, 2, 0, 2, 3], instanceCount: opts.count });
  const group = new UniformGroup(opts.uniforms as never);
  const resources: Record<string, unknown> = { u: group, ...(opts.textures ?? {}) };
  const shader = new Shader({
    glProgram: new GlProgram({ vertex: opts.vertex, fragment: opts.fragment, name: opts.name, preferredFragmentPrecision: "highp" }),
    resources,
  });
  const mesh = new Mesh({ geometry, shader });
  return {
    mesh,
    data,
    u: group.uniforms as Record<string, number | Float32Array | number[]>,
    setCount: (n: number) => {
      geometry.instanceCount = n;
    },
    upload: () => buffer.update(),
  };
};
