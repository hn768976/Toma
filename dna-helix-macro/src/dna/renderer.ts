// WebGL 2 renderer for the DNA macro shot.
//
// Every atom is drawn as a camera-facing sphere impostor. Depth of field is
// done "per sprite": each sphere's quad is grown by its circle of confusion
// and its edge is feathered over that radius, then everything is composited
// back-to-front with premultiplied alpha. This gives true lens-like bokeh on
// thousands of spheres at 4K while staying cheap enough for software GL.

import { Vec3, clamp, cross, dot, norm, rotX, rotY, rotZ, sub } from "./math";
import { Atom, Dust, HelixPlacement } from "./scene";

export type Camera = {
  pos: Vec3;
  target: Vec3;
  /** Vertical field of view in radians. */
  fov: number;
  /** Distance (along view axis) that is in perfect focus. */
  focus: number;
  /** Aperture: CoC in fractions of frame height per unit |1 - focus / z|. */
  aperture: number;
  roll: number;
};

export type Look = {
  bgDeep: Vec3;
  bgMid: Vec3;
  bgHaze: Vec3;
  hazeCenter: [number, number];
  light: Vec3;
  rimTint: Vec3;
  dust: Vec3;
};

const COMMON = /* glsl */ `
uniform vec2 uFullRes;
uniform vec3 uBgDeep;
uniform vec3 uBgMid;
uniform vec3 uBgHaze;
uniform vec2 uHazeCenter;
vec3 background(vec2 fragPx) {
  vec2 uv = fragPx / uFullRes;        // 0..1, y up
  vec2 p = (uv - 0.5) * vec2(uFullRes.x / uFullRes.y, 1.0);
  vec2 hc = (uHazeCenter - 0.5) * vec2(uFullRes.x / uFullRes.y, 1.0);
  float d = length((p - hc) * vec2(0.85, 1.15));
  float haze = exp(-d * d * 3.2);
  float wide = exp(-d * d * 0.9);
  vec3 col = mix(uBgDeep, uBgMid, wide);
  col = mix(col, uBgHaze, haze * 0.95);
  return col;
}
`;

const BG_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const BG_FS = /* glsl */ `#version 300 es
precision highp float;
${COMMON}
out vec4 o;
void main() { o = vec4(background(gl_FragCoord.xy), 1.0); }`;

// Smooth (B-spline bicubic) upsampling of a low-resolution premultiplied layer.
const COMP_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uFullRes;
out vec4 o;
vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}
vec4 bicubic(sampler2D tex, vec2 uv) {
  vec2 size = vec2(textureSize(tex, 0));
  vec2 inv = 1.0 / size;
  vec2 tc = uv * size - 0.5;
  vec2 f = fract(tc);
  tc -= f;
  vec4 xc = cubic(f.x);
  vec4 yc = cubic(f.y);
  vec4 c = tc.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 off = (c + vec4(xc.yw, yc.yw) / s) * inv.xxyy;
  vec4 s0 = texture(tex, off.xz);
  vec4 s1 = texture(tex, off.yz);
  vec4 s2 = texture(tex, off.xw);
  vec4 s3 = texture(tex, off.yw);
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}
void main() { o = bicubic(uTex, gl_FragCoord.xy / uFullRes); }`;

const VIG_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float v = 1.0 - smoothstep(0.35, 1.15, length(p * vec2(0.9, 1.1))) * 0.62;
  o = vec4(vec3(v), 1.0);
}`;

