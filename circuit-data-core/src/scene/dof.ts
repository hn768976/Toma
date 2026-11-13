// Post-process depth of field (WebGL 2).
//
// The scene is rendered into an MSAA render target with a depth texture,
// prefiltered to quarter resolution, and a gather pass then blurs it by a physically shaped circle of
// confusion (single-pass bokeh gather: samples on a golden-angle spiral, with
// background samples clamped so in-focus objects don't bleed outwards).
// Finally the sharp and blurred images are blended at full resolution.
import * as THREE from "three";

const quadVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const DEPTH = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uNear;
  uniform float uFar;
  uniform float uFocus;      // focus distance (view-space depth)
  uniform float uAperture;   // CoC radius in output pixels at infinite distance
  uniform float uMaxCoc;     // clamp, in output pixels
  float viewZ(vec2 uv) {
    float d = texture2D(uDepth, uv).r;
    return (uNear * uFar) / (uFar - d * (uFar - uNear));
  }
  float cocPx(float z) {
    return min(uAperture * abs(z - uFocus) / z, uMaxCoc);
  }
`;

// Prefilter: 4x4 box-downsample of the scene (4 bilinear taps) to quarter
// resolution, storing the signed circle of confusion (output pixels; negative =
// in front of the focus plane) in alpha.
const prefilterFragment = /* glsl */ `
  uniform sampler2D uColor;
  uniform vec2 uSrcTexel;    // 1 / full-res size
  varying vec2 vUv;
  ${DEPTH}
  void main() {
    vec3 col = vec3(0.0);
    float coc = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 o = vec2(i == 1 || i == 3 ? 1.0 : -1.0, i >= 2 ? 1.0 : -1.0) * uSrcTexel;
      vec2 uv = vUv + o;
      col += texture2D(uColor, uv).rgb;
      float z = viewZ(uv);
      coc += sign(z - uFocus) * cocPx(z);
    }
    gl_FragColor = vec4(col * 0.25, coc * 0.25);
  }
`;

const gatherFragment = /* glsl */ `
  uniform sampler2D uSrc;    // prefiltered quarter-res colour + signed CoC
  uniform vec2 uTexel;       // 1 / quarter-res size
  uniform float uScale;      // output px per gather px
  uniform float uMaxCoc;
  varying vec2 vUv;
  const float GOLDEN = 2.39996323;
  const float RAD_SCALE = 0.6;
  void main() {
    vec4 c = texture2D(uSrc, vUv);
    float sizeC = abs(c.a) / uScale;
    vec3 col = c.rgb;
    float tot = 1.0;
    float maxR = uMaxCoc / uScale;
    float radius = RAD_SCALE;
    for (float ang = 0.0; ang < 2000.0; ang += GOLDEN) {
      if (radius >= maxR) break;
      vec4 s = texture2D(uSrc, vUv + vec2(cos(ang), sin(ang)) * uTexel * radius);
      float sizeS = abs(s.a) / uScale;
      // Samples behind the centre can't blur over it by more than it is blurred.
      if (s.a > c.a) sizeS = clamp(sizeS, 0.0, sizeC * 2.0);
      float m = smoothstep(radius - 0.5, radius + 0.5, sizeS);
      col += mix(col / tot, s.rgb, m);
      tot += 1.0;
      radius += RAD_SCALE / radius;
    }
    gl_FragColor = vec4(col / tot, sizeC);
  }
`;

const compositeFragment = /* glsl */ `
  uniform sampler2D uColor;
  uniform sampler2D uBlur;
  uniform float uScale;
  varying vec2 vUv;
  ${DEPTH}
  void main() {
    vec3 sharp = texture2D(uColor, vUv).rgb;
    vec4 blur = texture2D(uBlur, vUv);
    // Use the larger of this pixel's own CoC and the blurred neighbourhood's so
    // that defocused foreground spreads over sharper pixels behind it.
    float c = max(cocPx(viewZ(vUv)), blur.a * uScale);
    float t = smoothstep(1.5, 6.0, c);
    gl_FragColor = vec4(mix(sharp, blur.rgb, t), 1.0);
  }
`;

export type Dof = {
  render: (gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) => void;
  setFocus: (focus: number) => void;
};

export const createDof = (
  width: number,
  height: number,
  opts: { aperture: number; maxCoc: number },
): Dof => {
  const depthTexture = new THREE.DepthTexture(width, height);
  depthTexture.type = THREE.UnsignedIntType;
  const sceneRT = new THREE.WebGLRenderTarget(width, height, {
    samples: 4,
    depthTexture,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  const scale = 4;
  const hw = Math.round(width / scale);
  const hh = Math.round(height / scale);
  const quarterRT = () =>
    new THREE.WebGLRenderTarget(hw, hh, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
  const preRT = quarterRT();
  const blurRT = quarterRT();

  const depthUniforms = () => ({
    uDepth: { value: depthTexture },
    uNear: { value: 0.05 },
    uFar: { value: 120 },
    uFocus: { value: 5 },
    uAperture: { value: opts.aperture },
    uMaxCoc: { value: opts.maxCoc },
  });

  const prefilterMat = new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: prefilterFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      ...depthUniforms(),
      uColor: { value: sceneRT.texture },
      uSrcTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
    },
  });
  const gatherMat = new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: gatherFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uSrc: { value: preRT.texture },
      uTexel: { value: new THREE.Vector2(1 / hw, 1 / hh) },
      uScale: { value: scale },
      uMaxCoc: { value: opts.maxCoc },
    },
  });
  const compositeMat = new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: compositeFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      ...depthUniforms(),
      uColor: { value: sceneRT.texture },
      uBlur: { value: blurRT.texture },
      uScale: { value: scale },
    },
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), prefilterMat);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const mats = [prefilterMat, compositeMat];
  return {
    setFocus: (focus) => {
      for (const m of mats) m.uniforms.uFocus.value = focus;
    },
    render: (gl, scene, camera) => {
      for (const m of mats) {
        m.uniforms.uNear.value = camera.near;
        m.uniforms.uFar.value = camera.far;
      }
      gl.setRenderTarget(sceneRT);
      gl.clear();
      gl.render(scene, camera);
      quad.material = prefilterMat;
      gl.setRenderTarget(preRT);
      gl.render(postScene, postCam);
      quad.material = gatherMat;
      gl.setRenderTarget(blurRT);
      gl.render(postScene, postCam);
      quad.material = compositeMat;
      gl.setRenderTarget(null);
      gl.render(postScene, postCam);
    },
  };
};
