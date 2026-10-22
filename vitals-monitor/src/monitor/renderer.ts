// WebGL2 "lens": ray-casts every output pixel onto the monitor plane, then applies a
// physically-motivated depth of field (circle of confusion from distance to the focus
// plane), a mip-based bloom, vignette and film grain.

export type Vec3 = [number, number, number];

export type CameraState = {
  pos: Vec3;
  target: Vec3;
  roll: number; // radians
  fovY: number; // radians
  focusDist: number; // world units along view axis
  aperture: number; // blur in output pixels (at 2160p) per unit of relative defocus
  focusRange: number; // relative depth either side of focus that stays sharp
};

export type Grade = {
  lift: Vec3;
  gain: Vec3;
  bloom: number;
  vignette: number;
  grain: number;
};

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const COMMON = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uTexSize;
uniform vec2 uPlane;
uniform vec3 uCamPos;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uFwd;
uniform float uTanHalf;
uniform float uFocus;
uniform float uAperture;
uniform float uFocusRange;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 ray(vec2 frag) {
  vec2 ndc = (frag / uRes) * 2.0 - 1.0;
  ndc.x *= uRes.x / uRes.y;
  return normalize(uFwd + uRight * ndc.x * uTanHalf + uUp * ndc.y * uTanHalf);
}

vec2 planeUv(vec3 dir, out float depth) {
  float t = -uCamPos.z / dir.z;
  vec3 p = uCamPos + dir * t;
  depth = t * dot(dir, uFwd);
  return vec2(p.x / uPlane.x, 1.0 - p.y / uPlane.y);
}

vec3 sampleScreen(vec2 uv, float lod) {
  // Beyond the painted area the monitor glass continues as plain dark panel; use a
  // heavily-filtered sample of the nearest edge so there is no visible seam.
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  float m = inside.x * inside.y;
  vec3 edge = textureLod(uTex, clamp(uv, 0.0, 1.0), 8.0).rgb;
  return mix(edge, textureLod(uTex, uv, lod).rgb, m);
}

// Projects the output pixel onto the screen plane: uv, its texture-space Jacobian
// (uvx/uvy per output pixel), mip level for the footprint and the circle of
// confusion in output pixels.
void project(vec2 frag, out vec2 uv, out vec2 uvx, out vec2 uvy, out float fp,
             out float coc) {
  float depth; float d1; float d2;
  uv = planeUv(ray(frag), depth);
  uvx = planeUv(ray(frag + vec2(1.0, 0.0)), d1) - uv;
  uvy = planeUv(ray(frag + vec2(0.0, 1.0)), d2) - uv;
  fp = max(length(uvx * uTexSize), length(uvy * uTexSize));
  float scale = uRes.y / 2160.0;
  coc = uAperture * scale *
    max(0.0, abs(depth - uFocus) / max(depth, 1e-3) - uFocusRange);
  coc = min(coc, 160.0 * scale);
}
`;

// Pass 1 (rendered at reduced resolution): depth-of-field gather + bloom.
const BLUR_FRAG = `${COMMON}
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outBloom;
const int TAPS = 24;
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv; vec2 uvx; vec2 uvy; float fp; float coc;
  project(frag, uv, uvx, uvy, fp, coc);
  float baseLod = log2(max(fp, 1.0));
  vec3 col;
  if (coc < 0.6) {
    col = sampleScreen(uv, baseLod);
  } else {
    float spacing = coc * 0.36;
    float lod = max(baseLod, log2(max(spacing * fp, 1.0)));
    vec3 acc = vec3(0.0);
    float rot = hash(frag) * 6.2831;
    for (int i = 0; i < TAPS; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / float(TAPS)) * coc;
      float a = fi * 2.39996 + rot;
      vec2 o = vec2(cos(a), sin(a)) * r;
      acc += sampleScreen(uv + uvx * o.x + uvy * o.y, lod);
    }
    col = acc / float(TAPS);
  }
  float bl = max(baseLod, log2(max(coc * 0.36 * fp, 1.0)));
  vec3 glow = sampleScreen(uv, bl + 4.0) * 0.55 + sampleScreen(uv, bl + 6.0) * 0.45;
  outColor = vec4(col, 1.0);
  outBloom = vec4(glow, 1.0);
}
`;

// Pass 2 (full resolution): sharp sample where in focus, blurred where not, then
// grade, vignette and grain.
const FINAL_FRAG = `${COMMON}
uniform sampler2D uBlur;
uniform sampler2D uBloomTex;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uBloom;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
out vec4 outColor;
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv; vec2 uvx; vec2 uvy; float fp; float coc;
  project(frag, uv, uvx, uvy, fp, coc);
  vec2 suv = frag / uRes;
  vec3 sharp = sampleScreen(uv, log2(max(fp, 1.0)));
  vec3 blurred = texture(uBlur, suv).rgb;
  vec3 col = mix(sharp, blurred, smoothstep(0.6, 2.6, coc));
  col += texture(uBloomTex, suv).rgb * uBloom;

  col = uLift + col * uGain;
  vec2 q = suv - 0.5;
  q.x *= uRes.x / uRes.y * 0.75;
  col *= clamp(1.0 - dot(q, q) * uVignette, 0.0, 1.0);
  col += (hash(frag + fract(uTime * 37.17) * 913.0) - 0.5) * uGrain;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

