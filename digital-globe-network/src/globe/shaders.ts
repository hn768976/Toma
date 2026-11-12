import * as THREE from "three";

/**
 * One GLSL point-sprite shader drives every particle layer of the globe.
 * Each vertex carries colour, size (world units), alpha and an `anim` vec4
 * whose meaning depends on uMode:
 *
 *   0 static/twinkle  anim = (twinkleSpeed, twinklePhase, -, -)
 *   1 ring dashes     anim = (angle, angularSpeed, dashCount, dashDuty)
 *   2 travelling arc  anim = (u along arc, startTime, duration, tailLength)
 *   3 spike / ray     anim = (u along spike, pulseSpeed, pulsePhase, -)
 *
 * Depth of field: the point is grown by its circle of confusion and its alpha
 * reduced to conserve energy, giving lens-like bokeh for out-of-focus dots.
 */
const vertexShader = /* glsl */ `
  attribute vec3 color;
  attribute float size;
  attribute float alpha;
  attribute vec4 anim;

  uniform float uTime;
  uniform float uPixelScale;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uOpacity;
  uniform int uMode;
  uniform float uFacing;      // 1 = fade points on the far side of the globe
  uniform float uRimBoost;    // >0: brighten points near the silhouette
  uniform float uMinPx;
  uniform float uMaxPx;
  uniform float uReveal;      // global fade-in for the layer (0..1)
  uniform float uBack;        // brightness kept on the far side (see-through hologram)
  uniform float uOcclusion;   // brightness kept when hidden behind the globe body (1 = off)

  varying vec3 vColor;
  varying float vAlpha;
  varying float vBlur;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * world;
    float depth = max(-mv.z, 0.0001);

    float a = alpha * uOpacity * uReveal;

    if (uMode == 0) {
      a *= 0.72 + 0.28 * sin(uTime * anim.x + anim.y);
    } else if (uMode == 1) {
      float p = fract((anim.x + uTime * anim.y) / 6.2831853 * anim.z);
      a *= smoothstep(0.0, 0.04, p) * (1.0 - smoothstep(anim.w - 0.04, anim.w, p));
    } else if (uMode == 2) {
      float cycle = anim.z + 1.6;
      float local = mod(uTime - anim.y, cycle);
      float head = local / anim.z * (1.0 + anim.w);
      float u = anim.x;
      float tail = smoothstep(head - anim.w, head, u) * step(u, head);
      float fadeOut = 1.0 - smoothstep(anim.z, cycle, local);
      float headGlow = 1.0 + 2.0 * smoothstep(head - 0.02, head, u) * step(u, head);
      a *= tail * fadeOut * headGlow * step(0.0, uTime - anim.y);
    } else if (uMode == 3) {
      float len = 0.55 + 0.45 * sin(uTime * anim.y + anim.z);
      a *= (1.0 - anim.x) * step(anim.x, len);
    }

    vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 n = normalize(world.xyz - center);
    vec3 v = normalize(cameraPosition - world.xyz);
    float facing = dot(n, v);
    if (uFacing > 0.5) {
      a *= mix(uBack, 1.0, smoothstep(-0.12, 0.18, facing));
    }
    if (uRimBoost > 0.0) {
      a *= 1.0 + uRimBoost * pow(1.0 - clamp(abs(facing), 0.0, 1.0), 3.0);
    }

    if (uOcclusion < 0.999) {
      // Analytic ray/sphere test (globe radius 1 at the origin): dim points
      // that sit behind the translucent globe body as seen from the camera.
      vec3 ro = cameraPosition;
      vec3 rd = world.xyz - ro;
      float len = length(rd);
      rd /= len;
      float b = dot(ro, rd);
      float c = dot(ro, ro) - 1.0;
      float h = b * b - c;
      if (h > 0.0) {
        float tHit = -b - sqrt(h);
        float edge = smoothstep(0.0, 0.02, h);
        if (tHit > 0.0 && tHit < len - 0.002) a *= mix(1.0, uOcclusion, edge);
      }
    }

    float px = size * uPixelScale / depth;
    px = clamp(px, uMinPx, uMaxPx);
    float coc = uAperture * uPixelScale * 0.012 * abs(depth - uFocus) / depth;
    float total = sqrt(px * px + coc * coc);
    total = min(total, 480.0);
    float energy = (px * px) / (total * total);
    a *= max(energy, 0.025);
    // Very small points are dimmed instead of shrunk so they never alias.
    a *= clamp(size * uPixelScale / depth / uMinPx, 0.25, 1.0);

    vBlur = clamp(coc / max(total, 0.001), 0.0, 1.0);
    vColor = color;
    vAlpha = a;
    gl_PointSize = total;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vBlur;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    if (r > 1.0) discard;
    // Sharp: bright core + soft falloff. Blurred: flat lens disc w/ soft edge.
    float sharp = pow(1.0 - r, 1.6) + 0.35 * (1.0 - smoothstep(0.0, 0.35, r));
    float disc = exp(-r * r * 2.6) * (1.0 - smoothstep(0.85, 1.0, r)) * 1.1;
    float shape = mix(sharp, disc, vBlur);
    // alpha 0: pure additive light over the (transparent) canvas background
    gl_FragColor = vec4(vColor * vAlpha * shape, 0.0);
  }
`;

