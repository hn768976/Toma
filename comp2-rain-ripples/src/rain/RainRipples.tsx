import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { cameraAt } from "./camera";
import colorField from "./colorField.json";
import { HEIGHT_FRAG, SHADE_FRAG, VERT } from "./shaders";
import { buildWaves } from "./waves";

export const rainSchema = z.object({
  camera: z.enum(["reference", "lowAngleDolly"]),
  seed: z.number(),
  debugShading: z.boolean().optional(),
  waveGain: z.number().optional(),
  rippleGain: z.number().optional(),
  sigma: z.number().optional(),
});

export type RainProps = z.infer<typeof rainSchema>;

// Slope normaliser — chosen so the shaded value is ~uniformly distributed,
// which makes the colour-field lookup reproduce the reference's per-region
// tonal distribution (verified with the debug histogram).
const SIGMA = 0.3;
// Relative strength of background chop vs. rain-drop rings (tuned against
// the reference's regional colour/contrast statistics).
const WAVE_GAIN = 0.024;
const RIPPLE_GAIN = 2.1;

type GLState = {
  gl: WebGL2RenderingContext;
  heightProg: WebGLProgram;
  shadeProg: WebGLProgram;
  vao: WebGLVertexArrayObject;
  fbo: WebGLFramebuffer;
  heightTex: WebGLTexture;
  fieldTex: WebGLTexture;
  w: number;
  h: number;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error("Shader compile error: " + gl.getShaderInfoLog(sh));
  }
  return sh;
};

const link = (gl: WebGL2RenderingContext, fs: string) => {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("Program link error: " + gl.getProgramInfoLog(p));
  }
  return p;
};

const initGL = (canvas: HTMLCanvasElement): GLState => {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    alpha: false,
  });
  if (!gl) throw new Error("WebGL2 is not available");
  if (!gl.getExtension("EXT_color_buffer_float")) {
    throw new Error("EXT_color_buffer_float is not available");
  }
  const w = canvas.width;
  const h = canvas.height;

  const heightProg = link(gl, HEIGHT_FRAG);
  const shadeProg = link(gl, SHADE_FRAG);

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const heightTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, heightTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, heightTex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Height framebuffer incomplete");
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // Colour field: 7 luminance-quantile slabs of 24x14 stacked vertically.
  const { gridW, gridH, rgb } = colorField as {
    gridW: number;
    gridH: number;
    rgb: number[][][][];
  };
  const levels = rgb.length;
  const data = new Uint8Array(gridW * gridH * levels * 4);
  for (let l = 0; l < levels; l++) {
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const o = ((l * gridH + y) * gridW + x) * 4;
        const c = rgb[l][y][x];
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 255;
      }
    }
  }
  const fieldTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, fieldTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gridW, gridH * levels, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return { gl, heightProg, shadeProg, vao, fbo, heightTex, fieldTex, w, h };
};

export const RainRipples: React.FC<RainProps> = ({ camera, seed, debugShading, waveGain = WAVE_GAIN, rippleGain = RIPPLE_GAIN, sigma = SIGMA }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GLState | null>(null);
  // The composition is authored at 4K. The shader is evaluated at the
  // pixel density actually being rendered: full 3840x2160 for a native
  // 4K render (scale 1), 1920x1080 when rendered with --scale=0.5, so no
  // work is wasted on pixels that are immediately downsampled. Capped at 1
  // so a HiDPI Studio preview never exceeds 4K.
  const density =
    typeof window === "undefined" ? 1 : Math.min(1, Math.max(0.25, window.devicePixelRatio || 1));
  const bw = Math.round(width * density);
  const bh = Math.round(height * density);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!glRef.current || glRef.current.w !== canvas.width || glRef.current.h !== canvas.height) {
      glRef.current = initGL(canvas);
    }
    const st = glRef.current;
    const { gl } = st;
    const wv = buildWaves(seed);
    const time = frame / fps;
    const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
    const cam = cameraAt(camera, progress, st.w / st.h);

    const setCommon = (prog: WebGLProgram) => {
      gl.useProgram(prog);
      const u = (n: string) => gl.getUniformLocation(prog, n);
      gl.uniform2f(u("uRes"), st.w, st.h);
      gl.uniform1f(u("uTime"), time);
      gl.uniform1f(u("uSeed"), seed);
      gl.uniform3fv(u("uCamPos"), cam.pos);
      gl.uniform3fv(u("uCamFwd"), cam.fwd);
      gl.uniform3fv(u("uCamRight"), cam.right);
      gl.uniform3fv(u("uCamUp"), cam.up);
      gl.uniform1f(u("uTanHalfFov"), cam.tanHalfFov);
      gl.uniform1f(u("uWorldScale"), cam.worldScale);
      gl.uniform1f(u("uWaveGain"), waveGain);
      gl.uniform1f(u("uRippleGain"), rippleGain);
      return u;
    };

    gl.bindVertexArray(st.vao);
    gl.viewport(0, 0, st.w, st.h);

    // Pass 1 — height field
    gl.bindFramebuffer(gl.FRAMEBUFFER, st.fbo);
    const hu = setCommon(st.heightProg);
    gl.uniform4fv(hu("uWave"), wv.a);
    gl.uniform2fv(hu("uWave2"), wv.b);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Pass 2 — shading
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const u = setCommon(st.shadeProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, st.heightTex);
    gl.uniform1i(u("uHeight"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, st.fieldTex);
    gl.uniform1i(u("uField"), 1);
    gl.uniform1f(u("uSigma"), sigma);
    const lx = 0.3;
    const ly = 1.0;
    const ll = Math.hypot(lx, ly);
    gl.uniform2f(u("uLight"), lx / ll, ly / ll);
    gl.uniform1f(u("uFresnel"), camera === "lowAngleDolly" ? 0.55 : 0);
    gl.uniform1i(u("uDebug"), debugShading ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, fps, durationInFrames, camera, seed, debugShading, waveGain, rippleGain, sigma, bw, bh]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b2a6b" }}>
      <canvas
        ref={canvasRef}
        width={bw}
        height={bh}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
