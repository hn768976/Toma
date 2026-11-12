// WebGL 2 renderer: procedural Earth + atmosphere + sun glare (full-screen
// ray-cast shader into a float buffer), plexus network and stars (instanced
// anti-aliased capsules, additive), then a post pass for tone mapping,
// glitches, the countdown HUD, vignette and dithering.

import { Vec3, clamp, dot, len, norm, scale as vscale, smoothstep, sub } from "./math";
import { NetEdge, NetNode, Network, Star } from "./network";
import { EarthPalette } from "./palette";
import { EARTH_TEX_FS, FULLSCREEN_VS, LINE_FS, LINE_VS, POST_FS, SCENE_FS } from "./shaders";

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

type Mat3 = number[]; // row-major 3×3

const axisAngle = (axis: Vec3, a: number): Mat3 => {
  const [x, y, z] = norm(axis);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
};
const mul = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

export type CameraRig = {
  /** Vertical field of view (radians). */
  fov: number;
  /** Planet centre in camera space (camera at origin looking down −Z). */
  center: Vec3;
  /** Earth rotation axis (camera space) and angle. */
  axis: Vec3;
  angle: number;
};

export type FrameState = {
  time: number;
  rig: CameraRig;
  sunX: number; // 0..1 of width
  sunFlare: number;
  rimWarmth: number;
  glitch: number;
  glitchSeed: number;
  networkGain: number;
};

const LINE_FLOATS = 11;
const TEX_W = 4096;
const TEX_H = 2048;

export class EarthRenderer {
  private gl: WebGL2RenderingContext;
  private sceneProg: WebGLProgram;
  private lineProg: WebGLProgram;
  private postProg: WebGLProgram;
  private quadVao: WebGLVertexArrayObject;
  private lineVao: WebGLVertexArrayObject;
  private lineBuf: WebGLBuffer;
  private lineData: Float32Array;
  private earthTex: WebGLTexture;
  private sceneTex: WebGLTexture;
  private sceneFbo: WebGLFramebuffer;
  private hudTex: WebGLTexture;
  private nodeCam: Float32Array; // projected nodes: x, y, vis, warm
  private maxLines: number;

  constructor(
    private canvas: HTMLCanvasElement,
    private pal: EarthPalette,
    private net: Network,
    private stars: Star[],
    private hud: HTMLCanvasElement,
    private hudRect: { x: number; y: number; w: number; h: number },
  ) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    if (!gl) throw new Error("WebGL 2 is not available");
    this.gl = gl;
    const floatOk = !!gl.getExtension("EXT_color_buffer_float");

