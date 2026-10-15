import {
  Container,
  Geometry,
  GlProgram,
  Mesh,
  RenderTexture,
  Shader,
  Texture,
  UniformGroup,
  type WebGLRenderer,
} from "pixi.js";

// ---------------------------------------------------------------------------
// Full-screen passes on top of PixiJS 8 (WebGL2).
//
// Coordinate convention: vUV is screen space with (0,0) at the TOP-LEFT, the
// same convention Pixi uses when it draws sprites into a RenderTexture. When a
// pass writes into a RenderTexture we flip clip-space Y (uFlip = -1) so that
// everything stored in our targets shares Pixi's orientation; the final pass
// to the canvas uses uFlip = +1.
// ---------------------------------------------------------------------------

export const FS_VERT = /* glsl */ `
in vec2 aPosition;
uniform float uFlip;
out vec2 vUV;
void main() {
  vUV = aPosition;
  gl_Position = vec4(aPosition.x * 2.0 - 1.0, (1.0 - aPosition.y * 2.0) * uFlip, 0.0, 1.0);
}
`;

// Shared GLSL helpers (hash, tileable noise) included by several looks.
export const GLSL_COMMON = /* glsl */ `
const float PI = 3.14159265358979;
const float TAU = 6.28318530717959;

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash33u(vec3 p) {
  uvec3 h = pcg3d(uvec3(ivec3(floor(p)) + 32768));
  return vec3(h) * (1.0 / 4294967295.0);
}
float hash21(vec2 p) { return hash33u(vec3(p, 17.0)).x; }

// Periodic gradient-ish value noise: period 'per' (integer lattice units).
float vnoiseP(vec2 p, vec2 per) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 i00 = mod(i, per), i10 = mod(i + vec2(1, 0), per);
  vec2 i01 = mod(i + vec2(0, 1), per), i11 = mod(i + vec2(1, 1), per);
  float a = hash21(i00), b = hash21(i10), c = hash21(i01), d = hash21(i11);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbmP(vec2 p, vec2 per, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * vnoiseP(p, per); n += a;
    p *= 2.0; per *= 2.0; a *= 0.5;
  }
  return s / n;
}
`;

/** Pixi only treats a program as GLSL ES 3.00 when the source declares it. */
export const es300 = (src: string) => (src.includes("#version 300 es") ? src : `#version 300 es\n${src.replace(/^\s+/, "")}`);

const quadGeometry = () =>
  new Geometry({
    attributes: { aPosition: [0, 0, 1, 0, 1, 1, 0, 1] },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });

export type UniformSpec = Record<string, { value: unknown; type: string }>;

export class Pass {
  readonly mesh: Mesh<Geometry, Shader>;
  // the mesh is rendered through a parent so its blend mode applies
  private root = new Container();
  readonly u: UniformGroup;
  private shader: Shader;

  constructor(name: string, fragment: string, uniforms: UniformSpec, textures: Record<string, Texture> = {}) {
    this.u = new UniformGroup({ uFlip: { value: 1, type: "f32" }, ...uniforms } as never);
    const resources: Record<string, unknown> = { passUniforms: this.u };
    for (const [k, t] of Object.entries(textures)) resources[k] = t.source;
    this.shader = new Shader({
      glProgram: GlProgram.from({ vertex: es300(FS_VERT), fragment: es300(fragment), name }),
      resources,
    });
    this.mesh = new Mesh({ geometry: quadGeometry(), shader: this.shader });
    this.root.addChild(this.mesh);
  }

  get uniforms(): Record<string, unknown> {
    return this.u.uniforms as Record<string, unknown>;
  }

  setTexture(name: string, tex: Texture) {
    this.shader.resources[name] = tex.source;
  }

  private validated = false;

  run(renderer: WebGLRenderer, target: RenderTexture | null, additive: boolean | "multiply" = false) {
    if (!this.validated) {
      validateProgram(renderer, this.shader.glProgram);
      this.validated = true;
    }
    this.uniforms.uFlip = target ? -1 : 1;
    this.mesh.blendMode = additive === "multiply" ? "multiply" : additive ? "add" : "none";
    renderer.render({
      container: this.root,
      target: target ?? undefined,
      clear: !additive,
      clearColor: [0, 0, 0, 1],
    });
  }
}

/** Compile a program once with raw GL so shader errors surface as exceptions. */
export const validateProgram = (renderer: WebGLRenderer, program: GlProgram) => {
  const gl = renderer.gl;
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      throw new Error(`Shader compile failed (${program._key ?? ""}): ${log}\n${src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n")}`);
    }
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, program.vertex ?? "");
  const fs = compile(gl.FRAGMENT_SHADER, program.fragment ?? "");
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Link failed: ${gl.getProgramInfoLog(p)}`);
  gl.deleteProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
};

export const hdrTarget = (w: number, h: number, res: number) =>
  RenderTexture.create({
    width: w,
    height: h,
    resolution: res,
    format: "rgba16float",
    scaleMode: "linear",
    antialias: false,
  });

export const drawInto = (renderer: WebGLRenderer, container: Container, target: RenderTexture, clear = true) => {
  renderer.render({ container, target, clear, clearColor: [0, 0, 0, 0] });
};
