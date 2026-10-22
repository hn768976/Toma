import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender, useVideoConfig } from "remotion";

export type Uniforms = Record<string, number | number[]>;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

type GLState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
  textures: { name: string; tex: WebGLTexture }[];
};

// Decoded images are cached per tab so every frame reuses them.
const imageCache = new Map<string, Promise<HTMLImageElement>>();
const loadImage = (src: string) => {
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load ${src}`));
        img.src = src;
      }),
    );
  }
  return imageCache.get(src)!;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(sh) || "(no log)"} lost=${gl.isContextLost()}`);
  }
  return sh;
};

/**
 * Full-screen WebGL2 fragment shader layer. The backing store follows the
 * render scale (`window.devicePixelRatio` equals Remotion's `--scale`), so a
 * 4K composition rendered at `--scale=0.5` shades 1920x1080 pixels while a
 * full 4K render shades 3840x2160. `uResolution` is always passed in backing
 * store pixels; shaders should work in resolution-independent units.
 */
export const ShaderCanvas: React.FC<{
  fragment: string;
  uniforms: Uniforms;
  /** Sampler uniform name → image URL (mipmapped, clamped). */
  textures?: Record<string, string>;
  style?: React.CSSProperties;
}> = ({ fragment, uniforms, textures = {}, style }) => {
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<GLState | null>(null);
  const [handle] = useState(() => delayRender("Compiling shader"));
  const [images, setImages] = useState<Record<string, HTMLImageElement> | null>(null);
  const texKey = JSON.stringify(textures);
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);

  useLayoutEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL2 is not available");
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    state.current = { gl, program, locations: new Map(), textures: [] };
    if (images) {
      for (const [name, img] of Object.entries(images)) {
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        state.current.textures.push({ name, tex });
      }
    }
    return () => {
      // The canvas keeps its context; just free GPU objects before rebuilding.
      state.current?.textures.forEach(({ tex }) => gl.deleteTexture(tex));
      gl.deleteProgram(program);
      gl.deleteBuffer(buf);
      state.current = null;
    };
  }, [fragment, images]);

  useLayoutEffect(() => {
    const s = state.current;
    if (!s) return;
    const { gl, program, locations } = s;
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(program);
    s.textures.forEach(({ name, tex }, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(gl.getUniformLocation(program, name), unit);
    });
    const all: Uniforms = { ...uniforms, uResolution: [bw, bh] };
    for (const [name, value] of Object.entries(all)) {
      if (!locations.has(name)) {
        locations.set(name, gl.getUniformLocation(program, name));
      }
      const l = locations.get(name);
      if (!l) continue;
      if (typeof value === "number") gl.uniform1f(l, value);
      else if (value.length === 2) gl.uniform2fv(l, value);
      else if (value.length === 3) gl.uniform3fv(l, value);
      else if (value.length === 4) gl.uniform4fv(l, value);
      else gl.uniform1fv(l, value);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  });

  useEffect(() => {
    const entries = Object.entries(JSON.parse(texKey) as Record<string, string>);
    Promise.all(entries.map(([, src]) => loadImage(src)))
      .then((imgs) => {
        setImages(Object.fromEntries(entries.map(([name], i) => [name, imgs[i]])));
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });
  }, [texKey]);

  useEffect(() => {
    if (images) continueRender(handle);
  }, [handle, images]);

  return (
    <canvas
      ref={ref}
      width={bw}
      height={bh}
      style={{ position: "absolute", inset: 0, width, height, ...style }}
    />
  );
};
