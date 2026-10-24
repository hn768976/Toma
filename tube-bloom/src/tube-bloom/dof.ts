import * as THREE from "three";

// Shared GLSL: perspective depth -> view distance, and circle-of-confusion
// radius (px) for a view distance.
const COC_GLSL = /* glsl */ `
  uniform float cameraNear, cameraFar, focusDistance, cocScale, maxBlur;
  float linearize(float d) {
    float z = d * 2.0 - 1.0;
    return 2.0 * cameraNear * cameraFar / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
  }
  float coc(float z) {
    return clamp(abs(1.0 / focusDistance - 1.0 / z) * cocScale, 0.0, maxBlur);
  }
`;

const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const cocUniforms = () => ({
  cameraNear: { value: 0.1 },
  cameraFar: { value: 100 },
  focusDistance: { value: 10 },
  cocScale: { value: 1 }, // pixels of blur radius per unit of |1/zf - 1/z|
  maxBlur: { value: 40 }, // px
});

// Pass 1 (tiles): largest blur radius of any *geometry* pixel inside each
// tile. Empty background is uniform, so it never needs a gather of its own.
export const createCocTileMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...cocUniforms(),
      tDepth: { value: null },
      srcSize: { value: new THREE.Vector2() },
      tile: { value: 16 },
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tDepth;
      uniform vec2 srcSize;
      uniform float tile;
      ${COC_GLSL}
      void main() {
        vec2 base = floor(gl_FragCoord.xy) * tile;
        float m = 0.0;
        // Stride 2: blur radii vary smoothly, half-density sampling is ample.
        for (int y = 0; y < 32; y++) {
          if (float(y) * 2.0 >= tile) break;
          for (int x = 0; x < 32; x++) {
            if (float(x) * 2.0 >= tile) break;
            vec2 uv = (base + vec2(x, y) * 2.0 + 1.0) / srcSize;
            float d = texture2D(tDepth, uv).x;
            if (d < 0.99999) m = max(m, coc(linearize(d)));
          }
        }
        gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

// Pass 2 (tiles): spread each tile's radius to the neighbours it can reach.
export const createTileDilateMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      tTile: { value: null },
      tileTexel: { value: new THREE.Vector2() },
      reach: { value: 2 }, // tiles
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tTile;
      uniform vec2 tileTexel;
      uniform float reach;
      varying vec2 vUv;
      void main() {
        float m = 0.0;
        for (int y = -8; y <= 8; y++) {
          if (abs(float(y)) > reach) continue;
          for (int x = -8; x <= 8; x++) {
            if (abs(float(x)) > reach) continue;
            m = max(m, texture2D(tTile, vUv + vec2(x, y) * tileTexel).r);
          }
        }
        gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

// Pass 3: "scatter as gather" bokeh depth of field (golden-angle spiral),
// after Dennis Gustafsson's single-pass technique. Blurred foreground
// correctly spreads over sharp background, which the references rely on
// (big defocused tubes in front of in-focus ones). Also applies a
// soft-shoulder tone curve that leaves values below the knee untouched, so
// background colours stay exactly what the look specifies, then encodes sRGB.
export const createDofMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      tTile: { value: null }, // dilated per-tile gather radius
      texel: { value: new THREE.Vector2() },
      ...cocUniforms(),
      radScale: { value: 2 },
      exposure: { value: 1 },
      knee: { value: 0.8 },
      vignette: { value: 0 },
      grain: { value: 0 },
      frame: { value: 0 },
      debugMode: { value: 0 },
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform sampler2D tTile;
      uniform vec2 texel;
      uniform float radScale;
      ${COC_GLSL}
      uniform float exposure, knee, vignette, grain, frame, debugMode;
      varying vec2 vUv;

      const float GOLDEN_ANGLE = 2.39996323;

      float linDepth(vec2 uv) {
        return linearize(texture2D(tDepth, uv).x);
      }
      vec3 shoulder(vec3 c) {
        // identity below knee, smooth asymptote to 1 above it
        vec3 over = max(c - knee, 0.0);
        float room = 1.0 - knee;
        return min(c, vec3(knee)) + room * (over / (over + room));
      }
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233)) + frame * 0.618) * 43758.5453);
      }
      void main() {
        vec3 color = texture2D(tColor, vUv).rgb;
        float centerDepth = linDepth(vUv);
        if (debugMode > 1.5) { gl_FragColor = vec4(vec3(fract(centerDepth)), 1.0); return; }
        if (debugMode > 0.5) { gl_FragColor = vec4(pow(min(color, 1.0), vec3(1.0 / 2.2)), 1.0); return; }
        float centerSize = coc(centerDepth);
        // Only gather as far as any blur in this neighbourhood can reach.
        float reach = min(maxBlur, texture2D(tTile, vUv).r + radScale);
        float tot = 1.0;
        float radius = radScale;
        float ang = 0.0;
        for (int i = 0; i < 1024; i++) {
          if (radius >= reach) break;
          vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
          vec3 sc = texture2D(tColor, tc).rgb;
          float sd = linDepth(tc);
          float ss = coc(sd);
          if (sd > centerDepth) ss = min(ss, centerSize);
          float m = smoothstep(radius - 0.5 * radScale, radius + 0.5 * radScale, ss);
          color += mix(color / tot, sc, m);
          tot += 1.0;
          radius += radScale / radius;
          ang += GOLDEN_ANGLE;
        }
        color /= tot;
        color = shoulder(color * exposure);
        vec2 q = vUv - 0.5;
        color *= 1.0 - vignette * dot(q, q) * 2.0;
        vec3 srgb = mix(
          color * 12.92,
          1.055 * pow(max(color, 0.0), vec3(1.0 / 2.4)) - 0.055,
          step(0.0031308, color)
        );
        srgb += (hash(gl_FragCoord.xy) - 0.5) * grain;
        gl_FragColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