const SPR_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 iA; // screen x, screen y (px, y down), core radius px, coc px
layout(location=2) in vec4 iB; // r, g, b, ao
layout(location=3) in vec3 iC; // fog, alpha, emissive
uniform vec2 uRes;    // render-target size in px
uniform float uScale; // render-target size / full output size
out vec2 vP;
out float vR;
out float vC;
out vec4 vCol;
out vec3 vX;
void main() {
  float R = iA.z * uScale;
  float C = iA.w * uScale;
  float ext = R + 0.75 * C + 2.0;
  vec2 offs = aCorner * ext;
  vec2 px = iA.xy * uScale + offs;
  vP = offs; vR = R; vC = C; vCol = iB; vX = iC;
  vec2 ndc = px / uRes * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}`;

const SPR_FS = /* glsl */ `#version 300 es
precision highp float;
${COMMON}
uniform vec3 uLight;
uniform vec3 uRim;
uniform float uScale;
in vec2 vP;
in float vR;
in float vC;
in vec4 vCol;
in vec3 vX;
out vec4 o;
void main() {
  float R = max(vR, 0.6);
  float C = vC;
  float d = length(vP);
  float w = 1.5 * C + 1.25;
  float cov = clamp((R - d) / w + 0.5, 0.0, 1.0);
  cov = cov * cov * (3.0 - 2.0 * cov);
  if (cov <= 0.0) discard;
  float spread = R / (R + 0.5 * C);
  float a = cov * mix(1.0, spread * spread, 0.5) * vX.y;

  vec3 col;
  if (vX.z > 0.5) {
    col = vCol.rgb;
  } else {
    vec2 q = vP / R;
    float ql = length(q);
    if (ql > 1.0) q /= ql;
    vec3 n = normalize(vec3(q.x, -q.y, sqrt(max(0.0, 1.0 - dot(q, q)))));
    vec3 L = normalize(uLight);
    float ndl = dot(n, L);
    float wrap = pow(clamp(ndl * 0.55 + 0.45, 0.0, 1.0), 1.6);
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, H), 0.0), 48.0) * 0.55 + pow(max(dot(n, H), 0.0), 8.0) * 0.08;
    float fres = pow(1.0 - n.z, 2.6);
    vec3 alb = vCol.rgb;
    col = alb * (0.22 + 1.05 * wrap) * vCol.a;
    // translucent, slightly glowing rim (sub-surface look)
    col += mix(alb, uRim, 0.45) * fres * (0.35 + 0.45 * clamp(ndl + 0.4, 0.0, 1.0));
    col += vec3(1.0, 0.97, 0.92) * spec;
    // the further out of focus, the more the sphere reads as its average colour
    vec3 avg = alb * 0.78 * vCol.a + uRim * 0.06;
    col = mix(col, avg, clamp(C / (R * 2.2), 0.0, 0.8));
  }
  col = mix(col, background(gl_FragCoord.xy / uScale), vX.x);
  o = vec4(col * a, a);
}`;

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error("Shader compile failed: " + gl.getShaderInfoLog(sh));
  }
  return sh;
};

const program = (gl: WebGL2RenderingContext, vs: string, fs: string) => {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("Program link failed: " + gl.getProgramInfoLog(p));
  }
  return p;
};

type HelixInstance = { place: HelixPlacement; atoms: Atom[] };

const FLOATS = 11;

/**
 * Depth-of-field tiers. Strongly defocused spheres are smooth, so they are
 * drawn into low-resolution layers and upsampled; only the (nearly) sharp
 * spheres are drawn at full resolution. Tiers are split by blur radius and by
 * side of the focal plane, so their back-to-front order is preserved:
 * back-1/8, back-1/4, sharp (full res), front-1/4, front-1/8.
 */
type Tier = { scale: number; fbo: WebGLFramebuffer | null; tex: WebGLTexture | null; w: number; h: number };

const SHARP_MAX = 14 / 2160; // CoC (fraction of frame height) still drawn at full res
const MID_MAX = 70 / 2160; // CoC drawn at 1/4 res; above that 1/8 res

export class DnaRenderer {
  private gl: WebGL2RenderingContext;
  private bgProg: WebGLProgram;
  private vigProg: WebGLProgram;
  private sprProg: WebGLProgram;
  private compProg: WebGLProgram;
  private quadVao: WebGLVertexArrayObject;
  private sprVao: WebGLVertexArrayObject;
  private instBuf: WebGLBuffer;
  private data: Float32Array;
  private sorted: Float32Array;
  private depth: Float32Array;
  private tierOf: Uint8Array;
  private order: Uint32Array;
  private total: number;
  private tiers: Tier[];

  constructor(
    private canvas: HTMLCanvasElement,
    private helices: HelixInstance[],
    private dust: Dust[],
  ) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    if (!gl) throw new Error("WebGL 2 is not available");
    this.gl = gl;
    this.bgProg = program(gl, BG_VS, BG_FS);
    this.vigProg = program(gl, BG_VS, VIG_FS);
    this.sprProg = program(gl, SPR_VS, SPR_FS);
    this.compProg = program(gl, BG_VS, COMP_FS);

    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.total = helices.reduce((s, h) => s + h.atoms.length, 0) + dust.length;
    this.data = new Float32Array(this.total * FLOATS);
    this.sorted = new Float32Array(this.total * FLOATS);
    this.depth = new Float32Array(this.total);
    this.tierOf = new Uint8Array(this.total);
    this.order = new Uint32Array(this.total);

    this.sprVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.sprVao);
    const cb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.instBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.sorted.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 32);
    gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);

    const W = canvas.width;
    const H = canvas.height;
    const mk = (scale: number): Tier => {
      if (scale === 1) return { scale, fbo: null, tex: null, w: W, h: H };
      const w = Math.max(1, Math.round(W * scale));
      const h = Math.max(1, Math.round(H * scale));
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { scale: w / W, fbo, tex, w, h };
    };
    // index: 0 back-1/8, 1 back-1/4, 2 sharp, 3 front-1/4, 4 front-1/8
    this.tiers = [mk(1 / 8), mk(1 / 4), mk(1), mk(1 / 4), mk(1 / 8)];
  }

  private setCommon(p: WebGLProgram, look: Look) {
    const gl = this.gl;
    gl.uniform2f(gl.getUniformLocation(p, "uFullRes"), this.canvas.width, this.canvas.height);
    gl.uniform3fv(gl.getUniformLocation(p, "uBgDeep"), look.bgDeep);
    gl.uniform3fv(gl.getUniformLocation(p, "uBgMid"), look.bgMid);
    gl.uniform3fv(gl.getUniformLocation(p, "uBgHaze"), look.bgHaze);
    gl.uniform2fv(gl.getUniformLocation(p, "uHazeCenter"), look.hazeCenter);
  }

  render(t: number, cam: Camera, look: Look) {
    const gl = this.gl;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Camera basis
    const fwd = norm(sub(cam.target, cam.pos));
    let right = norm(cross(fwd, [0, 1, 0]));
    let up = cross(right, fwd);
    if (cam.roll !== 0) {
      const c = Math.cos(cam.roll);
      const s = Math.sin(cam.roll);
      const r2: Vec3 = [right[0] * c + up[0] * s, right[1] * c + up[1] * s, right[2] * c + up[2] * s];
      const u2: Vec3 = [up[0] * c - right[0] * s, up[1] * c - right[1] * s, up[2] * c - right[2] * s];
      right = r2;
      up = u2;
    }
    const f = H / 2 / Math.tan(cam.fov / 2);
    const cocK = cam.aperture * H;
    const cocMax = 0.11 * H;
    const sharpMax = SHARP_MAX * H;
    const midMax = MID_MAX * H;
    const margin = 0.02 * H;

    let n = 0;
    const d = this.data;
    const push = (w: Vec3, r: number, col: Vec3, ao: number, alpha: number, emissive: number) => {
      const rel = sub(w, cam.pos);
      const z = dot(rel, fwd);
      if (z < 0.25) return;
      const x = dot(rel, right);
      const y = dot(rel, up);
      const sx = W / 2 + (f * x) / z;
      const sy = H / 2 - (f * y) / z;
      const R = (f * r) / z;
      const C = Math.min(cocMax, cocK * Math.abs(1 - cam.focus / z));
      const ext = R + 0.75 * C + 2;
      if (sx < -ext - margin || sx > W + ext + margin || sy < -ext - margin || sy > H + ext + margin) return;
      const fog = clamp((z - 9) / 22, 0, 0.82);
      const o = n * FLOATS;
      d[o] = sx;
      d[o + 1] = sy;
      d[o + 2] = R;
      d[o + 3] = C;
      d[o + 4] = col[0];
      d[o + 5] = col[1];
      d[o + 6] = col[2];
      d[o + 7] = ao;
      d[o + 8] = fog;
      d[o + 9] = alpha;
      d[o + 10] = emissive;
      this.depth[n] = z;
      const behind = z > cam.focus;
      this.tierOf[n] = C < sharpMax ? 2 : C < midMax ? (behind ? 1 : 3) : behind ? 0 : 4;
      n++;
    };

    for (const h of this.helices) {
      const pl = h.place;
      const ang = pl.phase + pl.spin * t;
      for (const a of h.atoms) {
        let p = rotY(a.p, ang);
        p = rotX(p, pl.tiltX);
        p = rotZ(p, pl.tiltZ);
        const w: Vec3 = [p[0] + pl.pos[0], p[1] + pl.pos[1], p[2] + pl.pos[2]];
        push(w, a.r, a.color, a.ao, 1, 0);
      }
    }
    for (const s of this.dust) {
      const w: Vec3 = [s.p[0] + s.drift[0] * t, s.p[1] + s.drift[1] * t, s.p[2] + s.drift[2] * t];
      const tw = 0.55 + 0.45 * Math.sin(s.tw + t * 0.9);
      push(w, s.r, look.dust, 1, 0.75 * tw, 1);
    }

    // Order: by tier, then back-to-front inside each tier.
    const order = this.order.subarray(0, n);
    for (let i = 0; i < n; i++) order[i] = i;
    const depth = this.depth;
    const tierOf = this.tierOf;
    order.sort((a, b) => tierOf[a] - tierOf[b] || depth[b] - depth[a]);
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      counts[tierOf[order[i]]]++;
      this.sorted.set(d.subarray(order[i] * FLOATS, order[i] * FLOATS + FLOATS), i * FLOATS);
    }
    const starts = [0, 0, 0, 0, 0];
    for (let i = 1; i < 5; i++) starts[i] = starts[i - 1] + counts[i - 1];

    gl.disable(gl.DEPTH_TEST);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sorted, 0, n * FLOATS);

    const drawSprites = (tierIdx: number) => {
      const tier = this.tiers[tierIdx];
      gl.useProgram(this.sprProg);
      this.setCommon(this.sprProg, look);
      gl.uniform2f(gl.getUniformLocation(this.sprProg, "uRes"), tier.w, tier.h);
      gl.uniform1f(gl.getUniformLocation(this.sprProg, "uScale"), tier.scale);
      gl.uniform3fv(gl.getUniformLocation(this.sprProg, "uLight"), look.light);
      gl.uniform3fv(gl.getUniformLocation(this.sprProg, "uRim"), look.rimTint);
      gl.bindVertexArray(this.sprVao);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (counts[tierIdx] > 0) {
        // offset instance attributes to this tier's slice
        const stride = FLOATS * 4;
        const base = starts[tierIdx] * stride;
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, base);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, base + 16);
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, base + 32);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, counts[tierIdx]);
      }
    };

    // 1. Low-resolution defocus layers.
    for (const ti of [0, 1, 3, 4]) {
      const tier = this.tiers[ti];
      gl.bindFramebuffer(gl.FRAMEBUFFER, tier.fbo);
      gl.viewport(0, 0, tier.w, tier.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      drawSprites(ti);
    }

    // 2. Final image at full resolution.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    gl.useProgram(this.bgProg);
    this.setCommon(this.bgProg, look);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const composite = (ti: number) => {
      if (counts[ti] === 0) return;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.compProg);
      gl.uniform2f(gl.getUniformLocation(this.compProg, "uFullRes"), W, H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tiers[ti].tex);
      gl.uniform1i(gl.getUniformLocation(this.compProg, "uTex"), 0);
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    composite(0);
    composite(1);
    drawSprites(2);
    composite(3);
    composite(4);

    // 3. Lens vignette (multiplicative)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
    gl.useProgram(this.vigProg);
    gl.uniform2f(gl.getUniformLocation(this.vigProg, "uRes"), W, H);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);
    gl.finish();
  }

  dispose() {
    const ext = this.gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
  }
}