export type PointLayerOptions = {
  mode: 0 | 1 | 2 | 3;
  facing?: boolean;
  rimBoost?: number;
  opacity?: number;
  minPx?: number;
  maxPx?: number;
  depthTest?: boolean;
  /** 0..1 brightness kept on the globe's far side (needs facing). */
  back?: number;
  /** Write depth so the translucent globe body can dim the parts behind it. */
  depthWrite?: boolean;
  /** Brightness kept when behind the globe body (1 = no dimming). */
  occlusion?: number;
};

export const makePointMaterial = (opts: PointLayerOptions) =>
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uPixelScale: { value: 1000 },
      uFocus: { value: 3 },
      uAperture: { value: 1 },
      uOpacity: { value: opts.opacity ?? 1 },
      uMode: { value: opts.mode },
      uFacing: { value: opts.facing ? 1 : 0 },
      uRimBoost: { value: opts.rimBoost ?? 0 },
      uMinPx: { value: opts.minPx ?? 1.6 },
      uMaxPx: { value: opts.maxPx ?? 220 },
      uReveal: { value: 1 },
      uBack: { value: opts.back ?? 0 },
      uOcclusion: { value: opts.occlusion ?? 1 },
    },
    transparent: true,
    depthWrite: opts.depthWrite ?? false,
    depthTest: opts.depthTest ?? true,
    // Premultiplied colour in the fragment shader -> pure additive light.
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });

/** Fresnel atmosphere / rim light shell. */
export const makeAtmosphereMaterial = (color: THREE.Color, power: number, intensity: number, side: THREE.Side, center = false) =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      uniform float uSide;
      uniform float uCenter;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = dot(normalize(vN), normalize(vV));
        float rim;
        if (uCenter > 0.5) {
          // Inner haze: brightest facing the camera (light scattered inside the hologram)
          rim = pow(clamp(f, 0.0, 1.0), uPower);
        } else if (uSide > 0.5) {
          // Back side shell: glow that falls off outside the silhouette
          rim = pow(clamp(-f, 0.0, 1.0), uPower);
        } else {
          rim = pow(1.0 - clamp(f, 0.0, 1.0), uPower);
        }
        gl_FragColor = vec4(uColor * rim * uIntensity, 0.0);
      }
    `,
    uniforms: {
      uColor: { value: color },
      uPower: { value: power },
      uIntensity: { value: intensity },
      uSide: { value: side === THREE.BackSide ? 1 : 0 },
      uCenter: { value: center ? 1 : 0 },
    },
    side,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });

/** Camera-facing textured icons (padlocks / markers) that sit on the globe. */
export const makeIconMaterial = (atlas: THREE.Texture) =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float icon;
      attribute float phase;
      uniform float uPixelScale;
      uniform float uTime;
      uniform float uReveal;
      uniform float uFocus;
      uniform float uAperture;
      varying float vIcon;
      varying float vAlpha;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * world;
        float depth = max(-mv.z, 0.0001);
        vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 n = normalize(world.xyz - center);
        vec3 v = normalize(cameraPosition - world.xyz);
        float facing = dot(n, v);
        float coc = uAperture * uPixelScale * 0.012 * abs(depth - uFocus) / depth;
        float px = size * uPixelScale / depth;
        // Staggered pop-in after the reveal starts, then a gentle pulse.
        // Hex markers are present from the start; padlocks pop in during the reveal.
        float appear = (icon > 0.5 && icon < 1.5) ? 1.0 : smoothstep(phase, phase + 0.12, uReveal);
        vAlpha = mix(0.1, 1.0, smoothstep(0.05, 0.45, facing)) * appear * (0.75 + 0.25 * sin(uTime * 1.7 + phase * 40.0));
        vAlpha *= px * px / (px * px + coc * coc);
        vIcon = icon;
        gl_PointSize = clamp(px, 2.0, 300.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform vec3 uColor;
      varying float vIcon;
      varying float vAlpha;
      void main() {
        vec2 uv = vec2((gl_PointCoord.x + vIcon) / 3.0, 1.0 - gl_PointCoord.y);
        float m = texture2D(uAtlas, uv).r;
        gl_FragColor = vec4(uColor * m * vAlpha, 0.0);
      }
    `,
    uniforms: {
      uAtlas: { value: atlas },
      uColor: { value: new THREE.Color("#bfe0ff") },
      uPixelScale: { value: 1000 },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uFocus: { value: 3 },
      uAperture: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
