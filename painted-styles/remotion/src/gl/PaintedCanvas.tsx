import React, { useLayoutEffect, useRef } from "react";
import { cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FINAL_FRAG, LAYER_FRAG, VERT } from "./shaders";
import { LayerDraw, Scene } from "./scene";

type GLState = {
  gl: WebGL2RenderingContext;
  layerProg: WebGLProgram;
  finalProg: WebGLProgram;
  fbo: WebGLFramebuffer;
  acc: WebGLTexture;
  blue: WebGLTexture;
  textures: Map<string, WebGLTexture>;
  halfFloat: boolean;
  w: number;
  h: number;
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const loadImage = (src: string): Promise<HTMLImageElement> => {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`failed to load ${src}`));
      img.src = staticFile(src);
    });
    imageCache.set(src, p);
  }
  return p;
};

const compile = (gl: WebGL2RenderingContext, vs: string, fs: string) => {
  const prog = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
    gl.attachShader(prog, sh);
  }
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
  return prog;
};

const uploadImage = (gl: WebGL2RenderingContext, img: HTMLImageElement) => {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
};

const init = (canvas: HTMLCanvasElement): GLState => {
  const gl = canvas.getContext("webgl2", {
    antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: false,
  });
  if (!gl) throw new Error("WebGL2 unavailable (render with --gl=angle)");
  const halfFloat = !!gl.getExtension("EXT_color_buffer_float") || !!gl.getExtension("EXT_color_buffer_half_float");
  const layerProg = compile(gl, VERT, LAYER_FRAG);
  const finalProg = compile(gl, VERT, FINAL_FRAG);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const w = canvas.width, h = canvas.height;
  const acc = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, acc);
  if (halfFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, acc, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("FBO incomplete");
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { gl, layerProg, finalProg, fbo, acc, blue: null as unknown as WebGLTexture, textures: new Map(), halfFloat, w, h };
};

const setU = (gl: WebGL2RenderingContext, prog: WebGLProgram, u: Record<string, number | number[]>) => {
  for (const [k, v] of Object.entries(u)) {
    const loc = gl.getUniformLocation(prog, k);
    if (loc === null) continue;
    if (k === "uMode" || k === "uFx") gl.uniform1i(loc, v as number);
    else if (typeof v === "number") gl.uniform1f(loc, v);
    else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
  }
};

export const PaintedCanvas: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GLState | null>(null);
  const scale = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

  useLayoutEffect(() => {
    const handle = delayRender(`paint frame ${frame}`);
    const run = async () => {
      const canvas = canvasRef.current!;
      if (!stateRef.current) {
        stateRef.current = init(canvas);
        stateRef.current.blue = uploadImage(stateRef.current.gl, await loadImage("bluenoise64.png"));
      }
      const st = stateRef.current;
      const { gl } = st;
      const draws: LayerDraw[] = scene.draws(frame);
      // upload any textures this frame needs (draw-on frames are streamed, 3 kept)
      for (const d of draws) {
        if (!st.textures.has(d.src)) st.textures.set(d.src, uploadImage(gl, await loadImage(d.src)));
      }
      const keep = new Set(draws.map((d) => d.src));
      for (const [src, t] of st.textures) {
        if (!keep.has(src) && src.startsWith("drawon/") && st.textures.size > 3) {
          gl.deleteTexture(t);
          st.textures.delete(src);
          imageCache.delete(src);
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, st.fbo);
      gl.viewport(0, 0, st.w, st.h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(st.layerProg);
      for (const d of draws) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, st.textures.get(d.src)!);
        setU(gl, st.layerProg, {
          uTex: 0, uComp: [width, height], uScale: st.w / width, uOpacity: 1,
          uOff: [0, 0], uOff2: [0, 0], uDrift: [0, 0], uWeight: [1, 0], uShift: [0, 0], uAngle: 0,
          ...d.uniforms,
        });
        gl.uniform1i(gl.getUniformLocation(st.layerProg, "uTex"), 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(st.finalProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, st.acc);
      gl.uniform1i(gl.getUniformLocation(st.finalProg, "uAcc"), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, st.blue);
      gl.uniform1i(gl.getUniformLocation(st.finalProg, "uBlue"), 1);
      setU(gl, st.finalProg, { uComp: [width, height], uScale: st.w / width, uGrain: 0.01, ...scene.finalUniforms(frame) });
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.finish();
      canvas.dataset.halfFloat = String(st.halfFloat);
    };
    run().then(() => continueRender(handle)).catch((e) => cancelRender(e));
  }, [frame, scene, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(width * scale)}
      height={Math.round(height * scale)}
      style={{ width, height, display: "block" }}
    />
  );
};
