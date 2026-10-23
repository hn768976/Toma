import { mulberry32 } from "../lib/random";
import { BurstPalette } from "./palettes";

// Raw WebGL 2 renderer for the powder explosion. Every particle is an
// instanced screen-space streak drawn additively into a float buffer, then
// tone-mapped in a final full-screen pass.

const STREAK_COUNT = 80000;
const HAZE_COUNT = 40000;

const streakVS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;      // x: along (0 tail, 1 head), y: side (-1..1)
layout(location = 1) in vec4 aDirSpeed;    // xyz: direction, w: speed
layout(location = 2) in vec4 aColor;       // rgb, a: brightness
layout(location = 3) in vec4 aShape;       // x: trail length, y: width, z: seed, w: jitter

uniform mat4 uViewProj;
uniform mat3 uRot;
uniform float uExpand;
uniform vec2 uResolution;
uniform float uPxScale;

out vec4 vColor;
out vec2 vCorner;
out float vSeed;

vec4 project(vec3 p) { return uViewProj * vec4(p, 1.0); }

void main() {
  vec3 dir = normalize(uRot * aDirSpeed.xyz);
  float radius = aDirSpeed.w * uExpand;
  // Slight outward-curving drift so streaks are not perfectly straight lines.
  vec3 headP = dir * radius;
  vec3 tailP = dir * radius * (1.0 - aShape.x) + vec3(0.0, -0.04, 0.0) * aShape.w * uExpand;

  vec4 c0 = project(tailP);
  vec4 c1 = project(headP);
  vec2 s0 = c0.xy / c0.w;
  vec2 s1 = c1.xy / c1.w;
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 d = (s1 - s0) * aspect;
  float len = length(d);
  d = len > 1e-6 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);

  vec4 c = mix(c0, c1, aCorner.x);
  float widthPx = aShape.y * uPxScale;
  vec2 offset = (n * aCorner.y * widthPx + d * (aCorner.x * 2.0 - 1.0) * widthPx) / aspect;
  c.xy += offset * (2.0 / uResolution.y) * c.w;
  gl_Position = c;

  vColor = aColor;
  vCorner = aCorner;
  vSeed = aShape.z;
}`;

const streakFS = /* glsl */ `#version 300 es
precision highp float;
in vec4 vColor;
in vec2 vCorner;
in float vSeed;
uniform float uGain;
out vec4 outColor;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  float side = 1.0 - vCorner.y * vCorner.y;
  // Bright head, fading toward the centre of the burst.
  float along = pow(vCorner.x, 1.6);
  // Powdery speckle along the streak.
  float k = floor(vCorner.x * (18.0 + 40.0 * hash(vSeed * 7.1)));
  float h = hash(k + vSeed * 131.7);
  float speckle = h < 0.45 ? 0.08 : 0.3 + 2.2 * (h - 0.45);
  // Powder grains are opaque-ish and occlude each other (premultiplied
  // "over" blending), so colours stay saturated instead of averaging out.
  float a = clamp(side * along * speckle * vColor.a * uGain, 0.0, 1.0);
  outColor = vec4(vColor.rgb * a, a);
}`;

const hazeVS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aDirSpeed;
layout(location = 2) in vec4 aColor;
layout(location = 3) in vec4 aShape;   // x: radial fraction, y: size, z: seed

uniform mat4 uViewProj;
uniform mat3 uRot;
uniform float uExpand;
uniform vec2 uResolution;
uniform float uPxScale;

out vec4 vColor;
out vec2 vUv;

void main() {
  vec3 dir = normalize(uRot * aDirSpeed.xyz);
  vec3 p = dir * aDirSpeed.w * uExpand * aShape.x;
  vec4 c = uViewProj * vec4(p, 1.0);
  float sizePx = aShape.y * uPxScale * (0.4 + 0.6 * clamp(uExpand / 2.0, 0.0, 1.5));
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  c.xy += aCorner * sizePx * (2.0 / uResolution.y) / aspect * c.w;
  gl_Position = c;
  vColor = aColor;
  vUv = aCorner;
}`;

const hazeFS = /* glsl */ `#version 300 es
precision highp float;
in vec4 vColor;
in vec2 vUv;
uniform float uGain;
out vec4 outColor;
void main() {
  float r2 = dot(vUv, vUv);
  float a = exp(-r2 * 3.5) * vColor.a * uGain;
  outColor = vec4(vColor.rgb * a, 1.0);
}`;

