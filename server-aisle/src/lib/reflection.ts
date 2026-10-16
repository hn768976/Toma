import {
  Color,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Material,
  Matrix4,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
  Object3D,
  PerspectiveCamera,
  Plane,
  Scene,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";

/**
 * Planar mirror for a horizontal floor at y = height. Same oblique-clip math
 * as three's Reflector, but updated explicitly once per frame and rendered at
 * reduced resolution into a half-float target, so glowing LEDs stay HDR in
 * the reflection (and bloom picks them up).
 */
export class PlanarReflection {
  readonly target: WebGLRenderTarget;
  readonly textureMatrix = new Matrix4();
  readonly camera = new PerspectiveCamera();
  private readonly hidden: Object3D[] = [];
  private readonly height: number;

  constructor(width: number, height: number, floorHeight = 0) {
    this.height = floorHeight;
    this.target = new WebGLRenderTarget(Math.max(2, Math.round(width)), Math.max(2, Math.round(height)), {
      type: HalfFloatType,
      samples: 0,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: true,
      depthBuffer: true,
    });
  }

  /** Objects hidden while the mirror image is drawn (the floor itself). */
  hide(...objs: Object3D[]) {
    this.hidden.push(...objs);
  }

  update(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
    const normal = new Vector3(0, 1, 0);
    const reflectorPos = new Vector3(camera.position.x, this.height, camera.position.z);
    camera.updateMatrixWorld();
    const camPos = new Vector3().setFromMatrixPosition(camera.matrixWorld);
    const view = new Vector3().subVectors(reflectorPos, camPos);
    view.reflect(normal).negate().add(reflectorPos);
    const rot = new Matrix4().extractRotation(camera.matrixWorld);
    const lookAt = new Vector3(0, 0, -1).applyMatrix4(rot).add(camPos);
    const target = new Vector3().subVectors(reflectorPos, lookAt);
    target.reflect(normal).negate().add(reflectorPos);
    const vc = this.camera;
    vc.position.copy(view);
    vc.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    vc.lookAt(target);
    vc.far = camera.far;
    vc.near = camera.near;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);
    // Oblique near plane (Lengyel) so nothing below the floor leaks in.
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, reflectorPos);
    plane.applyMatrix4(vc.matrixWorldInverse);
    const clip = new Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = vc.projectionMatrix;
    const q = new Vector4(
      (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0],
      (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5],
      -1,
      (1 + pm.elements[10]) / pm.elements[14],
    );
    clip.multiplyScalar(2 / clip.dot(q));
    pm.elements[2] = clip.x;
    pm.elements[6] = clip.y;
    pm.elements[10] = clip.z + 1;
    pm.elements[14] = clip.w;
    vc.projectionMatrixInverse.copy(pm).invert();

    const vis = this.hidden.map((o) => o.visible);
    this.hidden.forEach((o) => (o.visible = false));
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(new Color(0, 0, 0), 1);
    renderer.clear();
    renderer.render(scene, vc);
    renderer.setRenderTarget(prev);
    this.hidden.forEach((o, i) => (o.visible = vis[i]));
  }

  dispose() {
    this.target.dispose();
  }
}

export type FloorOptions = MeshStandardMaterialParameters & {
  reflection: PlanarReflection;
  reflectStrength: number;
  /** Blur radius in reflection-texture UV units. */
  blur: number;
  /** Tile size in metres (x, z); 0 disables seams. */
  tile?: [number, number];
  seamDarken?: number;
  tileVariation?: number;
  /** Mip level added to the blur (smooth, noise-free glossy blur). */
  lod?: number;
  /** Contact shadow along the line z = aoZ (floor at z > aoZ). */
  aoZ?: number;
  /** Contact shadow along both walls |x| = aoX. */
  aoX?: number;
  aoWidth?: number;
  aoStrength?: number;
};

/**
 * Standard PBR floor (so it is lit by the scene's lights) plus a blurred
 * planar reflection added on top with a Fresnel-ish weight, and procedural
 * tile seams. `uTileOffset` scrolls the seams with the scene.
 */
export const makeReflectiveFloorMaterial = (o: FloorOptions) => {
  const { reflection, reflectStrength, blur, tile, seamDarken, tileVariation, lod, aoZ, aoX, aoWidth, aoStrength, ...params } = o;
  const mat = new MeshStandardMaterial(params);
  const uniforms = {
    tRefl: { value: reflection.target.texture },
    uReflMatrix: { value: reflection.textureMatrix },
    uReflStrength: { value: reflectStrength },
    uBlur: { value: blur },
    uTile: { value: new Vector2(...(tile ?? [0, 0])) },
    uTileOffset: { value: new Vector2(0, 0) },
    uSeam: { value: seamDarken ?? 0.3 },
    uTileVar: { value: tileVariation ?? 0.05 },
    uLod: { value: lod ?? 1.5 },
    uAO: { value: new Vector4(aoZ ?? -1e6, aoX ?? 0, aoWidth ?? 0.3, aoStrength ?? 0) },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform mat4 uReflMatrix;\nvarying vec4 vReflCoord;\nvarying vec3 vFloorPos;",
      )
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvec4 fwp = modelMatrix * vec4(transformed, 1.0);\nvReflCoord = uReflMatrix * fwp;\nvFloorPos = fwp.xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D tRefl;
uniform float uReflStrength;
uniform float uBlur;
uniform vec2 uTile;
uniform vec2 uTileOffset;
uniform float uSeam;
uniform float uTileVar;
uniform float uLod;
uniform vec4 uAO;
varying vec4 vReflCoord;
varying vec3 vFloorPos;
float tileHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
if (uTile.x > 0.0) {
  vec2 tp = (vFloorPos.xz + uTileOffset) / uTile;
  vec2 cell = floor(tp);
  vec2 f = fract(tp);
  vec2 fw = fwidth(tp) * 1.5 + 0.004;
  vec2 seam = smoothstep(vec2(0.0), fw * 1.0 + 0.012, f) * smoothstep(vec2(0.0), fw * 1.0 + 0.012, 1.0 - f);
  float s = seam.x * seam.y;
  diffuseColor.rgb *= mix(1.0 - uSeam, 1.0, s) * (1.0 + uTileVar * (tileHash(cell) - 0.5));
}
{
  // Contact shadow where racks meet the floor.
  float dz = vFloorPos.z - uAO.x;
  float dx = uAO.y > 0.0 ? uAO.y - abs(vFloorPos.x) : 1e6;
  float d = min(dz, dx);
  diffuseColor.rgb *= 1.0 - uAO.w * exp(-max(d, 0.0) / uAO.z);
}
`,
      )
      .replace(
        "#include <opaque_fragment>",
        `{
  vec2 ruv = vReflCoord.xy / vReflCoord.w;
  vec3 refl = vec3(0.0);
  float tot = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / 12.0);
    float a = fi * 2.39996323;
    vec2 o = vec2(cos(a), sin(a)) * r * uBlur;
    float w = 1.0 - 0.5 * r;
    refl += textureLod(tRefl, ruv + o * vec2(1.0, 1.6), uLod).rgb * w;
    tot += w;
  }
  refl /= tot;
  vec3 V = normalize(cameraPosition - vFloorPos);
  float fres = 0.35 + 0.65 * pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
  outgoingLight += refl * uReflStrength * fres;
}
#include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => "reflective-floor-v2";
  return { material: mat as Material & MeshStandardMaterial, uniforms };
};
