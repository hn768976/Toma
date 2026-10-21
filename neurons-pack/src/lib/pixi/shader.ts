import { GlProgram, Shader } from "pixi.js";

/**
 * A Pixi shader from GLSL ES 3.00 sources (written without #version).
 * Pixi only treats a program as ES 3.00 when it sees the #version line, and
 * defaults fragments to mediump; both matter for float targets and hashes.
 */
export const glShader = (
  name: string,
  vertex: string,
  fragment: string,
  resources: Record<string, unknown>,
) =>
  new Shader({
    glProgram: GlProgram.from({
      name,
      vertex: `#version 300 es\nprecision highp float;\n${vertex}`,
      fragment: `#version 300 es\nprecision highp float;\n${fragment}`,
      preferredVertexPrecision: "highp",
      preferredFragmentPrecision: "highp",
    }),
    resources: resources as never,
  });
