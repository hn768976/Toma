import {
  Buffer,
  BufferUsage,
  Container,
  Geometry,
  GlProgram,
  Mesh,
  Shader,
  UniformGroup,
} from 'pixi.js';

type UniformSpec = Record<string, { value: number | Float32Array; type: string }>;

// One quad (two triangles) drawn once per instance; per-instance data comes
// from the given float attributes. The corner attribute is named aPosition.
export const instancedQuadGeometry = (
  attrs: Record<string, { data: Float32Array; size: number }>,
  count: number,
) => {
  const attributes: Record<string, unknown> = {
    aPosition: { buffer: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), format: 'float32x2' },
  };
  for (const [name, a] of Object.entries(attrs)) {
    attributes[name] = {
      buffer: new Buffer({ data: a.data, usage: BufferUsage.VERTEX }),
      format: `float32x${a.size}`,
      instance: true,
    };
  }
  return new Geometry({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attributes: attributes as any,
    indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
    instanceCount: count,
  });
};

export const makeShader = (
  name: string,
  vertex: string,
  fragment: string,
  uniforms: UniformSpec,
  extra: Record<string, unknown> = {},
) => {
  const group = new UniformGroup(uniforms as never);
  const shader = new Shader({
    glProgram: GlProgram.from({ vertex, fragment, name }),
    resources: { sceneUniforms: group, ...extra },
  });
  return { shader, group };
};

export const FULLSCREEN_VERT = /* glsl */ `
in vec2 aPosition;
out vec2 vUV;
void main() {
  vUV = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const fullscreenMesh = (shader: Shader) => {
  const geometry = new Geometry({
    attributes: {
      aPosition: { buffer: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), format: 'float32x2' },
    },
    indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
  });
  const mesh = new Mesh({ geometry, shader });
  const c = new Container();
  c.addChild(mesh);
  return { container: c, mesh };
};
