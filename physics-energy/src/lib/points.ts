import * as THREE from "three";

/**
 * Round dots as GL points. Sizes are in 4K pixels (or world units when
 * `worldSize` is set, with perspective attenuation). Dots smaller than a
 * device pixel keep a 1 px footprint and lose alpha instead, so they don't
 * flicker in the 720p previews.
 */
export interface DotsOptions {
  count: number;
  pxScale: number;
  /** 0 soft glow, 1 hard disc, 2 shaded sphere */
  mode?: number;
  additive?: boolean;
  /** world-size points: projection scale = buffer height / (2 tan(fov/2)) */
  worldSize?: number;
  depthWrite?: boolean;
  depthTest?: boolean;
}

const VERT = /* glsl */ `
in float size;
in vec4 rgba;
uniform float pxScale;
uniform float worldScale; // >0: size is in world units
out vec4 vRgba;
out float vSize;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = worldScale > 0.0 ? size * worldScale / max(-mv.z, 1e-3) : size * pxScale;
  float fade = clamp(s, 0.0, 1.0);
  s = max(s, 1.0);
  vSize = s;
  vRgba = vec4(rgba.rgb, rgba.a * fade * fade);
  gl_PointSize = s + 2.0;
}`;

const FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
in vec4 vRgba;
in float vSize;
uniform float mode;
void main() {
  vec2 q = (gl_PointCoord - 0.5) * (vSize + 2.0);
  float d = length(q);
  float r = vSize * 0.5;
  float a;
  vec3 col = vRgba.rgb;
  if (mode < 0.5) {
    float sg = r * 0.55;
    a = exp(-0.5 * d * d / (sg * sg));
  } else {
    a = clamp(r + 0.5 - d, 0.0, 1.0);
    if (mode > 1.5) {
      vec2 n2 = q / max(r, 1e-3);
      float nz = sqrt(max(0.0, 1.0 - dot(n2, n2)));
      vec3 n = vec3(n2.x, -n2.y, nz);
      float diff = max(dot(n, normalize(vec3(-0.4, 0.6, 0.7))), 0.0);
      float spec = pow(max(dot(n, normalize(vec3(-0.3, 0.5, 1.0))), 0.0), 24.0);
      col = col * (0.55 + 0.6 * diff) + spec * 0.35;
    }
  }
  if (a <= 0.002) discard;
  fragColor = vec4(col, a * vRgba.a);
}`;

export class Dots {
  readonly points: THREE.Points;
  readonly pos: Float32Array;
  readonly rgba: Float32Array;
  readonly size: Float32Array;
  private geo: THREE.BufferGeometry;

  constructor(o: DotsOptions) {
    this.pos = new Float32Array(o.count * 3);
    this.rgba = new Float32Array(o.count * 4);
    this.size = new Float32Array(o.count);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("rgba", new THREE.BufferAttribute(this.rgba, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("size", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        pxScale: { value: o.pxScale },
        worldScale: { value: o.worldSize ?? 0 },
        mode: { value: o.mode ?? 0 },
      },
      transparent: true,
      depthWrite: o.depthWrite ?? false,
      depthTest: o.depthTest ?? true,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
  }

  update() {
    for (const k of ["position", "rgba", "size"]) {
      (this.geo.getAttribute(k) as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose() {
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

/** Projection scale for world-size points with a perspective camera. */
export const worldPointScale = (bufferHeight: number, fovDeg: number) =>
  bufferHeight / (2 * Math.tan((fovDeg * Math.PI) / 360));
