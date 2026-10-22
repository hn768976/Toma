import { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { getNebulaCamera, getStarCamera, screenToWorldMatrix } from "./camera";
import { getFlyby } from "./flyby";
import { emberPalette, paletteToArray, referencePalette } from "./palettes";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";

export const helixNebulaSchema = z.object({
  palette: z.enum(["reference", "ember"]),
});

type Props = z.infer<typeof helixNebulaSchema>;

type GlState = {
  gl: WebGL2RenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
};

const initGl = (canvas: HTMLCanvasElement): GlState => {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error("WebGL 2 is not available");
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uniforms: GlState["uniforms"] = {};
  for (const name of [
    "uRes",
    "uCam",
    "uCamCenter",
    "uStarCam",
    "uStarCenter",
    "uTime",
    "uPx",
    "uStarPx",
    "uStarSize",
    "uPal",
    "uFly",
  ]) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { gl, uniforms };
};

export const HelixNebula: React.FC<Props> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GlState | null>(null);
  const [handle] = useState(() => delayRender("Drawing nebula"));

  // The backing store follows the device pixel ratio, so a `--scale=0.5`
  // render of the 4K composition shades 1920x1080 pixels instead of shading
  // 4K and downsampling. Capped at 1x so studio on a HiDPI screen stays 4K.
  const dpr =
    typeof window === "undefined"
      ? 1
      : Math.min(1, window.devicePixelRatio || 1);
  const bufW = Math.round(width * dpr);
  const bufH = Math.round(height * dpr);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!glRef.current) glRef.current = initGl(canvas);
    const { gl, uniforms } = glRef.current;

    const cam = getNebulaCamera(frame);
    const starCam = getStarCamera(frame);
    gl.viewport(0, 0, bufW, bufH);
    gl.uniform2f(uniforms.uRes, bufW, bufH);
    gl.uniformMatrix2fv(uniforms.uCam, false, screenToWorldMatrix(cam));
    gl.uniform2f(uniforms.uCamCenter, cam.centerX, cam.centerY);
    gl.uniformMatrix2fv(uniforms.uStarCam, false, screenToWorldMatrix(starCam));
    gl.uniform2f(uniforms.uStarCenter, starCam.centerX, starCam.centerY);
    gl.uniform1f(uniforms.uTime, frame / fps);
    gl.uniform1f(uniforms.uPx, 1 / cam.zoom / bufH);
    gl.uniform1f(uniforms.uStarPx, 1 / starCam.zoom / bufH);
    gl.uniform1f(uniforms.uStarSize, Math.pow(starCam.zoom, -0.7));
    gl.uniform3fv(
      uniforms.uPal,
      paletteToArray(palette === "ember" ? emberPalette : referencePalette),
    );
    gl.uniform4fv(uniforms.uFly, getFlyby(frame));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
    continueRender(handle);
  }, [frame, fps, bufW, bufH, palette, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={bufW}
        height={bufH}
        style={{ width, height }}
      />
    </AbsoluteFill>
  );
};