    this.sceneProg = program(gl, FULLSCREEN_VS, SCENE_FS);
    this.lineProg = program(gl, LINE_VS, LINE_FS);
    this.postProg = program(gl, FULLSCREEN_VS, POST_FS);

    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Instanced capsules
    this.maxLines = net.edges.length + net.nodes.length + stars.length;
    this.lineData = new Float32Array(this.maxLines * LINE_FLOATS);
    this.lineVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.lineVao);
    const cb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.lineBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.lineData.byteLength, gl.DYNAMIC_DRAW);
    const stride = LINE_FLOATS * 4;
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

    this.nodeCam = new Float32Array(net.nodes.length * 4);

    // Bake the procedural Earth map once (with mipmaps).
    this.earthTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.earthTex);
    const levels = Math.floor(Math.log2(TEX_W)) + 1;
    gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, TEX_W, TEX_H);
    const texFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, texFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.earthTex, 0);
    gl.viewport(0, 0, TEX_W, TEX_H);
    const texProg = program(gl, FULLSCREEN_VS, EARTH_TEX_FS);
    gl.useProgram(texProg);
    gl.uniform2f(gl.getUniformLocation(texProg, "uTexRes"), TEX_W, TEX_H);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(texFbo);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // HDR scene target
    this.sceneTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, floatOk ? gl.RGBA16F : gl.RGBA8, canvas.width, canvas.height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.sceneFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.hudTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.hudTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private rayDir(px: number, py: number, tanHalf: number): Vec3 {
    const W = this.canvas.width;
    const H = this.canvas.height;
    return norm([((px / W) * 2 - 1) * tanHalf * (W / H), ((py / H) * 2 - 1) * tanHalf, -1]);
  }

  /** Screen y (GL, y up) of the planet's limb at column px. */
  limbY(px: number, rig: CameraRig): number {
    const tanHalf = Math.tan(rig.fov / 2);
    const hits = (py: number) => {
      const d = this.rayDir(px, py, tanHalf);
      const b = dot(d, rig.center);
      const c = dot(rig.center, rig.center) - 1;
      return b > 0 && b * b - c > 0;
    };
    let lo = -this.canvas.height; // hits
    let hi = this.canvas.height * 2; // misses
    if (!hits(lo)) return lo;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (hits(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  render(s: FrameState) {
    const gl = this.gl;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const S = W / 3840; // authoring scale for pixel sizes
    const pal = this.pal;
    const rig = s.rig;
    const tanHalf = Math.tan(rig.fov / 2);
    const f = H / 2 / tanHalf;
    const C = rig.center;
    const M = axisAngle(rig.axis, rig.angle); // earth-fixed → camera

    // Sun placement: on the horizon line at the given column.
    const sunPxX = s.sunX * W;
    const sunPxY = this.limbY(sunPxX, rig) + 0.004 * H;
    const dS = this.rayDir(sunPxX, sunPxY, tanHalf);
    const bS = dot(dS, C);
    const nLimb = norm(sub(vscale(dS, bS), C));
    const lit = 0.16 + 0.2 * s.sunFlare; // the lit crescent widens as the sun clears the limb
    const sunDir = norm([dS[0] + lit * nLimb[0], dS[1] + lit * nLimb[1], dS[2] + lit * nLimb[2]]);

    const warmAt = (px: number, py: number) => {
      const dx = Math.abs(px - sunPxX) / (0.21 * W);
      return (
        Math.exp(-Math.pow(dx, 1.7)) * Math.exp(-Math.max(sunPxY - py, 0) / (0.4 * H)) * s.rimWarmth
      );
    };
    const mixc = (a: Vec3, b: Vec3, t: number): Vec3 => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];

    // --- project network nodes
    const nodes: NetNode[] = this.net.nodes;
    const nc = this.nodeCam;
    const cc = dot(C, C) - 1;
    for (let i = 0; i < nodes.length; i++) {
      const p = mul(M, nodes[i].p);
      const P: Vec3 = [C[0] + p[0], C[1] + p[1], C[2] + p[2]];
      const dist = len(P);
      const dir = vscale(P, 1 / dist);
      const b = dot(dir, C);
      const disc = b * b - cc;
      let vis = 1;
      if (disc > 0 && b > 0) {
        const tHit = b - Math.sqrt(disc);
        if (tHit < dist - 1e-4) {
          const closest = sub(vscale(dir, b), C);
          const h = len(closest) - 1;
          vis = smoothstep(-0.006, 0.0, h);
        }
      }
      const z = -P[2];
      let px = -1e5;
      let py = -1e5;
      if (z > 0.01) {
        px = W / 2 + (f * P[0]) / z;
        py = H / 2 + (f * P[1]) / z;
      } else {
        vis = 0;
      }
      nc[i * 4] = px;
      nc[i * 4 + 1] = py;
      nc[i * 4 + 2] = vis;
      nc[i * 4 + 3] = vis > 0 ? warmAt(px, py) : 0;
    }

    // --- fill capsule instances
    const ld = this.lineData;
    let n = 0;
    const pushCapsule = (
      x0: number, y0: number, x1: number, y1: number,
      col: Vec3, a: number, hw: number, glowR: number, glowA: number,
    ) => {
      const pad = Math.max(hw, glowR * 2.5) + 2;
      if (Math.max(x0, x1) < -pad || Math.min(x0, x1) > W + pad) return;
      if (Math.max(y0, y1) < -pad || Math.min(y0, y1) > H + pad) return;
      if (a <= 0.002) return;
      const o = n * LINE_FLOATS;
      ld[o] = x0;
      ld[o + 1] = y0;
      ld[o + 2] = x1;
      ld[o + 3] = y1;
      ld[o + 4] = col[0];
      ld[o + 5] = col[1];
      ld[o + 6] = col[2];
      ld[o + 7] = a;
      ld[o + 8] = hw;
      ld[o + 9] = glowR;
      ld[o + 10] = glowA;
      n++;
    };

    const tm = s.time;
    const edges: NetEdge[] = this.net.edges;
    for (const e of edges) {
      const va = nc[e.a * 4 + 2];
      const vb = nc[e.b * 4 + 2];
      const vis = Math.min(va, vb);
      if (vis <= 0) continue;
      const x0 = nc[e.a * 4];
      const y0 = nc[e.a * 4 + 1];
      const x1 = nc[e.b * 4];
      const y1 = nc[e.b * 4 + 1];
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      if (segLen > 0.25 * W) continue;
      const warm = clamp((nc[e.a * 4 + 3] + nc[e.b * 4 + 3]) * 0.5, 0, 1);
      const tw = 0.75 + 0.25 * Math.sin(e.phase + tm * 0.7);
      const a = vis * e.bright * tw * s.networkGain * (0.6 + 0.6 * warm);
      pushCapsule(x0, y0, x1, y1, mixc(pal.netCool, pal.netWarm, warm), a, 1.5 * S, 0, 0);
    }
    for (let i = 0; i < nodes.length; i++) {
      const vis = nc[i * 4 + 2];
      if (vis <= 0) continue;
      const nd = nodes[i];
      const warm = clamp(nc[i * 4 + 3], 0, 1);
      const tw = 0.7 + 0.3 * Math.sin(nd.phase + tm * 1.1);
      const a = vis * nd.bright * tw * s.networkGain * (0.9 + 0.8 * warm);
      pushCapsule(
        nc[i * 4], nc[i * 4 + 1], nc[i * 4], nc[i * 4 + 1],
        mixc(pal.netCool, pal.netWarm, warm), a, 2.0 * S * nd.size, 6 * S * nd.size, 0.22,
      );
    }
    // stars (hidden behind the planet)
    for (const st of this.stars) {
      const b = dot(st.d, C);
      if (b > 0 && b * b - cc > 0) continue;
      const z = -st.d[2];
      const px = W / 2 + (f * st.d[0]) / z;
      const py = H / 2 + (f * st.d[1]) / z;
      const tw = 0.75 + 0.25 * Math.sin(st.phase + tm * 0.8);
      pushCapsule(px, py, px, py, pal.star, st.bright * tw, 1.3 * S * st.size, 3.5 * S * st.size, 0.18);
    }

    // --- 1. planet / atmosphere / sun into the HDR buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    const sp = this.sceneProg;
    gl.useProgram(sp);
    const u = (name: string) => gl.getUniformLocation(sp, name);
    gl.uniform2f(u("uRes"), W, H);
    gl.uniform1f(u("uTanHalf"), tanHalf);
    gl.uniform3fv(u("uCenter"), C);
    gl.uniformMatrix3fv(u("uEarthRot"), false, M); // column-major of Mᵀ = row-major of M
    gl.uniform3fv(u("uSunDir"), sunDir);
    gl.uniform2f(u("uSunPx"), sunPxX, sunPxY);
    gl.uniform1f(u("uSunI"), s.sunFlare);
    gl.uniform1f(u("uRimI"), s.rimWarmth);
    gl.uniform1f(u("uTime"), s.time);
    gl.uniform3fv(u("uSpace"), pal.space);
    gl.uniform3fv(u("uSpaceLow"), pal.spaceLow);
    gl.uniform3fv(u("uOceanN"), pal.oceanNight);
    gl.uniform3fv(u("uLandN"), pal.landNight);
    gl.uniform3fv(u("uOceanD"), pal.oceanDay);
    gl.uniform3fv(u("uLandD"), pal.landDay);
    gl.uniform3fv(u("uCity"), pal.city);
    gl.uniform3fv(u("uRimCool"), pal.rimCool);
    gl.uniform3fv(u("uRimWarm"), pal.rimWarm);
    gl.uniform3fv(u("uSunCore"), pal.sunCore);
    gl.uniform3fv(u("uSunGlow"), pal.sunGlow);
    gl.uniform3fv(u("uStreak"), pal.streak);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.earthTex);
    gl.uniform1i(u("uEarth"), 0);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // --- 2. network + stars (additive)
    if (n > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.lineProg);
      gl.uniform2f(gl.getUniformLocation(this.lineProg, "uRes"), W, H);
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, ld, 0, n * LINE_FLOATS);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
      gl.disable(gl.BLEND);
    }

    // --- 3. HUD texture
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.hudTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.hud);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    // --- 4. post to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    const pp = this.postProg;
    gl.useProgram(pp);
    gl.uniform2f(gl.getUniformLocation(pp, "uRes"), W, H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.uniform1i(gl.getUniformLocation(pp, "uScene"), 0);
    gl.uniform1i(gl.getUniformLocation(pp, "uHud"), 1);
    const r = this.hudRect;
    gl.uniform4f(gl.getUniformLocation(pp, "uHudRect"), r.x * S, H - (r.y + r.h) * S, r.w * S, r.h * S);
    gl.uniform1f(gl.getUniformLocation(pp, "uGlitch"), s.glitch);
    gl.uniform1f(gl.getUniformLocation(pp, "uSeed"), s.glitchSeed);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.finish();
  }

  dispose() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
