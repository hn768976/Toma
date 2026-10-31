import * as THREE from "three";

/*
 * HDR post pipeline:
 *   scene -> half-float target (no 8-bit banding from thousands of faint
 *   additive layers) -> two-level gaussian bloom -> composite with a
 *   per-composition grade (vignette etc.) + blue-noise-ish dithering.
 */

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  vec3 b = max(c - vec3(uThreshold), vec3(0.0));
  gl_FragColor = vec4(b, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.1964825501511404;
  c += texture2D(tSrc, vUv + uDir * 1.411764705882353).rgb * 0.2969069646728344;
  c += texture2D(tSrc, vUv - uDir * 1.411764705882353).rgb * 0.2969069646728344;
  c += texture2D(tSrc, vUv + uDir * 3.2941176470588234).rgb * 0.09447039785044732;
  c += texture2D(tSrc, vUv - uDir * 3.2941176470588234).rgb * 0.09447039785044732;
  c += texture2D(tSrc, vUv + uDir * 5.176470588235294).rgb * 0.010381362401148057;
  c += texture2D(tSrc, vUv - uDir * 5.176470588235294).rgb * 0.010381362401148057;
  gl_FragColor = vec4(c, 1.0);
}
`;

const compositeFrag = (gradeBody: string) => /* glsl */ `
uniform sampler2D tHdr;
uniform sampler2D tBloomA;
uniform sampler2D tBloomB;
uniform float uBloomA;
uniform float uBloomB;
uniform float uTime;
varying vec2 vUv;
${gradeBody}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec3 c = texture2D(tHdr, vUv).rgb;
  c += texture2D(tBloomA, vUv).rgb * uBloomA + texture2D(tBloomB, vUv).rgb * uBloomB;
  c = grade(c, vUv);
  float d = ign(gl_FragCoord.xy + floor(fract(uTime * 3.7) * 64.0)) - 0.5;
  c += d * 1.5 / 255.0; // ~1.5 LSB triangular-ish dither: survives H.264 better
  gl_FragColor = vec4(c, 1.0);
}
`;

export type PostOptions = {
  width: number;
  height: number;
  threshold: number;
  bloomA: number; // tight bloom strength
  bloomB: number; // wide bloom strength
  gradeBody: string; // must define vec3 grade(vec3 c, vec2 uv)
  gradeUniforms?: Record<string, THREE.IUniform>;
  time: { value: number };
};

export const createPost = (opts: PostOptions) => {
  const rtOpts = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  } as const;
  const w = opts.width;
  const h = opts.height;
  const hdr = new THREE.WebGLRenderTarget(w, h, rtOpts);
  const aW = Math.max(1, Math.round(w / 4));
  const aH = Math.max(1, Math.round(h / 4));
  const bW = Math.max(1, Math.round(w / 16));
  const bH = Math.max(1, Math.round(h / 16));
  const a1 = new THREE.WebGLRenderTarget(aW, aH, rtOpts);
  const a2 = new THREE.WebGLRenderTarget(aW, aH, rtOpts);
  const b1 = new THREE.WebGLRenderTarget(bW, bH, rtOpts);
  const b2 = new THREE.WebGLRenderTarget(bW, bH, rtOpts);

  const geo = new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
      3,
    ),
  );
  const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: FS_VERT,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
  const down = mk(DOWN_FRAG, {
    tSrc: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uThreshold: { value: opts.threshold },
  });
  const blur = mk(BLUR_FRAG, {
    tSrc: { value: null },
    uDir: { value: new THREE.Vector2() },
  });
  const comp = mk(compositeFrag(opts.gradeBody), {
    tHdr: { value: hdr.texture },
    tBloomA: { value: a1.texture },
    tBloomB: { value: b1.texture },
    uBloomA: { value: opts.bloomA },
    uBloomB: { value: opts.bloomB },
    uTime: opts.time,
    ...(opts.gradeUniforms ?? {}),
  });
  const quad = new THREE.Mesh(geo, down);
  quad.frustumCulled = false;
  const orth = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const syncPixel = new Uint8Array(4);
  const pass = (
    gl: THREE.WebGLRenderer,
    mat: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget | null,
  ) => {
    quad.material = mat;
    gl.setRenderTarget(target);
    gl.render(quad, orth);
  };

  const render = (
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) => {
    const prevAuto = gl.autoClear;
    gl.autoClear = true;
    gl.setRenderTarget(hdr);
    gl.clear();
    gl.render(scene, camera);
    // tight bloom (1/4 res)
    down.uniforms.tSrc.value = hdr.texture;
    down.uniforms.uTexel.value.set(1 / w, 1 / h);
    down.uniforms.uThreshold.value = opts.threshold;
    pass(gl, down, a1);
    blur.uniforms.tSrc.value = a1.texture;
    blur.uniforms.uDir.value.set(1 / aW, 0);
    pass(gl, blur, a2);
    blur.uniforms.tSrc.value = a2.texture;
    blur.uniforms.uDir.value.set(0, 1 / aH);
    pass(gl, blur, a1);
    // wide bloom (1/16 res)
    down.uniforms.tSrc.value = a1.texture;
    down.uniforms.uTexel.value.set(1 / aW, 1 / aH);
    down.uniforms.uThreshold.value = 0;
    pass(gl, down, b1);
    blur.uniforms.tSrc.value = b1.texture;
    blur.uniforms.uDir.value.set(1 / bW, 0);
    pass(gl, blur, b2);
    blur.uniforms.tSrc.value = b2.texture;
    blur.uniforms.uDir.value.set(0, 1 / bH);
    pass(gl, blur, b1);
    // composite to the canvas
    pass(gl, comp, null);
    gl.autoClear = prevAuto;
    // Force the (software) GPU to finish this frame before Remotion captures
    // the canvas – prevents torn / partially-updated frames.
    const ctx = gl.getContext();
    ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, syncPixel);
  };

  const dispose = () => {
    [hdr, a1, a2, b1, b2].forEach((t) => t.dispose());
    [down, blur, comp].forEach((m) => m.dispose());
    geo.dispose();
  };

  return { render, dispose, uniforms: comp.uniforms };
};
