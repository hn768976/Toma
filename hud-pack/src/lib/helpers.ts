import * as THREE from "three";

/** Canvas -> texture with mipmaps + anisotropy (keeps thin lines from shimmering). */
export const canvasTexture = (canvas: HTMLCanvasElement, srgb = true) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
};

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
};

/**
 * Additive glow sprite / streak: a quad whose brightness is a soft elliptical falloff.
 * Instanced: per-instance colour (instanceColor) and matrix.
 */
export const glowMaterial = (opts: { core?: number; soft?: number; depthTest?: boolean; tint?: [number, number, number] } = {}) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: opts.depthTest ?? true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uCore: { value: opts.core ?? 6.0 },
      uSoft: { value: opts.soft ?? 0.35 },
      uTint: { value: new THREE.Vector3(...(opts.tint ?? [1, 1, 1])) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vUv = uv * 2.0 - 1.0;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(1.0);
        #endif
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uCore, uSoft;
      uniform vec3 uTint;
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        float r2 = dot(vUv, vUv);
        float a = exp(-r2 * uCore) + uSoft * exp(-r2 * 2.0);
        a *= smoothstep(1.0, 0.7, sqrt(r2));
        gl_FragColor = vec4(vCol * uTint * a, 1.0);
      }`,
  });

/**
 * Depth-only twin of a textured additive plane: writes depth only where the texture
 * (seen through a blurred mip, so a little dilated) has content. Without the mask the
 * whole quad would be "in focus" and show up as a hard sharp rectangle over the blur.
 */
export const maskedDepthMaterial = (map: THREE.Texture, threshold = 0.02) =>
  new THREE.ShaderMaterial({
    transparent: true,
    colorWrite: false,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: { map: { value: map }, uT: { value: threshold } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float uT; varying vec2 vUv;
      void main(){
        vec3 m = texture2D(map, vUv, 3.0).rgb;
        if (max(m.r, max(m.g, m.b)) < uT) discard;
        gl_FragColor = vec4(0.0);
      }`,
  });

/** Depth-only twin of a mesh: lets additive holograms take part in depth of field. */
export const depthOnlyMaterial = () =>
  // transparent so it sorts with the additive pass by renderOrder (drawn after it)
  new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true });