const finalVS = /* glsl */ `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 vUv;
void main() {
  vec2 p = P[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const finalFS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform vec3 uBackground;
uniform float uExposure;
uniform float uSeed;
in vec2 vUv;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
void main() {
  vec3 c = texture(uScene, vUv).rgb;
  // Exponential tone curve keeps dense additive regions saturated, not clipped.
  vec3 mapped = 1.0 - exp(-c * uExposure);
  // Gentle desaturation toward white in the hottest regions.
  float l = dot(mapped, vec3(0.2126, 0.7152, 0.0722));
  mapped = mix(mapped, vec3(l), smoothstep(0.85, 1.0, l) * 0.2);
  vec3 col = uBackground + mapped;
  col = pow(col, vec3(1.0 / 1.12));
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.012;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
};

const program = (gl: WebGL2RenderingContext, vs: string, fs: string) => {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
};

type RGB = [number, number, number];
const pick = (arr: RGB[], r: number) => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];

const randomUnit = (rand: () => number): [number, number, number] => {
  const u = rand() * 2 - 1;
  const th = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(th), u, s * Math.sin(th)];
};

type Jet = { axis: [number, number, number]; spread: number; color: RGB; reach: number };

const buildParticles = (palette: BurstPalette, count: number, haze: boolean) => {
  const rand = mulberry32(haze ? 7717 : 1368);
  // Powder bursts are clumpy: most grains travel in coloured jets.
  const jets: Jet[] = [];
  for (let j = 0; j < 420; j++) {
    const axis = randomUnit(rand);
    // Colour comes from a low-frequency field over the sphere so neighbouring
    // jets share a hue (coherent colour regions, not a uniform average).
    const [ax, ay, az] = axis;
    const field =
      0.5 +
      0.25 * Math.sin(2.6 * ax + 1.3) * Math.cos(2.1 * az + 0.7) +
      0.25 * Math.sin(3.3 * ay + 1.9 * ax + 0.4);
    const cr = Math.min(0.999, Math.max(0, field + (rand() - 0.5) * 0.25));
    const lowerWeight = Math.min(0.9, Math.max(0.12, -ay * 1.5 + 0.1 + 0.4 * Math.sin(3 * ax + 2 * az)));
    const color =
      rand() < 0.07
        ? pick(palette.accents, rand())
        : rand() < lowerWeight
          ? pick(palette.lower, cr)
          : pick(palette.upper, cr);
    jets.push({ axis, spread: 0.015 + 0.08 * rand(), color, reach: 0.4 + 1.05 * Math.pow(rand(), 2.2) });
  }

  const dirSpeed = new Float32Array(count * 4);
  const color = new Float32Array(count * 4);
  const shape = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    let dir = randomUnit(rand);
    let col: RGB;
    const cr = rand();
    const inJet = !haze && rand() < 0.72;
    let reach = 0.75 + 0.3 * rand();
    if (inJet) {
      const jet = jets[Math.floor(rand() * jets.length)];
      const off = randomUnit(rand);
      const k = jet.spread * Math.sqrt(rand());
      reach = jet.reach;
      dir = [jet.axis[0] + off[0] * k, jet.axis[1] + off[1] * k, jet.axis[2] + off[2] * k];
      col = rand() < 0.85 ? jet.color : pick(palette.upper, cr);
    } else if (haze) {
      col = pick(palette.haze, cr);
    } else {
      const lowerWeight = Math.min(1, Math.max(0, -dir[1] * 1.4 + 0.15));
      if (rand() < 0.06) col = pick(palette.accents, cr);
      else if (rand() < lowerWeight) col = pick(palette.lower, cr);
      else col = pick(palette.upper, cr);
    }
    // Slightly wider than tall, with a drooping lower plume.
    const x = dir[0] * 1.12;
    const y = dir[1] * (dir[1] < 0 ? 1.05 : 0.9);
    const z = dir[2];
    // Dense core with a few long outlying spikes.
    // Each jet has its own reach, giving the spiky silhouette of the
    // reference; grains are spread along the jet from core to tip.
    const speed = haze ? 0.85 : reach * (0.12 + 0.88 * Math.pow(rand(), 0.7));
    dirSpeed.set([x, y, z, speed], i * 4);

    const bright = haze ? 0.005 + 0.006 * rand() : (inJet ? 0.5 : 0.36) * (0.3 + 0.9 * rand());
    // Per-grain shading gives the powder texture.
    const shade = haze ? 1 : 0.5 + 0.5 * rand();
    color.set([col[0] * shade, col[1] * shade, col[2] * shade, bright], i * 4);

    if (haze) {
      shape.set([0.25 + 0.75 * rand(), 14 + 40 * rand(), rand() * 1000, 0], i * 4);
    } else {
      const trail = rand() < 0.25 ? 0.4 + 0.4 * rand() : 0.04 + 0.22 * rand();
      const width = 2.0 + 4.2 * Math.pow(rand(), 2.5);
      shape.set([trail, width, rand() * 1000, rand() * 2 - 1], i * 4);
      // Glints: short, bright sparkles scattered through the cloud.
      if (rand() < 0.08) {
        const a = pick(palette.accents, rand());
        color.set([a[0], a[1], a[2], 0.9 + 0.1 * rand()], i * 4);
        shape.set([0.015 + 0.04 * rand(), 1.6 + 1.8 * rand(), rand() * 1000, 0], i * 4);
      }
    }
  }
  return { dirSpeed, color, shape };
};

export type BurstFrame = {
  expand: number;
  yaw: number;
  pitch: number;
  cameraZ: number;
  centerY: number;
  seed: number;
};

const perspective = (fovY: number, aspect: number, near: number, far: number) => {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  // Column-major.
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
};

const multiply = (a: Float32Array, b: Float32Array) => {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
};

export const createBurstRenderer = (
  canvas: HTMLCanvasElement,
  palette: BurstPalette,
) => {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL 2 is not available");
  const width = canvas.width;
  const height = canvas.height;

  const floatOk = !!gl.getExtension("EXT_color_buffer_float");
  const sceneTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, sceneTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    floatOk ? gl.RGBA16F : gl.RGBA8,
    width,
    height,
    0,
    gl.RGBA,
    floatOk ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const corner = new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]);
  const hazeCorner = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

  const makeVao = (cornerData: Float32Array, data: ReturnType<typeof buildParticles>) => {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffers: WebGLBuffer[] = [];
    const attrib = (loc: number, arr: Float32Array, size: number, divisor: number) => {
      const b = gl.createBuffer()!;
      buffers.push(b);
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(loc, divisor);
    };
    attrib(0, cornerData, 2, 0);
    attrib(1, data.dirSpeed, 4, 1);
    attrib(2, data.color, 4, 1);
    attrib(3, data.shape, 4, 1);
    gl.bindVertexArray(null);
    return { vao, buffers };
  };

  const streaks = makeVao(corner, buildParticles(palette, STREAK_COUNT, false));
  const haze = makeVao(hazeCorner, buildParticles(palette, HAZE_COUNT, true));
  const streakProg = program(gl, streakVS, streakFS);
  const hazeProg = program(gl, hazeVS, hazeFS);
  const finalProg = program(gl, finalVS, finalFS);
  const emptyVao = gl.createVertexArray()!;

  const render = (f: BurstFrame) => {
    const aspect = width / height;
    const proj = perspective((40 * Math.PI) / 180, aspect, 0.05, 100);
    // View: camera on +z looking at origin, burst centre shifted vertically.
    const view = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, f.centerY, -f.cameraZ, 1,
    ]);
    const viewProj = multiply(proj, view);
    const cy = Math.cos(f.yaw);
    const sy = Math.sin(f.yaw);
    const cp = Math.cos(f.pitch);
    const sp = Math.sin(f.pitch);
    // R = Rx(pitch) * Ry(yaw), column-major mat3.
    const rot = new Float32Array([
      cy, sp * sy, -cp * sy,
      0, cp, sp,
      sy, -sp * cy, cp * cy,
    ]);
    const pxScale = height / 2160;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    const setCommon = (prog: WebGLProgram) => {
      gl.useProgram(prog);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uViewProj"), false, viewProj);
      gl.uniformMatrix3fv(gl.getUniformLocation(prog, "uRot"), false, rot);
      gl.uniform1f(gl.getUniformLocation(prog, "uExpand"), f.expand);
      gl.uniform2f(gl.getUniformLocation(prog, "uResolution"), width, height);
      gl.uniform1f(gl.getUniformLocation(prog, "uPxScale"), pxScale);
      // The compact opening clump is dim; it brightens as it opens up.
      const open = Math.min(1, Math.max(0, (f.expand - 0.16) / 1.1));
      gl.uniform1f(gl.getUniformLocation(prog, "uGain"), 0.18 + 0.82 * open * open * (3 - 2 * open));
    };

    setCommon(hazeProg);
    gl.bindVertexArray(haze.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, HAZE_COUNT);

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    setCommon(streakProg);
    gl.bindVertexArray(streaks.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, STREAK_COUNT);

    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(finalProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(gl.getUniformLocation(finalProg, "uScene"), 0);
    gl.uniform3fv(gl.getUniformLocation(finalProg, "uBackground"), palette.background);
    gl.uniform1f(gl.getUniformLocation(finalProg, "uExposure"), 2.3);
    gl.uniform1f(gl.getUniformLocation(finalProg, "uSeed"), f.seed);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.finish();
  };

  const dispose = () => {
    for (const v of [streaks, haze]) {
      gl.deleteVertexArray(v.vao);
      v.buffers.forEach((b) => gl.deleteBuffer(b));
    }
    gl.deleteVertexArray(emptyVao);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(sceneTex);
    [streakProg, hazeProg, finalProg].forEach((p) => gl.deleteProgram(p));
  };

  return { render, dispose };
};
