/**
 * The cylindrical warp, applied as a WebGL post-process over the flat
 * composite.
 *
 * The display is a cylinder with a vertical axis. For each output pixel the
 * shader solves for the angle theta on that cylinder whose perspective
 * projection lands on this pixel, which gives an exact, uniform curve rather
 * than the flat-plane result a CSS perspective transform would produce.
 *
 * Vignette and grain are applied here, after the warp, so the grain stays film
 * flat and the vignette follows the frame rather than the curved surface.
 */

const VERTEX_SHADER = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uTexSize;
uniform float uThetaMax;
uniform float uCamA;
uniform float uPMax;
uniform float uOverscan;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform float uEdgeFalloff;

const int MAX_TAPS = 8;

// Invert the perspective projection of the cylinder:
//   p = sin(theta) / (a - cos(theta))
float thetaAt(float sx) {
  float p = sx * uPMax;
  return asin(clamp(p * uCamA / sqrt(1.0 + p * p), -1.0, 1.0)) - atan(p);
}

vec2 mapUV(float sx, float sy) {
  float theta = thetaAt(sx);
  float depth = (uCamA - cos(theta)) / (uCamA - 1.0);
  return vec2(
    (theta / uThetaMax) * 0.5 + 0.5,
    (sy * depth) / uOverscan * 0.5 + 0.5
  );
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 screen = gl_FragCoord.xy / uRes;
  float sx = screen.x * 2.0 - 1.0;
  float sy = 1.0 - screen.y * 2.0; // +1 at the bottom of the frame

  float tu = thetaAt(sx) / uThetaMax;

  // Footprint of this output pixel in texture space. Toward the left and right
  // edges the cylinder turns away and compresses the texture horizontally by
  // about 5x, which a single bilinear tap aliases into streaks across the dot
  // matrix. Integrate the footprint with as many taps as it actually needs:
  // one at the centre of the frame, where the mapping is 1:1.
  float halfPixel = 1.0 / uRes.x;
  vec2 uvA = mapUV(sx - halfPixel, sy);
  vec2 uvB = mapUV(sx + halfPixel, sy);
  vec2 span = uvB - uvA;
  float texels = length(span * uTexSize);
  int taps = int(min(float(MAX_TAPS), max(1.0, ceil(texels))));

  vec3 col = vec3(0.0);
  for (int i = 0; i < MAX_TAPS; i++) {
    if (i >= taps) break;
    col += texture2D(uTex, uvA + span * ((float(i) + 0.5) / float(taps))).rgb;
  }
  col /= float(taps);

  // The surface turns away at the left and right edges, so it takes less light.
  float edge = 1.0 - uEdgeFalloff * pow(abs(tu), 2.1);
  float radius = length(vec2(sx, sy * 0.82));
  float vig = 1.0 - uVignette * pow(clamp(radius / 1.42, 0.0, 1.0), 2.3);
  col *= edge * vig;

  // Fine grain: the dark gradient would band in H.264 without it.
  float g = hash(gl_FragCoord.xy + vec2(uTime * 13.37, uTime * 7.13));
  col += (g - 0.5) * uGrain;

  gl_FragColor = vec4(col, 1.0);
}
`;

export type WarpParams = {
  readonly thetaMax: number;
  readonly camDistance: number;
  readonly pMax: number;
  readonly overscan: number;
  readonly grain: number;
  readonly vignette: number;
  readonly edgeFalloff: number;
};

export type Warper = {
  render: (source: TexImageSource, frame: number, params: WarpParams) => void;
};

const compile = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
};

export const createWarper = (canvas: HTMLCanvasElement): Warper => {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    // The frame is captured after the buffer may already have been presented.
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
  }) as WebGLRenderingContext | null;

  if (!gl) throw new Error("WebGL is not available for the curved-map warp");

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
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const uTex = uniform("uTex");
  const uRes = uniform("uRes");
  const uTexSize = uniform("uTexSize");
  const uThetaMax = uniform("uThetaMax");
  const uCamA = uniform("uCamA");
  const uPMax = uniform("uPMax");
  const uOverscan = uniform("uOverscan");
  const uTime = uniform("uTime");
  const uGrain = uniform("uGrain");
  const uVignette = uniform("uVignette");
  const uEdgeFalloff = uniform("uEdgeFalloff");

  return {
    render: (source, frame, params) => {
      const texWidth =
        (source as HTMLCanvasElement).width ?? (source as ImageBitmap).width;
      const texHeight =
        (source as HTMLCanvasElement).height ?? (source as ImageBitmap).height;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform1i(uTex, 0);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2f(uTexSize, texWidth, texHeight);
      gl.uniform1f(uThetaMax, params.thetaMax);
      gl.uniform1f(uCamA, params.camDistance);
      gl.uniform1f(uPMax, params.pMax);
      gl.uniform1f(uOverscan, params.overscan);
      gl.uniform1f(uTime, frame);
      gl.uniform1f(uGrain, params.grain);
      gl.uniform1f(uVignette, params.vignette);
      gl.uniform1f(uEdgeFalloff, params.edgeFalloff);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
    },
  };
};
