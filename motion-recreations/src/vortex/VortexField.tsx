import { useEffect, useRef } from "react";
import {
  AbsoluteFill,
  cancelRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COMPOSITE_SHADER, FIELD_SHADER, VERTEX_SHADER } from "./shader";

// The smooth field is evaluated at a quarter of the composition size, then
// upsampled to full 4K where the grain is added (see shader.ts).
const FIELD_SCALE = 0.25;

type Pass = {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

type GlState = {
  gl: WebGL2RenderingContext;
  field: Pass;
  composite: Pass;
  fieldTexture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  fieldWidth: number;
  fieldHeight: number;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Could not create shader");
  }
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compile failed");
  }
  return shader;
};

const createPass = (
  gl: WebGL2RenderingContext,
  fragmentSrc: string,
  uniformNames: string[],
): Pass => {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSrc));
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Program link failed");
  }
  const uniforms: Pass["uniforms"] = {};
  for (const name of uniformNames) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
};

const setup = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): GlState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
  });
  if (!gl) {
    throw new Error("WebGL 2 is not available");
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const field = createPass(gl, FIELD_SHADER, [
    "uResolution",
    "uFieldSize",
    "uTime",
    "uCamera",
    "uProgress",
  ]);
  const composite = createPass(gl, COMPOSITE_SHADER, [
    "uField",
    "uResolution",
    "uFrame",
  ]);

  const fieldWidth = Math.round(width * FIELD_SCALE);
  const fieldHeight = Math.round(height * FIELD_SCALE);
  const fieldTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, fieldTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    fieldWidth,
    fieldHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    fieldTexture,
    0,
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Field framebuffer is incomplete");
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    gl,
    field,
    composite,
    fieldTexture,
    framebuffer,
    fieldWidth,
    fieldHeight,
  };
};

export const VortexField: React.FC<{ camera: "locked" | "flyover" }> = ({
  camera,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    try {
      if (!stateRef.current) {
        stateRef.current = setup(canvas, width, height);
      }
      const st = stateRef.current;
      const { gl } = st;

      // Pass 1: smooth field at quarter resolution into the offscreen texture.
      gl.bindFramebuffer(gl.FRAMEBUFFER, st.framebuffer);
      gl.viewport(0, 0, st.fieldWidth, st.fieldHeight);
      gl.useProgram(st.field.program);
      gl.uniform2f(st.field.uniforms.uResolution, width, height);
      gl.uniform2f(st.field.uniforms.uFieldSize, st.fieldWidth, st.fieldHeight);
      gl.uniform1f(st.field.uniforms.uTime, frame / fps);
      gl.uniform1i(st.field.uniforms.uCamera, camera === "flyover" ? 1 : 0);
      gl.uniform1f(st.field.uniforms.uProgress, frame / (durationInFrames - 1));
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Pass 2: upsample to 4K and add grain.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.useProgram(st.composite.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, st.fieldTexture);
      gl.uniform1i(st.composite.uniforms.uField, 0);
      gl.uniform2f(st.composite.uniforms.uResolution, width, height);
      gl.uniform1f(st.composite.uniforms.uFrame, frame);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.finish();
    } catch (err) {
      cancelRender(err);
    }
  }, [frame, fps, width, height, durationInFrames, camera]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={width} height={height} />
    </AbsoluteFill>
  );
};

export const VortexFieldReference: React.FC = () => (
  <VortexField camera="locked" />
);

export const VortexFieldFlyover: React.FC = () => (
  <VortexField camera="flyover" />
);
