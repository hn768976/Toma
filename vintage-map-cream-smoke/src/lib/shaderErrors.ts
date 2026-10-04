import { cancelRender } from "remotion";
import type { WebGLRenderer } from "three";

// A shader that fails to compile must fail the render, not produce black frames.
export const failOnShaderError = (gl: WebGLRenderer) => {
  gl.debug.onShaderError = (ctx, program, vs, fs) => {
    const log = [ctx.getShaderInfoLog(vs), ctx.getShaderInfoLog(fs), ctx.getProgramInfoLog(program)].filter(Boolean).join("\n");
    cancelRender(new Error(`Shader compile error:\n${log}`));
  };
};
