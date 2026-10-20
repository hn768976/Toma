// Turns the p5.brush paint canvas into the final sheet, in WebGL2:
//
//   paint (sRGB, paint res)
//     -> optical density D = -ln(linear transmittance)       [paint res]
//     -> blurred D (for the dried-rim edge darkening)          [paint res]
//     -> Lanczos-3 upscale, horizontal then vertical           [output res]
//     -> cold-press paper: procedural height field, lit softly [output res]
//     -> multiply: paper albedo * shading * exp(-D'), where D' has pigment
//        settled into the paper's dips, granulation for granulating
//        pigments, and darker drying rims.
//
// Working in density means overlapping washes keep multiplying like real
// transparent glazes, and the paper always shows through.

export type PaperParams = {
  /** 0..1 granulation strength (blues, earths, Payne's grey) */
  granulation: number;
  /** how strongly pigment collects in paper dips */
  settle: number;
  /** extra density on the inner side of every wash edge */
  edge: number;
  /** salt for the paper and granulation noise */
  seed: number;
};

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const HEADER = `#version 300 es
precision highp float;
precision highp int;
out vec4 o;
`;

const NOISE = `
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float h21(ivec2 c, uint seed) {
  return float(pcg(uint(c.x) * 1597334677u ^ pcg(uint(c.y) + seed * 3812015801u))) / 4294967295.0;
}
vec2 h22(ivec2 c, uint seed) {
  return vec2(h21(c, seed), h21(c, seed + 101u));
}
float vnoise(vec2 p, uint seed) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec2 c = ivec2(i);
  float a = h21(c, seed);
  float b = h21(c + ivec2(1, 0), seed);
  float d = h21(c + ivec2(0, 1), seed);
  float e = h21(c + ivec2(1, 1), seed);
  return mix(mix(a, b, u.x), mix(d, e, u.x), u.y);
}
float fbm(vec2 p, uint seed) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p, seed + uint(i) * 17u);
    n += a;
    a *= 0.5;
    p = p * 2.03 + vec2(13.1, -7.7);
  }
  return s / n;
}
// smooth Voronoi distance: rounded hills with soft valleys, no creases
float smoothWorley(vec2 p, uint seed, float k) {
  vec2 i = floor(p);
  vec2 f = p - i;
  float acc = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + h22(ivec2(i) + ivec2(x, y), seed) - f;
      acc += exp(-k * sqrt(dot(r, r)));
    }
  return -log(acc) / k;
}
// distance to nearest jittered feature point
float worley(vec2 p, uint seed) {
  vec2 i = floor(p);
  vec2 f = p - i;
  float d = 9.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + h22(ivec2(i) + ivec2(x, y), seed) - f;
      d = min(d, dot(r, r));
    }
  return sqrt(d);
}
`;

const SRGB = `
vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
`;

const DENSITY_FS = `${HEADER}${SRGB}
uniform sampler2D uPaint;
void main() {
  vec3 c = texelFetch(uPaint, ivec2(gl_FragCoord.xy), 0).rgb;
  vec3 t = toLin(c);
  o = vec4(-log(max(t, vec3(1.0 / 1024.0))), 1.0);
}`;

const BLUR_FS = `${HEADER}
uniform sampler2D uSrc;
uniform ivec2 uDir;
uniform float uSigma;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 sz = textureSize(uSrc, 0) - 1;
  int r = int(ceil(uSigma * 2.5));
  vec4 s = vec4(0.0);
  float w = 0.0;
  for (int i = -r; i <= r; i++) {
    float k = exp(-0.5 * float(i * i) / (uSigma * uSigma));
    s += k * texelFetch(uSrc, clamp(p + uDir * i, ivec2(0), sz), 0);
    w += k;
  }
  o = s / w;
}`;

const LANCZOS = `
float lanczos3(float x) {
  x = abs(x);
  if (x < 1e-5) return 1.0;
  if (x >= 3.0) return 0.0;
  float px = 3.14159265358979 * x;
  return 3.0 * sin(px) * sin(px / 3.0) / (px * px);
}
`;

const LANCZOS_H_FS = `${HEADER}${LANCZOS}
uniform sampler2D uSrc;
uniform float uScale;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int w = textureSize(uSrc, 0).x - 1;
  float sx = (float(p.x) + 0.5) / uScale - 0.5;
  int i0 = int(floor(sx));
  vec4 s = vec4(0.0);
  float ws = 0.0;
  for (int k = -2; k <= 3; k++) {
    int i = i0 + k;
    float wt = lanczos3(sx - float(i));
    s += wt * texelFetch(uSrc, ivec2(clamp(i, 0, w), p.y), 0);
    ws += wt;
  }
  o = max(s / ws, vec4(0.0));
}`;

