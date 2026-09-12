import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";
import {
  amplitudeNorm,
  packWaveAmplitudes,
  packWaveVectors,
  WAVE_COUNT,
} from "./waves";
import { hexToRgb, type SatinTheme } from "./palette";

export type SatinRenderer = {
  gl: WebGL2RenderingContext;
  draw: (opts: { t: number; frame: number; theme: SatinTheme }) => void;
};

const compile = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error("Shader compile failed: " + gl.getShaderInfoLog(shader));
  }
  return shader;
};

/**
 * Sets up the full-screen triangle pair and caches uniform locations. The
 * context is created once per canvas and reused for every frame — recreating
 * it per frame would leak contexts and stall the renderer.
 */
export const createSatinRenderer = (
  canvas: HTMLCanvasElement,
): SatinRenderer => {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error("WebGL2 is not available");

  const program = gl.createProgram();
  if (!program) throw new Error("Could not create program");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("Program link failed: " + gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const loc = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    resolution: loc("uResolution"),
    t: loc("uT"),
    frame: loc("uFrame"),
    wave: loc("uWave"),
    waveAmpBand: loc("uWaveAmpBand"),
    ampNorm: loc("uAmpNorm"),
    bandFocus: loc("uBandFocus"),
    warp: loc("uWarp"),
    calm: loc("uCalm"),
    shadow: loc("uShadow"),
    mid: loc("uMid"),
    high: loc("uHigh"),
    bump: loc("uBump"),
    diffuse: loc("uDiffuse"),
    specular: loc("uSpecular"),
    specPower: loc("uSpecPower"),
    sheen: loc("uSheen"),
    grain: loc("uGrain"),
    vignette: loc("uVignette"),
  };

  // The wave table never changes, so upload it once.
  gl.uniform4fv(u.wave, packWaveVectors(), 0, WAVE_COUNT * 4);
  gl.uniform2fv(u.waveAmpBand, packWaveAmplitudes(), 0, WAVE_COUNT * 2);
  gl.uniform1f(u.ampNorm, amplitudeNorm());
  gl.uniform3f(u.bandFocus, 1.0, 0.45, 0.12);
  gl.uniform1f(u.warp, 0.12);
  gl.uniform1f(u.calm, 0.45);

  const draw: SatinRenderer["draw"] = ({ t, frame, theme }) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.resolution, canvas.width, canvas.height);
    gl.uniform1f(u.t, t);
    gl.uniform1f(u.frame, frame);
    gl.uniform3fv(u.shadow, hexToRgb(theme.shadow));
    gl.uniform3fv(u.mid, hexToRgb(theme.mid));
    gl.uniform3fv(u.high, hexToRgb(theme.high));
    gl.uniform1f(u.bump, theme.bump);
    gl.uniform1f(u.diffuse, theme.diffuse);
    gl.uniform1f(u.specular, theme.specular);
    gl.uniform1f(u.specPower, theme.specPower);
    gl.uniform1f(u.sheen, theme.sheen);
    gl.uniform1f(u.grain, theme.grain);
    gl.uniform1f(u.vignette, theme.vignette);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Force the draw to land before Remotion screenshots the page.
    gl.finish();
  };

  return { gl, draw };
};
