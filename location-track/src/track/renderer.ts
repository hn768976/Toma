// WebGL2 compositor for the satellite map: samples the procedural map layers with
// the current zoom/pan (two maps, crossfaded at the cut), applies defocus (explicit
// mip LOD), palette grade, overlay glow, vignette and sensor grain.

import { MAP_RECT, MapLayers, TEX_W } from "./maps";
import { Palette } from "./palette";
import { View } from "./timeline";

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uBaseA;
uniform sampler2D uOverA;
uniform sampler2D uBaseB;
uniform sampler2D uOverB;
uniform vec2 uRes;
uniform vec4 uRect;
uniform float uTexW;
uniform vec4 uCamA; // zoom, cx, cy, blur
uniform vec4 uCamB;
uniform vec2 uExposure; // per map
uniform float uMix;
uniform float uTime;
uniform vec3 uShadow;
uniform vec3 uMid;
uniform vec3 uHigh;
uniform vec3 uLine;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 grade(float l) {
  l = clamp(l, 0.0, 1.0);
  return l < 0.5 ? mix(uShadow, uMid, l / 0.5) : mix(uMid, uHigh, (l - 0.5) / 0.5);
}

vec3 shade(sampler2D base, sampler2D over, vec4 cam, float exposure, vec2 s) {
  vec2 m = (s - vec2(596.0, 336.0)) / cam.x + cam.yz;
  vec2 uv = (m - uRect.xy) / uRect.zw;
  // Explicit LOD: texels per output pixel, plus the defocus amount. (A plain
  // texture() bias would do nothing while the map is magnified.)
  float fp = (uTexW / uRect.z) / (cam.x * uRes.x / 1192.0);
  float lod = max(log2(fp), 0.0) + cam.w;
  float l = textureLod(base, uv, lod).r;
  float o = textureLod(over, uv, lod).r;
  float lGlow = textureLod(base, uv, lod + 5.0).r;
  float oGlow = textureLod(over, uv, lod + 3.0).r;
  vec3 col = grade(l * exposure);
  col += grade(lGlow) * 0.12;
  col = mix(col, uLine, o * 0.7);
  col += uLine * oGlow * 0.35;
  return col;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 s = frag / uRes * vec2(1192.0, 672.0);
  vec3 col;
  if (uMix <= 0.0) {
    col = shade(uBaseA, uOverA, uCamA, uExposure.x, s);
  } else if (uMix >= 1.0) {
    col = shade(uBaseB, uOverB, uCamB, uExposure.y, s);
  } else {
    col = mix(shade(uBaseA, uOverA, uCamA, uExposure.x, s),
              shade(uBaseB, uOverB, uCamB, uExposure.y, s), uMix);
  }
  vec2 q = frag / uRes - 0.5;
  col *= 1.0 - dot(q * vec2(1.1, 1.0), q) * 0.9;
  col += (hash(frag + fract(uTime * 13.37) * 517.0) - 0.5) * 0.03;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const UNIFORMS = [
  "uBaseA",
  "uOverA",
  "uBaseB",
  "uOverB",
  "uRes",
  "uRect",
  "uTexW",
  "uCamA",
  "uCamB",
  "uExposure",
  "uMix",
  "uTime",
  "uShadow",
  "uMid",
  "uHigh",
  "uLine",
];

export class MapRenderer {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private textures: Record<"A" | "B", [WebGLTexture, WebGLTexture]>;

  constructor(canvas: HTMLCanvasElement, maps: Record<"A" | "B", MapLayers>) {
    const gl = canvas.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
    });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) ?? "shader error");
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "link error");
    }
    this.prog = prog;
    for (const name of UNIFORMS) {
      this.loc[name] = gl.getUniformLocation(prog, name);
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const upload = (src: HTMLCanvasElement) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.textures = {
      A: [upload(maps.A.base), upload(maps.A.overlay)],
      B: [upload(maps.B.base), upload(maps.B.overlay)],
    };
  }

  render(view: View, palette: Palette, time: number) {
    const gl = this.gl;
    const w = gl.canvas.width;
    const h = gl.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.prog);
    const units: Array<[string, WebGLTexture]> = [
      ["uBaseA", this.textures.A[0]],
      ["uOverA", this.textures.A[1]],
      ["uBaseB", this.textures.B[0]],
      ["uOverB", this.textures.B[1]],
    ];
    const L = this.loc;
    units.forEach(([name, tex], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(L[name], i);
    });
    const { a, b } = view;
    gl.uniform2f(L.uRes, w, h);
    gl.uniform4f(L.uRect, MAP_RECT.x0, MAP_RECT.y0, MAP_RECT.w, MAP_RECT.h);
    gl.uniform1f(L.uTexW, TEX_W);
    gl.uniform4f(L.uCamA, a.zoom, a.cx, a.cy, a.blur);
    gl.uniform4f(L.uCamB, b.zoom, b.cx, b.cy, b.blur);
    gl.uniform2f(L.uExposure, a.exposure, b.exposure);
    gl.uniform1f(L.uMix, view.mix);
    gl.uniform1f(L.uTime, time);
    gl.uniform3fv(L.uShadow, palette.shadow);
    gl.uniform3fv(L.uMid, palette.mid);
    gl.uniform3fv(L.uHigh, palette.high);
    gl.uniform3fv(L.uLine, palette.mapLine);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }
}