const PAPER_FS = `${HEADER}${NOISE}
uniform float uUnit;  // output px per 6000-px-wide reference px
uniform uint uSeed;
float paperHeight(vec2 q) {
  // domain warp so the tooth has no visible cell grid
  vec2 w = vec2(fbm(q / 70.0, uSeed + 1u), fbm(q / 70.0, uSeed + 2u)) * 2.0 - 1.0;
  vec2 qw = q + w * 14.0;
  // cold-press tooth: rounded hills about 2 mm across with soft pits between
  float hills = 1.0 - smoothWorley(qw / 19.0, uSeed + 3u, 7.0);
  float small = 1.0 - smoothWorley(qw / 8.0 + 31.7, uSeed + 4u, 8.0);
  float mid = fbm(q / 30.0, uSeed + 5u);
  float fibre = vnoise(vec2(q.x / 3.2, q.y / 2.1), uSeed + 6u);
  float large = fbm(q / 600.0, uSeed + 7u);
  float hgt = 0.48 * hills + 0.14 * small + 0.22 * mid + 0.05 * fibre + 0.11 * large;
  return clamp((hgt - 0.2) * 1.45, 0.0, 1.0);
}
void main() {
  vec2 q = gl_FragCoord.xy / uUnit;
  o = vec4(paperHeight(q), 0.0, 0.0, 1.0);
}`;

const FINAL_FS = `${HEADER}${NOISE}${SRGB}${LANCZOS}
uniform sampler2D uDH;     // density, Lanczos'd horizontally (outW x paintH)
uniform sampler2D uBlur;   // blurred density (paint res)
uniform sampler2D uPaper;  // paper height (output res)
uniform float uScaleY;
uniform vec2 uOut;
uniform float uUnit;
uniform uint uSeed;
uniform vec3 uAlbedo;
uniform float uGran;
uniform float uSettle;
uniform float uEdge;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 q = gl_FragCoord.xy / uUnit;

  // vertical Lanczos-3
  int hmax = textureSize(uDH, 0).y - 1;
  float sy = (float(p.y) + 0.5) / uScaleY - 0.5;
  int j0 = int(floor(sy));
  vec3 D = vec3(0.0);
  float ws = 0.0;
  for (int k = -2; k <= 3; k++) {
    int j = j0 + k;
    float wt = lanczos3(sy - float(j));
    D += wt * texelFetch(uDH, ivec2(p.x, clamp(j, 0, hmax)), 0).rgb;
    ws += wt;
  }
  D = max(D / ws, vec3(0.0));

  // Drying rim. Comparing density with its blurred neighbourhood finds wash
  // edges: just inside an edge D > blur, on the outer fringe D < blur.
  // Raising D by (D / blur)^edge darkens the inner rim, where pigment is
  // carried as a wash dries, and tightens the feathered outer fringe.
  vec3 Db = texture(uBlur, gl_FragCoord.xy / uOut).rgb;
  vec3 ratio = clamp((D + 0.002) / (Db + 0.002), 0.0, 3.0);
  D *= pow(ratio, vec3(uEdge));

  // paper height and its soft raking light
  ivec2 lim = ivec2(uOut) - 1;
  float h = texelFetch(uPaper, p, 0).r;
  float hl = texelFetch(uPaper, clamp(p - ivec2(1, 0), ivec2(0), lim), 0).r;
  float hr = texelFetch(uPaper, clamp(p + ivec2(1, 0), ivec2(0), lim), 0).r;
  float hd = texelFetch(uPaper, clamp(p - ivec2(0, 1), ivec2(0), lim), 0).r;
  float hu = texelFetch(uPaper, clamp(p + ivec2(0, 1), ivec2(0), lim), 0).r;
  float relief = 2.6 * uUnit;
  vec3 n = normalize(vec3((hl - hr) * relief, (hd - hu) * relief, 1.0));
  vec3 L = normalize(vec3(-0.5, 0.55, 0.67));
  // the tooth is faint on bare paper and shows more where pigment sits in it
  float Dl = clamp(dot(D, vec3(0.3333)) * 1.3, 0.0, 1.0);
  float shade = 1.0 + (0.17 + 0.22 * Dl) * (dot(n, L) - L.z) + 0.03 * (h - 0.5);

  // On the outer fringe of a wash the water only reaches the paper's pits,
  // so the edge breaks up along the tooth instead of fading smoothly.
  float fringe = clamp(1.0 - min(ratio.r, min(ratio.g, ratio.b)), 0.0, 1.0);
  float bite = smoothstep(0.0, 0.5, 0.75 - fringe + (0.5 - h) * 0.8);
  D *= mix(1.0, bite, smoothstep(0.25, 0.6, fringe));

  // pigment pools in the valleys of the tooth and thins on the peaks
  float dip = clamp((0.5 - h) * 2.0, -1.0, 1.0);
  float settle = uSettle * (0.45 + 1.1 * Dl);
  D *= max(0.0, 1.0 + settle * (dip > 0.0 ? dip : 0.5 * dip));

  // Granulation: heavy pigment particles flocculate into fine dark specks
  // that drop into the grain; the effect is patchy across a wash.
  float speck = vnoise(q / 3.2, uSeed + 11u) * 0.5 + vnoise(q / 7.5, uSeed + 12u) * 0.5;
  speck = smoothstep(0.52, 0.86, speck);
  float clump = fbm(q / 110.0, uSeed + 13u);
  // patchy, strongest where paint pooled, absent in thin tints
  float gstrength = uGran * (0.08 + 0.92 * smoothstep(0.38, 0.72, clump)) * smoothstep(0.06, 0.55, Dl);
  D *= max(0.0, 1.0 + gstrength * (1.0 * speck - 0.15 + 0.45 * max(dip, -0.4)));

  // uneven pigment load, at the scale of a brushload and of a few mm
  D *= 1.0 + 0.09 * (fbm(q / 260.0, uSeed + 14u) * 2.0 - 1.0)
           + 0.05 * (fbm(q / 55.0, uSeed + 15u) * 2.0 - 1.0);

  vec3 lin = uAlbedo * exp(-D) * shade;
  vec3 c = toSrgb(lin);
  // triangular dither, so 8-bit output never steps in a smooth gradient
  float d = h21(p, uSeed + 21u) + h21(p, uSeed + 22u) - 1.0;
  o = vec4(c + d / 255.0, 1.0);
}`;

