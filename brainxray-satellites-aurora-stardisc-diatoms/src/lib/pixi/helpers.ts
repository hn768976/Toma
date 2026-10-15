import { Geometry, GlProgram, Mesh, Shader, Texture, TextureSource, UniformGroup } from "pixi.js";

type UniformDef = { value: number | Float32Array | number[]; type: string; size?: number };
export type Uniforms = Record<string, UniformDef>;

export const GLSL_HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
`;

/** Standard Pixi 8 mesh vertex shader passing vUV through. */
export const QUAD_VERT = /* glsl */ `${GLSL_HEADER}
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
}`;

export const quadGeometry = (x: number, y: number, w: number, h: number) =>
  new Geometry({
    attributes: {
      aPosition: [x, y, x + w, y, x + w, y + h, x, y + h],
      aUV: [0, 0, 1, 0, 1, 1, 0, 1],
    },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });

export type ShaderMesh = { mesh: Mesh<Geometry, Shader>; u: Record<string, number | Float32Array | number[]> };

/** A mesh with a custom WebGL2 program; `u` writes go straight to the uniform group. */
export const makeShaderMesh = (opts: {
  geometry: Geometry;
  vertex?: string;
  fragment: string;
  uniforms: Uniforms;
  textures?: Record<string, TextureSource | Texture>;
  name?: string;
}): ShaderMesh => {
  const group = new UniformGroup(opts.uniforms as never);
  const resources: Record<string, unknown> = { u: group };
  for (const [k, t] of Object.entries(opts.textures ?? {})) {
    resources[k] = t instanceof Texture ? t.source : t;
  }
  const shader = new Shader({
    glProgram: new GlProgram({
      vertex: opts.vertex ?? QUAD_VERT,
      fragment: opts.fragment,
      name: opts.name,
      preferredFragmentPrecision: "highp",
    }),
    resources,
  });
  const mesh = new Mesh({ geometry: opts.geometry, shader });
  return { mesh, u: group.uniforms as ShaderMesh["u"] };
};

/** Full-design-size quad with a fragment shader. */
export const fullscreenMesh = (W: number, H: number, fragment: string, uniforms: Uniforms, textures?: Record<string, TextureSource | Texture>, name?: string) =>
  makeShaderMesh({ geometry: quadGeometry(0, 0, W, H), fragment, uniforms, textures, name });

/** Upload a canvas (2D) as a linear-filtered texture. */
export const canvasTexture = (c: HTMLCanvasElement | OffscreenCanvas, opts?: { repeat?: boolean; mip?: boolean }) => {
  const t = Texture.from(c as HTMLCanvasElement);
  t.source.style.addressMode = opts?.repeat ? "repeat" : "clamp-to-edge";
  t.source.style.scaleMode = "linear";
  if (opts?.mip) {
    t.source.autoGenerateMipmaps = true;
    t.source.style.mipmapFilter = "linear";
    t.source.updateMipmaps();
  }
  t.source.update();
  return t;
};

/** Common GLSL: integer hashing, value noise, fbm. All deterministic. */
export const GLSL_NOISE = /* glsl */ `
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hash3i(ivec3 p) { return float(pcg(uint(p.x) + pcg(uint(p.y) + pcg(uint(p.z))))) / 4294967295.0; }
float hash2i(ivec2 p) { return float(pcg(uint(p.x) + pcg(uint(p.y)))) / 4294967295.0; }
float hash21(vec2 p) { return hash2i(ivec2(floor(p))); }
float vnoise3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec3 b = ivec3(i);
  float n000 = hash3i(b), n100 = hash3i(b + ivec3(1,0,0)), n010 = hash3i(b + ivec3(0,1,0)), n110 = hash3i(b + ivec3(1,1,0));
  float n001 = hash3i(b + ivec3(0,0,1)), n101 = hash3i(b + ivec3(1,0,1)), n011 = hash3i(b + ivec3(0,1,1)), n111 = hash3i(b + ivec3(1,1,1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float vnoise2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  ivec2 b = ivec2(i);
  return mix(mix(hash2i(b), hash2i(b + ivec2(1,0)), u.x), mix(hash2i(b + ivec2(0,1)), hash2i(b + ivec2(1,1)), u.x), u.y);
}
float fbm3(vec3 p, int oct) { float a = 0.5, s = 0.0, n = 0.0; for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * vnoise3(p); n += a; p = p * 2.03 + vec3(17.1, 9.3, 4.7); a *= 0.5; } return s / n; }
float fbm2(vec2 p, int oct) { float a = 0.5, s = 0.0, n = 0.0; for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * vnoise2(p); n += a; p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; } return s / n; }
`;