export const cameraBasis = (cam: CameraState) => {
  const fwd = norm(sub(cam.target, cam.pos));
  // World "up" is +y on the monitor plane.
  let right = norm(cross(fwd, [0, 1, 0]));
  let up = cross(right, fwd);
  const c = Math.cos(cam.roll);
  const s = Math.sin(cam.roll);
  const r2: Vec3 = [
    right[0] * c + up[0] * s,
    right[1] * c + up[1] * s,
    right[2] * c + up[2] * s,
  ];
  up = norm(cross(r2, fwd));
  right = norm(r2);
  return { fwd, right, up };
};

// Resolution divisor for the depth-of-field pass. Defocused areas carry no fine
// detail, so gathering them at half resolution is visually lossless and ~4x cheaper.
const BLUR_DIVISOR = 2;

const UNIFORMS = [
  "uTex",
  "uRes",
  "uTexSize",
  "uPlane",
  "uCamPos",
  "uRight",
  "uUp",
  "uFwd",
  "uTanHalf",
  "uFocusRange",
  "uFocus",
  "uAperture",
  "uBlur",
  "uBloomTex",
  "uLift",
  "uGain",
  "uBloom",
  "uVignette",
  "uGrain",
  "uTime",
];

type Program = {
  prog: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
};

export class MonitorRenderer {
  private gl: WebGL2RenderingContext;
  private blurProg: Program;
  private finalProg: Program;
  private tex: WebGLTexture;
  private fbo: WebGLFramebuffer;
  private blurTex: WebGLTexture;
  private bloomTex: WebGLTexture;
  private blurW: number;
  private blurH: number;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) ?? "shader error");
      }
      return sh;
    };
    const link = (frag: string): Program => {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(prog, 0, "aPos");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog) ?? "link error");
      }
      const loc: Program["loc"] = {};
      for (const name of UNIFORMS)
        loc[name] = gl.getUniformLocation(prog, name);
      return { prog, loc };
    };
    this.blurProg = link(BLUR_FRAG);
    this.finalProg = link(FINAL_FRAG);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.blurW = Math.ceil(gl.canvas.width / BLUR_DIVISOR);
    this.blurH = Math.ceil(gl.canvas.height / BLUR_DIVISOR);
    const target = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        this.blurW,
        this.blurH,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.blurTex = target();
    this.bloomTex = target();
    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.blurTex,
      0,
    );
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT1,
      gl.TEXTURE_2D,
      this.bloomTex,
      0,
    );
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("DOF framebuffer incomplete");
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private setCamera(
    p: Program,
    source: HTMLCanvasElement,
    cam: CameraState,
    w: number,
    h: number,
  ) {
    const gl = this.gl;
    const { fwd, right, up } = cameraBasis(cam);
    const L = p.loc;
    gl.uniform1i(L.uTex, 0);
    gl.uniform2f(L.uRes, w, h);
    gl.uniform2f(L.uTexSize, source.width, source.height);
    gl.uniform2f(L.uPlane, source.width / source.height, 1);
    gl.uniform3fv(L.uCamPos, cam.pos);
    gl.uniform3fv(L.uRight, right);
    gl.uniform3fv(L.uUp, up);
    gl.uniform3fv(L.uFwd, fwd);
    gl.uniform1f(L.uTanHalf, Math.tan(cam.fovY / 2));
    gl.uniform1f(L.uFocus, cam.focusDist);
    gl.uniform1f(L.uAperture, cam.aperture);
    gl.uniform1f(L.uFocusRange, cam.focusRange);
  }

  render(
    source: HTMLCanvasElement,
    cam: CameraState,
    grade: Grade,
    time: number,
  ) {
    const gl = this.gl;
    const w = gl.canvas.width;
    const h = gl.canvas.height;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);

    // Pass 1: defocus + bloom at reduced resolution.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.blurW, this.blurH);
    gl.useProgram(this.blurProg.prog);
    this.setCamera(this.blurProg, source, cam, this.blurW, this.blurH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Pass 2: composite at full resolution.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    const p = this.finalProg;
    gl.useProgram(p.prog);
    this.setCamera(p, source, cam, w, h);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.blurTex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomTex);
    gl.activeTexture(gl.TEXTURE0);
    const L = p.loc;
    gl.uniform1i(L.uBlur, 1);
    gl.uniform1i(L.uBloomTex, 2);
    gl.uniform3fv(L.uLift, grade.lift);
    gl.uniform3fv(L.uGain, grade.gain);
    gl.uniform1f(L.uBloom, grade.bloom);
    gl.uniform1f(L.uVignette, grade.vignette);
    gl.uniform1f(L.uGrain, grade.grain);
    gl.uniform1f(L.uTime, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }
}