type Tex = { tex: WebGLTexture; w: number; h: number; fb?: WebGLFramebuffer };

export const composite = (
  paint: HTMLCanvasElement,
  out: HTMLCanvasElement,
  params: PaperParams,
) => {
  const gl = out.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
    premultipliedAlpha: false,
    alpha: false,
  });
  if (!gl) throw new Error("WebGL2 not available");
  if (!gl.getExtension("EXT_color_buffer_float")) {
    throw new Error("EXT_color_buffer_float not available");
  }
  const outW = out.width;
  const outH = out.height;
  const pw = paint.width;
  const ph = paint.height;

  const compile = (fs: string) => {
    const mk = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
      }
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "link error");
    }
    return prog;
  };

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const target = (w: number, h: number, fmt: "rgba16f" | "r16f", linear = false): Tex => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const f = linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (fmt === "rgba16f") gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, w, h);
    else gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16F, w, h);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("framebuffer incomplete");
    }
    return { tex, w, h, fb };
  };

  const run = (
    prog: WebGLProgram,
    dst: Tex | null,
    inputs: [string, Tex | WebGLTexture][],
    uniforms: (loc: (n: string) => WebGLUniformLocation | null) => void,
  ) => {
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb! : null);
    gl.viewport(0, 0, dst ? dst.w : outW, dst ? dst.h : outH);
    inputs.forEach(([name, t], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, "tex" in t ? t.tex : t);
      gl.uniform1i(gl.getUniformLocation(prog, name), i);
    });
    uniforms((n) => gl.getUniformLocation(prog, n));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // paint canvas -> texture (flip so GL row 0 is the bottom of the sheet)
  const paintTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, paintTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, paint);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const unit = outW / 6000;
  const paintUnit = pw / 3000;
  const seed = params.seed >>> 0;

  const dens = target(pw, ph, "rgba16f");
  run(compile(DENSITY_FS), dens, [["uPaint", paintTex]], () => {});

  const blurProg = compile(BLUR_FS);
  const tmp = target(pw, ph, "rgba16f");
  const blur = target(pw, ph, "rgba16f", true);
  const sigma = 6 * paintUnit;
  run(blurProg, tmp, [["uSrc", dens]], (u) => {
    gl.uniform2i(u("uDir"), 1, 0);
    gl.uniform1f(u("uSigma"), sigma);
  });
  run(blurProg, blur, [["uSrc", tmp]], (u) => {
    gl.uniform2i(u("uDir"), 0, 1);
    gl.uniform1f(u("uSigma"), sigma);
  });

  const dh = target(outW, ph, "rgba16f");
  run(compile(LANCZOS_H_FS), dh, [["uSrc", dens]], (u) => {
    gl.uniform1f(u("uScale"), outW / pw);
  });

  const paper = target(outW, outH, "r16f");
  run(compile(PAPER_FS), paper, [], (u) => {
    gl.uniform1f(u("uUnit"), unit);
    gl.uniform1ui(u("uSeed"), seed);
  });

  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  run(
    compile(FINAL_FS),
    null,
    [
      ["uDH", dh],
      ["uBlur", blur],
      ["uPaper", paper],
    ],
    (u) => {
      gl.uniform1f(u("uScaleY"), outH / ph);
      gl.uniform2f(u("uOut"), outW, outH);
      gl.uniform1f(u("uUnit"), unit);
      gl.uniform1ui(u("uSeed"), seed);
      // #FAF7F0
      gl.uniform3f(u("uAlbedo"), lin(0xfa), lin(0xf7), lin(0xf0));
      gl.uniform1f(u("uGran"), params.granulation);
      gl.uniform1f(u("uSettle"), params.settle);
      gl.uniform1f(u("uEdge"), params.edge);
    },
  );
  // reading a pixel waits for the GPU, so the timing report is honest
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  for (const t of [dens, tmp, blur, dh, paper]) {
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fb!);
  }
  gl.deleteTexture(paintTex);
};
